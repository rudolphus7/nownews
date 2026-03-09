const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://bukva.news';

module.exports = async (req, res) => {
    try {
        const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

        // Отримуємо останні 50 опублікованих новин
        const apiUrl = `${SUPABASE_URL}/rest/v1/news?is_published=eq.true&select=id,title,slug,content,created_at,image_url,category,city,meta_description&order=created_at.desc&limit=50`;
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) throw new Error('Failed to fetch from Supabase');
        const news = await response.json();

        const CAT_MAP = {
            'war': 'viyna', 'politics': 'polityka', 'economy': 'ekonomika',
            'sport': 'sport', 'culture': 'kultura', 'tech': 'tekhnolohii',
            'frankivsk': 'frankivsk', 'oblast': 'oblast'
        };

        const rssItems = news.map(item => {
            const description = item.meta_description || (item.content || '').replace(/<[^>]*>/g, '').substring(0, 300) + '...';
            let path = `/news/${item.slug}/`;
            if (item.city) path = `/${item.city}/${item.slug}/`;
            else if (item.category && CAT_MAP[item.category]) path = `/category/${CAT_MAP[item.category]}/${item.slug}/`;

            const link = `${SITE_URL}${path}`;
            const pubDate = new Date(item.created_at).toUTCString();

            return `
        <item>
            <title><![CDATA[${item.title}]]></title>
            <link>${link}</link>
            <guid isPermaLink="false">${item.id}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[${description}]]></description>
            ${item.image_url ? `<enclosure url="${item.image_url}" length="0" type="image/jpeg" />` : ''}
            ${item.image_url ? `<media:content url="${item.image_url}" medium="image" />` : ''}
            <category>${CAT_MAP[item.category] || item.category || 'Новини'}</category>
        </item>`;
        }).join('');

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>BUKVA NEWS | Головні новини Івано-Франківщини</title>
    <link>${SITE_URL}</link>
    <description>Незалежна журналістика Івано-Франківщини. Політика, економіка, війна, культура і спорт.</description>
    <language>uk</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed/" rel="self" type="application/rss+xml" />
    <image>
        <url>${SITE_URL}/logo.png</url>
        <title>BUKVA NEWS</title>
        <link>${SITE_URL}</link>
    </image>
    ${rssItems}
</channel>
</rss>`;

        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60');
        return res.status(200).send(rss);

    } catch (err) {
        console.error('RSS error:', err);
        return res.status(500).send('RSS generation failed');
    }
};
