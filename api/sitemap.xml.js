const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

// Fallbacks for when Supabase is unavailable
const CITIES_FALLBACK = ['kalush', 'if', 'kolomyya', 'dolyna', 'bolekhiv', 'nadvirna', 'burshtyn', 'kosiv', 'yaremche'];
const CATEGORIES_FALLBACK = ['politics', 'economy', 'sport', 'culture', 'tech', 'frankivsk', 'oblast', 'war'];

module.exports = async (req, res) => {
    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        };

        // Fetch cities, categories, and articles IN PARALLEL from Supabase
        const [citiesRes, categoriesRes, articlesRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/cities?select=slug&order=order_index.asc`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/categories?select=slug&order=order_index.asc`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=slug,updated_at,created_at&order=created_at.desc`, { headers })
        ]);

        // Parse results, fall back to hardcoded lists on error
        const citiesData = citiesRes.ok ? await citiesRes.json() : [];
        const categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
        const articlesData = articlesRes.ok ? await articlesRes.json() : [];

        const cities = citiesData.length > 0
            ? citiesData.map(c => c.slug).filter(Boolean)
            : CITIES_FALLBACK;

        const categories = categoriesData.length > 0
            ? categoriesData.map(c => c.slug).filter(Boolean)
            : CATEGORIES_FALLBACK;

        const articles = articlesData.filter(a => a.slug);

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

        // Build URL list
        const staticUrls = [
            { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'hourly' },
            ...cities.map(slug => ({
                loc: `${SITE_URL}/${slug}/`,
                priority: '0.9',
                changefreq: 'hourly'
            })),
            ...categories.map(slug => ({
                loc: `${SITE_URL}/category/${CATEGORY_EN_TO_UK_SLUG[slug] || slug}/`,
                priority: '0.8',
                changefreq: 'hourly'
            }))
        ];

        const articleUrls = articles.map(a => ({
            loc: `${SITE_URL}/news/${a.slug}/`,
            lastmod: (a.updated_at || a.created_at || new Date().toISOString()).split('T')[0],
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
        // Cache 1 hour on edge — fresh enough for SEO, not stale after admin changes
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
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
