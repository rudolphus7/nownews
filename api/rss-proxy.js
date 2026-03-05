/**
 * /api/rss-proxy.js — Серверний RSS-проксі для Vercel
 *
 * Отримує RSS/Atom feed на сервері й повертає клієнту,
 * обходячи будь-які CORS-обмеження браузера.
 *
 * Використання: /api/rss-proxy?url=https://kalush.informator.ua/feed/
 */

module.exports = async (req, res) => {
    // Дозволяємо запити лише з нашого домену (безпека)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing "url" query parameter' });
    }

    // Базова валідація URL
    try {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: 'Invalid URL protocol' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                // Представляємось як браузер, щоб сайти не блокували запит
                'User-Agent': 'Mozilla/5.0 (compatible; BUKVA-NEWS-RSS-Bot/1.0; +https://bukva.news)',
                'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
                'Accept-Language': 'uk,en;q=0.9',
                'Cache-Control': 'no-cache',
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).json({
                error: `Upstream server returned ${response.status}: ${response.statusText}`,
                status: response.status
            });
        }

        const contentType = response.headers.get('content-type') || 'application/xml';
        const body = await response.text();

        // Кешуємо відповідь на 5 хвилин на рівні CDN Vercel
        res.setHeader('Content-Type', contentType.includes('xml') ? 'application/xml; charset=utf-8' : contentType);
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        res.setHeader('X-Proxy-Source', new URL(targetUrl).hostname);

        return res.status(200).send(body);

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request timed out after 10 seconds' });
        }
        console.error('[rss-proxy] Fetch error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch upstream: ' + err.message });
    }
};
