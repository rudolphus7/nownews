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
    
    // Default fallback if not a city subdomain
    if (citySlug === 'bukva' || citySlug === 'localhost' || !citySlug || citySlug === 'www') {
        citySlug = 'kalush'; 
    }

    try {
        // Fetch city settings from our new table
        const settingsArr = await fetchFromSupabase('portal_settings', `city_slug=eq.${citySlug}&select=*`);
        const settings = (settingsArr && settingsArr.length > 0) ? settingsArr[0] : null;

        const cityDisplayName = settings?.city_name || citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
        const config = settings?.config || {};
        const seo = config.seo || {};

        const title = seo.title || `Портал міста ${cityDisplayName} — новини, заклади, оголошення | ${cityDisplayName.toUpperCase()} NEWS`;
        const description = seo.description || `Найповніший портал міста ${cityDisplayName}: останні новини громади, каталог цікавих закладів, дошка оголошень та важливі міські події.`;
        const logoUrl = config.logo_url || '/logo.png';
        const canonicalUrl = `https://${citySlug}.bukva.news/`;

        // Read portal.html template
        const portalPath = path.join(process.cwd(), 'portal.html');
        let htmlContent = fs.readFileSync(portalPath, 'utf8');

        // Dynamic Header Injection
        const headerHtml = `
            <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
                <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                    <a href="/" class="flex items-center space-x-3 group">
                        <div class="relative">
                            <img src="${logoUrl}" alt="${cityDisplayName} NEWS" class="w-12 h-12 rounded-2xl shadow-2xl shadow-orange-200/60 group-hover:rotate-3 transition-transform duration-500 object-cover">
                            <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div class="leading-none text-left">
                            <span class="text-3xl font-black uppercase tracking-tighter text-slate-900 block mt-1 header-logo-text">${cityDisplayName.toUpperCase()} <span class="text-orange-600">NEWS</span></span>
                            <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Міський Портал</span>
                        </div>
                    </a>
                    <nav class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                        <a href="#places" class="hover:text-orange-600">Заклади</a>
                        <a href="#ads" class="hover:text-orange-600">Оголошення</a>
                        <a href="https://bukva.news/" class="text-slate-400">Головна</a>
                    </nav>
                </div>
            </header>
        `;

        htmlContent = htmlContent.replace('<div id="site-header-placeholder"></div>', headerHtml);
        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
        
        // SEO Meta & Hydration Data Injection
        const headInjections = `
            <meta name="description" content="${description}">
            <link rel="canonical" href="${canonicalUrl}">
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:url" content="${canonicalUrl}">
            <meta property="og:image" content="${logoUrl}">
            <script>
                window.PORTAL_CONFIG = ${JSON.stringify({ citySlug, cityDisplayName, logoUrl })};
            </script>
        `;
        htmlContent = htmlContent.replace('</head>', `${headInjections}\n</head>`);

        // Final UI placeholders replacement
        htmlContent = htmlContent.replace(/ВІТАЄМО В <span class="text-orange-600">КАЛУШІ<\/span>/g, `ВІТАЄМО В <span class="text-orange-600">${cityDisplayName.toUpperCase()}</span>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        // Aggressive caching for performance (economy)
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(htmlContent);

    } catch (e) {
        console.error('Portal Handler Error:', e);
        return res.status(500).send('Portal Configuration Error');
    }
};
