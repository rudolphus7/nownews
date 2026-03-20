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
        <div class="fixed top-0 w-full z-50 px-4 py-4 md:px-10">
            <div class="container mx-auto px-6 py-4 bg-[#020617]/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex justify-between items-center shadow-2xl">
                <a href="https://kalush.bukva.news/" class="flex items-center gap-4 group transition-all">
                    <img src="/logo_footer.png" class="w-10 md:w-12 group-hover:scale-110 transition duration-500">
                    <div class="flex flex-col">
                        <span class="font-black text-white tracking-tighter uppercase text-sm md:text-xl leading-none">КАЛУШ <span class="text-orange-600">ПОРТАЛ</span></span>
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">Оголошення Громади</span>
                    </div>
                </a>
                <div class="flex items-center gap-3 md:gap-6">
                    <a href="https://kalush.bukva.news/" class="hidden md:flex items-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] hover:text-white transition-all px-4 py-2">
                        Новини
                    </a>
                    <a href="https://kalush.bukva.news/" class="px-6 md:px-10 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] text-[10px] font-black uppercase text-white tracking-[0.2em] hover:bg-orange-600 hover:border-orange-600 transition-all shadow-xl active:scale-95">
                        На головну
                    </a>
                </div>
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
