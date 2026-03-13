const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';

module.exports = async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        
        // Delete unpublished and non-imported articles older than 48 hours
        const apiUrl = `${SUPABASE_URL}/rest/v1/rss_articles?is_imported=eq.false&is_dismissed=eq.false&pub_date=lt.${encodeURIComponent(cutoff)}`;
        
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase delete failed: ${response.status} - ${errorText}`);
        }

        return res.status(200).json({ ok: true, message: 'Old RSS articles cleaned up successfully' });

    } catch (err) {
        console.error('Cleanup error:', err);
        return res.status(500).json({ error: 'Cleanup failed', message: err.message });
    }
};
