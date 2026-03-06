const SUPABASE_URL = 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

async function test() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=image_url&limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    const data = await res.json();
    if (data && data.length > 0) {
        const originalUrl = data[0].image_url;
        console.log("Original:", originalUrl);

        let transformUrl = originalUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        transformUrl += '?width=500&quality=70';
        console.log("Transform:", transformUrl);

        const imgRes = await fetch(transformUrl, { method: 'HEAD' });
        console.log("Transform response:", imgRes.status);
    }
}
test();
