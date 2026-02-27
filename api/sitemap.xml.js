const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

const CITIES = ['kalush', 'if', 'kolomyya', 'dolyna', 'bolekhiv', 'nadvirna', 'burshtyn', 'kosiv', 'yaremche'];
const CATEGORIES = ['politics', 'economy', 'sport', 'culture', 'tech', 'frankivsk', 'oblast', 'war'];

module.exports = async (req, res) => {
    try {
        // Fetch all published articles from Supabase REST API
        const apiUrl = `${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=slug,created_at,updated_at&order=created_at.desc`;
        const response = await fetch(apiUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        let articles = [];
        if (response.ok) {
            articles = await response.json();
        }

        const now = new Date().toISOString();

        // Build static URLs
        const staticUrls = [
            { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'hourly' },
            ...CATEGORIES.map(cat => ({
                loc: `${SITE_URL}/?category=${cat}`,
                priority: '0.8',
                changefreq: 'hourly'
            })),
            ...CITIES.map(city => ({
                loc: `${SITE_URL}/${city}/`,
                priority: '0.9',
                changefreq: 'hourly'
            }))
        ];

        // Article URLs
        const articleUrls = articles
            .filter(a => a.slug)
            .map(a => ({
                loc: `${SITE_URL}/news/${a.slug}/`,
                lastmod: (a.updated_at || a.created_at || now).split('T')[0],
                priority: '0.7',
                changefreq: 'weekly'
            }));

        const allUrls = [...staticUrls, ...articleUrls];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(200).send(xml);

    } catch (err) {
        console.error('Sitemap error:', err);
        return res.status(500).send('Sitemap generation failed');
    }
};

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
