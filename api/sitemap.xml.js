const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

module.exports = async (req, res) => {
    try {
        const sitemaps = [
            'sitemap-pages.xml',
            'sitemap-posts.xml',
            'sitemap-news.xml'
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${SITE_URL}/${s}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(200).send(xml);

    } catch (err) {
        console.error('Sitemap index error:', err);
        return res.status(500).send('Sitemap index generation failed');
    }
};

