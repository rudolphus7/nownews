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
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    let citySlug = host.split('.')[0].toLowerCase();
    
    if (citySlug === 'bukva' || citySlug === 'localhost' || !citySlug || citySlug === 'www') {
        citySlug = 'kalush'; 
    }

    try {
        const places = await fetchFromSupabase('places', `city_slug=eq.${citySlug}&order=is_featured.desc,rating.desc&select=*`);

        const templatePath = path.join(process.cwd(), 'places_list.html');
        let html = fs.readFileSync(templatePath, 'utf8');

        let placesHtml = '';
        if (places && places.length > 0) {
            placesHtml = places.map(p => `
                <a href="/places/${p.id}" class="place-card group relative">
                    <div class="aspect-video rounded-[2rem] overflow-hidden mb-6 bg-slate-900 border border-white/5 relative">
                        <img src="${p.image_url || '/logo_footer.png'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="${p.name}">
                        ${p.is_featured ? '<span class="absolute top-4 right-4 bg-orange-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full shadow-2xl">RECOMENDED</span>' : ''}
                    </div>
                    <div>
                        <div class="flex items-center justify-between gap-3 mb-2">
                            <span class="text-[9px] font-black uppercase tracking-[0.25em] text-orange-600/70">${p.category_name || 'Заклад'}</span>
                            <div class="flex text-orange-500 text-[10px] gap-0.5">
                                ${'★'.repeat(Math.round(p.rating || 0))}${'☆'.repeat(5 - Math.round(p.rating || 0))}
                            </div>
                        </div>
                        <h3 class="text-2xl font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-orange-500 transition-colors">${p.name}</h3>
                        <div class="text-[10px] font-bold text-slate-500 mt-4 uppercase tracking-widest flex items-center gap-2 opacity-60">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            ${p.address || 'Адреса не вказана'}
                        </div>
                    </div>
                </a>
            `).join('');
        } else {
            placesHtml = '<div class="col-span-full py-40 text-center text-slate-600 font-black uppercase tracking-[0.3em] opacity-50 italic">Закладів поки не додано</div>';
        }

        html = html.replace('<!-- Places items -->', placesHtml);

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
        console.error('Places List Handler Error:', e);
        return res.status(500).send('Server Error');
    }
};
