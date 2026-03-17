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
        // Fetch city settings
        const settingsArr = await fetchFromSupabase('portal_settings', `city_slug=eq.${citySlug}&select=*`);
        const settings = (settingsArr && settingsArr.length > 0) ? settingsArr[0] : null;

        // Map database fields to our config
        const portalName = settings?.portal_name || `${citySlug.toUpperCase()} ПОРТАЛ`;
        const logoUrl = settings?.logo_url || '/logo.png';
        const seo = settings?.seo_config || {};
        
        const title = seo.title || `${portalName} | Новини, заклади, оголошення`;
        const description = seo.description || `Найповніший портал міста ${portalName}: новини, каталог цікавих закладів, дошка оголошень та важливі міські події.`;
        const canonicalUrl = `https://${citySlug}.bukva.news/`;

        // Read template
        const portalPath = path.join(process.cwd(), 'portal.html');
        let htmlContent = fs.readFileSync(portalPath, 'utf8');

        // SEO and Config Injection
        const headInjections = `
            <title>${title}</title>
            <meta name="description" content="${description}">
            <link rel="canonical" href="${canonicalUrl}">
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:url" content="${canonicalUrl}">
            <meta property="og:image" content="${logoUrl}">
            <script>
                window.PORTAL_CONFIG = ${JSON.stringify({ citySlug, portalName, logoUrl })};
            </script>
        `;

        // Replace existing title if any, otherwise prepend to </head>
        htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, '');
        htmlContent = htmlContent.replace('</head>', `${headInjections}\n</head>`);

        // Final UI placeholders replacement (for the Hero)
        htmlContent = htmlContent.replace(/ТВОЄ МІСТО/g, `МІСТО ${citySlug.toUpperCase()}`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(htmlContent);

    } catch (e) {
        console.error('Portal Handler Error:', e);
        return res.status(500).send('Portal Error');
    }
};
