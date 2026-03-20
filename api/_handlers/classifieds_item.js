const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

async function fetchFromSupabase(table, id) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
}

const CAT_MAP = {
    'sale': 'Купівля / Продаж',
    'rent': 'Оренда нерухомості',
    'services': 'Послуги та сервіс',
    'job': 'Робота / Вакансії',
    'auto': 'Авто та транспорт',
    'other': 'Різне'
};

module.exports = async (req, res) => {
    const { id } = req.query;

    if (!id) return res.status(404).send('Not Found');

    try {
        const ad = await fetchFromSupabase('classifieds', id);
        if (!ad) return res.status(404).send('Ad not found');

        const templatePath = path.join(process.cwd(), 'classifieds_detail.html');
        let html = fs.readFileSync(templatePath, 'utf8');

        // Dynamic Data
        html = html.replace(/<title id="page-title">.*?<\/title>/, `<title id="page-title">${ad.title} | Оголошення</title>`);
        html = html.replace(/<h1 id="ad-title"[^>]*>.*?<\/h1>/, `<h1 id="ad-title" class="text-3xl md:text-5xl font-black mt-6 leading-tight tracking-tighter uppercase italic">${ad.title}</h1>`);
        html = html.replace(/<span id="ad-category"[^>]*>.*?<\/span>/, `<span id="ad-category" class="bg-orange-600/10 text-orange-600 border border-orange-600/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">${CAT_MAP[ad.category] || ad.category}</span>`);
        html = html.replace(/<div id="ad-price"[^>]*>.*?<\/div>/, `<div id="ad-price" class="text-4xl font-black text-orange-500 mt-4 tracking-tight">${ad.price ? ad.price + ' <span class="text-xl text-slate-500/60 font-bold uppercase tracking-tighter">грн</span>' : 'Договірна'}</div>`);
        html = html.replace(/<p id="ad-desc"[^>]*>.*?<\/p>/, `<p id="ad-desc" class="text-slate-400 text-lg leading-relaxed font-medium">${ad.description || 'Опис відсутній'}</p>`);
        html = html.replace('id="call-link" href="tel:"', `id="call-link" href="tel:${ad.contact_phone}"`);
        
        if (ad.image_url) {
            html = html.replace('id="ad-image" src=""', `id="ad-image" src="${ad.image_url}"`);
        } else {
            // Placeholder if no image
            html = html.replace('id="ad-image" src=""', `id="ad-image" src="https://via.placeholder.com/800x800?text=No+Photo"`);
        }

        if (ad.is_featured) {
            html = html.replace('id="vip-badge" class="absolute top-6 left-6 bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hidden shadow-2xl"', 'id="vip-badge" class="absolute top-6 left-6 bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex shadow-2xl"');
        }

        // Phone Spoiler
        const phone = ad.contact_phone || 'Не вказано';
        const maskedPhone = phone.length > 5 ? phone.substring(0, phone.length - 4) + '****' : phone;
        html = html.replace('8800555****', maskedPhone);
        html = html.replace("let fullPhone = '';", `let fullPhone = '${phone}';`);

        // Gallery
        if (ad.gallery && Array.isArray(ad.gallery) && ad.gallery.length > 0) {
            const galleryHtml = ad.gallery.map(img => `
                <div class="aspect-square rounded-xl overflow-hidden cursor-zoom-in border border-white/5 hover:border-orange-600/50 transition-all" onclick="openLightbox('${img}')">
                    <img src="${img}" class="w-full h-full object-cover">
                </div>
            `).join('');
            html = html.replace('id="gallery-container" class="mt-12 grid grid-cols-4 md:grid-cols-6 gap-4 hidden"', 'id="gallery-container" class="mt-12 grid grid-cols-4 md:grid-cols-6 gap-4 flex"');
            html = html.replace('<!-- Thumbs inserted here -->', galleryHtml);
        }

        // Shared Header
        const headerHtml = `
    <!-- Premium Unified Header -->
    <header class="fixed top-0 left-0 w-full z-[100] p-4 md:p-8 pointer-events-none transition-all duration-500" id="main-header">
        <div class="container mx-auto pointer-events-auto max-w-7xl">
            <div class="glass flex items-center justify-between px-6 md:px-12 py-3 md:py-5 bg-[#020617]/40 backdrop-blur-[50px] border-white/10 shadow-2xl rounded-full">
                <div class="flex items-center gap-4 md:gap-6">
                    <a href="https://kalush.bukva.news/" class="relative group block flex items-center gap-3 md:gap-5">
                        <img src="/logo_footer.png" class="w-10 md:w-16 h-auto object-contain group-hover:scale-110 transition duration-500" alt="Logo">
                        <div class="flex flex-col text-left">
                            <div class="font-black text-lg md:text-2xl tracking-tighter uppercase leading-none text-white italic">КАЛУШ <span class="text-orange-600">ПОРТАЛ</span></div>
                            <div class="text-[8px] md:text-[10px] font-bold opacity-30 uppercase tracking-[0.2em] mt-1.5 hidden md:block text-left">Premium City Guide System</div>
                        </div>
                    </a>
                </div>
                <nav class="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <a href="/places/all/" class="hover:text-orange-500 transition-all">Заклади</a>
                    <a href="/classifieds/all/" class="hover:text-orange-500 transition-all">Оголошення</a>
                    <a href="https://bukva.news/" class="hover:text-orange-500 transition-all">Новини</a>
                    <a href="https://bukva.news/contacts" class="hover:text-orange-500 transition-all">Контакти</a>
                </nav>
                <div class="flex items-center gap-4">
                    <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
                </div>
            </div>
        </div>
    </header>
    <!-- Mobile Menu Overlay -->
    <div class="mobile-menu" id="mobile-menu">
        <div class="mobile-menu-close-area" onclick="toggleMenu()"></div>
        <div class="mobile-menu-bg-logo">B</div>
        <a href="https://bukva.news/" onclick="toggleMenu()">Новини</a>
        <a href="/classifieds/all/" onclick="toggleMenu()">Оголошення</a>
        <a href="/places/all/" onclick="toggleMenu()">Заклади</a>
        <a href="https://bukva.news/contacts" onclick="toggleMenu()">Контакти</a>
        <div class="mt-10 pt-10 border-t border-white/5 w-64 text-center">
            <div class="text-[10px] font-black uppercase opacity-20 tracking-[0.5em] mb-4">БЛОКИ ГРОМАДИ 2026</div>
        </div>
    </div>`;
        html = html.replace('<div id="site-header-placeholder"></div>', headerHtml);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    } catch (e) {
        console.error('Classifieds Detail Error:', e);
        return res.status(500).send('Server Error');
    }
};
