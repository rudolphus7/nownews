const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';
const PUBLICATION_NAME = 'Прикарпаття News';
const PUBLICATION_LANGUAGE = 'uk';

module.exports = async (req, res) => {
    try {
        // Google News requires only articles published in the LAST 48 HOURS
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const apiUrl = `${SUPABASE_URL}/rest/v1/news?is_published=eq.true&created_at=gte.${encodeURIComponent(cutoff)}&select=slug,title,created_at,city,category&order=created_at.desc`;

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

        // Filter out articles without a slug (can't build clean URL)
        const validArticles = articles.filter(a => a.slug && a.title);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${validArticles.map(a => {
            const pubDate = formatDate(a.created_at);
            const loc = `${SITE_URL}/news/${a.slug}/`;

            return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`;
        }).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        // Google News Sitemap should not be heavily cached — 5 minutes max
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        return res.status(200).send(xml);

    } catch (err) {
        console.error('News sitemap error:', err);
        return res.status(500).send('News sitemap generation failed');
    }
};

/**
 * Formats date to ISO 8601 without milliseconds: YYYY-MM-DDThh:mm:ss+02:00
 */
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const pad = (num) => String(num).padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    // Assume +02:00 as per user request/local time
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+02:00`;
}

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
