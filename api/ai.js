const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    // Покращений промпт для кращої структуризації
    const prompt = `Ти професійний український журналіст видання "IF News". 
Перепиши статтю, зберігаючи факти, але додаючи динаміки.

Вимоги:
1. Перший рядок — новий заголовок (без знаків #).
2. Далі — текст у форматі HTML (p, h2, strong).
3. В кінці підпис: ПЕРЕПИСАНО ШІ.

Оригінальний заголовок: ${title}
Текст: ${content.replace(/<[^>]*>/g, ' ')}`;

    async function tryGemini(version, model, key, payload) {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${key}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return response;
        } catch (e) {
            return { ok: false, statusText: e.message };
        }
    }

    try {
        // Пріоритет на актуальні моделі 2026 року
        const models = [
            'gemini-3-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash'
        ];

        // v1beta зазвичай підтримує нові моделі краще
        const versions = ['v1beta', 'v1'];
        let errors = [];
        let successResponse = null;

        outerLoop: for (const model of models) {
            for (const ver of versions) {
                console.log(`Checking: ${model} (${ver})`);

                const response = await tryGemini(ver, model, GEMINI_API_KEY, {
                    contents: [{ parts: [{ text: prompt }] }]
                });

                const data = await response.json().catch(() => ({}));

                if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    successResponse = data;
                    break outerLoop;
                } else {
                    const errMsg = data.error?.message || response.statusText || "Unknown error";
                    // Якщо помилка 429 (квота), ми не зупиняємось, а пробуємо наступну модель
                    errors.push(`${model}(${ver}): ${errMsg}`);
                    console.error(`AI Attempt failed: ${model} - ${errMsg}`);
                }
            }
        }

        if (!successResponse) {
            return res.status(500).json({
                error: "ШІ тимчасово перевантажений або модель недоступна.",
                details: errors.join(' | ')
            });
        }

        const aiText = successResponse.candidates[0].content.parts[0].text;
        const lines = aiText.split('\n').filter(l => l.trim().length > 0);

        let rewrittenTitle = title;
        let bodyLines = lines;

        if (lines.length > 0) {
            rewrittenTitle = lines[0].replace(/[*#]/g, '').trim();
            bodyLines = lines.slice(1);
        }

        // Чистка та форматування контенту
        let rewrittenContent = bodyLines.join('\n')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        if (!rewrittenContent.startsWith('<p')) {
            rewrittenContent = `<p>${rewrittenContent}</p>`;
        }

        const signature = `<p><br></p><hr><p><strong>Матеріал відредаговано за допомогою ШІ для "IF News".</strong></p>`;

        return res.status(200).json({
            title: rewrittenTitle,
            content: rewrittenContent + signature
        });

    } catch (err) {
        console.error('Final Catch Error:', err);
        return res.status(500).json({ error: 'Критична помилка сервера при обробці ШІ.' });
    }
};