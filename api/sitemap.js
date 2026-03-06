const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

module.exports = async (req, res) => {
    const { type } = req.query;

    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        };

        if (type === 'pages') return await servePages(res, headers);
        if (type === 'posts') return await servePosts(res, headers);
        if (type === 'news') return await serveNews(res, headers);

        // Default to Index
        return await serveIndex(res);

    } catch (err) {
        console.error('Sitemap error:', err);
        return res.status(500).send('Sitemap generation failed');
    }
};

async function serveIndex(res) {
    const sitemaps = ['sitemap-pages.xml', 'sitemap-posts.xml', 'sitemap-news.xml'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${SITE_URL}/${s}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
    return sendXml(res, xml, 3600);
}

async function servePages(res, headers) {
    const [citiesRes, categoriesRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/cities?select=slug&order=order_index.asc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/categories?select=slug&order=order_index.asc`, { headers })
    ]);

    let cities = [];
    let categories = [];
    try { cities = citiesRes.ok ? await citiesRes.json() : []; } catch (e) { }
    try { categories = categoriesRes.ok ? await categoriesRes.json() : []; } catch (e) { }

    if (!Array.isArray(cities)) cities = [];
    if (!Array.isArray(categories)) categories = [];

    const CAT_MAP = {
        'war': 'viyna', 'politics': 'polityka', 'economy': 'ekonomika',
        'sport': 'sport', 'culture': 'kultura', 'tech': 'tekhnolohii',
        'frankivsk': 'frankivsk', 'oblast': 'oblast'
    };

    const urls = [{ loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' }];
    categories.forEach(c => {
        if (c.slug) urls.push({ loc: `${SITE_URL}/category/${CAT_MAP[c.slug] || c.slug}/`, priority: '0.7', changefreq: 'daily' });
    });
    cities.forEach(c => {
        if (c.slug) urls.push({ loc: `${SITE_URL}/${c.slug}/`, priority: '0.6', changefreq: 'weekly' });
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
    return sendXml(res, xml, 3600);
}

async function servePosts(res, headers) {
    let articles = [];
    try {
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const fetchHeaders = { ...headers, 'Range': `${offset}-${offset + limit - 1}` };
            const response = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=slug,updated_at,created_at,city,category&order=created_at.desc`, {
                method: 'GET',
                headers: fetchHeaders
            });

            if (!response.ok) {
                console.error(`Supabase error fetching posts chunk at offset ${offset}: ${response.status}`);
                break;
            }

            const text = await response.text();
            if (text) {
                const chunk = JSON.parse(text);
                articles = articles.concat(chunk);

                // If we got fewer items than the limit, we've reached the end
                if (chunk.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                hasMore = false;
            }

            // Safety limit to prevent infinite loops or excessively large sitemaps (e.g., max 10000)
            if (articles.length >= 10000) {
                hasMore = false;
            }
        }
    } catch (e) {
        console.error("Posts fetch/parse error:", e);
    }

    if (!Array.isArray(articles)) {
        articles = [];
    }

    const CAT_MAP = {
        'war': 'viyna', 'politics': 'polityka', 'economy': 'ekonomika',
        'sport': 'sport', 'culture': 'kultura', 'tech': 'tekhnolohii',
        'frankivsk': 'frankivsk', 'oblast': 'oblast'
    };

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${articles.filter(a => a.slug).map(a => {
        let lastmod = new Date().toISOString().split('T')[0];
        try {
            if (a.updated_at) lastmod = new Date(a.updated_at).toISOString().split('T')[0];
            else if (a.created_at) lastmod = new Date(a.created_at).toISOString().split('T')[0];
        } catch (e) { }
        let path = `/news/${a.slug}/`;
        if (a.city) path = `/${a.city}/${a.slug}/`;
        else if (a.category && CAT_MAP[a.category]) path = `/category/${CAT_MAP[a.category]}/${a.slug}/`;

        return `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.85</priority>
  </url>`;
    }).join('\n')}
</urlset>`;
    return sendXml(res, xml, 3600);
}

async function serveNews(res, headers) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const apiUrl = `${SUPABASE_URL}/rest/v1/news?is_published=eq.true&created_at=gte.${encodeURIComponent(cutoff)}&select=slug,title,created_at,city,category&order=created_at.desc`;
    const response = await fetch(apiUrl, { headers });
    let articles = [];
    try {
        const text = await response.text();
        if (text) articles = JSON.parse(text);
    } catch (e) {
        console.error("News JSON parse error", e);
    }

    if (!Array.isArray(articles)) articles = [];
    const validArticles = articles.filter(a => a.slug && a.title);

    const CAT_MAP = {
        'war': 'viyna', 'politics': 'polityka', 'economy': 'ekonomika',
        'sport': 'sport', 'culture': 'kultura', 'tech': 'tekhnolohii',
        'frankivsk': 'frankivsk', 'oblast': 'oblast'
    };

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${validArticles.map(a => {
        let path = `/news/${a.slug}/`;
        if (a.city) path = `/${a.city}/${a.slug}/`;
        else if (a.category && CAT_MAP[a.category]) path = `/category/${CAT_MAP[a.category]}/${a.slug}/`;

        return `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
    <news:news>
      <news:publication><news:name>BUKVA NEWS</news:name><news:language>uk</news:language></news:publication>
      <news:publication_date>${formatDate(a.created_at)}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`;
    }).join('\n')}
</urlset>`;
    return sendXml(res, xml, 300);
}

function sendXml(res, xml, maxAge) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${Math.floor(maxAge / 10)}`);
    return res.status(200).send(xml);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+02:00`;
}

function escapeXml(str) {
    return String(str || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": "&apos;" }[c]));
}
