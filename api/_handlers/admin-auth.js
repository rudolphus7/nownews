/**
 * /api/admin-auth.js — Серверна аутентифікація адмінки
 *
 * POST /api/admin-auth  { password: "..." }  → { token: "...", ok: true }
 * GET  /api/admin-auth?token=...             → { valid: true/false }
 *
 * Пароль задається через змінну середовища ADMIN_PASSWORD у Vercel.
 * Токен — HMAC-SHA256 підписаний рядок із часом дії (48 год).
 */

const { signToken, verifyToken } = require('./_auth_utils');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

// Секрет для підпису токенів — встановіть JWT_SECRET у Vercel Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || 'if-news-admin-secret-change-me-in-vercel';
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD || 'ifnews2024';
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 годин

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

        // 1. Check against Environment Variable(s)
        const envPasswords = ADMIN_PASSWORD_ENV.split(',').map(p => p.trim()).filter(Boolean);
        let match = false;
        let role = 'staff';

        const crypto = require('crypto'); // Need for timingSafeEqual here or move to utils

        for (const p of envPasswords) {
            const inputBuf = Buffer.from(password);
            const correctBuf = Buffer.from(p);
            if (inputBuf.length === correctBuf.length && crypto.timingSafeEqual(inputBuf, correctBuf)) {
                match = true;
                role = 'admin';
                break;
            }
        }

        // 2. Check against Database (Settings table)
        if (!match) {
            try {
                const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.additional_admin_passwords&select=value`, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                });
                if (r.ok) {
                    const data = await r.json();
                    if (data && data.length > 0 && data[0].value) {
                        const dbPasswords = data[0].value.split(',').map(p => p.trim()).filter(Boolean);
                        for (const p of dbPasswords) {
                            const inputBuf = Buffer.from(password);
                            const correctBuf = Buffer.from(p);
                            if (inputBuf.length === correctBuf.length && crypto.timingSafeEqual(inputBuf, correctBuf)) {
                                match = true;
                                role = 'staff'; // Additional passwords are staff
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('DB Auth check failed:', err);
            }
        }

        if (!match) {
            // Small delay to slow down brute force
            await new Promise(r => setTimeout(r, 500));
            return res.status(401).json({ ok: false, error: 'Невірний пароль' });
        }

        const token = signToken({
            role: role,
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
