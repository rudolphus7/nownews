const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── POST /api/subscribe — save new email ──────────────────────────────
    if (req.method === 'POST') {
        const { email } = req.body || {};
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ ok: false, error: 'Невірний формат email' });
        }

        const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                email: email.toLowerCase().trim(),
                subscribed_at: new Date().toISOString(),
                status: 'active',
                source: req.headers['referer'] || 'website'
            })
        });

        if (r.status === 409) {
            return res.status(409).json({ ok: false, error: 'Цей email вже підписаний' });
        }
        if (!r.ok) {
            const err = await r.text();
            console.error('Supabase subscriber insert error:', err);
            return res.status(500).json({ ok: false, error: 'Помилка сервера' });
        }

        return res.status(200).json({ ok: true, message: 'Дякуємо за підписку!' });
    }

    // ── GET /api/subscribe — list subscribers (admin only) ────────────────
    if (req.method === 'GET') {
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        // Validate admin token via admin-auth
        const authRes = await fetch(`${process.env.SITE_URL || 'https://bukva.news'}/api/admin-auth?token=${encodeURIComponent(token)}`);
        const authData = await authRes.json();
        if (!authData.valid) return res.status(401).json({ error: 'Unauthorized' });

        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/subscribers?select=*&order=subscribed_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await r.json();
        return res.status(200).json(data);
    }

    // ── DELETE /api/subscribe?id=xxx — unsubscribe ────────────────────────
    if (req.method === 'DELETE') {
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
        const id = req.query.id;
        if (!token || !id) return res.status(400).json({ error: 'Missing params' });

        const authRes = await fetch(`${process.env.SITE_URL || 'https://bukva.news'}/api/admin-auth?token=${encodeURIComponent(token)}`);
        const authData = await authRes.json();
        if (!authData.valid) return res.status(401).json({ error: 'Unauthorized' });

        await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
