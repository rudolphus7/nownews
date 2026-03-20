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

const CAT_MAP = {
    'sale': 'Купівля / Продаж',
    'rent': 'Оренда нерухомості',
    'services': 'Послуги та сервіс',
    'job': 'Робота / Вакансії',
    'auto': 'Авто та транспорт',
    'other': 'Різне'
};

module.exports = async (req, res) => {
    const category = req.query.cat;
    const city = req.query.city || 'kalush';

    try {
        let query = `is_published=eq.true&city_slug=eq.${city}&select=*&order=created_at.desc`;
        if (category && category !== 'all') {
            query += `&category=eq.${category}`;
        }

        const ads = await fetchFromSupabase('classifieds', query);

        const templatePath = path.join(process.cwd(), 'classifieds_list.html');
        let html = fs.readFileSync(templatePath, 'utf8');

        const catTitle = CAT_MAP[category] || 'Всі оголошення';
        html = html.replace('id="list-title">', `id="list-title">${catTitle}`);
        html = html.replace('id="list-desc">', `id="list-desc">Актуальні пропозиції у місті ${city.toUpperCase()}`);

        let adsHtml = '';
        if (ads && ads.length > 0) {
            adsHtml = ads.map(ad => `
                <a href="/classifieds/item/${ad.id}" class="ad-card group">
                    <div class="flex flex-col md:flex-row gap-6">
                        <!-- Left: Image -->
                        <div class="md:w-32 md:h-32 w-full aspect-square bg-black/40 rounded-2xl overflow-hidden flex-shrink-0 relative border border-white/5">
                            <img src="${ad.image_url || 'https://via.placeholder.com/400x400?text=No+Photo'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="${ad.title}">
                            ${ad.is_featured ? '<span class="absolute top-2 left-2 bg-orange-600 text-white text-[8px] font-black px-2 py-1 rounded-md shadow-lg">VIP</span>' : ''}
                        </div>
                        
                        <!-- Right: Content -->
                        <div class="flex-1 flex flex-col justify-between">
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-orange-600/60">${CAT_MAP[ad.category] || ad.category}</span>
                                    <div class="text-white font-black text-xl">
                                        ${ad.price ? `<span class="text-orange-500">${ad.price}</span> <span class="text-xs text-slate-500 font-bold uppercase tracking-tighter">грн</span>` : '<span class="text-slate-500 text-xs uppercase font-bold tracking-tighter">Договірна</span>'}
                                    </div>
                                </div>
                                <h3 class="text-xl font-black text-white tracking-tight uppercase leading-none mb-3 group-hover:text-orange-500 transition-colors">${ad.title}</h3>
                                <p class="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">${ad.description || ''}</p>
                            </div>
                            
                            <div class="flex items-center justify-between pt-4 border-t border-white/5">
                                <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <svg class="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    ${new Date(ad.created_at).toLocaleDateString('uk-UA')}
                                </div>
                                <div class="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-orange-600 font-black uppercase text-[9px] tracking-[0.2em] group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-all active:scale-95 shadow-lg">Детальніше</div>
                            </div>
                        </div>
                    </div>
                </a>
            `).join('');
        } else {
            adsHtml = '<div class="col-span-full py-40 text-center text-slate-600 font-black uppercase tracking-[0.3em] opacity-50">Оголошень поки немає</div>';
        }

        html = html.replace('<!-- Ads items -->', adsHtml);

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
        console.error('Classifieds Handler Error:', e);
        return res.status(500).send('Server Error');
    }
};
