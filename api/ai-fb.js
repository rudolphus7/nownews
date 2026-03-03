const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, content, articleUrl } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const cleanText = content.replace(/<[^>]*>/g, ' ').trim();

    const prompt = `Ти — досвідчений SMM-менеджер українського новинного видання "BUKVA NEWS". Твоє завдання — написати цікавий і залучаючий пост для Facebook на основі цієї статті.

Вимоги до поста:
1. Захоплюючий початок: Зроби так, щоб читач захотів зупинитися і прочитати.
2. Коротка суть: Передай головну думку статті (2-3 коротких речення).
3. Емоції: Додай 2-4 доречних емодзі, щоб текст не був сухим.
4. Call-to-action (заклик до дії): Заохоть читачів перейти за посиланням і прочитати всі деталі. 
5. Посилання: Обов'язково встав посилання на статтю в кінці тексту.
6. Хештеги: Додай 3-5 релевантних хештегів (наприклад: #Прикарпаття #Новини #BukvaNews).
7. Довжина: Максимум 600-700 символів (щоб не доводилось натискати "Читати далі" у ФБ без потреби, хоча суть має бути розкрита).

Оригінальний заголовок: ${title}
Оригінальний текст (або частина): ${cleanText.substring(0, 1500)}...

Посилання на статтю, яке треба вставити в пост:
${articleUrl || "https://ifnews-omega.vercel.app/"}

ВАЖЛИВО: Поверни тільки готовий текст для поста, без жодних додаткових коментарів, пояснень чи форматування markdown, лише чистий текст (з емодзі та посиланням).`;

    async function tryGemini(model) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1024
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
            'gemini-1.5-flash'
        ];

        let result = null;
        for (const model of models) {
            result = await tryGemini(model);
            if (result.ok) break;
            console.warn(`[AI-FB] Model ${model} failed, trying next...`, result.data);
        }

        if (!result || !result.ok) {
            throw new Error(result?.data?.error?.message || "All Gemini models failed");
        }

        const generatedText = result.data.candidates[0].content.parts[0].text;

        return res.status(200).json({ text: generatedText.trim() });
    } catch (error) {
        console.error("Gemini FB Generate Error:", error);
        return res.status(500).json({ error: 'Помилка генерації тексту: ' + error.message });
    }
};
