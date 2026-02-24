import { SEOEngine } from './seo-engine.js';

// --- ІНІЦІАЛІЗАЦІЯ SUPABASE ---
let _supabase;
function initSupabase() {
    if (window.supabase) {
        const SUPABASE_URL = 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("✅ Supabase ініціалізовано успішно");
    } else {
        setTimeout(initSupabase, 500);
    }
}
initSupabase();

// --- СТАН РЕДАГУВАННЯ ---
let currentEditingId = null;
let currentTags = [];

// --- ТЕГИ (ЛОГІКА) ---
const renderTags = () => {
    const container = document.getElementById('tags-container');
    if (!container) return;
    const input = document.getElementById('tag-input');

    // Очищаємо всі теги крім інпуту
    const badges = container.querySelectorAll('.tag-badge');
    badges.forEach(b => b.remove());

    currentTags.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = 'tag-badge bg-orange-600 text-[10px] font-black text-white px-2 py-1 rounded flex items-center shadow-lg';
        badge.innerHTML = `${tag} <button type="button" class="ml-1 opacity-50 hover:opacity-100" onclick="window.removeTag('${tag}')">×</button>`;
        container.insertBefore(badge, input);
    });
};

window.addFastTag = (tag) => {
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags();
    }
};

window.removeTag = (tag) => {
    currentTags = currentTags.filter(t => t !== tag);
    renderTags();
};

document.getElementById('tag-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(',', '');
        if (val && !currentTags.includes(val)) {
            currentTags.push(val);
            e.target.value = '';
            renderTags();
        }
    }
});

// --- ІНІЦІАЛІЗАЦІЯ РЕДАКТОРА (QUILL) ---
let quill;
function initEditor() {
    const editorElem = document.getElementById('editor-container');
    if (editorElem && typeof Quill !== 'undefined') {
        quill = new Quill('#editor-container', {
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['image', 'link', 'video', 'blockquote'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            },
            placeholder: 'Напишіть професійну статтю тут...',
            theme: 'snow'
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initEditor();

    const newsForm = document.getElementById('news-form');
    const titleInput = document.getElementById('title');
    const slugInput = document.getElementById('slug');
    const metaTitleInput = document.getElementById('meta_title');
    const metaDescInput = document.getElementById('meta_description');
    const categoryInput = document.getElementById('category');
    const imageUrlInput = document.getElementById('image_url');
    const imagePreview = document.getElementById('image-preview');

    const updateSEO = () => {
        try {
            const title = titleInput?.value || "";
            const contentText = quill ? quill.getText() : "";

            if (title) {
                const generatedSlug = SEOEngine.generateSlug(title);
                if (slugInput) slugInput.value = generatedSlug;
                const slugDisplay = document.getElementById('slug-display');
                if (slugDisplay) slugDisplay.innerHTML = `<a href="/news/${generatedSlug}" target="_blank" class="text-orange-600 hover:underline">/news/${generatedSlug}</a>`;
                if (metaTitleInput) {
                    metaTitleInput.value = SEOEngine.generateMetaTitle(title);
                    const titleCount = document.getElementById('title-count');
                    if (titleCount) titleCount.innerText = metaTitleInput.value.length;
                }
            }

            if (contentText.trim().length > 10 && metaDescInput) {
                metaDescInput.value = SEOEngine.generateMetaDesc(contentText);
                const descCount = document.getElementById('desc-count');
                if (descCount) descCount.innerText = metaDescInput.value.length;
            }
        } catch (e) {
            console.warn("SEO update failed:", e);
        }
    };

    titleInput?.addEventListener('input', updateSEO);
    if (quill) quill.on('text-change', updateSEO);

    imageUrlInput?.addEventListener('input', () => {
        const url = imageUrlInput.value;
        if (url && imagePreview) {
            imagePreview.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-xl shadow-md">`;
        }
    });

    // --- НАВІГАЦІЯ ---
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }

    window.showSection = (id) => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(id)?.classList.remove('hidden');

        document.querySelectorAll('aside nav a').forEach(l => l.classList.remove('bg-orange-600'));
        const activeLink = document.querySelector(`[onclick*="${id}"]`);
        if (activeLink) activeLink.classList.add('bg-orange-600');

        // Close mobile menu after navigation
        document.body.classList.remove('sidebar-open');
    };

    // --- ПУБЛІКАЦІЯ / ОНОВЛЕННЯ ---
    if (newsForm) {
        newsForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!_supabase) return;

            const btn = document.getElementById('btn-submit');
            btn.disabled = true;
            btn.innerText = currentEditingId ? 'Зберігаємо зміни...' : 'Йде публікація...';

            const payload = {
                title: titleInput.value,
                content: quill.root.innerHTML,
                slug: slugInput.value,
                meta_title: metaTitleInput.value,
                meta_description: metaDescInput.value,
                category: categoryInput.value,
                city: document.getElementById('city').value,
                image_url: imageUrlInput.value,
                tags: currentTags,
                link: newsForm.dataset.rssLink || "", // Preserve original RSS link
                is_published: true
            };

            try {
                let result;
                if (currentEditingId) {
                    result = await _supabase.from('news').update(payload).eq('id', currentEditingId);
                } else {
                    result = await _supabase.from('news').insert([payload]);
                }

                if (result.error) throw result.error;

                alert(currentEditingId ? "✅ Зміни збережено!" : "🚀 Новину опубліковано!");

                // AUTO-DISMISS RSS IF NEEDED
                if (newsForm.dataset.rssLink) {
                    await _supabase.from('rss_articles').update({ is_imported: true }).eq('link', newsForm.dataset.rssLink);
                }

                // Скидання форми
                currentEditingId = null;
                currentTags = [];
                newsForm.reset();
                if (document.getElementById('city')) document.getElementById('city').value = "";
                delete newsForm.dataset.rssLink;
                if (quill) {
                    try {
                        quill.setContents([]);
                    } catch (qe) {
                        console.warn("Quill reset failed:", qe);
                        quill.root.innerHTML = ""; // Fallback
                    }
                }
                imagePreview.innerHTML = '<span class="text-slate-600 text-[10px] uppercase font-bold text-center px-4">Зображення не вибрано</span>';
                renderTags();
                window.showSection('section-list');
                window.loadNews();
            } catch (err) {
                console.error("Publication error:", err);
                alert("Помилка: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = currentEditingId ? 'Зберегти зміни' : 'Опублікувати новину';
            }
        };
    }

    let CATEGORIES_UK = {};
    let CITIES_UK = {};

    window.loadNews = async () => {
        const tbody = document.getElementById('news-table-body');
        if (!tbody || !_supabase) return;

        tbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-gray-500 italic">Синхронізація...</td></tr>';

        const { data, error } = await _supabase.from('news').select('*').order('created_at', { ascending: false });

        if (error) return;

        tbody.innerHTML = data.map(item => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="p-4 text-sm font-bold flex items-center">
                ${item.image_url ? `<img src="${item.image_url}" class="w-10 h-10 rounded mr-3 object-cover">` : `<div class="w-10 h-10 bg-gray-200 rounded mr-3"></div>`}
                <span class="truncate max-w-xs">${item.title}</span>
            </td>
            <td class="p-4 text-center">
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] uppercase font-black">
                    ${CATEGORIES_UK[item.category] || item.category}
                </span>
            </td>
            <td class="p-4 text-center font-mono text-[11px] font-black text-slate-400">
                👁️ ${item.views || 0}
            </td>
            <td class="p-4 text-xs text-gray-400 font-bold">${new Date(item.created_at).toLocaleDateString()}</td>
            <td class="p-4 text-right space-x-2">
                <button onclick="window.editItem('${item.id}')" class="text-orange-500 font-bold hover:underline uppercase text-xs">Редагувати</button>
                <button onclick="window.deleteItem('${item.id}')" class="text-red-500 font-bold hover:underline uppercase text-xs">Видалити</button>
            </td>
        </tr>
    `).join('');
    };

    function autoTagArticle(content, title) {
        const text = (title + ' ' + content).toLowerCase();
        if (text.includes('зсу') || text.includes('фронт') || text.includes('обстріл') || text.includes('війна')) return 'war';
        if (text.includes('депутат') || text.includes('мер ') || text.includes('рада') || text.includes('вибори')) return 'politics';
        if (text.includes('курс') || text.includes('банк') || text.includes('бюджет') || text.includes('ціни')) return 'economy';
        if (text.includes('матч') || text.includes('футбол') || text.includes('спорт') || text.includes('команда')) return 'sport';
        if (text.includes('виставка') || text.includes('фільм') || text.includes('театр') || text.includes('музей')) return 'culture';
        if (text.includes('штучний') || text.includes('смартфон') || text.includes('it') || text.includes('додаток')) return 'tech';
        return 'frankivsk'; // Default
    }

    // ФУНКЦІЯ РЕДАГУВАННЯ: Завантажує дані в форму
    window.editItem = async (id) => {
        const { data, error } = await _supabase.from('news').select('*').eq('id', id).single();

        if (error || !data) {
            alert("Не вдалося завантажити дані статті");
            return;
        }

        currentEditingId = id; // Запам'ятовуємо, що ми редагуємо

        // Заповнюємо поля форми
        document.getElementById('title').value = data.title;
        document.getElementById('slug').value = data.slug;
        const slugDisplay = document.getElementById('slug-display');
        if (slugDisplay) slugDisplay.innerHTML = `<a href="/news/${data.slug}" target="_blank" class="text-orange-600 hover:underline">/news/${data.slug} ↗</a>`;
        document.getElementById('meta_title').value = data.meta_title;
        document.getElementById('meta_description').value = data.meta_description;
        document.getElementById('category').value = data.category;
        if (document.getElementById('city')) document.getElementById('city').value = data.city || "";
        document.getElementById('image_url').value = data.image_url;
        currentTags = data.tags || [];
        renderTags();

        // Оновлюємо лічильники
        document.getElementById('title-count').innerText = data.meta_title.length;
        document.getElementById('desc-count').innerText = data.meta_description.length;

        // Вставляємо контент у Quill
        quill.root.innerHTML = data.content;

        // Оновлюємо прев'ю фото
        if (data.image_url) {
            document.getElementById('image-preview').innerHTML = `<img src="${data.image_url}" class="w-full h-full object-cover rounded-xl">`;
        }

        // Змінюємо текст кнопки
        document.getElementById('btn-submit').innerText = 'Зберегти зміни';

        // Перемикаємо на секцію редактора
        window.showSection('section-add');
    };

    window.deleteItem = async (id) => {
        if (confirm('⚠️ Видалити назавжди?') && _supabase) {
            await _supabase.from('news').delete().eq('id', id);
            window.loadNews();
        }
    };

    // --- RSS АГРЕГАТОР (ДАНІ) ---
    let rssSources = [];
    let rssInterval = null;

    async function loadRSSSources() {
        if (!_supabase) return;
        const { data, error } = await _supabase.from('rss_sources').select('*').order('created_at', { ascending: true });
        if (!error && data) {
            rssSources = data;
            renderRSSSources();
        }
    }

    function renderRSSSources() {
        const list = document.getElementById('rss-sources-list');
        if (!list) return;

        if (rssSources.length === 0) {
            list.innerHTML = '<div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4 opacity-50">Джерела відсутні</div>';
            return;
        }

        list.innerHTML = rssSources.map((source) => {
            const statusColor = source.last_status === 'online' ? 'bg-green-500' : (source.last_status === 'error' ? 'bg-red-500' : 'bg-slate-300');
            const sourceHost = new URL(source.url).hostname;

            return `
            <div class="bg-white p-4 rounded-3xl flex justify-between items-center shadow-lg border border-white transition-all hover:border-orange-200 group relative overflow-hidden">
                <div class="flex flex-col min-w-0 pr-8">
                    <span class="text-[10px] font-black text-slate-800 truncate uppercase tracking-widest">${sourceHost}</span>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse"></span>
                        <span class="text-[9px] font-bold text-slate-400 truncate">${source.url}</span>
                    </div>
                </div>
                <button onclick="window.removeRSSSource('${source.id}')" class="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all absolute right-2">✕</button>
            </div>`;
        }).join('');
    }

    const rssForm = document.getElementById('rss-source-form');
    if (rssForm) {
        rssForm.onsubmit = async (e) => {
            e.preventDefault();
            const urlInp = document.getElementById('rss-url');
            const url = urlInp.value.trim();
            if (url && _supabase) {
                const { error } = await _supabase.from('rss_sources').insert([{ url }]);
                if (error) {
                    if (error.code === '23505') alert("Це джерело вже додано!");
                    else alert("Помилка: " + error.message);
                } else {
                    urlInp.value = '';
                    await loadRSSSources();
                    fetchRSSArticles();
                }
            }
        };
    }

    async function removeRSSSource(id) {
        if (confirm("Видалити це джерело?") && _supabase) {
            const { error } = await _supabase.from('rss_sources').delete().eq('id', id);
            if (!error) {
                await loadRSSSources();
                await fetchRSSArticles();
            }
        }
    }
    window.removeRSSSource = removeRSSSource;

    async function refreshRSS() {
        const btn = document.querySelector('[onclick="window.refreshRSS()"]');
        if (!btn) return fetchRSSArticles(); // Fallback if button not found

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Завантаження...';

        console.log("RSS Refresh started via refreshRSS...");
        try {
            await fetchRSSArticles();
            console.log("RSS Refresh completed.");
        } catch (e) {
            console.error("RSS Refresh failed:", e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
    window.refreshRSS = refreshRSS;

    async function loadRSS() {
        await loadRSSSources();
        renderRSSArticles();
        await fetchRSSArticles();

        if (rssInterval) clearInterval(rssInterval);
        rssInterval = setInterval(fetchRSSArticles, 300000);
    }
    window.loadRSS = loadRSS;

    // --- RSS DB MANAGEMENT ---
    async function renderRSSArticles() {
        const grid = document.getElementById('rss-items-grid');
        if (!grid || !_supabase) return;

        const { data: articles, error } = await _supabase
            .from('rss_articles')
            .select('*')
            .eq('is_dismissed', false)
            .eq('is_imported', false)
            .order('pub_date', { ascending: false })
            .limit(50);

        if (error || !articles || articles.length === 0) {
            grid.innerHTML = `
                <div class="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200">
                     <div class="text-5xl mb-6 opacity-20">📭</div>
                     <p class="text-slate-400 italic font-medium">Нових новин поки немає...</p>
                     <button onclick="window.fetchRSSArticles()" class="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition shadow-xl">Перевірити зараз</button>
                </div>`;
            return;
        }

        grid.innerHTML = articles.map((art, idx) => `
        <div id="rss-item-${art.id}" class="bg-white p-6 md:p-10 rounded-[3rem] shadow-xl border border-white flex flex-col md:flex-row gap-8 items-start transition-all hover:border-orange-200 group relative">
            ${art.image_url ? `
            <div class="w-full md:w-56 h-56 flex-shrink-0 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <img src="${art.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            ` : `
            <div class="w-full md:w-56 h-56 flex-shrink-0 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-200 border-2 border-dashed border-slate-100 italic text-xs">Немає фото</div>
            `}
            <div class="flex-1 pt-2">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <span class="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">${art.source_name}</span>
                        <span class="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${art.pub_date ? new Date(art.pub_date).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Нещодавно'}</span>
                    </div>
                </div>
                <h3 class="text-2xl md:text-3xl font-black text-slate-800 mb-4 tracking-tighter leading-[1.1] group-hover:text-orange-600 transition-colors italic">${art.title}</h3>
                <div class="text-sm md:text-base text-slate-500 line-clamp-2 mb-10 leading-relaxed font-medium">${art.description ? art.description.replace(/<[^>]*>/g, '').substring(0, 200) : 'Опис відсутній'}...</div>
                
                <div class="flex flex-wrap items-center gap-4">
                    <button onclick="window.importFromRSS('${art.id}')" class="bg-orange-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition shadow-xl shadow-orange-100 active:scale-95">Створити статтю</button>
                    <a href="${art.link}" target="_blank" class="px-6 py-4 rounded-2xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition flex items-center gap-2">Оригінал ↗</a>
                    <button onclick="window.dismissRSSArticle('${art.id}')" class="ml-auto w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90">✕</button>
                </div>
            </div>
        </div>
    `).join('');
    }

    // Clear interval when switching sections
    const originalShowSection = window.showSection;
    window.showSection = (id) => {
        if (id !== 'section-rss' && rssInterval) {
            clearInterval(rssInterval);
            rssInterval = null;
        }
        originalShowSection(id);
    };

    async function clearDismissedRSS() {
        if (confirm("Повернути всі приховані новини у список?")) {
            if (!_supabase) return;
            await _supabase.from('rss_articles').update({ is_dismissed: false }).eq('is_dismissed', true);
            renderRSSArticles();
        }
    }
    window.clearDismissedRSS = clearDismissedRSS;

    // --- AI REWRITING LOGIC ---
    async function rewriteWithAI() {
        const titleInput = document.getElementById('title');
        const btn = document.getElementById('btn-ai-rewrite');
        const bar = document.getElementById('ai-loading-bar');

        if (!quill || !titleInput) return;

        const currentHtml = quill.root.innerHTML;
        const currentTitle = titleInput.value;

        if (currentHtml.length < 100) {
            alert("⚠️ Текст занадто короткий для перепису. Спочатку завантажте або напишіть контент.");
            return;
        }

        if (!confirm("🧙 ШІ перепише статтю у нашому стилі. Продовжити?")) return;

        btn.disabled = true;
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<span>🪄</span> ШІ думає...';

        if (bar) {
            bar.classList.remove('hidden');
            bar.style.width = '10%';
        }

        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            if (!apiKey) {
                alert("⚠️ Не знайдено API ключ Gemini. Будь ласка, додайте його в налаштуваннях.");
                window.showSection('section-settings');
                return;
            }

            console.log("AI Rewrite triggered with Gemini API...");
            if (bar) bar.style.width = '40%';

            const prompt = `Ти професійний український журналіст. Перепиши наступну новину у стилі видання "IF News". 
            Вимоги:
            1. Професійний, стриманий, але динамічний тон.
            2. Збережи всі важливі факти та цифри.
            3. Додай влучний та потужний заголовок на початку (перший рядок).
            4. Використовуй HTML теги для структурування (p, h2, strong).
            5. Додай логічний висновок або підсумок.
            
            Текст для обробки: ${currentTitle}\n\n${currentHtml.replace(/<[^>]*>/g, ' ')}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (bar) bar.style.width = '80%';
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            const aiText = data.candidates[0].content.parts[0].text;

            // Extract the first line as the potential new title
            const lines = aiText.split('\n').filter(l => l.trim().length > 0);
            let newTitle = currentTitle;
            let bodyContent = aiText;

            if (lines.length > 1) {
                newTitle = lines[0].replace(/#/g, '').trim();
                bodyContent = lines.slice(1).join('\n');
            }

            if (bar) bar.style.width = '100%';

            const signature = `<p><br></p><p><strong>Стаття підготовлена редакцією "IF News"</strong>.</p>`;

            titleInput.value = newTitle;
            quill.clipboard.dangerouslyPasteHTML(bodyContent + signature);

            // Re-detect category and SEO
            document.getElementById('category').value = autoTagArticle(bodyContent, newTitle);
            updateSEO();

        } catch (e) {
            console.error("AI Error:", e);
            alert("❌ Помилка ШІ: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
            if (bar) {
                setTimeout(() => {
                    bar.classList.add('hidden');
                    bar.style.width = '0';
                }, 500);
            }
        }
    }
    window.rewriteWithAI = rewriteWithAI;

    // --- AI CONFIG MANAGEMENT ---
    window.saveAIConfig = () => {
        const key = document.getElementById('gemini-api-key').value.trim();
        if (!key) { alert("⚠️ Будь ласка, введіть API ключ."); return; }

        localStorage.setItem('gemini_api_key', key);
        alert("✅ Конфігурацію ШІ збережено успішно!");
    };

    window.toggleKeyVisibility = () => {
        const input = document.getElementById('gemini-api-key');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    };

    function loadAIConfig() {
        const key = localStorage.getItem('gemini_api_key');
        if (key && document.getElementById('gemini-api-key')) {
            document.getElementById('gemini-api-key').value = key;
        }
    }
    // Initialize AI config after some delay to ensure DOM is ready
    setTimeout(loadAIConfig, 1000);

    // --- RSS SCRAPER HELPER ---
    async function scrapeFullContent(link) {
        try {
            let htmlContent = null;
            // Primary Proxy: AllOrigins
            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(link)}&_=${Date.now()}`;
                const response = await fetch(proxyUrl);
                const data = await response.json();
                if (data && data.contents) htmlContent = data.contents;
            } catch (e) { console.warn("Primary scraper proxy failed"); }

            // Secondary Proxy: CORSProxy.io
            if (!htmlContent) {
                try {
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(link)}`;
                    const response = await fetch(proxyUrl);
                    htmlContent = await response.text();
                } catch (e) { console.warn("Secondary scraper proxy failed"); }
            }

            if (htmlContent) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, "text/html");
                const selectors = [
                    '.post-content', '.entry-content', '.article-content',
                    '.td-post-content', '.article__text', '.article-body',
                    '.wp-block-post-content', '.single-post-content',
                    'article', '[itemprop="articleBody"]', '.content-main',
                    '.post-item-content', '.entry', '.item-content', '.entry-wrapper',
                    '.post-content-inner', '.article-main'
                ];

                let candidates = [];
                for (const s of selectors) {
                    doc.querySelectorAll(s).forEach(node => {
                        if (node && node.innerText.trim().length > 250) {
                            candidates.push(node);
                        }
                    });
                }

                let contentNode = null;
                if (candidates.length > 0) {
                    // Pick candidate with MAXIMUM text length (helps with nested wrappers)
                    contentNode = candidates.reduce((prev, current) =>
                        (prev.innerText.length > current.innerText.length) ? prev : current
                    ).cloneNode(true);
                }

                if (contentNode) {
                    // Informator-specific and general junk
                    const junkSelectors = [
                        'script', 'style', '.adsbygoogle', '.related', '.social-share',
                        'noscript', '.sidebar', '.comments', '.newsletter-signup',
                        '.wp-block-embed', '.sharedaddy', '.jp-relatedposts', '.printfriendly',
                        'blockquote.wp-embedded-content', '.post-navigation', '.author-box'
                    ];
                    junkSelectors.forEach(s => {
                        contentNode.querySelectorAll(s).forEach(j => j.remove());
                    });

                    console.log("✅ Scraped content from:", link, "Length:", contentNode.innerText.length);

                    // Remove "Читайте також" (Read Also) blocks common in UA news
                    contentNode.querySelectorAll('p, div').forEach(el => {
                        const txt = el.innerText.toLowerCase();
                        if (txt.includes('читайте також') || txt.includes('також читайте') || txt.includes('дивіться також')) {
                            // If it's a short paragraph with a link, it's likely a "read also" block
                            if (el.innerText.length < 200 && el.querySelector('a')) {
                                el.remove();
                            }
                        }
                    });

                    // Normalize image URLs in content
                    contentNode.querySelectorAll('img').forEach(img => {
                        let src = img.getAttribute('src') || img.getAttribute('data-src');
                        if (src && (src.startsWith('/') || !src.startsWith('http'))) {
                            try {
                                const origin = new URL(link).origin;
                                img.setAttribute('src', origin + (src.startsWith('/') ? src : '/' + src));
                            } catch (e) { }
                        }
                        // Remove very small icons/decorations
                        if (img.width > 0 && img.width < 50) img.remove();
                    });

                    return contentNode.innerHTML;
                }
            }
        } catch (e) {
            console.warn("Scraping failed for:", link, e);
        }
        return null;
    }

    async function fetchRSSArticles() {
        console.log("fetchRSSArticles logic started...");
        const grid = document.getElementById('rss-items-grid');
        if (!grid || !_supabase) {
            console.warn("RSS Grid or Supabase not found. Grid:", !!grid, "Supabase:", !!_supabase);
            return;
        }

        // 0. FETCH EXISTING LINKS FROM SUPABASE TO FILTER DUPLICATES
        let dbLinks = new Set();
        try {
            const { data: existing, error } = await _supabase.from('news').select('link');
            if (existing) existing.forEach(row => { if (row.link) dbLinks.add(row.link); });

            const { data: staged, error: sError } = await _supabase.from('rss_articles').select('link');
            if (staged) staged.forEach(row => { if (row.link) dbLinks.add(row.link); });
        } catch (e) {
            console.warn("DB cross-reference failed:", e);
        }

        if (rssSources.length === 0) {
            console.log("No RSS sources found to fetch.");
            grid.innerHTML = '<div class="text-center py-20 text-slate-400 italic font-medium">Додайте джерела RSS ліворуч, щоб стрічка ожила 📡</div>';
            return;
        }

        // Local UI Structure Management (only if needed)
        const statusList = document.getElementById('rss-status-list');
        if (statusList) statusList.innerHTML = '';

        for (const source of rssSources) {
            const url = source.url;
            const sourceHost = new URL(url).hostname;
            const statusId = `status-${sourceHost.replace(/\./g, '-')}`;
            statusList.insertAdjacentHTML('beforeend', `
            <div id="${statusId}" class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-slate-50">
                <div class="flex items-center gap-3">
                    <span class="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                    Синхронізація: ${sourceHost}
                </div>
            </div>
        `);

            try {
                let data = null;
                // Primary Proxy
                try {
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_=${Date.now()}`;
                    const response = await fetch(proxyUrl);
                    const json = await response.json();
                    if (json && json.contents) data = json.contents;
                } catch (e) { console.warn(`Fallback for ${sourceHost}`); }

                // Secondary Proxy
                if (!data) {
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                    const response = await fetch(proxyUrl);
                    data = await response.text();
                }

                if (!data) throw new Error("Connection failed");

                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(data, "text/xml"); // Renamed xml to xmlDoc
                let items = xmlDoc.querySelectorAll("item, entry");

                // If XML failed, try specialized WordPress selector
                if (items.length === 0) {
                    const html = parser.parseFromString(data, "text/html");
                    items = html.querySelectorAll("item, entry");
                }

                const itemsToStaging = [];

                for (const item of items) {
                    const title = item.querySelector("title")?.textContent || "Без заголовка";
                    const link = (item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "").trim();
                    const description = item.querySelector("description, summary")?.textContent || "";

                    if (!link || dbLinks.has(link)) continue;

                    let fullContent = "";
                    try {
                        const encodedNS = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0];
                        const encodedTag = item.getElementsByTagName("content:encoded")[0];
                        const encodedQuery = item.querySelector("encoded");

                        if (encodedNS) fullContent = encodedNS.textContent;
                        else if (encodedTag) fullContent = encodedTag.textContent;
                        else if (encodedQuery) fullContent = encodedQuery.textContent;
                    } catch (e) { }

                    // PRE-SCRAPE if missing from feed
                    if (!fullContent || fullContent.length < 500) {
                        const scraped = await scrapeFullContent(link);
                        if (scraped) fullContent = scraped;
                    }

                    const pubDateString = item.querySelector("pubDate, published, updated")?.textContent || "";
                    let pubDate = null;
                    if (pubDateString) {
                        try { pubDate = new Date(pubDateString).toISOString(); } catch (e) { }
                    }

                    let image = "";
                    const enclosure = item.querySelector("enclosure[type^='image']");
                    if (enclosure) {
                        image = enclosure.getAttribute("url");
                    } else {
                        const searchSource = fullContent || description;
                        const imgMatch = searchSource.match(/<img[^>]+src="([^">]+)"/);
                        if (imgMatch) image = imgMatch[1];
                    }

                    itemsToStaging.push({
                        title,
                        link,
                        description,
                        full_content: fullContent,
                        pub_date: pubDate,
                        image_url: image,
                        source_name: sourceHost
                    });
                    dbLinks.add(link);
                }

                if (itemsToStaging.length > 0) {
                    await _supabase.from('rss_articles').upsert(itemsToStaging, { onConflict: 'link' });
                }

                // Update Status in Supabase
                await _supabase.from('rss_sources').update({
                    last_status: 'online',
                    last_fetch: new Date().toISOString()
                }).eq('id', source.id);

                document.getElementById(statusId).innerHTML = `
                <div class="flex items-center gap-3 text-green-600">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    ${sourceHost}: +${itemsToStaging.length} нових
                </div>
                <span class="text-[8px] opacity-50 font-black tracking-widest">${new Date().toLocaleTimeString()}</span>
            `;
                renderRSSSources();
                renderRSSArticles(); // Refresh the grid
            } catch (err) {
                await _supabase.from('rss_sources').update({
                    last_status: 'error',
                    last_fetch: new Date().toISOString()
                }).eq('id', source.id);

                document.getElementById(statusId).innerHTML = `
                <div class="flex items-center gap-3 text-red-500">
                    <span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    ${sourceHost}: Помилка з'єднання
                </div>
            `;
                renderRSSSources();
                console.error(err);
            }
        }

        // UI Feedback for "No new items" - this will be handled by renderRSSArticles now
        // if (cachedArticles.length === 0) {
        //     const itemsGrid = document.getElementById('rss-items-grid');
        //     if (itemsGrid) {
        //         itemsGrid.innerHTML = `
        //         <div class="p-20 text-center animate-fadeIn">
        //             <div class="text-6xl mb-6 opacity-30">📭</div>
        //             <h3 class="text-xl font-black text-slate-500 uppercase tracking-widest">Нових новин не знайдено</h3>
        //             <p class="text-slate-600 mt-2 text-sm italic">Ми перевірили базу даних — усі актуальні новини вже додані або відхилені.</p>
        //             <button onclick="window.fetchRSSArticles()" class="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition">Повторити пошук</button>
        //         </div>`;
        //     }
        // }

        // PRE-FETCH FULL CONTENT FOR TOP ARTICLES (Background)
        // This will now operate on articles from the DB, not a local cache
        const { data: articlesToPreFetch } = await _supabase.from('rss_articles').select('*').eq('is_dismissed', false).eq('is_imported', false).order('pub_date', { ascending: false }).limit(10);
        if (articlesToPreFetch) {
            preFetchFullContent(articlesToPreFetch);
        }
    }
    window.fetchRSSArticles = fetchRSSArticles;

    async function preFetchFullContent(articles) {
        for (const art of articles) {
            if (art.full_content && art.full_content.length > 500) continue;

            // Skip if recently fetched to avoid spam
            const cacheKey = `pfetch_${art.id}`;
            if (localStorage.getItem(cacheKey)) continue;

            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(art.link)}`;
                const response = await fetch(proxyUrl);
                const data = await response.json();

                if (data && data.contents) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(data.contents, "text/html");
                    const selectors = ['.entry-content', '.post-content', '.article-content', '.td-post-content', '.article__text', 'article', '[itemprop="articleBody"]'];

                    let contentNode = null;
                    for (const s of selectors) {
                        const found = doc.querySelector(s);
                        if (found && found.innerText.length > 200) { contentNode = found; break; }
                    }

                    if (contentNode) {
                        const junk = contentNode.querySelectorAll('script, style, .adsbygoogle, .related, .social-share, .wp-caption-text, noscript, .sidebar, .comments');
                        junk.forEach(j => j.remove());

                        const cache = getRSSCache();
                        const idx = cache.findIndex(item => item.id === art.id);
                        if (idx !== -1) {
                            cache[idx].fullContent = contentNode.innerHTML;
                            saveRSSCache(cache);
                            localStorage.setItem(cacheKey, '1');
                            console.log(`✅ Background pre-fetch success: ${art.title}`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Pre-fetch failed for ${art.title}`);
            }
        }
    }

    async function dismissRSSArticle(id) {
        if (!_supabase) return;
        await _supabase.from('rss_articles').update({ is_dismissed: true }).eq('id', id);
        renderRSSArticles();
    }
    window.dismissRSSArticle = dismissRSSArticle;

    async function importFromRSS(id) {
        if (!_supabase) return;
        const { data: art } = await _supabase.from('rss_articles').select('*').eq('id', id).single();
        if (!art) return;

        // 1. INSTANT NAVIGATION & BASIC POPULATION
        window.showSection('section-add');
        currentEditingId = null;
        const form = document.getElementById('news-form');
        if (form) {
            form.reset();
            form.dataset.rssLink = art.link; // Track for auto-dismiss
        }

        document.getElementById('title').value = art.title;
        document.getElementById('image_url').value = art.image_url || '';

        if (art.image_url) {
            document.getElementById('image-preview').innerHTML = `<img src="${art.image_url}" class="w-full h-full object-cover rounded-xl shadow-md">`;
        }

        // 2. OPTIMISTIC EDITOR CONTENT
        let initialText = art.full_content || art.description || 'Завантаження змісту...';
        if (quill) {
            const html = `<h2>${art.title}</h2>${initialText}<p><br></p><hr><p>Джерело: <a href="${art.link}" target="_blank">${art.source_name}</a></p>`;
            quill.clipboard.dangerouslyPasteHTML(html);
        }

        // 3. FAST SEO AUTO-FILL & CATEGORY DETECTION
        const cleanDesc = (art.description || '').replace(/<[^>]*>/g, '').substring(0, 160).trim();
        document.getElementById('meta_description').value = cleanDesc;

        const detectedCat = autoTagArticle(initialText, art.title);
        document.getElementById('category').value = detectedCat;

        setTimeout(() => {
            document.getElementById('title').dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('meta_description').dispatchEvent(new Event('input', { bubbles: true }));
        }, 50);

        // 4. BACKGROUND SCRAPER (If content missing/short)
        if (!art.full_content || art.full_content.length < 500) {
            const btn = document.querySelector(`button[onclick*="importFromRSS('${id}')"]`);
            if (btn) btn.innerHTML = '⌛ Завантаження повного тексту...';

            const scraped = await scrapeFullContent(art.link);
            if (scraped) {
                // Update editor ONLY IF the user hasn't changed much (safe overwrite)
                const currentHtml = quill.root.innerHTML;
                if (currentHtml.length < initialText.length + 500) {
                    const fullHtml = `<h2>${art.title}</h2>${scraped}<p><br></p><hr><p>Джерело: <a href="${art.link}" target="_blank">${art.source_name}</a></p>`;
                    quill.clipboard.dangerouslyPasteHTML(fullHtml);

                    // Re-trigger category detection with full text
                    document.getElementById('category').value = autoTagArticle(scraped, art.title);
                    console.log("⚡ Hot-swapped content and updated category");
                }

                // Also update the staging record so next time it's immediate
                await _supabase.from('rss_articles').update({ full_content: scraped }).eq('id', id);
            }

            if (btn) btn.innerHTML = 'Редагувати та публікувати';
        }
    }
    window.importFromRSS = importFromRSS;

    window.loadStats = async () => {
        if (!_supabase) return;
        const { data } = await _supabase.from('news').select('id, meta_description');
        if (data) {
            document.getElementById('stat-total').innerText = data.length;
            document.getElementById('stat-no-desc').innerText = data.filter(i => !i.meta_description || i.meta_description.length < 50).length;
        }
    };

    // --- НАЛАШТУВАННЯ (РУБРИКИ ТА МІСТА) ---
    window.loadSettings = async () => {
        if (!_supabase) return;
        try {
            const [catRes, cityRes] = await Promise.all([
                _supabase.from('categories').select('*').order('order_index', { ascending: true }),
                _supabase.from('cities').select('*').order('order_index', { ascending: true })
            ]);
            if (catRes.error || cityRes.error) return;

            const cats = catRes.data || [];
            const cities = cityRes.data || [];

            // Update Global Translation Maps
            CATEGORIES_UK = {};
            cats.forEach(c => CATEGORIES_UK[c.slug] = c.name);
            CITIES_UK = {};
            cities.forEach(c => CITIES_UK[c.slug] = c.name);

            // Re-render news list to update category names if they changed
            window.loadNews();

            const catTable = document.getElementById('categories-table-body');
            if (catTable) {
                catTable.innerHTML = cats.map(c => `
                    <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                        <td class="py-4 font-bold text-slate-700">${c.name}</td>
                        <td class="py-4 text-slate-400 text-sm">${c.slug}</td>
                        <td class="py-4 flex gap-2">
                            <button onclick="window.openSettingsModal('category', '${c.id}', '${c.name}', '${c.slug}', ${c.order_index})" class="p-2 hover:bg-slate-100 rounded-lg">✏️</button>
                            <button onclick="window.deleteSetting('category', '${c.id}')" class="p-2 hover:bg-slate-100 rounded-lg text-red-500">🗑️</button>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="3" class="py-8 text-center text-slate-400">Порожньо</td></tr>';
            }

            const cityTable = document.getElementById('cities-table-body');
            if (cityTable) {
                cityTable.innerHTML = cities.map(c => `
                    <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                        <td class="py-4 font-bold text-slate-700">${c.name}</td>
                        <td class="py-4 text-slate-400 text-sm">${c.slug}</td>
                        <td class="py-4 flex gap-2">
                            <button onclick="window.openSettingsModal('city', '${c.id}', '${c.name}', '${c.slug}', ${c.order_index})" class="p-2 hover:bg-slate-100 rounded-lg">✏️</button>
                            <button onclick="window.deleteSetting('city', '${c.id}')" class="p-2 hover:bg-slate-100 rounded-lg text-red-500">🗑️</button>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="3" class="py-8 text-center text-slate-400">Порожньо</td></tr>';
            }

            // Update selects
            const categorySelect = document.getElementById('category');
            if (categorySelect) categorySelect.innerHTML = cats.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
            const citySelect = document.getElementById('city');
            if (citySelect) citySelect.innerHTML = '<option value="">Вся область</option>' + cities.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
        } catch (e) { console.error(e); }
    };

    window.openSettingsModal = (type, id = '', name = '', slug = '', order = 0) => {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        document.getElementById('setting-type').value = type;
        document.getElementById('setting-id').value = id;
        document.getElementById('setting-name').value = name;
        document.getElementById('setting-slug').value = slug;
        document.getElementById('setting-order').value = order;
        document.getElementById('settings-modal-title').innerText = id ? 'Редагувати' : 'Додати';
    };

    window.closeSettingsModal = () => document.getElementById('settings-modal')?.classList.add('hidden');

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('setting-type').value;
        const id = document.getElementById('setting-id').value;
        const payload = {
            name: document.getElementById('setting-name').value,
            slug: document.getElementById('setting-slug').value,
            order_index: parseInt(document.getElementById('setting-order').value) || 0
        };
        const table = type === 'category' ? 'categories' : 'cities';
        try {
            let res;
            if (id) res = await _supabase.from(table).update(payload).eq('id', id);
            else res = await _supabase.from(table).insert([payload]);

            if (res.error) throw res.error;

            alert("✅ Збережено!");
            window.closeSettingsModal();
            window.loadSettings();
        } catch (err) {
            alert("❌ Помилка: " + err.message);
        }
    });

    window.deleteSetting = async (type, id) => {
        if (!confirm("Ви впевнені, що хочете видалити цей елемент?")) return;
        const table = type === 'category' ? 'categories' : 'cities';
        try {
            const { error } = await _supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            window.loadSettings();
        } catch (e) {
            alert("❌ Помилка: " + e.message);
        }
    };

    window.seedDefaults = async (type) => {
        if (!_supabase || !confirm("Відновити стандартний список? Це оновить існуючі та додасть відсутні елементи.")) return;

        const data = type === 'categories' ? [
            { slug: 'politics', name: 'Політика', order_index: 0 },
            { slug: 'economy', name: 'Економіка', order_index: 10 },
            { slug: 'sport', name: 'Спорт', order_index: 20 },
            { slug: 'culture', name: 'Культура', order_index: 30 },
            { slug: 'tech', name: 'Технології', order_index: 40 },
            { slug: 'frankivsk', name: 'Франківськ', order_index: 50 },
            { slug: 'oblast', name: 'Область', order_index: 60 },
            { slug: 'war', name: 'Війна', order_index: 70 }
        ] : [
            { slug: 'kalush', name: 'Калуш', order_index: 0 },
            { slug: 'if', name: 'Івано-Франківськ', order_index: 10 },
            { slug: 'kolomyya', name: 'Коломия', order_index: 20 },
            { slug: 'dolyna', name: 'Долина', order_index: 30 },
            { slug: 'bolekhiv', name: 'Болехів', order_index: 40 },
            { slug: 'nadvirna', name: 'Надвірна', order_index: 50 },
            { slug: 'burshtyn', name: 'Бурштин', order_index: 60 },
            { slug: 'kosiv', name: 'Косів', order_index: 70 },
            { slug: 'yaremche', name: 'Яремче', order_index: 80 }
        ];

        try {
            const { error } = await _supabase.from(type).upsert(data, { onConflict: 'slug' });
            if (error) throw error;
            alert("✅ Стандартні налаштування завантажено!");
            window.loadSettings();
        } catch (err) {
            alert("❌ Помилка: " + err.message);
        }
    };

    setTimeout(() => { if (_supabase) window.loadSettings(); }, 1000);
    window.loadStats();
});