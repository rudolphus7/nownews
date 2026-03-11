// --- API KEYS ---
// Primary key: GEMINI_API_KEY
// Backup key:  GEMINI_API_KEY_BACKUP
// Logic: try primary key first. If quota exceeded (429) → switch to backup key.
// Client can also pass apiKey in body as last resort.

const PRIMARY_KEY = process.env.GEMINI_API_KEY;
const BACKUP_KEY = process.env.GEMINI_API_KEY_BACKUP;
const BACKUP_KEY_2 = process.env.GEMINI_API_KEY_3;

// Models to try in order (primary preferred)
const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
];

/**
 * Calls Gemini API with a specific key and model.
 * Returns { ok, data, quotaExceeded }
 */
async function callGemini(key, model, promptText, maxTokens, temperature) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
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
        const quotaExceeded = response.status === 429 ||
            (data?.error?.status === 'RESOURCE_EXHAUSTED') ||
            (data?.error?.message || '').toLowerCase().includes('quota');

        if (response.ok && data.candidates) {
            return { ok: true, data, quotaExceeded: false };
        }
        return { ok: false, data, quotaExceeded };
    } catch (e) {
        return { ok: false, data: { error: { message: e.message } }, quotaExceeded: false };
    }
}

/**
 * Smart Gemini caller:
 * 1. Try PRIMARY key through all models
 * 2. If all fail due to quota → switch to BACKUP key
 * 3. If backup also quota → try client-provided key
 */
async function tryGemini(promptText, maxTokens, temperature, clientKey) {
    const keys = [];
    if (PRIMARY_KEY) keys.push({ key: PRIMARY_KEY, label: 'primary' });
    if (BACKUP_KEY) keys.push({ key: BACKUP_KEY, label: 'backup' });
    if (BACKUP_KEY_2) keys.push({ key: BACKUP_KEY_2, label: 'backup2' });
    if (clientKey && clientKey !== PRIMARY_KEY && clientKey !== BACKUP_KEY && clientKey !== BACKUP_KEY_2) {
        keys.push({ key: clientKey, label: 'client' });
    }

    if (keys.length === 0) {
        return {
            ok: false,
            data: { error: { message: 'Не задано API ключ. Збережіть ключ у Налаштуваннях → AI Конфігурація.' } }
        };
    }

    let lastError = null;

    for (const { key, label } of keys) {
        let allQuota = true; // assume all models for this key have quota issues

        for (const model of MODELS) {
            const result = await callGemini(key, model, promptText, maxTokens, temperature);

            if (result.ok) {
                console.log(`✅ Gemini success: key=${label}, model=${model}`);
                return result;
            }

            if (!result.quotaExceeded) {
                // Not a quota issue — real error for this model, skip to next model
                allQuota = false;
                lastError = result.data;
                console.error(`❌ Gemini error (key=${label}, model=${model}):`, result.data?.error?.message);
            } else {
                console.warn(`⚠️ Quota exceeded: key=${label}, model=${model}`);
                lastError = result.data;
            }
        }

        if (allQuota) {
            console.warn(`⚠️ All models quota exceeded for key=${label}, trying next key...`);
        }
    }

    // All keys and models failed
    return { ok: false, data: lastError || { error: { message: 'Всі ключі та моделі недоступні.' } } };
}

// --- BUKVA NEWS JOURNALIST ---
const JOURNALIST_PROMPT = `Ти — редактор новинного відділу BUKVA NEWS (Івано-Франківська область). Пишеш за стандартами Reuters, BBC та Associated Press.

АЛГОРИТМ РОБОТИ (виконуй ЗАВЖДИ саме в такому порядку):

КРОК 1 — ДЕКОНСТРУКЦІЯ
Витягни з оригіналу лише «скелет»: імена, посади, цифри, дати, суми, цитати, географію. Оригінальний текст після цього відкидай повністю — не переписуй синонімами.

КРОК 2 — ПРІОРИТЕТ
З витягнутих фактів знайди справжню новину: що найважливіше для місцевого читача? Це і є основа заголовка та ліду.

КРОК 3 — ЗАГОЛОВОК (Reuters/BBC формула)
Тільки один варіант. Правила:
— Формат Reuters (жорстка новина): Суб'єкт + активне дієслово + об'єкт. Приклад: «Міськрада виділила 4,2 млн грн на ремонт вулиці Незалежності»
— Формат BBC (факт + наслідок): Коротка тема : ключовий результат. Приклад: «Тендер на дороги: підрядник обіцяє завершити роботи до червня»
— Активні дієслова: виділив, ухвалив, відремонтував, зекономив, відкрив, призначив
— ЗАБОРОНЕНО: «розповів», «повідомив», «несподівано», все що починається з «Як...», будь-яка інтрига заради інтриги
— Максимум 10 слів

КРОК 4 — ЛІД (правило 5W+1H)
Перший абзац. Хто? Що? Де? Коли? Чому важливо? Максимум 35 слів, 1-2 речення. Одразу з суті — без вступів.

КРОК 5 — ТІЛО (перевернута піраміда)
Абзаци від найважливішого до найменш важливого. У кожному — один факт або одна думка. Максимум 3-4 речення в абзаці. Цитати вплітай органічно — після цитати завжди одне речення пояснення або контексту.

КРОК 6 — БЕКГРАУНД (хвіст)
Останній абзац: чому це відбувається зараз, що було раніше, порівняння. Можна одне речення «Раніше повідомлялося, що...»

РИТМ ТЕКСТУ — навмисно нерівний. Ніколи три речення поспіль однакової довжини. Чергуй: коротке (5-8 слів) з довгим (20-30 слів). Це не правило — це живе мислення.

АБСОЛЮТНА ЗАБОРОНА: «зокрема», «варто зазначити», «слід відмітити», «у свою чергу», «таким чином», «з метою», «у рамках», «відповідно до», «було проведено», «здійснюється», «У сучасному світі», «Важливо зазначити», «Підсумовуючи», «Безперечно», «залишається сподіватись», «поживемо-побачимо».

ДЖЕРЕЛА: будь-які згадки сторонніх видань як авторів — замінюй на «BUKVA NEWS».

ФОРМАТ ВІДПОВІДІ:
1. Перший рядок — тільки заголовок (без #, *, лапок, тире).
2. HTML-тіло: абзаци у <p>, підзаголовки у <h2>, акценти у <strong>.
3. Нічого від себе — тільки заголовок і стаття.
4. ВАЖЛИВО: весь текст статті (без заголовка) — не більше 3500 символів. Пиши повністю — не обривай речення та абзаци на півслові.
`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, title, content, articleUrl, message, apiKey, note } = req.body;

    // --- FACEBOOK PUBLISHING LOGIC (VIA MAKE.COM) ---
    if (action === 'post-facebook') {
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        try {
            const webhookUrl = 'https://hook.eu2.make.com/ryu7i1m6rr64jqclnhjta2fynlje792j';
            const { imageUrl } = req.body;

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    articleUrl: articleUrl || '',
                    imageUrl: imageUrl || ''
                })
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

    // --- INSTAGRAM PUBLISHING LOGIC (VIA MAKE.COM) ---
    if (action === 'post-instagram') {
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        try {
            const webhookUrl = process.env.MAKE_INSTAGRAM_WEBHOOK || 'https://hook.eu2.make.com/REPLACE_WITH_YOUR_INSTAGRAM_WEBHOOK';
            const { imageUrl } = req.body;

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    imageUrl: imageUrl || '',
                    articleUrl: articleUrl || ''
                })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Make.com Instagram Webhook Error:", text);
                throw new Error("Помилка відправки в Make.com (Instagram)");
            }

            return res.status(200).json({ success: true, info: 'Відправлено до Make.com (Instagram)' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // --- AI CONTENT GENERATION LOGIC ---
    const cleanText = (content || '').replace(/<[^>]*>/g, ' ').trim();

    // --- GENERATE FACEBOOK POST ---
    if (action === 'generate-fb') {
        if (!title) {
            return res.status(400).json({ error: 'Заголовок статті обов\'язковий для генерації FB поста.' });
        }

        const fbContent = cleanText || title;
        const prompt = `Ти — професійний редактор українського новинного видання "BUKVA NEWS". Твоє завдання — написати ДУЖЕ КОРОТКЕ прев'ю до статті для Facebook.

Вимоги:
1. Довжина: Максимум 1-2 найцікавіших речення (суть + інтрига). Текст має бути коротким, як тизер до фільму, щоб його можна було прочитати за 3 секунди.
2. Тон: Журналістський, без дешевого клікбейту ("шок", "ви не повірите"), але чіпляючий.
3. Емоції: Лише 1-2 доречних емодзі на весь текст.
4. Call-to-action: Жодних посилань! Просто напишіть "Читайте деталі за посиланням 👇" або "Більше про це нижче 👇". САМЕ ПОСИЛАННЯ В ТЕКСТ НЕ ВСТАВЛЯЙ!
5. Хештеги: 2 релевантних хештеги в самому кінці.

Оригінальний заголовок: ${title}
Текст статті:
${fbContent}

ВАЖЛИВО: Поверни тільки готовий текст поста (1-2 речення + короткий заклик перейти за посиланням нижче + хештеги). Жодних URL в тексті!`;

        const { ok, data } = await tryGemini(prompt, 2048, 0.8, apiKey);
        if (!ok || !data.candidates) {
            const errMsg = data?.error?.message || JSON.stringify(data);
            console.error("Gemini FB Gen Error:", errMsg);
            return res.status(500).json({ error: "Помилка Gemini API: " + errMsg });
        }
        return res.status(200).json({ text: data.candidates[0].content.parts[0].text.trim() });
    }

    // --- REWRITE FULL ARTICLE (Default Action) ---
    if (!title || !cleanText) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const noteSection = note && note.trim() ? `

ДОДАТКОВА ІНСТРУКЦІЯ ДЛЯ ЦІЄЇ СТАТТІ:
${note.trim()}
` : '';

    const prompt = `${JOURNALIST_PROMPT}${noteSection}
---

Оригінальний заголовок: ${title}

Оригінальний текст:
${cleanText}`;

    try {
        const { ok, data } = await tryGemini(prompt, 6000, 1.0, apiKey);

        if (!ok || !data.candidates) {
            const errMsg = data?.error?.message || 'Всі моделі ШІ недоступні.';
            return res.status(500).json({ error: errMsg });
        }

        const candidate = data.candidates[0];
        const finishReason = candidate.finishReason || 'UNKNOWN';
        if (finishReason === 'MAX_TOKENS') {
            console.warn('⚠️ AI article truncated by MAX_TOKENS! Consider increasing maxOutputTokens.');
        } else {
            console.log(`✅ AI finish reason: ${finishReason}`);
        }
        const aiText = candidate.content.parts[0].text;
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

        const signature = `<p><br></p><hr><p><strong>Редакція BUKVA NEWS</strong></p>`;

        rewrittenContent = rewrittenContent
            .replace(/<p><em>ПЕРЕПИСАНО ШІ<\/em><\/p>/gi, '')
            .replace(/<p><strong>Матеріал.*?<\/strong><\/p>/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ для "BUKVA NEWS"\.?/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ.*?BUKVA NEWS.*?(?=<|$)/gi, '')
            .trim();

        return res.status(200).json({
            title: rewrittenTitle,
            content: rewrittenContent + signature,
            authorName: 'Редакція BUKVA NEWS'
        });
    } catch (err) {
        console.error('Final Catch Error:', err);
        return res.status(500).json({ error: 'Критична помилка сервера при обробці ШІ.' });
    }
};
