const { createClient } = require('@supabase/supabase-js');

// Init Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const supabase = createClient(supabaseUrl, supabaseKey);

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
            const { data, error } = await supabase
                .from('settings')
                .select('key, value');

            if (error) {
                console.error("Supabase GET error:", error);
                return res.status(500).json({ error: error.message });
            }

            // Перетворюємо масив [{key: 'a', value: '1'}] на об'єкт {a: '1'}
            const settingsObj = {};
            if (data) {
                data.forEach(item => {
                    settingsObj[item.key] = item.value;
                });
            }

            res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
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
                const { error } = await supabase
                    .from('settings')
                    .upsert(updates, { onConflict: 'key' });

                if (error) {
                    console.error("Supabase POST error:", error);
                    return res.status(500).json({ error: error.message });
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
