const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

module.exports = async (req, res) => {
    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        };

        // Fetch ALL published news articles
        const response = await fetch(`${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=slug,updated_at,created_at&order=created_at.desc`, { headers });

        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        const articles = await response.json();

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${articles.filter(a => a.slug).map(a => {
            const lastmod = (a.updated_at || a.created_at || new Date().toISOString()).split('T')[0];
            return `  <url>
    <loc>${escapeXml(`${SITE_URL}/news/${a.slug}/`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`;
        }).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(200).send(xml);
    } catch (err) {
        console.error('Sitemap posts error:', err);
        return res.status(500).send('Failed to generate sitemap-posts');
    }
};

function escapeXml(str) {
    return String(str || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": "&apos;" }[c]));
}
