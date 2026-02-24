// Запусти цей файл локально: node test-models.js
// АБО задеплой як окремий API endpoint на Vercel

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({ error: data });
        }

        // Повертає список всіх доступних моделей
        const models = data.models?.map(m => ({
            name: m.name,
            displayName: m.displayName,
            supportedMethods: m.supportedGenerationMethods
        }));

        return res.status(200).json({ models });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};