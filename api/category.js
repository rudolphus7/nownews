const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

/**
 * Bidirectional category mapping:
 * - UK_SLUG_TO_EN: /category/viyna/ → 'war' (for DB queries)
 * - EN_TO_UK_SLUG: 'war' → 'viyna' (for generating URLs)
 * - UK_SLUG_TO_NAME: 'viyna' → 'Війна' (for display)
 */
const UK_SLUG_TO_EN = {
    'viyna': 'war',
    'polityka': 'politics',
    'ekonomika': 'economy',
    'sport': 'sport',
    'kultura': 'culture',
    'tekhnolohii': 'tech',
    'frankivsk': 'frankivsk',
    'oblast': 'oblast'
};

const UK_SLUG_TO_NAME = {
    'viyna': 'Війна',
    'polityka': 'Політика',
    'ekonomika': 'Економіка',
    'sport': 'Спорт',
    'kultura': 'Культура',
    'tekhnolohii': 'Технології',
    'frankivsk': 'Франківськ',
    'oblast': 'Область'
};

module.exports = async (req, res) => {
    // Vercel rewrite: /category/viyna/ → /api/category?slug=viyna
    let slug = req.query.slug;
    if (Array.isArray(slug)) slug = slug[0];

    if (!slug || !UK_SLUG_TO_NAME[slug]) {
        // Unknown category slug — fallback to homepage
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    const categoryName = UK_SLUG_TO_NAME[slug];
    const canonicalUrl = `${SITE_URL}/category/${slug}/`;
    const title = `${categoryName} — новини Прикарпаття | IF News`;
    const description = `Новини рубрики «${categoryName}»: всі головні події Івано-Франківщини та Прикарпаття. Читайте оперативно на IF News.`;
    const siteName = 'Прикарпаття News | IF News';

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
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
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
    <!-- End Category SEO -->`;

    // SSR data: passes the EN slug so index.html JS can filter news by DB category
    const ssrScript = `<script>
    window.__SSR_CATEGORY_SLUG__ = '${slug}';
    window.__SSR_CATEGORY_EN__ = '${UK_SLUG_TO_EN[slug]}';
<\/script>`;

    // Inject into template
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
    htmlContent = htmlContent.replace(/<meta name="description"[^>]*>/gi, '');
    htmlContent = htmlContent.replace(/<link rel="canonical"[^>]*>/gi, '');
    htmlContent = htmlContent.replace('</head>', `${ssrScript}\n${metaTags}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
    return res.status(200).send(htmlContent);
};

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeJson(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
