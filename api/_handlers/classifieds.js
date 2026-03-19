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
        let query = `is_published=eq.true&city=eq.${city}&select=*&order=created_at.desc`;
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
                <div class="ad-card">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="bg-orange-600/10 text-orange-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">${CAT_MAP[ad.category] || ad.category}</span>
                        <span class="text-white font-black text-lg ml-auto">${ad.price ? ad.price + ' грн' : ''}</span>
                    </div>
                    <h3 class="text-xl font-bold mb-3 text-white">${ad.title}</h3>
                    <p class="text-slate-400 text-sm mb-6 line-clamp-3">${ad.description || ''}</p>
                    <div class="flex items-center justify-between border-t border-white/5 pt-5">
                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${ad.contact || 'Контакт не вказано'}</div>
                        <a href="tel:${ad.phone}" class="text-orange-600 font-bold hover:underline">Подзвонити</a>
                    </div>
                </div>
            `).join('');
        } else {
            adsHtml = '<div class="col-span-full py-20 text-center text-slate-500 font-bold uppercase tracking-widest">Оголошень поки немає</div>';
        }

        html = html.replace('<!-- Ads items -->', adsHtml);

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
        console.error('Classifieds Handler Error:', e);
        return res.status(500).send('Server Error');
    }
};
