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

    const prompt = `Ти — досвідчений старший журналіст українського видання "BUKVA NEWS". Твоє завдання — повністю переписати статтю нижче.

КРОК 1 — АНАЛІЗ НАСТРОЮ:
Визнач настрій оригінальної статті і витримуй його від першого до останнього слова:
- Трагічний / скорботний → пиши стримано, з болем і гідністю
- Тривожний / напружений → пиши динамічно, з відчуттям загрози
- Надихаючий / героїчний → пиши піднесено, з гордістю
- Інформаційний / нейтральний → пиши чітко, сухо, по суті
- Обурливий / критичний → пиши гостро, з конкретними претензіями
- Духовний / роздумливий → пиши глибоко, неспішно, з паузами між думками

КРОК 2 — СТВОРЕННЯ ЗАГОЛОВКУ (НАЙВАЖЛИВІШЕ):
Придумай заголовок, який змушує людину ОБОВ'ЯЗКОВО клікнути і прочитати.
Правила клікбейтного але чесного заголовку:
- Максимум 10 слів, краще 6-8
- Використовуй інтригу: "Ось чому...", "Те, що приховують...", "Несподівана правда про..."
- Або цифри та конкретику: "3 причини...", "Вперше за 4 роки..."
- Або емоційний удар: починай з дієслова чи сильного іменника
- Або риторичне запитання що чіпляє: "Де був Бог, коли..."
- Заголовок має бути ТОЧНИМ — не обманюй читача, просто зацікав
- НЕ використовуй слова: "розповів", "повідомив", "заявив" — це нудно
- НЕ копіюй оригінальний заголовок навіть частково
Приклади хороших заголовків:
"Чому Бог мовчить під час війни: відповідь із Біблії"
"Загинув захисник: місто прощається з героєм"
"Скандал у міськраді: депутат привласнив гроші для ЗСУ"
"Вибухи вночі: що сталося над Івано-Франківськом"

КРОК 3 — ЗАМІНА ДЖЕРЕЛ (ОБОВ'ЯЗКОВО):
Будь-які згадки сторонніх видань, сайтів, каналів як авторів або джерела — замінюй на "BUKVA NEWS".
Приклади:
"Пише Інформатор" → "Пише BUKVA NEWS"
"Повідомляє УП" → "Повідомляє BUKVA NEWS"
"За даними Суспільного" → "За даними BUKVA NEWS"
"Як пише Укрінформ" → "Як пише BUKVA NEWS"
"Джерело: назва_сайту" → "Джерело: BUKVA NEWS"
"Читайте також у ПІК:" → "Читайте також у BUKVA NEWS:"
Якщо джерело — державний орган, офіційна особа або міжнародна організація — залишай як є.

КРОК 4 — ПЕРЕПИСУВАННЯ ТЕКСТУ:
- Обсяг: не менше ${wordCount} слів (оригінал містить саме стільки).
- НЕ скорочуй, НЕ підсумовуй, НЕ пропускай жодного смислового блоку.
- Кожен абзац оригіналу = окремий переписаний абзац у тебе.
- Цитати (Писання, офіційних осіб) зберігай дослівно, але речення навколо них переписуй.
- Не копіюй жодного речення з оригіналу — тільки переформулюй.

ФОРМАТ ВІДПОВІДІ:
1. Перший рядок — тільки заголовок (без символів #, *, — тощо, без лапок).
2. Увесь текст у HTML: абзаци у <p>, підзаголовки у <h2>, акценти у <strong>.
3. Жодних пояснень від себе — лише заголовок і текст.
4. Останній рядок точно такий: <p><strong>Матеріал підготовлено командою "BUKVA NEWS"</strong></p>

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
                        temperature: 0.9,
                        maxOutputTokens: 8192
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
            rewrittenTitle = lines[0].replace(/[*#"«»]/g, '').trim();
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

        // Підпис жорстко прописаний в коді — на випадок якщо ШІ забуде
        const signature = `<p><br></p><hr><p><strong>Матеріал підготовлено командою "BUKVA NEWS"</strong></p>`;

        // Видаляємо будь-який варіант підпису що міг прийти від ШІ і ставимо наш
        rewrittenContent = rewrittenContent
            .replace(/<p><em>ПЕРЕПИСАНО ШІ<\/em><\/p>/gi, '')
            .replace(/<p><strong>Матеріал.*?<\/strong><\/p>/gi, '')
            .trim();

        return res.status(200).json({
            title: rewrittenTitle,
            content: rewrittenContent + signature
        });

    } catch (err) {
        console.error('Final Catch Error:', err);
        return res.status(500).json({ error: 'Критична помилка сервера при обробці ШІ.' });
    }
};