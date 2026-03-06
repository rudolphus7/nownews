const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

async function test() {
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    };
    const fetchHeaders = { ...headers, 'Range': '0-4999' };

    console.log("Fetching posts...");
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=slug,updated_at,created_at,city,category&order=created_at.desc`, {
            method: 'GET',
            headers: fetchHeaders
        });

        console.log("Status:", response.status, response.statusText);
        const text = await response.text();
        console.log("Response text length:", text.length);
        if (text.length > 0) {
            console.log("First 100 chars:", text.substring(0, 100));
            try {
                const arr = JSON.parse(text);
                console.log("Array length:", arr.length);
            } catch (e) {
                console.error("Parse error:", e);
            }
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}
test();
