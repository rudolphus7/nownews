const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const prompt = `Ти професійний український журналіст. Твоє завдання - переписати надану статтю у фірмовому стилі видання "IF News". Ми цінуємо динамічність, об'єктивність та влучні заголовки.

Вимоги до результату:
1. Залиш зміст повністю ідентичним оригіналу, не вигадуй нових фактів.
2. Тон: Професійний, стриманий, але енергійний.
3. Перший рядок має бути новим потужним заголовком (без символів #).
4. Решта тексту - основний зміст статті.
5. Використовуй HTML теги (p, h2, strong) для структурування.
6. В кінці додай підпис: ПЕРЕПИСАНО ШІ.

Оригінальний заголовок: ${title}
Оригінальний текст публікації:
${content.replace(/<[^>]*>/g, ' ')}

Поверни результат у форматі:
ЗАГОЛОВОК
Текст у форматі HTML`;

    async function tryGemini(version, model, key, payload) {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response;
    }

    try {
        let response = await tryGemini('v1beta', 'gemini-1.5-flash-latest', GEMINI_API_KEY, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (!response.ok) {
            console.log("v1beta failed, trying v1...");
            response = await tryGemini('v1', 'gemini-1.5-flash-latest', GEMINI_API_KEY, {
                contents: [{ parts: [{ text: prompt }] }]
            });
        }

        const data = await response.json();

        if (data.error) {
            console.error('Gemini API Error:', data.error);
            return res.status(500).json({ error: data.error.message || "AI Model error" });
        }

        const aiText = data.candidates[0].content.parts[0].text;

        // Split into title and body
        const lines = aiText.split('\n').filter(l => l.trim().length > 0);
        let rewrittenTitle = title;
        let bodyLines = lines;

        if (lines.length > 0) {
            rewrittenTitle = lines[0].replace(/#/g, '').trim();
            bodyLines = lines.slice(1);
        }

        // Cleanup body: convert markdown-style back to HTML
        let rewrittenContent = bodyLines.join('\n')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        if (rewrittenContent && !rewrittenContent.startsWith('<h') && !rewrittenContent.startsWith('<p')) {
            rewrittenContent = '<p>' + rewrittenContent + '</p>';
        }

        // Add a standard signature
        const signature = `<p><br></p><hr><p><strong>Матеріал відредаговано за допомогою ШІ для "IF News".</strong></p>`;

        return res.status(200).json({
            title: rewrittenTitle,
            content: rewrittenContent + signature
        });

    } catch (err) {
        console.error('Server Side AI Error:', err);
        return res.status(500).json({ error: 'Internal Server Error during AI processing' });
    }
};
