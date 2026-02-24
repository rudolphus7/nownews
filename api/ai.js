const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const cleanText = content.replace(/<[^>]*>/g, ' ').trim();
    const wordCount = cleanText.split(/\s+/).length;

    const prompt = `Ти — досвідчений старший журналіст українського видання "IF News". Твоє завдання — повністю переписати статтю нижче.

КРИТИЧНО ВАЖЛИВО:
- Вихідний текст має бути ТАКОГО САМОГО ОБСЯГУ або більшого, що й оригінал (оригінал містить приблизно ${wordCount} слів — ти маєш написати щонайменше стільки ж).
- НЕ скорочуй, НЕ підсумовуй, НЕ пропускай жодного смислового блоку чи розділу.
- Кожен абзац оригіналу має мати відповідний переписаний абзац у твоєму тексті.
- Кожна цитата зі Святого Письма або іншого джерела має бути збережена дослівно, але її подача (речення навколо неї) — переписана.

Стиль:
- Журналістський, живий, аналітичний, з авторським голосом.
- Не копіюй жодного речення з оригіналу — тільки переформулюй.
- Емоційно насичено, але без пафосу.
- Структура — як у серйозній газетній статті.

Формат відповіді:
1. Перший рядок — новий заголовок (без жодних символів #, *, тощо).
2. Далі — увесь текст у форматі HTML: абзаци у тегах <p>, підзаголовки у <h2>, важливі думки у <strong>.
3. Не додавай жодних пояснень від себе — лише заголовок і текст статті.
4. В самому кінці: <p><em>ПЕРЕПИСАНО ШІ</em></p>

Оригінальний заголовок: ${title}

Оригінальний текст:
${cleanText}`;

    async function tryGemini(model) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.85,
                        maxOutputTokens: 8192  // збільшено для довгих статей
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
            const { ok, data } = await tryGemini(model);

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
            rewrittenTitle = lines[0].replace(/[*#]/g, '').trim();
            bodyLines = lines.slice(1);
        }

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