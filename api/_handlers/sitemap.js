const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

module.exports = async (req, res) => {
    let { type, page } = req.query;
    if (Array.isArray(type)) type = type[0];
    if (Array.isArray(page)) page = page[0];

    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        };

        if (type === 'pages') return await servePages(res, headers);
        if (type === 'posts') return await servePosts(res, headers, page);
        if (type === 'news') return await serveNews(res, headers);

        // Default to Index
        return await serveIndex(res, headers);

    } catch (err) {
        console.error('Sitemap error:', err);
        return res.status(500).send('Sitemap generation failed');
    }
};

async function serveIndex(res, headers) {
    // 1. Get total post count to determine how many post sitemaps we need
    let postSitemaps = ['sitemap-posts-1.xml']; // Always at least one
    try {
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=is.true&select=id`, {
            method: 'HEAD',
            headers: { ...headers, 'Prefer': 'count=exact' }
        });
        const range = countRes.headers.get('content-range');
        if (range) {
            const total = parseInt(range.split('/')[1]);
            const chunks = Math.ceil(total / 1000);
            postSitemaps = [];
            for (let i = 1; i <= chunks; i++) {
                postSitemaps.push(`sitemap-posts-${i}.xml`);
            }
        }
    } catch (e) {
        console.warn('Could not fetch post count for sitemap index', e);
    }

    const sitemaps = ['sitemap-pages.xml', ...postSitemaps, 'sitemap-news.xml'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${SITE_URL}/${s}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
    return sendXml(res, xml, 86400); // 24h cache for index
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
        if (c.slug) urls.push({ loc: `${SITE_URL}/${CAT_MAP[c.slug] || c.slug}/`, priority: '0.7', changefreq: 'daily' });
    });
    cities.forEach(c => {
        if (c.slug) urls.push({ loc: `${SITE_URL}/${c.slug}/`, priority: '0.7', changefreq: 'daily' });
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
    return sendXml(res, xml, 86400); // 24h
}

async function servePosts(res, headers, pageNum = 1) {
    let articles = [];
    const limit = 1000;
    const page = parseInt(pageNum) || 1;
    const offset = (page - 1) * limit;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=is.true&select=slug,created_at,city,category&order=created_at.desc&limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            console.error(`Supabase error fetching posts page ${page}: ${response.status}`);
        } else {
            articles = await response.json();
        }
    } catch (e) {
        console.error("Posts fetch error:", e);
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
        
        let path;
        if (a.city) {
            path = `/novyny/${a.city}/${a.slug}/`;
        } else if (a.category) {
            const categorySlug = CAT_MAP[a.category] || a.category;
            path = `/${categorySlug}/${a.slug}/`;
        } else {
            path = `/${a.slug}/`;
        }

        return `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }).join('\n')}
</urlset>`;
    return sendXml(res, xml, 86400); // 24h cache
}

async function serveNews(res, headers) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const apiUrl = `${SUPABASE_URL}/rest/v1/news?is_published=is.true&created_at=gte.${encodeURIComponent(cutoff)}&select=slug,title,created_at,city,category&order=created_at.desc`;
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
        let path;
        if (a.city) {
            path = `/novyny/${a.city}/${a.slug}/`;
        } else if (a.category) {
            const cat = CAT_MAP[a.category] || a.category;
            path = `/${cat}/${a.slug}/`;
        } else {
            path = `/novyny/${a.slug}/`;
        }

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
    return new Date(dateStr).toISOString();
}

function escapeXml(str) {
    return String(str || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": "&apos;" }[c]));
}
