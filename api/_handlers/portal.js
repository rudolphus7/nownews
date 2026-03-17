const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

async function fetchFromSupabase(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
    return res.json();
}

module.exports = async (req, res) => {
    // Portals are city-specific by design
    const host = req.headers.host || '';
    let citySlug = 'kalush'; // Hardcoded for now as it's our first portal

    const title = `Портал міста Калуш — новини, заклади, оголошення | KALUSH NEWS`;
    const description = `Найповніший портал Калуша: останні новини громади, каталог цікавих закладів, дошка оголошень та важливі міські події. Будь у центрі життя Калущини.`;
    const canonicalUrl = `https://kalush.bukva.news/`;

    // Read portal.html template
    let htmlContent = '';
    try {
        const portalPath = path.join(process.cwd(), 'portal.html');
        if (fs.existsSync(portalPath)) {
            htmlContent = fs.readFileSync(portalPath, 'utf8');
        } else {
            throw new Error('portal.html not found');
        }
    } catch (e) {
        console.error('Portal Template Error:', e);
        return res.status(500).send('Portal configuration error');
    }

    // SSR Header Injections (similar to city handler)
    // We re-use logic from city handler but with "Portal" flavor
    // For now, let's keep it simple and just serve the template
    // In future versions, we can inject pre-fetched news or places here.

    const headerHtml = `
        <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
            <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" class="flex items-center space-x-3 group">
                    <div class="relative">
                        <img src="/logo.png" alt="KALUSH NEWS" class="w-12 h-12 rounded-2xl shadow-2xl shadow-orange-200/60 group-hover:rotate-3 transition-transform duration-500 object-cover">
                        <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div class="leading-none text-left">
                        <span class="text-3xl font-black uppercase tracking-tighter text-slate-900 block mt-1 header-logo-text">KALUSH <span class="text-orange-600">NEWS</span></span>
                        <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Міський Портал Калуша</span>
                    </div>
                </a>
                <nav class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                    <a href="#places" class="hover:text-orange-600">Заклади</a>
                    <a href="#ads" class="hover:text-orange-600">Оголошення</a>
                    <a href="https://bukva.news/" class="text-slate-400">Bukva News</a>
                </nav>
            </div>
        </header>
    `;

    htmlContent = htmlContent.replace('<div id="site-header-placeholder"></div>', headerHtml);
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
    
    // Inject SEO meta
    const metaTags = `
        <meta name="description" content="${description}">
        <link rel="canonical" href="${canonicalUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:site_name" content="KALUSH NEWS">
    `;
    htmlContent = htmlContent.replace('</head>', `${metaTags}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(htmlContent);
};
