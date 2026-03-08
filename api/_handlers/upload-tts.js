// /api/upload-tts.js - Endpoint to upload compressed MP3 from admin panel
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-article-id');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const articleId = req.headers['x-article-id'];
    if (!articleId) return res.status(400).json({ error: 'x-article-id header is required' });

    // Read the binary body
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const mp3Buffer = Buffer.concat(chunks);

    if (mp3Buffer.length === 0) return res.status(400).json({ error: 'Empty audio data' });

    console.log(`Uploading MP3 for ${articleId}, size: ${mp3Buffer.length} bytes`);

    try {
        const fileName = `${articleId}.mp3`;
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/tts_audio/${fileName}`;

        // 1. Upload to Storage
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'audio/mpeg',
                'x-upsert': 'true'
            },
            body: mp3Buffer
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Storage upload failed: ${uploadRes.status} ${errText}`);
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/tts_audio/${fileName}`;

        // 2. Update Database
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
            throw new Error(`Database update failed: ${updateRes.status}`);
        }

        return res.status(200).json({ success: true, url: publicUrl });

    } catch (err) {
        console.error('Upload error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
