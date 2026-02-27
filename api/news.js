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

        const news = await response.json();

        if (!news || Object.keys(news).length === 0) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlContent);
        }

        const CATEGORY_EN_TO_UK_SLUG = {
            'war': 'viyna',
            'politics': 'polityka',
            'economy': 'ekonomika',
            'sport': 'sport',
            'culture': 'kultura',
            'tech': 'tekhnolohii',
            'frankivsk': 'frankivsk',
            'oblast': 'oblast'
        };

        // Canonical URL logic — preference order: city > category > default news
        let canonicalUrl = `${SITE_URL}/news/${news.slug}/`;
        if (news.city && CITIES_MAP[news.city]) {
            canonicalUrl = `${SITE_URL}/${news.city}/${news.slug}/`;
        } else if (news.category && CATEGORY_EN_TO_UK_SLUG[news.category]) {
            canonicalUrl = `${SITE_URL}/category/${CATEGORY_EN_TO_UK_SLUG[news.category]}/${news.slug}/`;
        } else if (!news.slug) {
            canonicalUrl = `${SITE_URL}/news/?id=${news.id}`;
        }

        const title = `${news.title} | IF News`;
        const description = (news.meta_description || news.content || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 160);
        const image = news.image_url || `${SITE_URL}/og-default.jpg`;
        const publishedDate = news.created_at ? new Date(news.created_at).toISOString() : '';
        const author = news.author || 'Редакція IF News';
        const siteName = 'Прикарпаття News | IF News';

        // Inject SEO meta tags before </head>
        const metaTags = `
    <!-- SEO & Open Graph Meta Tags -->
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="author" content="${escapeAttr(author)}">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">

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
                "name": "${escapeJson(CITIES_MAP[news.city] || news.city)}",
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

        // Inject SSR data so client JS always knows the slug/id
        const ssrScript = `<script>
    window.__SSR_SLUG__ = '${escapeJson(news.slug || '')}';
    window.__SSR_ID__ = '${escapeJson(String(news.id || ''))}'; 
<\/script>`;

        // Inject before </head>
        htmlContent = htmlContent.replace('</head>', `${ssrScript}\n${metaTags}\n</head>`);

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
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
