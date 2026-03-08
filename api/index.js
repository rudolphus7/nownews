/**
 * BUKVA NEWS — Central API Router
 * Consolidates multiple serverless functions to stay under Vercel's Hobby plan limit (12).
 */

const handlers = {
    'news': require('./_handlers/news'),
    'category': require('./_handlers/category'),
    'city': require('./_handlers/city'),
    'sitemap': require('./_handlers/sitemap'),
    'rss': require('./_handlers/rss'),
    'live': require('./_handlers/live'),
    'tts': require('./_handlers/tts'),
    'upload-tts': require('./_handlers/upload-tts'),
    'ai': require('./_handlers/ai'),
    'admin-auth': require('./_handlers/admin-auth'),
    'subscribe': require('./_handlers/subscribe'),
    'settings': require('./_handlers/settings'),
    'rss-proxy': require('./_handlers/rss-proxy')
};

module.exports = async (req, res) => {
    // Determine which handler to use based on the path or a query parameter
    // Vercel rewrites will pass the original intent via query or path

    // 1. Get the target from query (set by vercel.json rewrites)
    const target = req.query.__target;

    if (target && handlers[target]) {
        try {
            return await handlers[target](req, res);
        } catch (err) {
            console.error(`Handler Error [${target}]:`, err);
            return res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    }

    // 2. Fallback: try to guess from URL if no __target is provided
    const path = req.url.split('?')[0];
    const fileName = path.split('/').pop();
    if (handlers[fileName]) {
        try {
            return await handlers[fileName](req, res);
        } catch (err) {
            console.error(`Fallback Handler Error [${fileName}]:`, err);
        }
    }

    if (path.includes('/api/tts')) return await handlers['tts'](req, res);
    if (path.includes('/api/ai')) return await handlers['ai'](req, res);
    if (path.includes('/api/rss-proxy')) return await handlers['rss-proxy'](req, res);

    // Default 404
    console.warn('No handler found for request:', req.url);
    return res.status(404).json({ error: 'Endpoint not found' });
};
