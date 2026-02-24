const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const prompt = `Ти професійний український журналіст видання "IF News". 
Перепиши статтю повністю іншими словами, в іншому журналістському стилі — живому, динамічному, з авторським голосом. Уникай копіювання оригінальних речень.

Вимоги:
1. Перший рядок — новий заголовок (без знаків # або *).
2. Далі — текст у форматі HTML (використовуй теги p, h2, strong).
3. В кінці додай підпис: <p><em>ПЕРЕПИСАНО ШІ</em></p>

Оригінальний заголовок: ${title}
Текст: ${content.replace(/<[^>]*>/g, ' ')}`;

    async function tryGemini(model, key) {
        // Використовуємо v1beta — він підтримує найновіші моделі
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 2048
                    }
                })
            });
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, data };
        } catch (e) {
            return { ok: false, data: { error: { message: e.message } } };
        }
    }

    try {
        // Актуальні моделі з твого API ключа
        const models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-flash-latest',
        ];

        let errors = [];
        let successResponse = null;

        for (const model of models) {
            console.log(`Trying model: ${model}`);
            const { ok, data } = await tryGemini(model, GEMINI_API_KEY);

            if (ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                successResponse = data;
                console.log(`Success with model: ${model}`);
                break;
            } else {
                const errMsg = data.error?.message || 'Unknown error';
                errors.push(`${model}: ${errMsg}`);
                console.error(`Failed ${model}: ${errMsg}`);
            }
        }

        if (!successResponse) {
            return res.status(500).json({
                error: 'Всі моделі ШІ недоступні.',
                details: errors.join(' | ')
            });
        }

        const aiText = successResponse.candidates[0].content.parts[0].text;
        const lines = aiText.split('\n').filter(l => l.trim().length > 0);

        let rewrittenTitle = title;
        let bodyLines = lines;

        if (lines.length > 0) {
            // Перший рядок — заголовок, прибираємо зайві символи
            rewrittenTitle = lines[0].replace(/[*#]/g, '').trim();
            bodyLines = lines.slice(1);
        }

        // Форматування тексту
        let rewrittenContent = bodyLines.join('\n')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        if (!rewrittenContent.startsWith('<')) {
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