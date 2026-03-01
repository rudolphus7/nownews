const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

const CITIES_MAP = {
    'kalush': 'Калуш', 'if': 'Івано-Франківськ', 'kolomyya': 'Коломия',
    'dolyna': 'Долина', 'bolekhiv': 'Болехів', 'nadvirna': 'Надвірна',
    'burshtyn': 'Бурштин', 'kosiv': 'Косів', 'yaremche': 'Яремче'
};

// SSR Cache
let globalCache = {
    categories: null,
    cities: null,
    ticker: null,
    lastUpdate: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STATIC_TTL = 60 * 60 * 1000; // 1 hour for categories/cities

module.exports = async (req, res) => {
    // slug може прийти як /news/:slug через rewrite або як ?slug= query param
    let slug = req.query.slug;
    let id = req.query.id;

    // Якщо прийшов масив (наприклад, через декілька параметрів), беремо перший елемент
    if (Array.isArray(slug)) slug = slug[0];
    if (Array.isArray(id)) id = id[0];

    console.log('SSR Request:', { url: req.url, slug, id });

    let htmlContent = '';
    try {
        // У Vercel файли знаходяться у корені проекту, доступному через __dirname або process.cwd()
        const possiblePaths = [
            path.join(process.cwd(), 'article.html'),
            path.join(__dirname, '..', 'article.html'),
            path.join(__dirname, 'article.html')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                htmlContent = fs.readFileSync(p, 'utf8');
                console.log('Successfully read news.html from:', p);
                break;
            }
        }

        if (!htmlContent) {
            // Fallback to news-template.html
            const templatePaths = [
                path.join(process.cwd(), 'news-template.html'),
                path.join(__dirname, '..', 'news-template.html')
            ];
            for (const p of templatePaths) {
                if (fs.existsSync(p)) {
                    htmlContent = fs.readFileSync(p, 'utf8');
                    console.log('Successfully read news-template.html from:', p);
                    break;
                }
            }
        }

        if (!htmlContent) throw new Error('No template file found');
    } catch (e) {
        console.error('Template Read Error:', e);
        return res.status(500).send('Configuration Error: HTML template missing');
    }

    // If no specific news is requested, just return the static page
    if (!slug && !id) {
        console.log('No slug/id provided, serving template only');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    }

    try {
        const filter = slug ? `slug=eq.${encodeURIComponent(slug)}` : `id=eq.${id}`;
        const apiUrl = `${SUPABASE_URL}/rest/v1/news?${filter}&select=*`;

        const response = await fetch(apiUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Accept': 'application/vnd.pgrst.object+json'
            }
        });

        if (!response.ok) {
            console.warn('Supabase fetch failed:', response.statusText);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlContent);
        }

        // Fetch everything in parallel
        const now = Date.now();
        const promises = [response.json()];

        if (!globalCache.categories || (now - globalCache.lastUpdate > STATIC_TTL)) {
            promises.push(fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=order_index.asc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            }).then(r => r.json()));
        } else {
            promises.push(Promise.resolve(globalCache.categories));
        }

        if (!globalCache.cities || (now - globalCache.lastUpdate > STATIC_TTL)) {
            promises.push(fetch(`${SUPABASE_URL}/rest/v1/cities?select=*&order=order_index.asc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            }).then(r => r.json()));
        } else {
            promises.push(Promise.resolve(globalCache.cities));
        }

        // Ticker fetch
        if (!globalCache.ticker || (now - globalCache.lastUpdate > CACHE_TTL)) {
            promises.push(fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=id,title,slug&order=created_at.desc&limit=5`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            }).then(r => r.json()));
        } else {
            promises.push(Promise.resolve(globalCache.ticker));
        }

        const [news, categories, cities, tickerNews] = await Promise.all(promises);

        // Update cache
        globalCache.categories = categories;
        globalCache.cities = cities;
        globalCache.ticker = tickerNews;
        globalCache.lastUpdate = now;

        const CAT_MAP = {};
        const CAT_EN_TO_UK_SLUG = {};
        categories.forEach(c => {
            CAT_MAP[c.slug] = c.name;
            CAT_EN_TO_UK_SLUG[c.slug] = c.slug;
        });

        const CITY_MAP = {};
        cities.forEach(c => {
            CITY_MAP[c.slug] = c.name;
        });

        // Canonical URL logic — preference order: city > category > fallback
        let preferredPath = '';
        if (news.city && CITY_MAP[news.city]) {
            preferredPath = `/${news.city}/${news.slug}/`;
        } else if (news.category && CAT_EN_TO_UK_SLUG[news.category]) {
            preferredPath = `/category/${CAT_EN_TO_UK_SLUG[news.category]}/${news.slug}/`;
        } else {
            preferredPath = `/news/${news.slug}/`;
        }

        const canonicalUrl = `${SITE_URL}${preferredPath}`;

        // 301 Redirect if current path is not the preferred one
        // Check if we are accessed via /news/ or some other non-preferred path
        const currentPath = req.url.split('?')[0];
        if (currentPath !== preferredPath && !currentPath.includes('/api/')) {
            console.log(`301 Redirect: ${currentPath} -> ${preferredPath}`);
            res.writeHead(301, { Location: preferredPath });
            return res.end();
        }

        const title = `${news.title} | IF News`;
        const description = (news.meta_description || news.content || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 160);
        const image = news.image_url || `${SITE_URL}/og-default.jpg`;
        const author = news.author || 'Редакція IF News';
        const siteName = 'Прикарпаття News | IF News';

        // Inject SEO meta tags before </head>
        const metaTags = `
    <!-- General SEO -->
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="author" content="${escapeAttr(author)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="uk-UA" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph (Facebook, Telegram, Viber) -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">
    ${publishedDate ? `<meta property="article:published_time" content="${publishedDate}">` : ''}
    ${news.category ? `<meta property="article:section" content="${news.category}">` : ''}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@ifnews_pro">
    <meta name="twitter:creator" content="@ifnews_pro">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(image)}">

    <!-- Schema.org JSON-LD: NewsArticle -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "${escapeJson(news.title)}",
        "description": "${escapeJson(description)}",
        "image": {
            "@type": "ImageObject",
            "url": "${escapeJson(image)}",
            "width": 1200,
            "height": 630
        },
        "datePublished": "${publishedDate}",
        "dateModified": "${publishedDate}",
        "author": {
            "@type": "Person",
            "name": "${escapeJson(author)}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "${escapeJson(siteName)}",
            "logo": {
                "@type": "ImageObject",
                "url": "${SITE_URL}/favicon.ico",
                "width": 512,
                "height": 512
            }
        },
        "articleSection": "${escapeJson(news.category || '')}",
        "url": "${escapeJson(canonicalUrl)}",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "${escapeJson(canonicalUrl)}"
        }
    }
    <\/script>
    <!-- Schema.org JSON-LD: BreadcrumbList -->
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
            }${news.city ? `,
            {
                "@type": "ListItem",
                "position": 2,
                "name": "${escapeJson(CITY_MAP[news.city] || news.city)}",
                "item": "${SITE_URL}/${escapeJson(news.city)}/"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": "${escapeJson(news.title)}",
                "item": "${escapeJson(canonicalUrl)}"
            }` : `,
            {
                "@type": "ListItem",
                "position": 2,
                "name": "${escapeJson(news.title)}",
                "item": "${escapeJson(canonicalUrl)}"
            }`}
        ]
    }
    <\/script>
    <!-- End SEO Meta Tags -->`;

        // Replace <title> tag
        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

        // Date formatting
        const formattedDate = new Date(news.created_at).toLocaleDateString('uk-UA', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Reading time calculation
        const words = (news.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
        const min = Math.max(1, Math.round(words / 200));
        const readingTimeText = `${min} ${min === 1 ? 'хвилина' : (min < 5 ? 'хвилини' : 'хвилин')}`;

        // SSR Utility
        const inject = (html, id, value) => {
            const regex = new RegExp(`(id="${id}"[^>]*>)`, 'g');
            return html.replace(regex, `$1${value || ''}`);
        };

        // SSR Header Injection
        let tickerHtml = 'ОСТАННІ НОВИНИ ПРИКАРПАТТЯ • ПЕРЕВІРЕНІ ФАКТИ • АКТУАЛЬНІ ПОДІЇ • ОПЕРАТИВНО ТА ЧЕСНО •';
        if (tickerNews && tickerNews.length > 0) {
            tickerHtml = tickerNews.map(tn => `<a href="/news/${tn.slug}/" class="mx-4 hover:text-orange-500 transition-colors">${tn.title}</a>`).join(' <span class="text-orange-600 font-bold mx-2">/</span> ');
        }

        const headerHtml = `
            <link rel="stylesheet" href="/components/header.css?v=3">
            <script src="/components/header.js?v=3"></script>
            <!-- Ticker -->
            <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5">
                <div class="container mx-auto px-4 flex items-center">
                    <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                    <div class="flex-1 overflow-hidden relative ticker-mask">
                        <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                            ${tickerHtml}
                        </div>
                    </div>
                </div>
            </div>

            <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
                <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                    <a href="/" class="flex items-center space-x-4 group">
                        <div class="relative">
                            <span class="bg-orange-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black text-2xl italic tracking-tighter shadow-2xl shadow-orange-200">IF</span>
                            <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 border-2 border-white rounded-full"></div>
                        </div>
                        <div class="leading-none text-left">
                            <span class="text-2xl font-black uppercase tracking-tighter text-slate-900 block mt-1">Прикарпаття <span class="text-orange-600">News</span></span>
                            <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Незалежна Журналістика</span>
                        </div>
                    </a>
                    
                    <nav id="desktop-nav" class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                        ${categories.map(c => `
                            <a href="/category/${c.slug}/" class="hover:text-orange-600 transition-colors py-2 font-black tracking-tight text-sm">${c.name}</a>
                        `).join('')}
                        <div class="flex items-center ml-4">
                            <a href="#" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
                                <span class="flex h-2.5 w-2.5 relative">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                                </span>
                                <span class="font-black tracking-tighter text-[11px]">LIVE • ЕФІР</span>
                            </a>
                        </div>
                    </nav>

                    <button id="mobile-menu-toggle" class="md:hidden flex flex-col gap-1.5 p-2">
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
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
                            ${cities.map(c => `<a href="/${c.slug}/" class="hover:text-orange-600 transition-colors">${c.name}</a>`).join('')}
                        </div>
                    </div>
                </div>
            </header>

            <!-- Mobile Menu Overlay -->
            <div id="mobile-menu-overlay" class="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl translate-x-full transition-transform duration-500 md:hidden overflow-y-auto">
                <div class="p-8">
                    <div class="flex justify-between items-center mb-12">
                        <a href="/" class="flex items-center space-x-4 group">
                            <div class="relative">
                                <span class="bg-orange-600 text-white w-10 h-10 flex items-center justify-center rounded-xl font-black text-xl italic tracking-tighter">IF</span>
                                <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-900 border border-white rounded-full"></div>
                            </div>
                            <div class="leading-none text-left">
                                <span class="text-xl font-black uppercase tracking-tighter text-slate-900 block">Прикарпаття <span class="text-orange-600">News</span></span>
                            </div>
                        </a>
                        <button id="close-mobile-menu" class="p-4 -mr-4 text-slate-400 hover:text-orange-600 font-black text-4xl transition-colors">&times;</button>
                    </div>
                    <div class="space-y-8">
                        <div>
                            <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">РУБРИКИ</h3>
                            <div id="mobile-nav-list" class="flex flex-col gap-5 text-lg font-black uppercase text-slate-800 tracking-tight">
                                ${categories.map(c => `
                                    <a href="/category/${c.slug}/" class="py-2 active:text-orange-600 font-bold">${c.name}</a>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        htmlContent = inject(htmlContent, 'site-header-placeholder', headerHtml);

        // SSR News content injection
        htmlContent = inject(htmlContent, 'news-title', news.title);
        htmlContent = inject(htmlContent, 'news-text', news.content);
        htmlContent = inject(htmlContent, 'breadcrumb-category', CAT_MAP[news.category] || news.category);
        htmlContent = inject(htmlContent, 'news-date', formattedDate);
        htmlContent = inject(htmlContent, 'reading-time', readingTimeText);
        htmlContent = inject(htmlContent, 'view-count', news.views);

        // Handle image separately
        if (news.image_url) {
            htmlContent = htmlContent.replace(/id="news-image"\s+src=""/, `id="news-image" src="${escapeAttr(news.image_url)}"`);
        }

        // Add a flag to indicate content is pre-rendered to prevent flickering/re-loading
        const ssrScript = `<script>
    window.__SSR_CONTENT_PRE_RENDERED__ = true;
    window.__SSR_POST_DATA__ = ${JSON.stringify(news).replace(/</g, '\\u003c')};
    window.__SSR_SLUG__ = '${escapeJson(news.slug || '')}';
    window.__SSR_ID__ = '${escapeJson(String(news.id || ''))}'; 
<\/script>`;

        // Inject meta tags after title
        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>\n${metaTags}\n${ssrScript}`);

        // Ensure content is visible and loader is hidden
        htmlContent = htmlContent.replace('id="loader"', 'id="loader" class="hidden"');
        htmlContent = htmlContent.replace('id="news-content" class="hidden"', 'id="news-content"');

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        return res.status(200).send(htmlContent);

    } catch (err) {
        console.error('SSR Error:', err);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    }
};

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJson(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
