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

// SSR Cache
let globalCache = {
    categories: null,
    cities: null,
    lastUpdate: 0
};
const STATIC_TTL = 60 * 60 * 1000; // 1 hour

module.exports = async (req, res) => {
    let citySlug = req.query.city;
    if (Array.isArray(citySlug)) citySlug = citySlug[0];

    if (!citySlug) {
        res.status(404).send('City not found');
        return;
    }

    let categories = [];
    let cities = [];

    const now = Date.now();
    try {
        const promises = [];
        if (!globalCache.categories || (now - globalCache.lastUpdate > STATIC_TTL)) {
            promises.push(fetchFromSupabase('categories', 'select=*&order=order_index.asc'));
        } else {
            promises.push(Promise.resolve(globalCache.categories));
        }

        if (!globalCache.cities || (now - globalCache.lastUpdate > STATIC_TTL)) {
            promises.push(fetchFromSupabase('cities', 'select=*&order=order_index.asc'));
        } else {
            promises.push(Promise.resolve(globalCache.cities));
        }

        [categories, cities] = await Promise.all(promises);

        // Update cache
        globalCache.categories = categories;
        globalCache.cities = cities;
        globalCache.lastUpdate = now;
    } catch (e) {
        console.error('Supabase fetch error:', e.message);
        return res.status(500).send('Помилка завантаження даних');
    }

    // Find city by slug in DB
    const city = cities.find(c => c.slug === citySlug);
    if (!city) {
        res.status(404).send('City not found');
        return;
    }

    const cityName = city.name;
    const canonicalUrl = `${SITE_URL}/${citySlug}/`;
    const title = `Новини ${cityName} — останні події | BUKVA NEWS`;
    const description = `Актуальні новини ${cityName}: місцеві події, факти, оперативна інформація. Слідкуйте за головними новинами першими на BUKVA NEWS.`;
    const siteName = 'BUKVA NEWS';

    // Read index.html template
    let htmlContent = '';
    try {
        const possiblePaths = [
            path.join(process.cwd(), 'index.html'),
            path.join(__dirname, '..', 'index.html')
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                htmlContent = fs.readFileSync(p, 'utf8');
                break;
            }
        }
        if (!htmlContent) throw new Error('index.html not found');
    } catch (e) {
        console.error('Template Error:', e);
        return res.status(500).send('Configuration error');
    }

    // Build SEO meta block
    const metaTags = `
    <!-- City Page SEO -->
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="uk" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@bukvanews">
    <meta name="twitter:creator" content="@bukvanews">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">

    <!-- Schema.org: BreadcrumbList -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "\u0413\u043e\u043b\u043e\u0432\u043d\u0430",
                "item": "${SITE_URL}/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "${escapeJson(cityName)}",
                "item": "${escapeJson(canonicalUrl)}"
            }
        ]
    }
    <\/script>

    <style>
        #hero-container { display: none !important; }
        #section-header { display: block !important; }
        #homepage-h1 { display: none !important; }
    </style>
    <!-- End City SEO -->`;

    // SSR data for client-side city filtering
    const ssrScript = `<script>
        window.__SSR_CITY__ = '${escapeAttr(citySlug)}';
        window.__SSR_CITY_NAME__ = '${escapeAttr(cityName)}';
        window.__SSR_CATEGORIES__ = ${JSON.stringify(categories)};
        window.__SSR_CITIES__ = ${JSON.stringify(cities)};
        // Ticker is optional for city pages but good for hydration
    </script>`;

    // Build SSR nav from DB data
    const navLinksHtml = categories.map(c => 
        `<a href="/${c.slug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm" data-category="${c.slug}">${escapeHtml(c.name)}</a>`
    ).join('');

    const mobileCatHtml = categories.map(c => 
        `<a href="/${c.slug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${escapeHtml(c.name)}</a>`
    ).join('');

    const cityLinksHtml = cities.map(c =>
        `<a href="/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1${c.slug === citySlug ? ' text-orange-600 font-black text-slate-900' : ''}" data-city="${c.slug}">${escapeHtml(c.name)}</a>`
    ).join('');

    const mobileCityHtml = `<a href="/" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">ВСЯ ОБЛАСТЬ</a>` +
        cities.map(c =>
            `<a href="/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight${c.slug === citySlug ? ' bg-orange-50 text-orange-600' : ''}">${escapeHtml(c.name)}</a>`
        ).join('');

    const headerHtml = `
        <!-- Ticker -->
        <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5 h-[40px]">
            <div class="container mx-auto px-4 flex items-center h-full">
                <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                <div class="flex-1 overflow-hidden relative ticker-mask h-full flex items-center">
                    <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                        BUKVA NEWS • ПЕРЕВІРЕНІ ФАКТИ • АКТУАЛЬНІ ПОДІЇ • ОПЕРАТИВНО ТА ЧЕСНО •
                    </div>
                </div>
            </div>
        </div>

        <style>
            #mobile-menu-toggle { display: none; flex-direction: column; gap: 6px; padding: 8px; background: transparent; border: none; cursor: pointer; }
            #mobile-menu-toggle span { display: block; width: 24px; height: 2px; background-color: #0f172a; border-radius: 9999px; transition: all 0.3s; }
            #desktop-nav { display: flex; align-items: center; gap: 24px; }
            @media (max-width: 768px) {
                #mobile-menu-toggle { display: flex !important; }
                #desktop-nav { display: none !important; }
                .header-logo-text { font-size: 1.25rem !important; }
            }
        </style>
        <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
            <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" class="flex items-center space-x-3 group">
                    <div class="relative">
                        <img src="/logo.png" alt="BUKVA NEWS" class="w-12 h-12 rounded-2xl shadow-2xl shadow-orange-200/60 group-hover:rotate-3 transition-transform duration-500 object-cover">
                        <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div class="leading-none text-left">
                        <span class="text-3xl font-black uppercase tracking-tighter text-slate-900 block mt-1 header-logo-text">BUKVA <span class="text-orange-600">NEWS</span></span>
                        <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Незалежна Журналістика</span>
                    </div>
                </a>

                <nav id="desktop-nav" class="items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                    ${navLinksHtml}
                    <div class="flex items-center ml-4">
                        <a href="/live/" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
                            <span class="flex h-2.5 w-2.5 relative">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                            </span>
                            <span class="font-black tracking-tighter text-[11px] text-white">LIVE • ЕФІР</span>
                        </a>
                    </div>
                </nav>

                <button id="mobile-menu-toggle" class="flex flex-col gap-1.5 p-2">
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                </button>
            </div>

            <!-- City Filter Row -->
            <div class="bg-white border-t border-slate-100 overflow-x-auto no-scrollbar shadow-sm">
                <div class="container mx-auto px-4 py-4 flex items-center space-x-8 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">
                    <span class="text-slate-900 border-r border-slate-200 pr-6 mr-2 flex items-center">
                        <span class="w-1.5 h-4 bg-orange-600 mr-3 rounded-full"></span>
                        ВАШЕ МІСТО
                    </span>
                    <div class="flex items-center gap-6" id="city-nav-list">
                        ${cityLinksHtml}
                    </div>
                </div>
            </div>
        </header>

        <!-- Mobile Menu Overlay -->
        <div id="mobile-menu-overlay" class="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl translate-x-full transition-transform duration-500 overflow-y-auto">
            <div class="p-8">
                <div class="flex justify-between items-center mb-12">
                    <a href="/" class="flex items-center space-x-3 group">
                        <div class="relative">
                            <img src="/logo.png" alt="BUKVA NEWS" class="w-10 h-10 rounded-xl object-cover shadow-md">
                            <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-500 border border-white rounded-full"></div>
                        </div>
                        <div class="leading-none text-left">
                            <span class="text-xl font-black uppercase tracking-tighter text-slate-900 block">BUKVA <span class="text-orange-600">NEWS</span></span>
                        </div>
                    </a>
                    <button id="close-mobile-menu" class="p-4 -mr-4 text-slate-400 hover:text-orange-600 font-black text-4xl transition-colors">&times;</button>
                </div>
                <div class="space-y-8">
                    <div>
                        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">РУБРИКИ</h3>
                        <div id="mobile-nav-list" class="flex flex-col gap-5 text-lg font-black uppercase text-slate-800 tracking-tight">
                            ${mobileCatHtml}
                            <a href="/live/" class="pt-4 text-orange-600 font-black flex items-center gap-2"><span class="flex h-2 w-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>LIVE • ЕФІР</a>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">МІСТА</h3>
                        <div id="mobile-city-list" class="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                            ${mobileCityHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // SSR Utility
    const inject = (html, id, value) => {
        const regex = new RegExp(`(id="${id}"[^>]*>)`, 'g');
        return html.replace(regex, `$1${value || ''}`);
    };

    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
    htmlContent = htmlContent.replace(/<meta name="description"[^>]*>/gi, '');
    htmlContent = htmlContent.replace(/<link rel="canonical"[^>]*>/gi, '');
    htmlContent = inject(htmlContent, 'site-header-placeholder', headerHtml);
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>\n${metaTags}\n${ssrScript}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(htmlContent);
};

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJson(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
