const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'if-news-admin-secret-change-me-in-vercel';

function signToken(payload) {
    const data = JSON.stringify(payload);
    const b64 = Buffer.from(data).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
    return `${b64}.${sig}`;
}

function verifyToken(token) {
    if (!token) return null;
    try {
        const [b64, sig] = token.split('.');
        if (!b64 || !sig) return null;
        const expected = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = { signToken, verifyToken };
