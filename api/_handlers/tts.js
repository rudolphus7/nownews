// /api/tts.js - Server-side Gemini TTS proxy with Supabase caching
// Flow: Check cache in DB → return cached URL, or Generate → Upload → Save URL → Return audio

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
    const dataLength = pcmBuffer.length;
    const buffer = Buffer.alloc(44 + dataLength);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
    buffer.writeUInt16LE(channels * (bitDepth / 8), 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
}

function parseRetryDelay(message) {
    const match = message && message.match(/retry in ([\d.]+)s/i);
    return match ? Math.ceil(parseFloat(match[1]) * 1000) : 60000;
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Upload WAV buffer to Supabase Storage using service role key
async function uploadToSupabase(wavBuffer, articleId, fileName) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !articleId || !fileName) return null;
    try {
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/tts_audio/${fileName}`;

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'audio/wav',
                'x-upsert': 'true'
            },
            body: wavBuffer
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error('Supabase upload failed:', uploadRes.status, errText.slice(0, 200));
            return null;
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/tts_audio/${fileName}`;

        // If it's the primary file (not an explicit part), save URL to news table
        if (!fileName.includes('_part_')) {
            await fetch(`${SUPABASE_URL}/rest/v1/news?id=eq.${articleId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ tts_audio_url: publicUrl })
            });
        }

        return publicUrl;
    } catch (err) {
        console.error('Supabase upload exception:', err.message);
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text, articleId, chunkIndex, totalChunks } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Text is required' });

    const apiKey = GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server' });

    // 1. Deterministic filename for caching
    let fileName = null;
    if (articleId) {
        fileName = (totalChunks > 1) ? `${articleId}_part_${chunkIndex}.wav` : `${articleId}.wav`;
    }

    // 2. Cache Check: If file exists in storage, return it directly
    if (fileName && req.query.skipCache !== 'true' && req.body.skipCache !== true) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/tts_audio/${fileName}`;
        try {
            const headRes = await fetch(publicUrl, { method: 'HEAD' });
            if (headRes.ok) {
                console.log(`TTS Cache Hit: ${fileName}`);
                res.setHeader('X-TTS-Cached-URL', publicUrl);
                const audioRes = await fetch(publicUrl);
                const audioBuffer = await audioRes.arrayBuffer();
                res.setHeader('Content-Type', 'audio/wav');
                return res.status(200).send(Buffer.from(audioBuffer));
            }
        } catch (e) {
            console.warn("Cache check failed, generating fresh audio...");
        }
    }

    const model = 'gemini-2.5-flash-preview-tts';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        console.log(`TTS API call: ${text.length} chars, articleId: ${articleId || 'none'}, part: ${chunkIndex || 0}`);

        // Derive deterministic seed from articleId to stabilize voice across chunks
        const seedValue = articleId ? hashCode(articleId.toString()) : undefined;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Прочитай цей текст голосом досвідченого диктора українських теленовин. Говори впевнено та енергійно, з живою інтонацією. Текст: ${text}`
                    }]
                }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    seed: seedValue,
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Charon' }
                        }
                    }
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            const msg = data.error.message || '';
            console.error('Gemini API Error:', data.error.code, msg.slice(0, 100));
            if (data.error.code === 429) {
                return res.status(429).json({ error: 'rate_limit', retryAfterMs: parseRetryDelay(msg) });
            }
            return res.status(500).json({ error: data.error.message });
        }

        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) return res.status(500).json({ error: 'No audio data received' });

        const pcmBuffer = Buffer.from(audioBase64, 'base64');
        const wavBuffer = pcmToWav(pcmBuffer);

        if (articleId && fileName) {
            uploadToSupabase(wavBuffer, articleId, fileName).then(url => {
                if (url) console.log(`Async upload finished: ${url}`);
            });
        }

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.status(200).send(wavBuffer);

    } catch (err) {
        console.error('TTS server error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
