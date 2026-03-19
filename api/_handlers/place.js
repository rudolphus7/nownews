const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

async function fetchFromSupabase(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) return null;
    return res.json();
}

module.exports = async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(404).send('Place ID missing');

    try {
        const placeArr = await fetchFromSupabase('places', `id=eq.${id}&select=*`);
        const place = (placeArr && placeArr.length > 0) ? placeArr[0] : null;

        if (!place) return res.status(404).send('Place not found');

        const templatePath = path.join(process.cwd(), 'place_detail.html');
        let html = fs.readFileSync(templatePath, 'utf8');

        // Inject data
        html = html.replace('id="place-title">', `id="place-title">${place.name}`);
        html = html.replace('id="place-description">', `id="place-description">${place.description || ''}`);
        html = html.replace('id="place-address">', `id="place-address">${place.address || '--'}`);
        html = html.replace('id="place-phone">', `id="place-phone">${place.phone || '--'}`);
        html = html.replace('id="place-category">', `id="place-category">${place.category || 'Заклад'}`);
        html = html.replace('src="" alt="Place Image"', `src="${place.image_url || '/logo.png'}" alt="${place.name}"`);

        // Inject header (reuse from city/portal logic if needed, or define in template)
        // For now, simple injection
        const headerHtml = `<div class="bg-white/95 backdrop-blur-xl fixed top-0 w-full z-50 p-6 border-b border-slate-100">
            <div class="container mx-auto flex justify-between items-center">
                <a href="/" class="flex items-center gap-3">
                    <img src="/logo_footer.png" class="w-20">
                    <span class="font-black text-slate-900 tracking-tighter uppercase">KALUSH <span class="text-orange-600">NEWS</span></span>
                </a>
                <a href="#" onclick="history.back()" class="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600">Назад</a>
            </div>
        </div>`;
        html = html.replace('<div id="site-header-placeholder"></div>', headerHtml);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    } catch (e) {
        console.error('Place Handler Error:', e);
        return res.status(500).send('Server Error');
    }
};
