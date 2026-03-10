// /api/_handlers/index-ping.js - Notifies Google Indexing API about URL updates
const crypto = require('crypto');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url, type = 'URL_UPDATED' } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    console.log(`Sending indexing ping for: ${url} (${type})`);

    const configJson = process.env.GOOGLE_INDEXING_JSON;
    if (!configJson) {
        return res.status(500).json({ error: 'GOOGLE_INDEXING_JSON env variable not found in Vercel. Please add it in project settings.' });
    }

    try {
        let config;
        try {
            config = JSON.parse(configJson);
        } catch (e) {
            throw new Error('Failed to parse GOOGLE_INDEXING_JSON. Ensure it is a valid JSON object.');
        }

        const accessToken = await getAccessToken(config);

        const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                url: url,
                type: type
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Google API error: ${JSON.stringify(data)}`);
        }

        console.log('✅ Indexing ping successful:', url);
        return res.status(200).json({ success: true, data });

    } catch (err) {
        console.error('Indexing Ping Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

async function getAccessToken(config) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: config.client_email,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedClaim = base64url(JSON.stringify(claim));

    const signatureInput = `${encodedHeader}.${encodedClaim}`;

    // Sign using RSA-SHA256
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    signer.end();

    const signature = signer.sign(config.private_key, 'base64');
    const encodedSignature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const jwt = `${signatureInput}.${encodedSignature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Token fetch failed: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

function base64url(str) {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
