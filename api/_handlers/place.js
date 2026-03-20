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
        html = html.replace(/<span id="place-category"[^>]*>.*?<\/span>/s, `<span id="place-category" class="bg-orange-600 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2.5 rounded-full shadow-xl shadow-orange-600/40">${place.category_name || 'Заклад'}</span>`);
        html = html.replace('id="place-hero-blur" class="hero-bg-blur"', `id="place-hero-blur" class="hero-bg-blur" style="background-image: url('${place.image_url || '/logo_footer.png'}')"`);
        html = html.replace('id="place-image" src=""', `id="place-image" src="${place.image_url || '/logo_footer.png'}"`);

        // Generate Premium Rating Stars (SVG)
        const rating = Math.round(place.rating || 0);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const opacity = i <= rating ? 'opacity-100' : 'opacity-20';
            const color = i <= rating ? 'text-orange-500' : 'text-white';
            starsHtml += `
                <svg class="w-5 h-5 md:w-8 md:h-8 ${opacity} ${color} drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.286 3.97c.3.921-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.175 0l-3.388 2.46c-.784.57-1.838-.197-1.539-1.118l1.286-3.97a1 1 0 00-.364-1.118L2.245 9.397c-.783-.57-.38-1.81.588-1.81h4.181a1 1 0 00.951-.69l1.286-3.97z" />
                </svg>`;
        }
        html = html.replace(/<div id="place-rating"[^>]*>.*?<\/div>/s, `<div id="place-rating" class="flex gap-1 md:gap-2">${starsHtml}</div>`);

        // Inject dynamic links
        html = html.replace('id="place-nav-link" href="#"', `id="place-nav-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}"`);
        html = html.replace('id="place-phone-link" href="tel:"', `id="place-phone-link" href="tel:${place.phone || ''}"`);

        // Inject header (reuse dark glass design)
        const headerHtml = `
        <div class="fixed top-0 w-full z-[100] px-4 py-4 md:px-10">
            <div class="container mx-auto px-4 md:px-8 py-3 bg-[#020617]/60 backdrop-blur-[40px] rounded-[3rem] border border-white/10 flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] header-nav-main">
                <a href="https://kalush.bukva.news/" class="flex items-center gap-3 md:gap-4 group transition-all header-brand-box">
                    <img src="/logo_footer.png" class="w-10 md:w-14 group-hover:scale-110 transition duration-500 header-brand-logo">
                    <div class="flex flex-col leading-[0.9]">
                        <span class="font-black text-white tracking-tighter uppercase text-base md:text-2xl header-brand-text">КАЛУШ</span>
                        <span class="font-black text-orange-600 tracking-tighter uppercase text-base md:text-2xl header-brand-text">ПОРТАЛ</span>
                    </div>
                </a>
                <div class="flex items-center gap-3 md:gap-6 header-links-box">
                    <a href="https://bukva.news/" class="hidden md:flex items-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] hover:text-white transition-all px-4 py-2">
                        Новини
                    </a>
                    <a href="https://kalush.bukva.news/" class="px-5 md:px-10 py-3.5 md:py-4 bg-white/5 border border-white/10 rounded-full text-[9px] md:text-[10px] font-black uppercase text-white tracking-[0.15em] md:tracking-[0.2em] hover:bg-orange-600 hover:border-orange-600 transition-all shadow-xl active:scale-95 header-btn-home">
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
