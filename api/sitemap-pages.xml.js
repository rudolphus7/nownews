const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

module.exports = async (req, res) => {
    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        };

        const [citiesRes, categoriesRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/cities?select=slug&order=order_index.asc`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/categories?select=slug&order=order_index.asc`, { headers })
        ]);

        const cities = citiesRes.ok ? await citiesRes.json().catch(() => []) : [];
        const categories = categoriesRes.ok ? await categoriesRes.json().catch(() => []) : [];

        // Simple mapping for categories if needed (based on previous logic)
        const CAT_MAP = {
            'war': 'viyna', 'politics': 'polityka', 'economy': 'ekonomika',
            'sport': 'sport', 'culture': 'kultura', 'tech': 'tekhnolohii',
            'frankivsk': 'frankivsk', 'oblast': 'oblast'
        };

        const urls = [
            { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'hourly' }
        ];

        // Add Categories
        categories.forEach(c => {
            if (c.slug) {
                urls.push({
                    loc: `${SITE_URL}/category/${CAT_MAP[c.slug] || c.slug}/`,
                    priority: '0.7',
                    changefreq: 'hourly'
                });
            }
        });

        // Add Cities
        cities.forEach(c => {
            if (c.slug) {
                urls.push({
                    loc: `${SITE_URL}/${c.slug}/`,
                    priority: '0.6',
                    changefreq: 'daily'
                });
            }
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(200).send(xml);
    } catch (err) {
        console.error('Sitemap pages error:', err);
        return res.status(500).send('Failed to generate sitemap-pages');
    }
};

function escapeXml(str) {
    return String(str || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": "&apos;" }[c]));
}
