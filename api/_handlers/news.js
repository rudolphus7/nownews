const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

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

/**
 * Converts any image URL to a Facebook-compatible JPEG og:image URL.
 * Facebook does not support WebP. We use Supabase Image Transformation API
 * to serve JPEG for og:image regardless of original format.
 */
function toOgImage(imageUrl) {
    if (!imageUrl) return `${SITE_URL}/og-default.jpg`;

    // Remove any existing query parameters from the original URL to avoid double question marks
    const cleanImageUrl = imageUrl.split('?')[0];

    // If it's already going through bukva.news/images/ proxy -> use Supabase render directly
    // bukva.news/images/2026/04/file.webp -> Supabase render -> origin format
    if (cleanImageUrl.includes(`${SITE_URL}/images/`)) {
        const relativePath = cleanImageUrl.replace(`${SITE_URL}/images/`, '');
        return `${SUPABASE_URL}/storage/v1/render/image/public/news/${relativePath}?width=1200&quality=85&format=origin`;
    }

    // If it's already a direct Supabase storage URL
    if (cleanImageUrl.includes('/storage/v1/object/public/')) {
        return cleanImageUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
            + '?width=1200&quality=85&format=origin';
    }

    // External URL — return as-is
    return imageUrl;
}

module.exports = async (req, res) => {
    // slug може прийти як /news/:slug через rewrite або як ?slug= query param
    let slug = req.query.slug;
    let id = req.query.id;

    // Якщо прийшов масив (наприклад, через декілька параметрів), беремо перший елемент
    if (Array.isArray(slug)) slug = slug[0];
    if (Array.isArray(id)) id = id[0];

    const originalPath = req.headers['x-vercel-sc-headers']
        ? JSON.parse(req.headers['x-vercel-sc-headers'] || '{}')['x-matched-path'] || req.url
        : req.url;
    const pathSegments = (req.headers['x-forwarded-proto'] ? req.url : originalPath).split('?')[0]
        .replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    console.log('SSR Request:', { url: req.url, slug, id, pathSegments });


    let htmlContent = '';
    try {
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
        let isNumeric = (val) => /^\d+$/.test(val);
        let filter = slug ? `slug=eq.${encodeURIComponent(slug)}` : `id=eq.${id}`;
        let apiUrl = `${SUPABASE_URL}/rest/v1/news?${filter}&select=*&limit=1`;

        let response = await fetch(apiUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            const dataArr = await response.json();
            if (dataArr.length === 0 && slug && isNumeric(slug)) {
                console.log(`Slug "${slug}" returned no results, trying as ID fallback...`);
                apiUrl = `${SUPABASE_URL}/rest/v1/news?id=eq.${slug}&select=*&limit=1`;
                response = await fetch(apiUrl, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                });
            } else {
                var newsData = dataArr[0];
            }
        }

        if (!response.ok) {
            console.warn('Supabase fetch failed:', response.status, response.statusText);
            const defaultTags = `
    <title>Новини Івано-Франківщини | BUKVA NEWS</title>
    <meta name="description" content="Головні новини Івано-Франківська та області. Оперативно, чесно, незалежно.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="BUKVA NEWS - Головні новини Івано-Франківщини">
    <meta property="og:description" content="Головні новини Івано-Франківська та області. Оперативно, чесно, незалежно.">
    <meta property="og:image" content="${SITE_URL}/og-default.jpg">
    <meta property="og:url" content="${SITE_URL}">`;
            htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, defaultTags);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlContent);
        }

        const currentPath = req.url.split('?')[0];
        console.log('Processing request for:', { currentPath, slug, id });

        let articleData = newsData;
        if (!articleData && response.ok) {
            try {
                const dataArr = await response.json();
                articleData = dataArr[0];
            } catch (jsonErr) {
                console.warn('Failed to parse news JSON:', jsonErr);
            }
        }

        // Fetch remaining data in parallel
        const now = Date.now();
        const promises = [];

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

        if (!globalCache.ticker || (now - globalCache.lastUpdate > CACHE_TTL)) {
            promises.push(fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=id,title,slug&order=created_at.desc&limit=5`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            }).then(r => r.json()));
        } else {
            promises.push(Promise.resolve(globalCache.ticker));
        }

        const [categories, cities, tickerNews] = await Promise.all(promises);

        globalCache.categories = categories;
        globalCache.cities = cities;
        globalCache.ticker = tickerNews;
        globalCache.lastUpdate = now;

        if (!articleData) {
            if (slug) {
                const matchingCategory = categories.find(c => c.slug === slug);
                if (matchingCategory) {
                    console.log(`Slug "${slug}" matches a category, forwarding to category handler`);
                    try {
                        const categoryHandler = require('./category');
                        const modifiedReq = Object.assign({}, req, {
                            query: Object.assign({}, req.query, { slug: matchingCategory.slug })
                        });
                        return await categoryHandler(modifiedReq, res);
                    } catch (catErr) {
                        console.error('Failed to forward to category handler:', catErr);
                    }
                }
            }
            console.warn('No news article found for slug/id:', slug);
            const notFoundHtml = htmlContent
                .replace(/<title>.*?<\/title>/s, '<title>\u0421\u0442\u043e\u0440\u0456\u043d\u043a\u0443 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e | BUKVA NEWS</title>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            return res.status(404).send(notFoundHtml);
        }

        const CITY_MAP = {};
        cities.forEach(c => {
            CITY_MAP[c.slug] = c.name;
        });

        const getNewsLink = (post) => {
            const slug = post.slug || '';
            if (post.city && CITY_MAP[post.city]) {
                return `/novyny/${post.city}/${slug}/`;
            }
            if (post.category) {
                return `/${post.category}/${slug}/`;
            }
            return `/novyny/${slug}/`;
        };

        const news = articleData;

        const CAT_MAP = {};
        categories.forEach(c => {
            CAT_MAP[c.slug] = c.name;
        });
        let preferredPath = '';
        if (news.city && CITY_MAP[news.city]) {
            preferredPath = `/novyny/${news.city}/${news.slug}/`;
        } else if (news.category) {
            preferredPath = `/${news.category}/${news.slug}/`;
        } else {
            preferredPath = `/novyny/${news.slug}/`;
        }

        const canonicalUrl = `${SITE_URL}${preferredPath}`;

        if (currentPath !== preferredPath && !currentPath.includes('/api/')) {
            console.log(`301 Redirect: ${currentPath} -> ${preferredPath}`);
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
            res.writeHead(301, { Location: preferredPath });
            return res.end();
        }

        const title = `${news.title} | BUKVA NEWS`;
        const description = (news.meta_description || news.content || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 160);

        // --- image: оригінальний URL для відображення на сторінці ---
        let image = news.image_url;
        if (!image && news.content) {
            const imgMatch = news.content.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
                image = imgMatch[1];
            }
        }
        image = image || `${SITE_URL}/og-default.jpg`;

        // Ensure image is an absolute URL
        if (image && !image.startsWith('http')) {
            const separator = image.startsWith('/') ? '' : '/';
            image = `${SITE_URL}${separator}${image}`;
        }

        // --- ogImage: JPEG-версія для Facebook og:image ---
        // Facebook не підтримує WebP. Конвертуємо через Supabase render API.
        const ogImage = toOgImage(image);
        console.log('og:image URL:', ogImage);

        const author = news.author || 'Редакція BUKVA NEWS';
        const siteName = 'BUKVA NEWS';
        const publishedDate = news.created_at ? new Date(news.created_at).toISOString() : '';

        const metaTags = `
    <!-- General SEO -->
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="author" content="${escapeAttr(author)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="uk" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph (Facebook, Telegram, Viber) -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(ogImage)}">
    <meta property="og:image:secure_url" content="${escapeAttr(ogImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">
    <meta property="fb:app_id" content="1617708079361633">
    <meta property="article:published_time" content="${publishedDate}">
    ${news.updated_at ? `<meta property="article:modified_time" content="${new Date(news.updated_at).toISOString()}">` : ''}
    ${news.category ? `<meta property="article:section" content="${news.category}">` : ''}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@bukvanews">
    <meta name="twitter:creator" content="@bukvanews">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(ogImage)}">

    <!-- Schema.org JSON-LD: NewsArticle -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "${escapeJson(news.title)}",
        "description": "${escapeJson(description)}",
        "image": {
            "@type": "ImageObject",
            "url": "${escapeJson(ogImage)}",
            "width": 1200,
            "height": 630
        },
        "datePublished": "${publishedDate}",
        "dateModified": "${news.updated_at ? new Date(news.updated_at).toISOString() : publishedDate}",
        "author": {
            "@type": "Person",
            "name": "${escapeJson(author)}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "${escapeJson(siteName)}",
            "logo": {
                "@type": "ImageObject",
                "url": "${SITE_URL}/logo.png",
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

        htmlContent = htmlContent.replace(/<html[^>]*>/, '<html lang=\"uk\" prefix=\"og: http://ogp.me/ns#\">');
        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

        const formattedDate = new Date(news.created_at).toLocaleDateString('uk-UA', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const words = (news.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
        const min = Math.max(1, Math.round(words / 200));
        const readingTimeText = `${min} ${min === 1 ? 'хвилина' : (min < 5 ? 'хвилини' : 'хвилин')}`;

        const inject = (html, id, value) => {
            const regex = new RegExp(`(id="${id}"[^>]*>)`, 'g');
            return html.replace(regex, `$1${value || ''}`);
        };

        let tickerHtml = 'BUKVA NEWS • ПЕРЕВІРЕНІ ФАКТИ • АКТУАЛЬНІ ПОДІЇ • ОПЕРАТИВНО ТА ЧЕСНО •';
        if (tickerNews && tickerNews.length > 0) {
            tickerHtml = tickerNews.map(tn => {
                const link = getNewsLink(tn);
                return `<a href="${link}" class="mx-4 hover:text-orange-500 transition-colors">${tn.title}</a>`;
            }).join(' <span class="text-orange-600 font-bold mx-2">/</span> ');
        }

        const navLinksHtml = categories.map(c =>
            `<a href="/${c.slug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm" data-category="${c.slug}">${escapeHtml(c.name)}</a>`
        ).join('');

        const cityLinksHtml = cities.map(c =>
            `<a href="/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1${c.slug === news.city ? ' text-orange-600 font-black text-slate-900' : ''}" data-city="${c.slug}">${escapeHtml(c.name)}</a>`
        ).join('');

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
                                ${categories.map(c => `<a href="/${c.slug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${escapeHtml(c.name)}</a>`).join('')}
                                <a href="/live/" class="pt-4 text-orange-600 font-black flex items-center gap-2"><span class="flex h-2 w-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>LIVE • ЕФІР</a>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">МІСТА</h3>
                            <div id="mobile-city-list" class="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                                ${cities.map(c => `<a href="/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">${escapeHtml(c.name)}</a>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        htmlContent = htmlContent.replace(/<div id="site-header-placeholder"><\/div>/, `<div id="site-header-placeholder">${headerHtml}</div>`);

        const postData = { ...news };
        delete postData.content;

        const ssrScript = `<script>
        window.__SSR_ID__ = '${news.id}';
        window.__SSR_SLUG__ = '${news.slug}';
        window.__SSR_CONTENT_PRE_RENDERED__ = true;
        window.__SSR_POST_DATA__ = ${JSON.stringify(postData)};
        window.__SSR_CATEGORIES__ = ${JSON.stringify(categories)};
        window.__SSR_CITIES__ = ${JSON.stringify(cities)};
        window.__SSR_TICKER__ = ${JSON.stringify(tickerNews)};
    </script>`;

        const injectIntoId = (html, id, content) => {
            const regex = new RegExp(`(id=["']${id}["'][^>]*>)`, 'g');
            return html.replace(regex, `$1${content || ''}`);
        };

        htmlContent = injectIntoId(htmlContent, 'news-title', news.title);
        htmlContent = injectIntoId(htmlContent, 'news-text', news.content);
        htmlContent = injectIntoId(htmlContent, 'breadcrumb-category', CAT_MAP[news.category] || news.category);
        htmlContent = injectIntoId(htmlContent, 'news-date', formattedDate);
        htmlContent = injectIntoId(htmlContent, 'reading-time', readingTimeText);
        htmlContent = injectIntoId(htmlContent, 'view-count', news.views || 0);

        if (news.image_url) {
            htmlContent = htmlContent.replace('id="news-image" src=""', `id="news-image" src="${news.image_url}" alt="${escapeAttr(news.title)}"`);
        }

        htmlContent = htmlContent.replace('id="loader"', 'id="loader" class="hidden"');
        htmlContent = htmlContent.replace('id="news-content" class="hidden"', 'id="news-content"');

        let metaBadgesHtml = '';
        if (news.city) metaBadgesHtml += `<div class="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-orange-100 shadow-sm leading-none">${CITY_MAP[news.city] || news.city}</div>`;
        metaBadgesHtml += `<div class="inline-flex items-center bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm leading-none">${CAT_MAP[news.category] || news.category}</div>`;
        if (news.tags) news.tags.forEach(t => {
            metaBadgesHtml += `<span class="bg-slate-50 text-slate-500 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-100 shadow-sm leading-none">#${t}</span>`;
        });
        htmlContent = injectIntoId(htmlContent, 'news-meta-tags', metaBadgesHtml);

        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>\n${metaTags}\n${ssrScript}`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
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
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}