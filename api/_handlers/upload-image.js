// /api/_handlers/upload-image.js - Endpoint to upload optimized images to Supabase Storage
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-file-name');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const fileName = req.headers['x-file-name'] || `${Date.now()}.webp`;

    // Read the binary body
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) return res.status(400).json({ error: 'Empty image data' });

    console.log(`Uploading optimized image: ${fileName}, size: ${buffer.length} bytes`);

    try {
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/news/${fileName}`;

        // 1. Upload to Supabase Storage (news bucket)
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'image/webp', // Defaulting to webp as we optimize client-side
                'x-upsert': 'true'
            },
            body: buffer
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();

            // If bucket not found, try to create it and retry upload once
            if (uploadRes.status === 404 || errText.includes('Bucket not found')) {
                console.log(`Bucket "news" not found. Attempting to create...`);

                const createBucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: 'news',
                        name: 'news',
                        public: true,
                        file_size_limit: 5242880, // 5MB
                        allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png']
                    })
                });

                if (createBucketRes.ok || createBucketRes.status === 409) { // 409 means already exists (race condition)
                    console.log(`Bucket "news" created or already exists. Retrying upload...`);
                    // Retry upload
                    const retryRes = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'image/webp',
                            'x-upsert': 'true'
                        },
                        body: buffer
                    });

                    if (retryRes.ok) {
                        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/news/${fileName}`;
                        return res.status(200).json({ success: true, url: publicUrl, size: buffer.length });
                    }

                    const retryErr = await retryRes.text();
                    throw new Error(`Retry failed: ${retryRes.status} ${retryErr}`);
                } else {
                    const createErr = await createBucketRes.text();
                    throw new Error(`Failed to create bucket "news": ${createBucketRes.status} ${createErr}`);
                }
            }

            throw new Error(`Storage upload failed: ${uploadRes.status} ${errText}`);
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/news/${fileName}`;

        return res.status(200).json({
            success: true,
            url: publicUrl,
            size: buffer.length
        });

    } catch (err) {
        console.error('Image Upload error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
