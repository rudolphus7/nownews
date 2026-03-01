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
            <!-- Ticker -->
            <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5 h-[40px]">
                <div class="container mx-auto px-4 flex items-center h-full">
                    <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                    <div class="flex-1 overflow-hidden relative ticker-mask h-full flex items-center">
                        <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                            ${tickerHtml}
                        </div>
                    </div>
                </div>
            </div>
            <!-- Header placeholder -->
            <div class="h-[80px]"></div> 
        `;

        htmlContent = htmlContent.replace(/<div id="site-header-placeholder"><\/div>/, `<div id="site-header-placeholder">${headerHtml}</div>`);

        // SSR Content Injection
        const ssrScript = `<script>
        window.__SSR_ID__ = '${news.id}';
        window.__SSR_SLUG__ = '${news.slug}';
        window.__SSR_CONTENT_PRE_RENDERED__ = true;
        window.__SSR_POST_DATA__ = ${JSON.stringify(news)};
        window.__SSR_CATEGORIES__ = ${JSON.stringify(categories)};
        window.__SSR_CITIES__ = ${JSON.stringify(cities)};
        window.__SSR_TICKER__ = ${JSON.stringify(tickerNews)};
    </script>`;

        // Utility for injecting content into specific IDs
        const injectIntoId = (html, id, content) => {
            const regex = new RegExp(`(id=["']${id}["'][^>]*>)`, 'g');
            return html.replace(regex, `$1${content || ''}`);
        };

        // Deep SSR Injections
        htmlContent = injectIntoId(htmlContent, 'news-title', news.title);
        htmlContent = injectIntoId(htmlContent, 'news-text', news.content);
        htmlContent = injectIntoId(htmlContent, 'breadcrumb-category', CAT_MAP[news.category] || news.category);
        htmlContent = injectIntoId(htmlContent, 'news-date', formattedDate);
        htmlContent = injectIntoId(htmlContent, 'reading-time', readingTimeText);
        htmlContent = injectIntoId(htmlContent, 'view-count', news.views || 0);

        // Image
        if (news.image_url) {
            htmlContent = htmlContent.replace('id="news-image" src=""', `id="news-image" src="${news.image_url}" alt="${escapeAttr(news.title)}"`);
        }

        // Initial state: Show content, Hide loader
        htmlContent = htmlContent.replace('id="loader"', 'id="loader" class="hidden"');
        htmlContent = htmlContent.replace('id="news-content" class="hidden"', 'id="news-content"');

        // Meta Badges
        let metaBadgesHtml = '';
        if (news.city) metaBadgesHtml += `<div class="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-orange-100 shadow-sm leading-none">${CITY_MAP[news.city] || news.city}</div>`;
        metaBadgesHtml += `<div class="inline-flex items-center bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm leading-none">${CAT_MAP[news.category] || news.category}</div>`;
        if (news.tags) news.tags.forEach(t => {
            metaBadgesHtml += `<span class="bg-slate-50 text-slate-500 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-100 shadow-sm leading-none">#${t}</span>`;
        });
        htmlContent = injectIntoId(htmlContent, 'news-meta-tags', metaBadgesHtml);

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
