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
    let slug = req.query.slug;
    if (Array.isArray(slug)) slug = slug[0];

    if (!slug) {
        res.setHeader('Location', '/');
        return res.status(302).end();
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
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    // Find category by slug
    const category = categories.find(c => c.slug === slug);
    if (!category) {
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    const categoryName = category.name;
    const canonicalUrl = `${SITE_URL}/${slug}/`;
    const title = `${categoryName} | BUKVA NEWS — Новини Івано-Франківська`;

    // Unique meta descriptions and SEO text per category slug
    const CATEGORY_META = {
        'sport': {
            description: 'Спортивні новини Івано-Франківська та Прикарпаття. Результати матчів, турніри, досягнення місцевих спортсменів — усе на BUKVA NEWS.',
            seoText: 'Спорт на Прикарпатті — це не просто змагання. Це досягнення, перемоги та боротьба тисяч людей. BUKVA NEWS стежить за результатами місцевих клубів, турнірами та успіхами івано-франківських спортсменів.'
        },
        'politics': {
            description: 'Політичні новини Івано-Франківська та України. Рішення влади, вибори, аналітика подій — актуально на BUKVA NEWS.',
            seoText: 'Політика відображає реальний стан суспільства. На BUKVA NEWS — об\'єктивні репортажі про рішення місцевої та центральної влади, резонансні події та позиції громади Прикарпаття.'
        },
        'economy': {
            description: 'Економічні новини Прикарпаття: бізнес, ринки, зайнятість, тарифи та фінанси Івано-Франківська — на BUKVA NEWS.',
            seoText: 'Економіка регіону — це робочі місця, ціни та добробут кожного мешканця. BUKVA NEWS висвітлює бізнес-події, ринок нерухомості, тарифи та фінансові новини Івано-Франківська і Прикарпаття.'
        },
        'culture': {
            description: 'Культурне життя Івано-Франківська: події, виставки, театр, музика та мистецтво Прикарпаття — на BUKVA NEWS.',
            seoText: 'Культура Прикарпаття — це багатство традицій і сучасних мистецьких форм. BUKVA NEWS розповідає про концерти, виставки, театральні прем\'єри та культурні події Івано-Франківська.'
        },
        'tech': {
            description: 'Технологічні новини та інновації: IT, гаджети, наука та цифрові тренди для Прикарпаття — на BUKVA NEWS.',
            seoText: 'Технології змінюють світ і наш регіон. BUKVA NEWS висвітлює новини IT-сфери, стартапи, цифрову трансформацію та науково-технічні досягнення, що мають значення для жителів Прикарпаття.'
        },
        'frankivsk': {
            description: 'Новини Івано-Франківська: події, що відбуваються у місті прямо зараз — оперативно на BUKVA NEWS.',
            seoText: 'Івано-Франківськ — живе місто з активним громадським, культурним та діловим життям. BUKVA NEWS — ваш провідник у міських новинах: від рішень міськради до подій у кварталах.'
        },
        'oblast': {
            description: 'Новини Івано-Франківської області: події у районах та громадах Прикарпаття — на BUKVA NEWS.',
            seoText: 'Івано-Франківська область — це 14 районів, десятки громад і тисячі подій щодня. BUKVA NEWS збирає найважливіше з усього Прикарпаття, щоб ви були в курсі того, що відбувається поряд.'
        },
        'war': {
            description: 'Новини про війну в Україні: фронтові зведення, ситуація в регіоні та підтримка ЗСУ — на BUKVA NEWS.',
            seoText: 'BUKVA NEWS висвітлює події російсько-української війни: фронтові зведення, новини з регіону, волонтерські ініціативи та підтримку захисників від прикарпатської громади.'
        }
    };

    const meta = CATEGORY_META[slug] || {
        description: `Новини рубрики «${categoryName}» — читайте найактуальніше на BUKVA NEWS. Перевірені факти, оперативні події з Івано-Франківська та Прикарпаття.`,
        seoText: `«${categoryName}» — одна з ключових рубрик BUKVA NEWS. Тут зібрані найважливіші матеріали з перевіреними фактами та оперативними новинами Прикарпаття.`
    };

    const description = meta.description;
    const seoText = meta.seoText;
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
        return res.status(500).send('Configuration error');
    }

    const metaTags = `
    <!-- Category Page SEO -->
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
                "name": "${escapeJson(categoryName)}",
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
    <!-- End Category SEO -->`;

    // SSR data: passes slug and name so client JS can filter news
    const ssrScript = `<script>
        window.__SSR_CATEGORY_SLUG__ = '${escapeAttr(slug)}';
        window.__SSR_CATEGORY_NAME__ = '${escapeAttr(categoryName)}';
        window.__SSR_CATEGORIES__ = ${JSON.stringify(categories)};
        window.__SSR_CITIES__ = ${JSON.stringify(cities)};
    </script>`;

    // Build SSR nav from DB data
    const navLinksHtml = categories.map(c =>
        `<a href="/${c.slug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm${c.slug === slug ? ' text-orange-600 border-orange-600' : ''}" data-category="${c.slug}">${escapeHtml(c.name)}</a>`
    ).join('');

    const mobileCatHtml = categories.map(c =>
        `<a href="/${c.slug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${escapeHtml(c.name)}</a>`
    ).join('');

    const cityLinksHtml = cities.map(c =>
        `<a href="/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1" data-city="${c.slug}">${c.name}</a>`
    ).join('');

    const mobileCityHtml = `<a href="/" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">ВСЯ ОБЛАСТЬ</a>` +
        cities.map(c =>
            `<a href="/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">${c.name}</a>`
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

    // Build SEO text injector — avoids </script> escaping issues in template literals
    const seoInjectorScript = '<scr' + 'ipt>document.addEventListener("DOMContentLoaded",function(){' +
        'var st=' + JSON.stringify(seoText) + ';' +
        'if(!st)return;' +
        'var b=document.createElement("p");' +
        'b.id="category-seo-text";' +
        'b.setAttribute("style","max-width:760px;margin:0 auto 20px;padding:14px 18px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 10px 10px 0;font-size:14px;line-height:1.75;color:#64748b;");' +
        'b.textContent=st;' +
        'var g=document.getElementById("news-grid")||document.getElementById("news-container")||document.querySelector("[id*=news]");' +
        'if(g&&g.parentNode)g.parentNode.insertBefore(b,g);' +
        '});<\/scr' + 'ipt>';

    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>\n${metaTags}\n${ssrScript}\n${seoInjectorScript}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
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
