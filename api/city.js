const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

const CITIES_MAP = {
    'kalush': 'Калуш',
    'if': 'Івано-Франківськ',
    'kolomyya': 'Коломия',
    'dolyna': 'Долина',
    'bolekhiv': 'Болехів',
    'nadvirna': 'Надвірна',
    'burshtyn': 'Бурштин',
    'kosiv': 'Косів',
    'yaremche': 'Яремче'
};

module.exports = async (req, res) => {
    // City slug comes from query string: /api/city?city=kolomyya
    // (Vercel rewrite maps /:city/ → /api/city?city=:city)
    let city = req.query.city;
    if (Array.isArray(city)) city = city[0];

    if (!city || !CITIES_MAP[city]) {
        res.status(404).send('City not found');
        return;
    }

    const cityName = CITIES_MAP[city];
    const canonicalUrl = `${SITE_URL}/${city}/`;
    const title = `Новини ${cityName} сьогодні — останні події | Прикарпаття News`;
    const description = `Актуальні новини ${cityName}: місцеві події, факти, оперативна інформація. Слідкуйте за головними новинами першими на IF News.`;
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
        console.error('Template Error:', e);
        return res.status(500).send('Configuration error');
    }

    // Build SEO meta block
    const metaTags = `
    <!-- City Page SEO -->
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
                "name": "${escapeJson(cityName)}",
                "item": "${escapeJson(canonicalUrl)}"
            }
        ]
    }
    <\/script>
    <!-- End City SEO -->`;

    // Inject SSR data for the city filter
    const ssrScript = `<script>
    window.__SSR_CITY__ = '${city}';
<\/script>`;

    // Replace <title> and inject metas before </head>
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

    // Remove existing canonical/description if already in HTML (avoid duplicates)
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
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
