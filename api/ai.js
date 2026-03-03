const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, title, content, articleUrl, message } = req.body;

    // --- FACEBOOK PUBLISHING LOGIC ---
    if (action === 'post-facebook') {
        const FB_PAGE_ID = process.env.FB_PAGE_ID;
        const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

        if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
            return res.status(500).json({
                error: 'Server configuration error: Missing Facebook Credentials (FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN) in Vercel settings.'
            });
        }

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

            return res.status(200).json({ success: true, id: data.id });
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
                const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
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
        const prompt = `Ти — досвідчений SMM-менеджер українського новинного видання "BUKVA NEWS". Твоє завдання — написати цікавий і залучаючий пост для Facebook на основі цієї статті.

Вимоги до поста:
1. Захоплюючий початок: Зроби так, щоб читач захотів зупинитися і прочитати.
2. Коротка суть: Передай головну думку статті (2-3 коротких речення).
3. Емоції: Додай 2-4 доречних емодзі, щоб текст не був сухим.
4. Call-to-action (заклик до дії): Заохоть читачів перейти за посиланням і прочитати всі деталі. 
5. Посилання: Обов'язково встав посилання на статтю в кінці тексту.
6. Хештеги: Додай 3-5 релевантних хештегів (наприклад: #Прикарпаття #Новини #BukvaNews).
7. Довжина: Максимум 600-700 символів.

Оригінальний заголовок: ${title}
Оригінальний текст (або частина): ${cleanText.substring(0, 1500)}...

Посилання на статтю, яке треба вставити в пост:
${articleUrl || "https://ifnews-omega.vercel.app/"}

ВАЖЛИВО: Поверни тільки готовий текст для поста, без жодних додаткових коментарів, пояснень чи форматування markdown, лише чистий текст (з емодзі та посиланням).`;

        const { ok, data } = await tryGemini(prompt, 1024, 0.8);
        if (!ok || !data.candidates) return res.status(500).json({ error: "Помилка AI. Спробуйте ще раз." });
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

        const signature = `<p><br></p><hr><p><strong>Матеріал підготовлено командою "BUKVA NEWS"</strong></p>`;

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