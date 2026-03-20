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
        html = html.replace(/<h1 id="place-title"[^>]*>.*?<\/h1>/s, `<h1 id="place-title" class="text-6xl md:text-[120px] font-black text-white uppercase tracking-tighter leading-[0.8] italic">${place.name}</h1>`);
        html = html.replace(/<div id="place-description"[^>]*>.*?<\/div>/s, `<div id="place-description" class="text-slate-300 text-lg md:text-xl leading-relaxed font-medium">${place.description || ''}</div>`);
        html = html.replace(/<div id="place-address"[^>]*>.*?<\/div>/s, `<div id="place-address" class="font-bold text-[15px] truncate">${place.address || '--'}</div>`);
        html = html.replace(/<div id="place-phone"[^>]*>.*?<\/div>/s, `<div id="place-phone" class="font-bold text-[15px] truncate">${place.phone || '--'}</div>`);
        html = html.replace(/<span id="place-category"[^>]*>.*?<\/span>/s, `<span id="place-category" class="bg-orange-600 text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-lg shadow-orange-600/20">${place.category || 'Заклад'}</span>`);
        html = html.replace('id="place-hero-blur" class="hero-bg-blur"', `id="place-hero-blur" class="hero-bg-blur" style="background-image: url('${place.image_url || '/logo_footer.png'}')"`);
        html = html.replace('id="place-image" src=""', `id="place-image" src="${place.image_url || '/logo_footer.png'}"`);

        // Inject dynamic links
        html = html.replace('id="place-nav-link" href="#"', `id="place-nav-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}"`);
        html = html.replace('id="place-phone-link" href="tel:"', `id="place-phone-link" href="tel:${place.phone || ''}"`);

        // Inject header (reuse dark glass design)
        const headerHtml = `
        <div class="fixed top-0 w-full z-50 px-4 py-4 md:px-10">
            <div class="container mx-auto px-6 py-4 bg-[#020617]/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex justify-between items-center shadow-2xl header-nav-main">
                <a href="https://kalush.bukva.news/" class="flex items-center gap-4 group transition-all header-brand-box">
                    <img src="/logo_footer.png" class="w-10 md:w-14 group-hover:scale-110 transition duration-500 header-brand-logo">
                    <div class="flex flex-col leading-none">
                        <span class="font-black text-white tracking-tighter uppercase text-base md:text-2xl header-brand-text">КАЛУШ</span>
                        <span class="font-black text-orange-600 tracking-tighter uppercase text-base md:text-2xl header-brand-text">ПОРТАЛ</span>
                    </div>
                </a>
                <div class="flex items-center gap-3 md:gap-6 header-links-box">
                    <a href="https://bukva.news/" class="hidden md:flex items-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] hover:text-white transition-all px-4 py-2">
                        Новини
                    </a>
                    <a href="https://kalush.bukva.news/" class="px-6 md:px-10 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] text-[10px] font-black uppercase text-white tracking-[0.2em] hover:bg-orange-600 hover:border-orange-600 transition-all shadow-xl active:scale-95 header-btn-home">
                        На головну
                    </a>
                </div>
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
