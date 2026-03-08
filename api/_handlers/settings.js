const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

module.exports = async (req, res) => {
    // Встановлюємо заголовки CORS (хоча Vercel зазвичай це хендлить)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key,value`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!r.ok) {
                const err = await r.text();
                console.error("Supabase GET error:", err);
                return res.status(500).json({ error: 'Failed to fetch settings' });
            }

            const data = await r.json();
            const settingsObj = {};
            if (data) {
                data.forEach(item => {
                    settingsObj[item.key] = item.value;
                });
            }

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return res.status(200).json(settingsObj);
        }
        else if (req.method === 'POST') {
            // Очікуємо об'єкт з налаштуваннями: { key1: value1, key2: value2 }
            const settings = req.body;

            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ error: 'Invalid settings format' });
            }

            // Готуємо масив для upsert
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value: String(value),
                updated_at: new Date().toISOString()
            }));

            if (updates.length > 0) {
                const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?on_conflict=key`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    },
                    body: JSON.stringify(updates)
                });

                if (!r.ok) {
                    const err = await r.text();
                    console.error("Supabase POST error:", err);
                    return res.status(500).json({ error: 'Failed to save settings' });
                }
            }

            return res.status(200).json({ success: true, message: 'Settings saved successfully' });
        }
        else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err) {
        console.error("Unexpected API error:", err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
