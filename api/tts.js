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

// Upload WAV buffer to Supabase Storage using service role key (bypasses RLS)
async function uploadToSupabase(wavBuffer, articleId) {
    if (!SUPABASE_URL) console.error('Missing SUPABASE_URL');
    if (!SUPABASE_SERVICE_KEY) console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    if (!articleId) console.error('Missing articleId in uploadToSupabase');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !articleId) return null;
    try {
        const fileName = `${articleId}.wav`;
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

        // Get public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/tts_audio/${fileName}`;

        // Save URL to news table
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/news?id=eq.${articleId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ tts_audio_url: publicUrl })
        });

        if (!updateRes.ok) {
            console.error('Supabase DB update failed:', updateRes.status);
        } else {
            console.log('TTS cached successfully:', publicUrl);
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

    const { text, articleId } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Text is required' });

    const apiKey = GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server' });

    const model = 'gemini-2.5-flash-preview-tts';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        console.log(`TTS API call: ${text.length} chars, articleId: ${articleId || 'none'}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Прочитай цей текст голосом досвідченого диктора українських теленовин. Говори впевнено та енергійно, з живою інтонацією: виділяй важливі факти, роби природні паузи між реченнями, злегка підвищуй тон на ключових словах. Темп помірний — не надто повільний, не поспішай. Звучи як людина, а не робот. Текст: ${text}`
                    }]
                }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
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

            if (data.error.code === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
                const retryAfterMs = parseRetryDelay(msg);
                return res.status(429).json({ error: 'rate_limit', retryAfterMs });
            }

            return res.status(500).json({ error: data.error.message });
        }

        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) {
            console.error('No audio in Gemini response:', JSON.stringify(data).slice(0, 300));
            return res.status(500).json({ error: 'No audio data in Gemini response' });
        }

        const pcmBuffer = Buffer.from(audioBase64, 'base64');
        const wavBuffer = pcmToWav(pcmBuffer);

        console.log(`TTS success: ${pcmBuffer.length} PCM → ${wavBuffer.length} WAV bytes, articleId: ${articleId || 'none'}`);

        // Upload to Supabase Storage server-side (bypasses RLS using service role key)
        if (articleId) {
            console.log(`Starting persistence for articleId: ${articleId}`);
            try {
                const persistenceResult = await uploadToSupabase(wavBuffer, articleId);
                if (persistenceResult) {
                    console.log(`Persistence successful: ${persistenceResult}`);
                    res.setHeader('X-TTS-Cached-URL', persistenceResult);
                } else {
                    console.error(`Persistence returned null (check SUPABASE_SERVICE_ROLE_KEY or SQL setup)`);
                }
            } catch (err) {
                console.error(`Persistence failed: ${err.message}`);
            }
        }

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', wavBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.status(200).send(wavBuffer);

    } catch (err) {
        console.error('TTS server error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
