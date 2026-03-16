const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            // Public or Admin fetch
            const { id, active_only } = req.query;
            let query = supabase.from('popups').select('*');

            if (id) {
                query = query.eq('id', id).single();
            } else if (active_only === 'true') {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;
            if (error) throw error;
            return res.status(200).json(data);
        }

        // POST/PUT/DELETE require admin token
        const token = req.headers.authorization?.split(' ')[1] || req.query.token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const authRes = await fetch(`${process.env.SITE_URL || 'http://localhost:3000'}/api/admin-auth?token=${encodeURIComponent(token)}`);
        const authData = await authRes.json();
        if (!authData.valid) return res.status(401).json({ error: 'Invalid token' });

        if (method === 'POST') {
            const { name, is_active, content_html, image_url, config } = req.body;
            const { data, error } = await supabase.from('popups').insert([{
                name, is_active, content_html, image_url, config
            }]).select();
            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'PUT') {
            const { id } = req.query;
            const updates = req.body;
            delete updates.id;
            delete updates.created_at;

            const { data, error } = await supabase.from('popups').update(updates).eq('id', id).select();
            if (error) throw error;
            return res.status(200).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const { error } = await supabase.from('popups').delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (e) {
        console.error('Popup API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
