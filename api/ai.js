const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, title, content, articleUrl, message, apiKey } = req.body;

    // Resolve which API key to use (backend env var or passed from client)
    const activeApiKey = process.env.GEMINI_API_KEY || apiKey;

    // --- FACEBOOK PUBLISHING LOGIC (VIA MAKE.COM) ---
    if (action === 'post-facebook') {
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        try {
            const webhookUrl = 'https://hook.eu2.make.com/ryu7i1m6rr64jqclnhjta2fynlje792j';

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, articleUrl: articleUrl })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Make.com Webhook Error:", text);
                throw new Error("Помилка відправки в Make.com");
            }

            return res.status(200).json({ success: true, info: 'Відправлено до Make.com' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }


    // --- AI CONTENT GENERATION LOGIC ---
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const cleanText = content.replace(/<[^>]*>/g, ' ').trim();

    async function tryGemini(promptText, maxTokens, temperature) {
        if (!activeApiKey) {
            console.error('API/AI: No GEMINI_API_KEY provided in env or explicitly from client.');
            return { ok: false, data: { error: 'Не задано API ключ для Gemini (ні на сервері, ні в налаштуваннях).' } };
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeApiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature, maxOutputTokens: maxTokens }
                })
            });
            const data = await response.json().catch(() => ({}));

            // Fallback to flash-lite if needed
            if (!response.ok || !data.candidates) {
                const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${activeApiKey}`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: { temperature, maxOutputTokens: maxTokens }
                    })
                });
                const fallbackData = await fallbackResponse.json().catch(() => ({}));
                return { ok: fallbackResponse.ok, data: fallbackData };
            }

            return { ok: response.ok, data };
        } catch (e) {
            return { ok: false, data: { error: { message: e.message } } };
        }
    }

    // --- GENERATE FACEBOOK POST ---
    if (action === 'generate-fb') {
        const prompt = `Ти — професійний редактор українського новинного видання "BUKVA NEWS". Твоє завдання — написати ДУЖЕ КОРОТКЕ прев'ю до статті для Facebook.

Вимоги:
1. Довжина: Максимум 1-2 найцікавіших речення (суть + інтрига). Текст має бути коротким, як тизер до фільму, щоб його можна було прочитати за 3 секунди.
2. Тон: Журналістський, без дешевого клікбейту ("шок", "ви не повірите"), але чіпляючий.
3. Емоції: Лише 1-2 доречних емодзі на весь текст.
4. Call-to-action: Жодних посилань! Просто напишіть "Читайте деталі за посиланням 👇" або "Більше про це нижче 👇". САМЕ ПОСИЛАННЯ В ТЕКСТ НЕ ВСТАВЛЯЙ!
5. Хештеги: 2 релевантних хештеги в самому кінці.

Оригінальний заголовок: ${title}
Текст статті:
${cleanText}

ВАЖЛИВО: Поверни тільки готовий текст поста (1-2 речення + короткий заклик перейти за посиланням нижче + хештеги). Жодних URL в тексті!`;

        const { ok, data } = await tryGemini(prompt, 2048, 0.8);
        if (!ok || !data.candidates) {
            console.error("Gemini FB Gen Error:", JSON.stringify(data));
            return res.status(500).json({ error: "Помилка Gemini API: " + (data?.error?.message || data?.error || JSON.stringify(data)) });
        }
        return res.status(200).json({ text: data.candidates[0].content.parts[0].text.trim() });
    }

    // --- REWRITE FULL ARTICLE (Default Action) ---
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

КРОК 2 — СТВОРЕННЯ ЗАГОЛОВКУ (ПРОФЕСІЙНИЙ ТА SEO):
Придумай чіткий, професійний заголовок, що відповідає стандартам серйозного новинного видання.
Правила якісного заголовку:
- Максимум 10 слів.
- Основа: "Хто/Що — що зроблено — за яких обставин".
- SEO: Важливі ключові слова (назва міста, прізвища, ключова подія) мають бути на початку.
- Конкретика замість інтриги: не пиши "несподівано" чи "приховують", пиши факти.
- НЕ використовуй слова: "розповів", "повідомив", "заявив" — це перевантажує заголовок.
- НЕ копіюй оригінальний заголовок навіть частково.
- Заголовок має бути дружнім до Google-індексації: чітко описувати суть події.

КРОК 3 — ЗАМІНА ДЖЕРЕЛ (ОБОВ'ЯЗКОВО):
Будь-які згадки сторонніх видань, сайтів, каналів як авторів або джерела — замінюй на "BUKVA NEWS".

КРОК 4 — ПЕРЕПИСУВАННЯ ТЕКСТУ:
- Обсяг: не менше ${wordCount} слів (оригінал містить саме стільки).
- НЕ скорочуй, НЕ підсумовуй, НЕ пропускай жодного смислового блоку.
- Кожен абзац оригіналу = окремий переписаний абзац у тебе.
- Цитати (Писання, офіційних осіб) зберігай дослівно, але речення навколо них переписуй.
- Усі дати у тексті та заголовках пиши виключно цифрами (наприклад: "25 лютого" замість "Двадцять п'ятого лютого").
- Не копіюй жодного речення з оригіналу — тільки переформулюй.
- ВАЖЛИВА ВИМОГА: Жодних згадок про те, що це написав штучний інтелект або "ШІ"! Ти — справжній живий журналіст редакції BUKVA NEWS. Категорично заборонено дописувати фрази типу "Матеріал відредаговано за допомогою ШІ".

ФОРМАТ ВІДПОВІДІ:
1. Перший рядок — тільки заголовок (без символів #, *, — тощо, без лапок).
2. Увесь текст у HTML: абзаци у <p>, підзаголовки у <h2>, акценти у <strong>.
3. Жодних пояснень від себе — лише заголовок і текст.

Оригінальний заголовок: ${title}

Оригінальний текст:
${cleanText}`;

    try {
        const { ok, data } = await tryGemini(prompt, 8192, 0.9);

        if (!ok || !data.candidates) {
            return res.status(500).json({ error: 'Всі моделі ШІ недоступні.' });
        }

        const aiText = data.candidates[0].content.parts[0].text;
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

        const signature = `<p><br></p><hr><p><strong>Матеріал підготовано командою "BUKVA NEWS"</strong></p>`;

        rewrittenContent = rewrittenContent
            .replace(/<p><em>ПЕРЕПИСАНО ШІ<\/em><\/p>/gi, '')
            .replace(/<p><strong>Матеріал.*?<\/strong><\/p>/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ для "BUKVA NEWS"\.?/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ.*?BUKVA NEWS.*?(?=<|$)/gi, '')
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