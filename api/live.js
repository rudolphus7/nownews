const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

module.exports = async (req, res) => {
    let id = req.query.track || req.query.id;
    if (Array.isArray(id)) id = id[0];

    console.log('Live SSR Request:', { url: req.url, id });

    let htmlContent = '';
    try {
        const possiblePaths = [
            path.join(process.cwd(), 'live.template.html'),
            path.join(__dirname, '..', 'live.template.html'),
            path.join(__dirname, 'live.template.html')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                htmlContent = fs.readFileSync(p, 'utf8');
                break;
            }
        }

        if (!htmlContent) throw new Error('No live.html file found');
    } catch (e) {
        console.error('Template Read Error:', e);
        return res.status(500).send('Configuration Error: HTML template missing');
    }

    // If no specific news id is requested, return static page (but still allow SSR injection if needed)
    if (!id) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    }

    try {
        const apiUrl = `${SUPABASE_URL}/rest/v1/news?id=eq.${id}&select=*`;
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

        const news = await response.json()[0]; // Supabase returns an array even for eq

        if (!news || Object.keys(news).length === 0) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(htmlContent);
        }

        const title = `🔊 ${news.title} • Голосові новини BUKVA NEWS`;
        let description = 'BUKVA NEWS — голосом диктора. Слухайте по дорозі — без рук, без зупинок.';
        if (news.meta_description) description = news.meta_description;
        else if (news.content) description = news.content.replace(/<[^>]*>/g, '').substring(0, 160) + '...';

        description = description.replace(/\s+/g, ' ').trim();

        const image = news.image_url || `${SITE_URL}/og-default.jpg`;
        const canonicalUrl = `${SITE_URL}/live/?track=${news.id}`;

        // Dynamic Meta Tags
        const metaTags = `
    <!-- Dynamic SEO & Open Graph Meta Tags -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="uk-UA" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph (Facebook, Telegram, Viber) -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(image)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:site_name" content="BUKVA NEWS | Live">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@bukvanews">
    <meta name="twitter:creator" content="@bukvanews">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(image)}">
    
    <script>window.__PRELOADED_TRACK_ID__ = "${escapeJson(id)}";</script>
`;

        // Inject meta tags into <head>
        // More robust replacement to handle multiline tags
        htmlContent = htmlContent.replace(/<title>[\s\S]*?<\/title>/i, '');
        htmlContent = htmlContent.replace(/<meta\s+name="description"\s+content="[\s\S]*?">/i, '');
        htmlContent = htmlContent.replace(/<link\s+rel="canonical"\s+href="[\s\S]*?">/i, '');

        // Inject meta tags and script
        htmlContent = htmlContent.replace('</head>', `${metaTags}\n</head>`);

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
