const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { id, active_only } = req.query;
            let apiUrl = `${SUPABASE_URL}/rest/v1/popups?select=*`;

            if (id) {
                apiUrl += `&id=eq.${id}&limit=1`;
            } else if (active_only === 'true') {
                apiUrl += `&is_active=eq.true`;
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!response.ok) throw new Error(`Supabase GET failed: ${response.status}`);
            const data = await response.json();
            return res.status(200).json(id ? data[0] : data);
        }

        // POST/PUT/DELETE require admin token
        const token = req.headers.authorization?.split(' ')[1] || req.query.token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const authRes = await fetch(`${process.env.SITE_URL || 'https://bukva.news'}/api/admin-auth?token=${encodeURIComponent(token)}`);
        const authData = await authRes.json();
        if (!authData.valid) return res.status(401).json({ error: 'Invalid token' });

        if (method === 'POST') {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/popups`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(req.body)
            });
            if (!response.ok) throw new Error(`Supabase POST failed: ${response.status}`);
            const data = await response.json();
            return res.status(201).json(data[0]);
        }

        if (method === 'PUT') {
            const { id } = req.query;
            const updates = { ...req.body };
            delete updates.id;
            delete updates.created_at;

            const response = await fetch(`${SUPABASE_URL}/rest/v1/popups?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updates)
            });
            if (!response.ok) throw new Error(`Supabase PUT failed: ${response.status}`);
            const data = await response.json();
            return res.status(200).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const response = await fetch(`${SUPABASE_URL}/rest/v1/popups?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            if (!response.ok) throw new Error(`Supabase DELETE failed: ${response.status}`);
            return res.status(200).json({ success: true });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (e) {
        console.error('Popup API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
