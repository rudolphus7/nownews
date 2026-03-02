export const SEOEngine = {
    /**
     * Генерація чистого ЧПУ (Slug)
     * Виправлено: повна транслітерація, видалення спецсимволів (?), обрізка по словах.
     */
    generateSlug: (text) => {
        const ukr = {
            "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ye", "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "yi", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ь": "", "ю": "yu", "я": "ya",
            "А": "a", "Б": "b", "В": "v", "Г": "h", "Ґ": "g", "Д": "d", "Е": "e", "Є": "ye", "Ж": "zh", "З": "z", "И": "y", "І": "i", "Ї": "yi", "Й": "y", "К": "k", "Л": "l", "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s", "Т": "t", "У": "u", "Ф": "f", "Х": "kh", "Ц": "ts", "Ч": "ch", "Ш": "sh", "Щ": "shch", "Ь": "", "Ю": "yu", "Я": "ya"
        };

        // 1. Початкова транслітерація та переведення в нижній регістр
        let slug = text
            .split('')
            .map(char => ukr[char] !== undefined ? ukr[char] : char)
            .join('')
            .toLowerCase()
            .trim();

        // 2. Очищення: залишаємо лише латиницю, цифри та дефіси
        // Це прибере символи на кшталт %D1 та знаки питання
        slug = slug
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

        // 3. Розумне обрізання до 80 символів по цілих словах
        const MAX_SLUG = 80;
        if (slug.length > MAX_SLUG) {
            slug = slug.substring(0, MAX_SLUG);
            const lastDash = slug.lastIndexOf('-');
            if (lastDash > 20) slug = slug.substring(0, lastDash);
        }

        return slug.replace(/^-+|-+$/g, '');
    },

    /**
     * Створення Meta Title (ліміт 70 символів)
     */
    generateMetaTitle: (title) => {
        let t = title.trim();
        const MAX_TITLE = 70;
        const BRAND = " | BUKVA NEWS";

        if (t.length > MAX_TITLE) {
            return t.substring(0, MAX_TITLE - 3).trim() + "...";
        }

        const cities = ["Франківськ", "Калуш", "Коломия"];
        const hasCity = cities.some(city => t.includes(city));

        if (!hasCity && (t.length + BRAND.length) <= MAX_TITLE) {
            t += BRAND;
        }

        return t.substring(0, MAX_TITLE);
    },

    /**
     * Генерація Meta Description (ліміт 160 символів)
     */
    generateMetaDesc: (content) => {
        const MAX_DESC = 160;
        const CTA = " Читайте подробиці.";

        let clean = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

        let availableSpace = MAX_DESC - CTA.length;
        let summary = clean.substring(0, availableSpace);

        const lastDot = summary.lastIndexOf('.');
        if (lastDot > availableSpace * 0.7) {
            summary = summary.substring(0, lastDot + 1);
        } else {
            const lastSpace = summary.lastIndexOf(' ');
            if (lastSpace > 0) {
                summary = summary.substring(0, lastSpace).trim() + "...";
            }
        }

        const finalDesc = summary + CTA;
        return finalDesc.length <= MAX_DESC ? finalDesc : finalDesc.substring(0, MAX_DESC);
    }
};