module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const FB_PAGE_ID = process.env.FB_PAGE_ID;
    const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        return res.status(500).json({
            error: 'Server configuration error: Missing Facebook Credentials (FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN) in Vercel settings.'
        });
    }

    const { message } = req.body;

    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message content is required' });
    }

    try {
        const fbUrl = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`;

        const params = new URLSearchParams();
        params.append('message', message);
        params.append('access_token', FB_PAGE_ACCESS_TOKEN);

        const response = await fetch(fbUrl, {
            method: 'POST',
            body: params
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Facebook API Error:", data);
            throw new Error(data.error?.message || "Невідома помилка Facebook API");
        }

        return res.status(200).json({
            success: true,
            id: data.id,
            message: "Successfully posted to Facebook"
        });

    } catch (error) {
        console.error("Server Error while posting to Facebook:", error);
        return res.status(500).json({ error: error.message });
    }
};
