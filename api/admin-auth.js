/**
 * /api/admin-auth.js — Серверна аутентифікація адмінки
 *
 * POST /api/admin-auth  { password: "..." }  → { token: "...", ok: true }
 * GET  /api/admin-auth?token=...             → { valid: true/false }
 *
 * Пароль задається через змінну середовища ADMIN_PASSWORD у Vercel.
 * Токен — HMAC-SHA256 підписаний рядок із часом дії (48 год).
 */

const crypto = require('crypto');

// Секрет для підпису токенів — встановіть JWT_SECRET у Vercel Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || 'if-news-admin-secret-change-me-in-vercel';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ifnews2024';
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 годин

function signToken(payload) {
    const data = JSON.stringify(payload);
    const b64 = Buffer.from(data).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
    return `${b64}.${sig}`;
}

function verifyToken(token) {
    try {
        const [b64, sig] = token.split('.');
        if (!b64 || !sig) return null;
        const expected = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
        // Constant-time comparison to prevent timing attacks
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
        if (Date.now() > payload.exp) return null; // expired
        return payload;
    } catch {
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- POST: логін ---
    if (req.method === 'POST') {
        let body = {};
        try {
            if (typeof req.body === 'object') {
                body = req.body;
            } else {
                body = JSON.parse(req.body || '{}');
            }
        } catch {
            return res.status(400).json({ ok: false, error: 'Invalid JSON' });
        }

        const { password } = body;

        if (!password) {
            return res.status(400).json({ ok: false, error: 'Password required' });
        }

        // Constant-time password compare
        const inputBuf = Buffer.from(password);
        const correctBuf = Buffer.from(ADMIN_PASSWORD);
        const match = inputBuf.length === correctBuf.length &&
            crypto.timingSafeEqual(inputBuf, correctBuf);

        if (!match) {
            // Small delay to slow down brute force
            await new Promise(r => setTimeout(r, 500));
            return res.status(401).json({ ok: false, error: 'Невірний пароль' });
        }

        const token = signToken({
            role: 'admin',
            iat: Date.now(),
            exp: Date.now() + TOKEN_TTL_MS
        });

        return res.status(200).json({ ok: true, token });
    }

    // --- GET: перевірка токена ---
    if (req.method === 'GET') {
        const token = req.query.token;
        if (!token) return res.status(400).json({ valid: false, error: 'No token' });

        const payload = verifyToken(token);
        if (!payload) return res.status(401).json({ valid: false, error: 'Invalid or expired token' });

        return res.status(200).json({ valid: true, role: payload.role });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
