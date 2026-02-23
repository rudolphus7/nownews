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
        const title = titleInput?.value || "";
        const contentText = quill ? quill.getText() : "";

        if (title) {
            if (slugInput) slugInput.value = SEOEngine.generateSlug(title);
            if (metaTitleInput) {
                metaTitleInput.value = SEOEngine.generateMetaTitle(title);
                document.getElementById('title-count').innerText = metaTitleInput.value.length;
            }
        }

        if (contentText.trim().length > 10 && metaDescInput) {
            metaDescInput.value = SEOEngine.generateMetaDesc(contentText);
            document.getElementById('desc-count').innerText = metaDescInput.value.length;
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
                    const dismissed = JSON.parse(localStorage.getItem('rss_dismissed') || '[]');
                    if (!dismissed.includes(newsForm.dataset.rssLink)) {
                        dismissed.push(newsForm.dataset.rssLink);
                        localStorage.setItem('rss_dismissed', JSON.stringify(dismissed));
                    }
                }

                // สารสภาพ
                currentEditingId = null;
                currentTags = [];
                newsForm.reset();
                if (document.getElementById('city')) document.getElementById('city').value = "";
                delete newsForm.dataset.rssLink;
                quill.setContents([]);
                imagePreview.innerHTML = '<span class="text-slate-600 text-[10px] uppercase font-bold text-center px-4">Зображення не вибрано</span>';
                renderTags();
                btn.innerText = 'Опублікувати новину';
                window.showSection('section-list');
                window.loadNews();
            } catch (err) {
                alert("Помилка: " + err.message);
                btn.disabled = false;
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
        document.getElementById('slug-display').innerText = data.slug;
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

    // --- RSS АГРЕГАТОР ---
    let rssSources = JSON.parse(localStorage.getItem('rss_sources') || '[]');
    let rssInterval = null;

    function renderRSSSources() {
        const list = document.getElementById('rss-sources-list');
        if (!list) return;
        list.innerHTML = rssSources.map((url, index) => `
        <div class="bg-white/50 p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50 transition-all hover:bg-white">
            <span class="text-[10px] font-black text-slate-400 truncate mr-4 uppercase tracking-widest">${url}</span>
            <button onclick="window.removeRSSSource(${index})" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
        </div>
    `).join('');
    }

    const rssForm = document.getElementById('rss-source-form');
    if (rssForm) {
        rssForm.onsubmit = (e) => {
            e.preventDefault();
            const urlInp = document.getElementById('rss-url');
            const url = urlInp.value.trim();
            if (url && !rssSources.includes(url)) {
                rssSources.push(url);
                localStorage.setItem('rss_sources', JSON.stringify(rssSources));
                urlInp.value = '';
                renderRSSSources();
                fetchRSSArticles();
            }
        };
    }

    window.removeRSSSource = (index) => {
        if (confirm("Видалити це джерело?")) {
            rssSources.splice(index, 1);
            localStorage.setItem('rss_sources', JSON.stringify(rssSources));
            renderRSSSources();
            fetchRSSArticles();
        }
    };

    window.loadRSS = () => {
        renderRSSSources();
        renderRSSCache(); // Show what we have immediately
        fetchRSSArticles();

        // Auto-refresh every 5 minutes while on this section
        if (rssInterval) clearInterval(rssInterval);
        rssInterval = setInterval(fetchRSSArticles, 300000);
    };

    // --- RSS CACHE MANAGEMENT ---
    function getRSSCache() {
        return JSON.parse(localStorage.getItem('rss_cache') || '[]');
    }

    function saveRSSCache(articles) {
        localStorage.setItem('rss_cache', JSON.stringify(articles));
    }

    function renderRSSCache() {
        const itemsGrid = document.getElementById('rss-items-grid');
        if (!itemsGrid) return;

        const articles = getRSSCache();
        const dismissed = JSON.parse(localStorage.getItem('rss_dismissed') || '[]');
        const visible = articles.filter(a => !dismissed.includes(a.id)).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        if (visible.length === 0) {
            const hasDismissed = dismissed.length > 0;
            itemsGrid.innerHTML = `
            <div class="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <p class="text-slate-400 italic mb-6">Нових новин поки немає у ваших джерелах.</p>
                ${hasDismissed ? `
                <button onclick="window.clearDismissedRSS()" class="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:underline">
                    Повернути приховані новини (${dismissed.length})
                </button>
                ` : ''}
            </div>
        `;
            return;
        }

        itemsGrid.innerHTML = visible.map((art, idx) => `
        <div id="rss-item-${idx}" class="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-white flex flex-col md:flex-row gap-8 items-start transition-all hover:border-orange-200 group">
            ${art.image ? `
            <div class="w-full md:w-48 h-48 flex-shrink-0 rounded-[2rem] overflow-hidden shadow-lg">
                <img src="${art.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
            </div>
            ` : ''}
            <div class="flex-1">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <span class="bg-orange-600 text-white px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest">${art.source}</span>
                        <span class="text-[9px] text-slate-300 font-bold italic">${art.pubDate ? new Date(art.pubDate).toLocaleString() : 'Нещодавно'}</span>
                    </div>
                    <button onclick="window.dismissRSSArticle('${art.id}', ${idx})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
                </div>
                <h3 class="text-2xl font-black text-slate-800 mb-4 tracking-tight leading-tight group-hover:text-orange-600 transition-colors">${art.title}</h3>
                <div class="text-sm text-slate-500 line-clamp-2 mb-8 leading-relaxed">${art.description ? art.description.replace(/<[^>]*>/g, '').substring(0, 200) : 'Без опису'}...</div>
                <div class="flex items-center gap-4">
                    <button onclick="window.importFromRSS('${art.id}')" class="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition shadow-2xl shadow-slate-200">Редагувати та публікувати</button>
                    <a href="${art.link}" target="_blank" class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition flex items-center gap-2">Оригінал <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></a>
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

    window.clearDismissedRSS = () => {
        if (confirm("Повернути всі приховані новини у список?")) {
            localStorage.removeItem('rss_dismissed');
            renderRSSCache(); // Re-render to show previously dismissed articles
        }
    };

    window.fetchRSSArticles = async () => {
        const container = document.getElementById('rss-articles-container');
        if (!container) return;

        // 0. FETCH EXISTING LINKS FROM SUPABASE TO FILTER DUPLICATES
        let dbLinks = new Set();
        try {
            const { data: existing, error } = await _supabase.from('news').select('link');
            if (error) {
                console.warn("DB cross-reference skipped (Link column might be missing)");
            } else if (existing) {
                existing.forEach(row => { if (row.link) dbLinks.add(row.link); });
            }
        } catch (e) {
            console.warn("DB cross-reference failed:", e);
        }

        const rssSources = JSON.parse(localStorage.getItem('rss_sources') || '[]');
        const dismissed = JSON.parse(localStorage.getItem('rss_dismissed') || '[]');

        if (rssSources.length === 0) {
            container.innerHTML = '<div class="text-center py-20 text-slate-400 italic font-medium">Додайте джерела RSS ліворуч, щоб стрічка ожила 📡</div>';
            return;
        }

        // Initial structure if empty
        if (!document.getElementById('rss-items-grid')) {
            container.innerHTML = '<div id="rss-status-list" class="mb-10 space-y-3"></div><div id="rss-items-grid" class="grid grid-cols-1 gap-8"></div>';
        }

        const statusList = document.getElementById('rss-status-list');
        statusList.innerHTML = ''; // Fresh status each time

        let cachedArticles = getRSSCache();
        const existingLinks = new Set(cachedArticles.map(a => a.link));

        for (const url of rssSources) {
            const sourceHost = new URL(url).hostname;
            const statusId = `status-${sourceHost.replace(/\./g, '-')}`;
            statusList.insertAdjacentHTML('beforeend', `
            <div id="${statusId}" class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-slate-50">
                <div class="flex items-center gap-3">
                    <span class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    Оновлення завантажується: ${sourceHost}
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

                const existingLinks = new Set(cachedArticles.map(a => a.link)); // Links already collected in this fetch session

                items.forEach(item => {
                    const title = item.querySelector("title")?.textContent || "Без заголовка"; // Added default title
                    const link = (item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "").trim();
                    const description = item.querySelector("description, summary")?.textContent || "";

                    // FILTER: Skip if link is missing, already in cache, dismissed, OR ALREADY IN DATABASE
                    if (!link || existingLinks.has(link) || dismissed.includes(link) || dbLinks.has(link)) return;

                    let fullContent = "";
                    try {
                        const encodedNS = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0];
                        const encodedTag = item.getElementsByTagName("content:encoded")[0];
                        const encodedQuery = item.querySelector("encoded");

                        if (encodedNS) fullContent = encodedNS.textContent;
                        else if (encodedTag) fullContent = encodedTag.textContent;
                        else if (encodedQuery) fullContent = encodedQuery.textContent;
                    } catch (e) {
                        console.warn("Error extracting fullContent:", e); // Added console.warn
                    }

                    const pubDate = item.querySelector("pubDate, published, updated")?.textContent || ""; // Added pubDate
                    const id = item.querySelector("guid, id")?.textContent || link;
                    let image = "";
                    const enclosure = item.querySelector("enclosure[type^='image']");
                    if (enclosure) {
                        image = enclosure.getAttribute("url");
                    } else {
                        const searchSource = fullContent || description;
                        const imgMatch = searchSource.match(/<img[^>]+src="([^">]+)"/);
                        if (imgMatch) image = imgMatch[1];
                    }

                    cachedArticles.push({ id, title, link, description, fullContent, pubDate, image, source: sourceHost }); // Added pubDate
                    existingLinks.add(link);
                });

                document.getElementById(statusId).innerHTML = `
                <div class="flex items-center gap-3 text-green-600">
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                    ${sourceHost}: Отримано ${items.length} елементів
                </div>
                <span class="text-[8px] opacity-50">${new Date().toLocaleTimeString()}</span>
            `; // Reverted status message to original, but kept green color
            } catch (err) {
                document.getElementById(statusId).innerHTML = `
                <div class="flex items-center gap-3 text-red-500">
                    <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                    ${sourceHost}: Помилка підключення
                </div>
            `;
                console.error(err);
            }
        }

        saveRSSCache(cachedArticles);
        renderRSSCache();

        // UI Feedback for "No new items"
        if (cachedArticles.length === 0) {
            const itemsGrid = document.getElementById('rss-items-grid');
            if (itemsGrid) {
                itemsGrid.innerHTML = `
                <div class="p-20 text-center animate-fadeIn">
                    <div class="text-6xl mb-6 opacity-30">📭</div>
                    <h3 class="text-xl font-black text-slate-500 uppercase tracking-widest">Нових новин не знайдено</h3>
                    <p class="text-slate-600 mt-2 text-sm italic">Ми перевірили базу даних — усі актуальні новини вже додані або відхилені.</p>
                    <button onclick="window.fetchRSSArticles()" class="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition">Повторити пошук</button>
                </div>`;
            }
        }

        // PRE-FETCH FULL CONTENT FOR TOP ARTICLES (Background)
        preFetchFullContent(cachedArticles.slice(0, 10));
    }

    async function preFetchFullContent(articles) {
        for (const art of articles) {
            if (art.fullContent && art.fullContent.length > 500) continue;

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

    window.dismissRSSArticle = (id, index) => {
        const dismissed = JSON.parse(localStorage.getItem('rss_dismissed') || '[]');
        if (!dismissed.includes(id)) {
            dismissed.push(id);
            localStorage.setItem('rss_dismissed', JSON.stringify(dismissed));
        }

        // Smooth removal from UI
        const elem = document.getElementById(`rss-item-${index}`);
        if (elem) {
            elem.style.opacity = '0';
            elem.style.transform = 'scale(0.95)';
            setTimeout(renderRSSCache, 300); // Re-render to update list
        }
    };

    window.importFromRSS = async (id) => {
        const articles = getRSSCache();
        const art = articles.find(a => a.id === id);
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
        document.getElementById('image_url').value = art.image || '';

        if (art.image) {
            document.getElementById('image-preview').innerHTML = `<img src="${art.image}" class="w-full h-full object-cover rounded-xl shadow-md">`;
        }

        // 2. OPTIMISTIC EDITOR CONTENT
        let initialText = art.fullContent || art.description || 'Завантаження змісту...';
        if (quill) {
            quill.root.innerHTML = `<h2>${art.title}</h2>${initialText}<p><br></p><hr><p>Джерело: <a href="${art.link}" target="_blank">${art.source}</a></p>`;
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
        if (!art.fullContent || art.fullContent.length < 500) {
            const btn = document.querySelector(`button[onclick*="importFromRSS('${id}')"]`);
            if (btn) btn.innerHTML = '⌛ Завантаження повного тексту...';

            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(art.link)}&_=${Date.now()}`;
                const response = await fetch(proxyUrl);
                const data = await response.json();

                if (data && data.contents) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(data.contents, "text/html");
                    const selectors = ['.entry-content', '.post-content', '.article-content', '.td-post-content', '.article__text', 'article', '[itemprop="articleBody"]', '.content-main'];

                    let contentNode = null;
                    for (const s of selectors) {
                        const found = doc.querySelector(s);
                        if (found && found.innerText.length > 200) { contentNode = found; break; }
                    }

                    if (contentNode) {
                        const junk = contentNode.querySelectorAll('script, style, .adsbygoogle, .related, .social-share, noscript, .sidebar, .comments');
                        junk.forEach(j => j.remove());

                        // Normalize image URLs in content
                        contentNode.querySelectorAll('img').forEach(img => {
                            let src = img.getAttribute('src');
                            if (src && (src.startsWith('/') || !src.startsWith('http'))) {
                                try {
                                    const origin = new URL(art.link).origin;
                                    img.setAttribute('src', origin + (src.startsWith('/') ? src : '/' + src));
                                } catch (e) { }
                            }
                        });

                        // Update editor ONLY IF the user hasn't changed much (safe overwrite)
                        const currentHtml = quill.root.innerHTML;
                        if (currentHtml.length < initialText.length + 500) {
                            quill.root.innerHTML = `<h2>${art.title}</h2>${contentNode.innerHTML}<p><br></p><hr><p>Джерело: <a href="${art.link}" target="_blank">${art.source}</a></p>`;

                            // Re-trigger category detection with full text
                            document.getElementById('category').value = autoTagArticle(contentNode.innerHTML, art.title);
                            console.log("⚡ Hot-swapped content and updated category");
                        }
                    }
                }
            } catch (e) {
                console.warn("Background fetch failed");
            }

            if (btn) btn.innerHTML = 'Редагувати та публікувати';
        }
    };

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