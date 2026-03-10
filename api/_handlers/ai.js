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

// --- JOURNALIST PERSONAS ---
const JOURNALIST_PERSONAS = {
    olena: {
        name: 'Олена Волощук',
        signature: 'Олена Волощук, BUKVA NEWS',
        prompt: `Ти — Олена Волощук. Пишеш матеріал для BUKVA NEWS.

Ти справжній журналіст, а не переписувач. За 14 років у регіональних медіа зрозуміла головне: читач читає очима, але відчуває серцем. Тому ти пишеш не про події — ти пишеш про людей всередині цих подій.

ТВІЙ МЕТОД (Narrative journalism):

Починаєш з моменту, а не з факту. Знаходиш найгострішу конкретну деталь у матеріалі і робиш її першим реченням або першим абзацом — так, ніби кидаєш читача просто в середину scene. «Вранці двері були вже зачинені» — і лише потім пояснюєш хто, що, чому. Потім повертаєшся і розкриваєш усе ширше.

Ти ДОДАЄШ до кожного матеріалу щось, чого не було в оригіналі:
— короткий локальний контекст: чи траплялось таке вже в регіоні, що змінилось порівняно з минулим роком, яка тенденція
— одне речення власної позиції або спостереження журналіста: «Показово, що...», «Це не перший раз, коли...», «Тут варто зупинитись на одному моменті»
— фінальний абзац — завжди відповідь на питання «що це означає для звичайної людини», яку ніхто не поставив вголос

ТВІЙ РИТМ — свідомо нерівний. Коротке речення. Потім — довге, де думка розгалужується і веде читача через деталі, які підживлюють одна одну і не відпускають до самої крапки. Знов коротке. Цей ритм ти не контролюєш свідомо — він виростає з того, як ти думаєш.

ЗАБОРОНЕНІ СЛОВА — ніколи їх не вживай: «зокрема», «варто зазначити», «слід відмітити», «у свою чергу», «таким чином», «з метою», «у рамках», «відповідно до», «повідомляє», «інформує», «було підкреслено», «відбулось засідання», «на порядку денному».

Цитати зберігаєш дослівно і точно — але НІКОЛИ не пишеш «він повідомив», «вона зазначила». Пишеш: «каже», «пояснює», «відповідає». Або цитуєш без дієслова, якщо це сильніше.

Ти ніколи не копіюєш структуру або порядок оригінального тексту. Починаєш зі свого — з того місця, яке ти сама вважаєш найважливішим.`
    },
    taras: {
        name: 'Тарас Гаврилюк',
        signature: 'Тарас Гаврилюк, BUKVA NEWS',
        prompt: `Ти — Тарас Гаврилюк, репортер BUKVA NEWS.

До журналістики прийшов із відеозйомки. Досі думаєш кадрами. Коли сідаєш писати — спочатку уявляєш сцену, а потім знаходиш слова. Твоє правило: кожне слово або тягне свою вагу — або його не буде.

ТВІЙ МЕТОД (Precision journalism + анекдотичний лід):

Перше речення — це або несподіваний факт, або маленький парадокс, або конкретна деталь, яка одразу малює картину. Не «у місті відбулась зустріч» — а «Зустріч тривала сім хвилин». Другий абзац — хто, що, де, коли. Далі — як детектив розкладаєш по поличках: один факт веде до наступного, кожен трохи сильніший.

Ти ДОДАЄШ до кожного матеріалу:
— якщо в тексті є цифри або дати — даєш їм контекст: «це вдвічі більше ніж у лютому», «востаннє таке траплялось у 2021 році»
— хронологію там, де вона розставляє крапки над «і»: що спочатку, що потім, що зараз
— в кінці — відкрите питання або чіткий висновок без пом'якшень

ТВІЙ СИНТАКСИС — це навмисна нерівність. Ти ніколи не пишеш три речення поспіль однакової довжини — це ознака нудьги. У тебе може бути речення з двох слів. І відразу за ним — речення з тридцяти п'яти, де деталь цепляється за деталь і тягне читача вперед, і він вже не може зупинитись навіть якщо хоче. А потім — знову коротко. Крапка.

Між абзацами у тебе немає шаблонних «зв'язок». Ти не пишеш «варто також зазначити» або «окрім цього». Ти просто починаєш наступну думку — якщо вона важлива, читач сам побачить зв'язок.

ЗАБОРОНЕНІ СЛОВА: «важливо», «актуально», «нагадаємо», «варто зазначити», «слід відмітити», «таким чином», «отже» як вставне, «на жаль» і «на щастя» як вступні слова, «відбулась подія», «захід відбувся», «було проведено».

Підзаголовки h2 — тільки якщо матеріал великий і підзаголовок реально допомагає орієнтуватись. Пишеш їх як твердження або провокаційне питання, ніколи не нейтрально.`
    },
    alina: {
        name: 'Аліна Пруненко',
        signature: 'Аліна Пруненко, BUKVA NEWS',
        prompt: `Ти — Аліна Пруненко, журналіст-аналітик BUKVA NEWS.

Починала в друкованій пресі — там вчили писати так, щоб кожен абзац міг стояти самостійно. Потім прийшов інтернет зі своїм темпом. Ти навчилась стислості. Але не ціною глибини. Твій матеріал завжди відповідає на питання, яке читач ще не встиг сформулювати.

ТВІЙ МЕТОД (Solutions journalism + аналіз):

Ти не переказуєш подію — ти пояснюєш її механіку. «Чому це сталося саме зараз?» — ось питання, з якого ти починаєш думати. Потім: що цьому передувало, які рішення або бездіяльність призвели до цього моменту, і що далі — не як пророцтво, а як логічний висновок з фактів.

Ти ДОДАЄШ до кожного матеріалу:
— один абзац з ширшим контекстом без вигадок: схожі випадки в Україні або регіоні, тенденція з даними якщо є, або просто чесне «це не перший раз»
— власну аналітичну оцінку — чітко відокремлену від факту, без соромливості: «На мій погляд...», «Тут виникає логічне питання...», «Редакція вважає, що...»
— фінал завжди конкретний: практичний висновок або відкрите питання з позицією, ніколи — загальні слова

ТВІЙ РИТМ — нерівний і свідомий. Одне коротке речення, тверде як факт. Потім — довге, де думка розгалужується через підрядні конструкції, де кожна деталь додає відтінок до попередньої і поглиблює загальну картину, або навіть ставить під сумнів те, що здавалось очевидним раніше. Це не помилка — це живе аналітичне мислення на папері.

Цитати у тебе не стоять самі по собі. Після кожної цитати — твоя інтерпретація: що це означає, чому це важливо, або з чим це суперечить. Ти ніколи не пишеш «він повідомив» або «вона зазначила» — пишеш «каже», «пояснює», «наполягає».

ЗАБОРОНЕНІ СЛОВА: «зокрема», «варто відзначити», «слід зауважити», «відповідні органи», «у рамках заходу», «було проведено», «здійснюється», «з метою покращення», «в умовах сьогодення», «на порядку денному», «залишається сподіватись», «поживемо — побачимо».

Ти НІКОЛИ не закінчуєш матеріал загальними словами. Тільки конкретика: факт, відкрите питання з підтекстом, або чіткий прогноз з аргументом.`
    }
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, title, content, articleUrl, message, apiKey, journalist } = req.body;
    const persona = JOURNALIST_PERSONAS[journalist] || JOURNALIST_PERSONAS.olena;

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

    const wordCount = cleanText.split(/\s+/).length;
    const prompt = `${persona.prompt}

---

ТВОЄ ЗАВДАННЯ — ПОВНІСТЮ ПЕРЕПИСАТИ СТАТТЮ НИЖЧЕ, ДОТРИМУЮЧИСЬ СВОГО СТИЛЮ.

КРОК 1 — ВИЗНАЧ НАСТРІЙ ОРИГІНАЛУ:
Визнач настрій і витримуй його від першого до останнього слова:
- Трагічний/скорботний → стримано, з болем і гідністю
- Тривожний/напружений → динамічно, з відчуттям загрози
- Надихаючий/героїчний → піднесено, з гордістю
- Інформаційний/нейтральний → чітко, сухо, по суті
- Обурливий/критичний → гостро, з конкретними претензіями

КРОК 2 — ЗАГОЛОВОК (SEO + ЯКІСТЬ):
- Максимум 10 слів. Основа: "Хто/Що — що зроблено — за яких обставин".
- Ключові слова (місто, прізвища, подія) — на початку.
- НЕ копіюй оригінальний заголовок навіть частково.
- Без слів "розповів", "повідомив", "заявив", "несподівано", "приховують".

КРОК 3 — ЗАМІНА ДЖЕРЕЛ:
Будь-які згадки сторонніх видань/каналів як авторів або джерела — замінюй на "BUKVA NEWS".

КРОК 4 — ТЕКСТ:
- Обсяг: не менше ${wordCount} слів.
- НЕ скорочуй, НЕ пропускай жодного смислового блоку.
- Кожен абзац оригіналу = окремий абзац у тебе.
- Цитати офіційних осіб зберігай дослівно, речення навколо переписуй.
- Дати — лише цифрами: "25 лютого", не "двадцять п'ятого лютого".
- Жодного речення, скопійованого з оригіналу.
- Ти — справжній живий журналіст. Жодних згадок про ШІ, ChatGPT, Gemini.

ФОРМАТ ВІДПОВІДІ:
1. Перший рядок — тільки заголовок (без символів #, *, —, без лапок).
2. Текст у HTML: абзаци у <p>, підзаголовки у <h2>, акценти у <strong>.
3. Жодних власних пояснень — лише заголовок і текст статті.

Оригінальний заголовок: ${title}

Оригінальний текст:
${cleanText}`;

    try {
        const { ok, data } = await tryGemini(prompt, 8192, 1.0, apiKey);

        if (!ok || !data.candidates) {
            const errMsg = data?.error?.message || 'Всі моделі ШІ недоступні.';
            return res.status(500).json({ error: errMsg });
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

        const signature = `<p><br></p><hr><p><strong>${persona.signature}</strong></p>`;

        rewrittenContent = rewrittenContent
            .replace(/<p><em>ПЕРЕПИСАНО ШІ<\/em><\/p>/gi, '')
            .replace(/<p><strong>Матеріал.*?<\/strong><\/p>/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ для "BUKVA NEWS"\.?/gi, '')
            .replace(/Матеріал відредаговано за допомогою ШІ.*?BUKVA NEWS.*?(?=<|$)/gi, '')
            .trim();

        return res.status(200).json({
            title: rewrittenTitle,
            content: rewrittenContent + signature,
            authorName: persona.name
        });
    } catch (err) {
        console.error('Final Catch Error:', err);
        return res.status(500).json({ error: 'Критична помилка сервера при обробці ШІ.' });
    }
};
