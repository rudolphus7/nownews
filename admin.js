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

// --- IMAGE UPLOAD & OPTIMIZATION ---
// Pre-load logo once to avoid repeated network requests and timing issues on mobile
const logoImage = new Image();
logoImage.src = window.location.origin + '/logo.png';
const logoLoadPromise = new Promise((resolve) => {
    logoImage.onload = () => resolve(true);
    logoImage.onerror = () => {
        console.warn('Logo could not be pre-loaded');
        resolve(false);
    };
});

window.handleImageUpload = async (input, targetId) => {
    const file = input.files[0];
    if (!file) return;

    const overlay = document.getElementById('upload-progress-overlay');
    const preview = document.getElementById('image-preview');
    const targetInput = document.getElementById(targetId);

    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    try {
        // 1. Load image and ensure it's decoded (crucial for mobile/Safari)
        const img = new Image();
        img.src = URL.createObjectURL(file);

        await new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    if (img.decode) await img.decode();
                    resolve();
                } catch (e) { resolve(); } // Fallback if decode fails
            };
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Max width 1200px (standard for modern editorial)
        const MAX_WIDTH = 1200;
        if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        // Draw the main image
        ctx.fillStyle = "#FFFFFF"; // Guard against transparent backgrounds
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Add Watermark (Branding)
        try {
            await logoLoadPromise; // Wait if not already loaded

            if (logoImage.complete && logoImage.naturalWidth > 0) {
                // Calculate logo size (e.g., 15% of image width)
                const logoScale = (width * 0.15) / logoImage.naturalWidth;
                const logoW = logoImage.naturalWidth * logoScale;
                const logoH = logoImage.naturalHeight * logoScale;

                // Position: bottom-right with 20px padding (relative to resized image)
                const padding = 20;
                const x = width - logoW - padding;
                const y = height - logoH - padding;

                ctx.save();
                ctx.globalAlpha = 0.7; // Subtle transparency
                ctx.drawImage(logoImage, x, y, logoW, logoH);
                ctx.restore();
            }
        } catch (e) {
            console.warn('Watermark overlay failed:', e);
        }

        // 3. Convert to WebP (optimized)
        const webpBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));

        // 4. Upload to our API
        const fileName = `${Date.now()}_${file.name.split('.')[0]}.webp`;
        const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
                'x-file-name': fileName
            },
            body: webpBlob
        });

        const data = await response.json();

        if (response.ok && data.url) {
            // Success!
            if (targetInput) {
                targetInput.value = data.url;
                // Trigger input event to update preview
                targetInput.dispatchEvent(new Event('input'));
            }
            console.log(`✅ Image uploaded: ${data.url} (${(data.size / 1024).toFixed(1)} KB)`);
        } else {
            throw new Error(data.error || 'Помилка завантаження');
        }

    } catch (err) {
        console.error('Upload failed:', err);
        alert('Помилка завантаження: ' + err.message);
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
        input.value = ''; // Reset input
    }
};

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
            if (slugDisplay) slugDisplay.innerHTML = `<a href="/${generatedSlug}" target="_blank" class="text-orange-600 hover:underline">/${generatedSlug}</a>`;
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

// --- РЕАКЦІЇ (ЛОГІКА ВИБОРУ В АДМІНЦІ) ---
const initReactionSelector = () => {
    const checkboxes = document.querySelectorAll('.reaction-checkbox');
    checkboxes.forEach(cb => {
        const updateUI = () => {
            const label = cb.closest('.reaction-checkbox-label');
            if (cb.checked) label.classList.add('checked');
            else label.classList.remove('checked');
        };
        cb.addEventListener('change', updateUI);
        updateUI(); // Initial
    });
};
initReactionSelector();

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

        const allowedReactions = Array.from(document.querySelectorAll('.reaction-checkbox:checked')).map(cb => cb.value);

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
            allowed_reactions: allowedReactions,
            link: newsForm.dataset.rssLink || "",
            is_published: true,
            author_name: 'Редакція BUKVA NEWS'
        };

        try {
            let result;
            if (currentEditingId) {
                result = await _supabase.from('news').update(payload).eq('id', currentEditingId);
            } else {
                result = await _supabase.from('news').insert([payload]);
            }

            if (result.error) throw result.error;

            // --- GOOGLE INDEXING PING ---
            try {
                const targetSlug = slugInput.value;
                const targetCity = document.getElementById('city').value;
                const targetCategory = document.getElementById('category').value;
                let canonicalUrl = `https://bukva.news/${targetSlug}/`; // Default fallback

                if (targetCity) {
                    canonicalUrl = `https://bukva.news/${targetCity}/${targetSlug}/`;
                } else if (targetCategory) {
                    canonicalUrl = `https://bukva.news/${targetCategory}/${targetSlug}/`;
                }

                console.log('🚀 Pinging Google Indexing for:', canonicalUrl);
                fetch('/api/index-ping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: canonicalUrl, type: currentEditingId ? 'URL_UPDATED' : 'URL_UPDATED' })
                }).catch(e => console.error('Indexing ping background error:', e));

            } catch (idxErr) {
                console.error('Failed to trigger indexing ping:', idxErr);
            }
            // ----------------------------

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

// --- FACEBOOK AUTO-POSTING ---
const btnGenerateFb = document.getElementById('btn-generate-fb');
const btnPublishFb = document.getElementById('btn-publish-fb');
const fbPostText = document.getElementById('fb_post_text');
const fbStatusIcon = document.getElementById('fb-status-icon');
const fbStatusText = document.getElementById('fb-status-text');

if (btnGenerateFb && fbPostText) {
    btnGenerateFb.addEventListener('click', async () => {
        const title = titleInput?.value || "";
        const content = quill ? quill.getText() : "";

        if (!title || !content.trim()) {
            alert("Спочатку напишіть заголовок та текст статті!");
            return;
        }

        const originalText = btnGenerateFb.innerHTML;
        btnGenerateFb.innerHTML = '<span>⏳</span> Генерую...';
        btnGenerateFb.disabled = true;

        try {
            // Determine absolute URL for CTA link
            const slug = slugInput?.value || "";
            const city = document.getElementById('city')?.value || "";
            const category = document.getElementById('category')?.value || "";
            let articleUrl = "https://bukva.news/";
            if (city) {
                articleUrl += `${city}/${slug}/`;
            } else if (category) {
                articleUrl += `${category}/${slug}/`;
            } else if (slug) {
                articleUrl += `${slug}/`;
            }

            // Get local key for fallback
            const localKey = localStorage.getItem('gemini_api_key') || "";

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-fb', title, content, articleUrl, apiKey: localKey })
            });

            const data = await response.json();
            if (response.ok && data.text) {
                // Append article URL to post text so it's visible and copyable
                const postText = articleUrl && articleUrl !== "https://bukva.news/"
                    ? data.text + "\n\n" + articleUrl
                    : data.text;
                fbPostText.value = postText;
            } else {
                alert("Помилка генерації AI: " + (data.error || "Невідома помилка"));
            }
        } catch (err) {
            console.error("AI FB error:", err);
            alert("Помилка запиту до AI: " + err.message);
        } finally {
            btnGenerateFb.innerHTML = originalText;
            btnGenerateFb.disabled = false;
        }
    });
}

if (btnPublishFb && fbPostText) {
    btnPublishFb.addEventListener('click', async () => {
        const text = fbPostText.value.trim();
        if (!text) {
            alert("Спочатку згенеруйте або напишіть текст поста!");
            return;
        }

        if (!confirm("Опублікувати цей пост на Facebook прямо зараз?\n\n‼️ ВАЖЛИВО: Переконайтеся, що ви вже зберегли (опублікували) саму статтю на сайті (кнопка 'Опублікувати новину'). Інакше Facebook не зможе завантажити фото!")) {
            return;
        }

        btnPublishFb.disabled = true;
        fbStatusIcon.innerText = '⏳';
        try {
            const slug = document.getElementById('slug')?.value || "";
            const city = document.getElementById('city')?.value || "";
            const category = document.getElementById('category')?.value || "";
            let articleUrl = "https://bukva.news/";
            if (city) {
                articleUrl += `${city}/${slug}/`;
            } else if (category) {
                articleUrl += `${category}/${slug}/`;
            } else if (slug) {
                articleUrl += `${slug}/`;
            }

            const igImg = document.getElementById('ig_image_url')?.value.trim();
            const mainImg = document.getElementById('image_url')?.value.trim();
            const imageUrl = igImg || mainImg || "";

            // Add cache-busting parameter to force Facebook scraper to bypass Vercel SSR cache
            const fbArticleUrl = articleUrl + (articleUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'post-facebook', message: text, articleUrl: fbArticleUrl, imageUrl })
            });

            const data = await response.json();

            if (response.ok) {
                fbStatusIcon.innerText = '✅';
                fbStatusText.innerText = 'Успішно опубліковано!';
                btnPublishFb.classList.replace('bg-blue-100', 'bg-green-100');
                btnPublishFb.classList.replace('text-blue-600', 'text-green-700');

                setTimeout(() => {
                    fbStatusIcon.innerText = '📤';
                    fbStatusText.innerText = 'Опублікувати у Facebook';
                    btnPublishFb.classList.replace('bg-green-100', 'bg-blue-100');
                    btnPublishFb.classList.replace('text-green-700', 'text-blue-600');
                    btnPublishFb.disabled = false;
                }, 5000);
            } else {
                throw new Error(data.error || "Помилка API Facebook");
            }
        } catch (err) {
            console.error("FB Post error:", err);
            alert("Помилка публікації: " + err.message);
            fbStatusIcon.innerText = '❌';
            fbStatusText.innerText = 'Помилка';
            btnPublishFb.disabled = false;
        }
    });
}


let CATEGORIES_UK = {};
let CITIES_UK = {};

window.loadNews = async () => {
    const tbody = document.getElementById('news-table-body');
    if (!tbody || !_supabase) return;

    tbody.innerHTML = '<tr><td colspan="6" class="p-5 text-center text-gray-500 italic">Синхронізація...</td></tr>';

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
            <td class="p-4 text-center min-w-[80px]">
                <div class="flex items-center justify-center gap-2">
                    ${item.tts_audio_url ?
            `<a href="${item.tts_audio_url}" target="_blank" class="text-orange-500 hover:scale-110 transition-transform text-lg" title="Слухати">▶️</a>
                     <span class="text-green-500 font-black cursor-help" title="${item.tts_audio_url}">✅</span>` :
            `<span class="text-slate-200 font-black">⚪</span>`
        }
                </div>
            </td>
            <td class="p-4 text-xs text-gray-400 font-bold">${new Date(item.created_at).toLocaleDateString()}</td>
            <td class="p-4 text-right space-x-2">
                <button id="btn-tts-${item.id}" onclick="window.generateTTS('${item.id}')" 
                    class="text-indigo-500 font-bold hover:underline uppercase text-xs">
                    ${item.tts_audio_url ? '🎙️ Переозвучити' : '🎙️ Озвучити'}
                </button>
                <button onclick="window.editItem('${item.id}')" class="text-orange-500 font-bold hover:underline uppercase text-xs">Редагувати</button>
                <button onclick="window.deleteItem('${item.id}')" class="text-red-500 font-bold hover:underline uppercase text-xs">Видалити</button>
            </td>
        </tr>
    `).join('');
};

function autoTagArticle(content, title) {
    const text = (title + ' ' + content).toLowerCase();
    if (text.includes('зсу') || text.includes('фронт') || text.includes('обстріл') || text.includes('війна')) return 'viyna';
    if (text.includes('депутат') || text.includes('мер ') || text.includes('рада') || text.includes('вибори')) return 'polityka';
    if (text.includes('курс') || text.includes('банк') || text.includes('бюджет') || text.includes('ціни')) return 'ekonomika';
    if (text.includes('матч') || text.includes('футбол') || text.includes('спорт') || text.includes('команда')) return 'sport';
    if (text.includes('виставка') || text.includes('фільм') || text.includes('театр') || text.includes('музей')) return 'kultura';
    if (text.includes('штучний') || text.includes('смартфон') || text.includes('it') || text.includes('додаток')) return 'tekhnolohii';
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
    if (slugDisplay) slugDisplay.innerHTML = `<a href="/${data.slug}" target="_blank" class="text-orange-600 hover:underline">/${data.slug} ↗</a>`;
    document.getElementById('meta_title').value = data.meta_title;
    document.getElementById('meta_description').value = data.meta_description;
    document.getElementById('category').value = data.category;
    if (document.getElementById('city')) document.getElementById('city').value = data.city || "";
    document.getElementById('image_url').value = data.image_url;

    // Clear social fields so they don't carry over from previous actions
    if (document.getElementById('ig_image_url')) document.getElementById('ig_image_url').value = "";
    if (document.getElementById('fb_post_text')) document.getElementById('fb_post_text').value = "";

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

    // Оновити чекбокси реакцій
    const allowed = data.allowed_reactions || ['like', 'fire', 'wow'];
    document.querySelectorAll('.reaction-checkbox').forEach(cb => {
        cb.checked = allowed.includes(cb.value);
        cb.dispatchEvent(new Event('change')); // Trigger UI update
    });

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

// Допоміжна функція для завантаження бібліотеки стиснення
async function loadLame() {
    if (window.lamejs) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

window.generateTTS = async (id) => {
    if (!_supabase) return;
    const btn = document.getElementById(`btn-tts-${id}`);
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ Генерую...';
    }

    try {
        await loadLame();

        // 1. Отримуємо текст статті
        const { data, error } = await _supabase.from('news').select('title, content').eq('id', id).single();
        if (error || !data) throw new Error("Статтю не знайдено");

        const cleanContent = data.content.replace(/<[^>]*>/g, ' ');
        const fullText = (data.title + ". " + cleanContent).replace(/\s+/g, ' ').trim();

        // 1.1 Розбиваємо на чанки по ~2000 символів (по пробілах), щоб уникнути таймаутів 504
        const chunks = fullText.match(/.{1,2000}(?:\s|$)/gs) || [fullText];
        console.log(`TTS Chunking: ${chunks.length} chunks for ${fullText.length} chars`);

        const mp3encoder = new lamejs.Mp3Encoder(1, 24000, 64);
        const mp3Data = [];

        // 2. Послідовно озвучуємо кожен чанк
        for (let i = 0; i < chunks.length; i++) {
            if (btn) btn.innerText = `🎙️ Синтез ${i + 1}/${chunks.length}...`;

            const response = await fetch('/api/tts?skipCache=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: chunks[i], articleId: id })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Server error' }));
                throw new Error(err.error || `Помилка на частині ${i + 1}: ${response.status}`);
            }

            const wavBuffer = await response.arrayBuffer();
            console.log(`Part ${i + 1} received: ${(wavBuffer.byteLength / 1024).toFixed(0)} KB`);

            // Конвертуємо WAV чанк у PCM і додаємо в MP3
            const wavView = new DataView(wavBuffer);
            const pcmData = new Int16Array((wavBuffer.byteLength - 44) / 2);
            for (let j = 0; j < pcmData.length; j++) {
                pcmData[j] = wavView.getInt16(44 + j * 2, true);
            }

            const sampleBlockSize = 1152;
            for (let j = 0; j < pcmData.length; j += sampleBlockSize) {
                const chunkPcm = pcmData.subarray(j, j + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(chunkPcm);
                if (mp3buf.length > 0) mp3Data.push(mp3buf);
            }
        }

        // 3. Фіналізація MP3
        if (btn) btn.innerText = '🗜️ Фіналізація...';
        const flush = mp3encoder.flush();
        if (flush.length > 0) mp3Data.push(flush);

        const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
        console.log(`Final MP3 size: ${(mp3Blob.size / 1024).toFixed(0)} KB`);

        // 4. Завантажуємо готовий MP3 на сервер
        if (btn) btn.innerText = '☁️ Зберігаю...';
        const uploadRes = await fetch('/api/upload-tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'audio/mpeg',
                'x-article-id': id
            },
            body: mp3Blob
        });

        if (!uploadRes.ok) throw new Error("Помилка завантаження фінального MP3");

        // 5. Успіх!
        if (btn) {
            btn.innerText = '✅ Готово';
            btn.classList.replace('text-indigo-500', 'text-green-500');
        }
        setTimeout(() => window.loadNews(), 1500);

    } catch (err) {
        console.error("TTS Generation error:", err);
        alert("Помилка: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = '🎙️ Повторити';
        }
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

        // Populate filter dropdown
        const filter = document.getElementById('rss-source-filter');
        if (filter) {
            const currentVal = filter.value;
            filter.innerHTML = '<option value="all">Усі джерела</option>';
            rssSources.forEach(s => {
                try {
                    const host = new URL(s.url).hostname;
                    filter.innerHTML += `<option value="${host}">${host}</option>`;
                } catch (e) { }
            });
            filter.value = currentVal;
        }
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

    const filter = document.getElementById('rss-source-filter');
    const sourceName = filter ? filter.value : 'all';

    let query = _supabase
        .from('rss_articles')
        .select('*')
        .eq('is_dismissed', false)
        .eq('is_imported', false);

    if (sourceName !== 'all') {
        query = query.eq('source_name', sourceName);
    }

    const { data: articles, error } = await query
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
window.renderRSSArticles = renderRSSArticles;

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

    if (currentHtml.length < 50 && currentTitle.length < 10) {
        alert("⚠️ Текст занадто короткий. Спочатку введіть заголовок або контент.");
        return;
    }

    if (!confirm("🧙 ШІ перепише статтю у фірмовому стилі BUKVA NEWS. Зміст залишиться незмінним. Продовжити?")) return;

    btn.disabled = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<span>🪄</span> ШІ працює...';

    if (bar) {
        bar.classList.remove('hidden');
        bar.style.width = '10%';
    }

    const prompt = `Ти професійний український журналіст видання "BUKVA NEWS". 
Перепиши статтю, зберігаючи факти, але додаючи професійної динаміки.

Вимоги:
1. Перший рядок — новий професійний заголовок (без знаків #).
   - Заголовок має бути інформативним та дружнім до Google (SEO).
   - Ключові слова (місто, подія) став на початок.
   - Уникай клікбейту, інтриг та "жовтого" стилю.
   - Усі дати пиши виключно цифрами (наприклад: "25 лютого" замість "Двадцять п'ятого лютого").
   - ВАЖЛИВА ВИМОГА: Жодних згадок про те, що це написав штучний інтелект або "ШІ"! Ти — справжній живий журналіст редакції BUKVA NEWS. Категорично заборонено дописувати фрази типу "Матеріал відредаговано за допомогою ШІ".
2. Далі — текст у форматі HTML (p, h2, strong).
3. В кінці підпис: <p><br></p><hr><p><strong>Матеріал підготовано командою "BUKVA NEWS"</strong></p>

Оригінальний заголовок: ${currentTitle}
Текст: ${currentHtml.replace(/<[^>]*>/g, ' ')}`;

    try {
        if (bar) bar.style.width = '30%';

        let resultData = null;

        // 1. Спроба через серверний проксі (працює на Vercel)
        try {
            const localKey = localStorage.getItem('gemini_api_key') || "";

            // Read optional note for fine-tuning
            const note = document.getElementById('journalist-note')?.value?.trim() || '';

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: currentTitle, content: currentHtml, apiKey: localKey, note })
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok && data.title && data.content) {
                resultData = data;
                console.log("AI result from Server Proxy");
            }
        } catch (e) { console.warn("Server AI Proxy failed, trying direct call..."); }

        // 2. Фолбек на прямий виклик (якщо ми на Localhost або проксі не працює)
        if (!resultData) {
            if (bar) bar.style.width = '50%';
            const key = localStorage.getItem('gemini_api_key');

            if (!key) {
                throw new Error("Завантажте API ключ у налаштуваннях для прямої роботи.");
            }

            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            const models = [
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite'
            ];
            const versions = ['v1beta', 'v1'];
            let finalData = null;
            let clientErrors = [];

            findModel: for (const model of models) {
                for (const ver of versions) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${key}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const data = await response.json();
                        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                            finalData = data;
                            break findModel;
                        }
                        const errMsg = data.error?.message || response.statusText || "Unknown error";
                        clientErrors.push(`${model}(${ver}): ${errMsg}`);
                    } catch (e) {
                        clientErrors.push(`${model}(${ver}): ${e.message}`);
                    }
                }
            }

            if (!finalData) {
                throw new Error("Всі моделі ШІ недоступні: " + clientErrors.slice(0, 3).join(" | ") + "...");
            }

            const aiText = finalData.candidates[0].content.parts[0].text;
            const lines = aiText.split('\n').filter(l => l.trim().length > 0);

            let rewrittenTitle = currentTitle;
            let bodyLines = lines;
            if (lines.length > 0) {
                rewrittenTitle = lines[0].replace(/[*#]/g, '').trim();
                bodyLines = lines.slice(1);
            }

            let formattedBody = bodyLines.join('\n')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');

            resultData = {
                title: rewrittenTitle,
                content: (formattedBody.startsWith('<p') ? formattedBody : '<p>' + formattedBody + '</p>') +
                    `<p><br></p><hr><p><strong>Матеріал підготовано командою "BUKVA NEWS"</strong></p>`
            };
            console.log("AI result from Direct Client call");
        }

        if (bar) bar.style.width = '100%';

        // Оновлюємо заголовок та контент
        titleInput.value = resultData.title;
        quill.clipboard.dangerouslyPasteHTML(resultData.content);

        // Автоматично оновлюємо теги та SEO
        document.getElementById('category').value = autoTagArticle(resultData.content, resultData.title);
        updateSEO();

        alert("✨ Статтю успішно переписано ШІ!");

    } catch (e) {
        console.error("AI Error:", e);
        alert("❌ Помилка: " + e.message);
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
    const key = document.getElementById('gemini-api-key')?.value.trim();
    if (!key) { alert("⚠️ Будь ласка, введіть API ключ."); return; }

    localStorage.setItem('gemini_api_key', key);
    alert("✅ Конфігурацію ШІ збережено успішно!");
};

window.toggleKeyVisibility = (id) => {
    const input = document.getElementById(id);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
};

function loadAIConfig() {
    const key = localStorage.getItem('gemini_api_key');
    const input = document.getElementById('gemini-api-key');
    if (input && key) {
        input.value = key;
    }
}
// Initialize AI config after some delay to ensure DOM is ready
setTimeout(loadAIConfig, 1000);

// --- RSS SCRAPER HELPER ---
async function scrapeFullContent(link) {
    try {
        let htmlContent = null;
        // Internal RSS/Page Proxy (Vercel serverless — no CORS issues)
        try {
            const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(link)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) htmlContent = await response.text();
        } catch (e) { console.warn("RSS proxy (scraper) failed:", e.message); }

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
            // Internal RSS Proxy (Vercel serverless — no CORS issues)
            try {
                const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    data = await response.text();
                } else {
                    console.warn(`RSS proxy returned ${response.status} for ${sourceHost}`);
                }
            } catch (e) { console.warn(`RSS proxy failed for ${sourceHost}:`, e.message); }

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

                // ROBUST DATE PARSING
                let pubDateString = item.querySelector("pubDate, published, updated, date")?.textContent || "";
                if (!pubDateString) {
                    const dcDate = item.getElementsByTagName("dc:date")[0] || item.getElementsByTagNameNS("*", "date")[0];
                    if (dcDate) pubDateString = dcDate.textContent;
                }

                let pubDate = null;
                if (pubDateString) {
                    try { pubDate = new Date(pubDateString).toISOString(); } catch (e) { }
                }

                // Fallback to "Right Now" if date is missing (common with rss.app)
                if (!pubDate) {
                    pubDate = new Date().toISOString();
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
            const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(art.link)}`;
            const response = await fetch(proxyUrl);
            const data = response.ok ? { contents: await response.text() } : null;

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

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS MANAGEMENT (Categories, Cities, AI, Social Media)
// ═══════════════════════════════════════════════════════════════════════

// -- Social Media Settings --
window.loadSocialSettings = async () => {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        if (settings) {
            if (settings.social_facebook) document.getElementById('setting_social_facebook').value = settings.social_facebook;
            if (settings.social_instagram) document.getElementById('setting_social_instagram').value = settings.social_instagram;
            if (settings.social_telegram) document.getElementById('setting_social_telegram').value = settings.social_telegram;
            if (settings.social_youtube) document.getElementById('setting_social_youtube').value = settings.social_youtube;
        }
    } catch (e) {
        console.error('Error loading social settings:', e);
    }
};

window.saveSocialSettings = async () => {
    const btn = document.getElementById('btn-save-social');
    const status = document.getElementById('social-save-status');
    const prevHtml = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ЗБЕРЕЖЕННЯ...`;

    const settings = {
        social_facebook: document.getElementById('setting_social_facebook').value.trim() || '#',
        social_instagram: document.getElementById('setting_social_instagram').value.trim() || '#',
        social_telegram: document.getElementById('setting_social_telegram').value.trim() || '#',
        social_youtube: document.getElementById('setting_social_youtube').value.trim() || '#'
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!res.ok) throw new Error('Помилка збереження');

        status.classList.remove('opacity-0');
        setTimeout(() => status.classList.add('opacity-0'), 3000);
    } catch (e) {
        alert('Помилка збереження налаштувань: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
    }
};

window.loadSettings = async () => {
    if (!_supabase) return;

    // Categories
    const { data: catData } = await _supabase.from('categories').select('*').order('order_index', { ascending: true });
    if (catData) renderSettingsTable('categories', catData);

    // Cities
    const { data: cityData } = await _supabase.from('cities').select('*').order('order_index', { ascending: true });
    if (cityData) renderSettingsTable('cities', cityData);

    // Load social specific settings from api
    await window.loadSocialSettings();
};

// ═══════════════════════════════════════════════════════════════════════
// READ ALSO GENERATOR (Internal Links)
// ═══════════════════════════════════════════════════════════════════════
let readAlsoTimeout = null;

window.openReadAlsoModal = async () => {
    document.getElementById('read-also-modal').classList.remove('hidden');
    document.getElementById('read-also-search').value = '';
    document.getElementById('read-also-search').focus();

    // Initial load (last 20)
    window.searchReadAlso(true);
};

window.closeReadAlsoModal = () => {
    document.getElementById('read-also-modal').classList.add('hidden');
};

window.searchReadAlso = (initial = false) => {
    clearTimeout(readAlsoTimeout);
    const query = document.getElementById('read-also-search').value.trim();
    const resultsEl = document.getElementById('read-also-results');
    const insertBtn = document.getElementById('btn-insert-read-also-selected');

    if (!initial && query.length < 3 && query.length > 0) return;

    resultsEl.innerHTML = '<li class="p-6 text-center text-slate-400 italic">Шукаємо...</li>';
    if (insertBtn) insertBtn.classList.add('hidden');

    readAlsoTimeout = setTimeout(async () => {
        if (!_supabase) return;

        let supaQuery = _supabase.from('news').select('id, title, slug, city, created_at').order('created_at', { ascending: false });

        if (query) {
            supaQuery = supaQuery.ilike('title', `%${query}%`).limit(20);
        } else {
            supaQuery = supaQuery.limit(20);
        }

        const { data, error } = await supaQuery;

        if (error) {
            console.error("Read Also Search Error:", error);
            resultsEl.innerHTML = '<li class="p-6 text-center text-red-400 italic">Помилка пошуку.</li>';
            return;
        }

        if (!data || data.length === 0) {
            resultsEl.innerHTML = '<li class="p-6 text-center text-slate-400 italic">Нічого не знайдено 😕</li>';
            return;
        }

        resultsEl.innerHTML = data.map(art => {
            const dateHtml = art.created_at ? `<span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded mr-2 mt-1 inline-block">${new Date(art.created_at).toLocaleDateString('uk-UA')}</span>` : '';
            const titleAttr = art.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            return `
                    <li class="p-4 bg-white rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors shadow-sm mb-2 flex items-center gap-4 group">
                        <input type="checkbox" class="read-also-checkbox w-5 h-5 rounded-lg border-slate-200 text-orange-600 focus:ring-orange-500/20 transition-all cursor-pointer" 
                            data-slug="${art.slug}" data-city="${art.city || ''}" data-title="${titleAttr}"
                            onchange="window.updateReadAlsoSelectionUI()">
                        
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-black text-slate-800 leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">${art.title}</h4>
                            ${dateHtml}
                        </div>
                        
                        <button type="button" onclick="window.insertReadAlso('${art.slug}', '${art.city || ''}', \`${titleAttr}\`)" 
                            class="bg-orange-50 hover:bg-orange-600 text-orange-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap hidden sm:block">
                            Швидка вставка
                        </button>
                    </li>
                `;
        }).join('');
    }, 500);
};

window.updateReadAlsoSelectionUI = () => {
    const selected = document.querySelectorAll('.read-also-checkbox:checked');
    const btn = document.getElementById('btn-insert-read-also-selected');
    if (btn) {
        if (selected.length > 0) {
            btn.classList.remove('hidden');
            btn.innerText = `Вставити вибрані (${selected.length})`;
        } else {
            btn.classList.add('hidden');
        }
    }
};

window.insertReadAlso = (slug, city, title) => {
    if (!quill) return;

    const url = city && city !== 'null' && city !== 'undefined' && city !== ''
        ? `https://bukva.news/${city}/${slug}/`
        : `https://bukva.news/novyny/${slug}/`;

    const htmlSnippet = `
            <p><br/></p>
            <p><strong><span style="color: rgb(230, 0, 0);">Читайте також:</span></strong></p>
            <ul>
                <li><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></li>
            </ul>
            <p><br/></p>
        `;

    let range = quill.getSelection(true);
    if (range) {
        quill.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet);
        quill.setSelection(range.index + htmlSnippet.length, 0);
    } else {
        const length = quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(length, htmlSnippet);
    }

    window.closeReadAlsoModal();
};

window.insertSelectedReadAlso = () => {
    const selected = document.querySelectorAll('.read-also-checkbox:checked');
    if (selected.length === 0 || !quill) return;

    let listItems = '';
    selected.forEach(cb => {
        const slug = cb.dataset.slug;
        const city = cb.dataset.city;
        const title = cb.dataset.title;
        const url = city && city !== 'null' && city !== 'undefined' && city !== ''
            ? `https://bukva.news/${city}/${slug}/`
            : `https://bukva.news/novyny/${slug}/`;
        listItems += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
    });

    const htmlSnippet = `
            <p><br/></p>
            <p><strong><span style="color: rgb(230, 0, 0);">Читайте також:</span></strong></p>
            <ul>
                ${listItems}
            </ul>
            <p><br/></p>
        `;

    let range = quill.getSelection(true);
    if (range) {
        quill.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet);
        quill.setSelection(range.index + htmlSnippet.length, 0);
    } else {
        const length = quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(length, htmlSnippet);
    }

    window.closeReadAlsoModal();
};

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
window.handleAnalyticsDateFilterChange = () => {
    const filter = document.getElementById('analytics-date-filter').value;
    console.log('Admin: Analytics filter changed to:', filter);
    const container = document.getElementById('analytics-custom-date-container');
    const startInput = document.getElementById('analytics-start-date');
    const endInput = document.getElementById('analytics-end-date');
    const separator = document.getElementById('analytics-range-separator');

    if (!container) return;

    container.classList.add('hidden');
    startInput.classList.add('hidden');
    endInput.classList.add('hidden');
    separator.classList.add('hidden');

    if (filter === 'custom-date') {
        container.classList.remove('hidden');
        startInput.classList.remove('hidden');
    } else if (filter === 'custom-range') {
        container.classList.remove('hidden');
        startInput.classList.remove('hidden');
        endInput.classList.remove('hidden');
        separator.classList.remove('hidden');
    }

    if (!filter.startsWith('custom-')) {
        window.loadAnalytics();
    }
};

// Ensure listeners are attached once DOM is ready
const filterEl = document.getElementById('analytics-date-filter');
if (filterEl) {
    filterEl.addEventListener('change', window.handleAnalyticsDateFilterChange);
}

window.loadAnalytics = async () => {
    if (!_supabase) return;

    const filter = document.getElementById('analytics-date-filter')?.value || 'all';
    const startDateVal = document.getElementById('analytics-start-date')?.value;
    const endDateVal = document.getElementById('analytics-end-date')?.value;

    ['stat-text-users', 'stat-text-time', 'stat-text-per-session',
        'stat-voice-users', 'stat-voice-time', 'stat-voice-per-session'].forEach(id => {
            const el = document.getElementById(id); if (el) el.innerText = '...';
        });
    ['analytics-text-table', 'analytics-voice-table'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Завантаження...</td></tr>';
    });

    try {
        let query = _supabase.from('analytics_events').select('*');
        let periodLabel = "За ввесь час";

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filter === 'today') {
            query = query.gte('created_at', startOfToday.toISOString());
            periodLabel = "Сьогодні";
        } else if (filter === 'yesterday') {
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            query = query.gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString());
            periodLabel = "Вчора";
        } else if (filter === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
            periodLabel = "Останній тиждень";
        } else if (filter === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setDate(monthAgo.getDate() - 30);
            query = query.gte('created_at', monthAgo.toISOString());
            periodLabel = "Останній місяць";
        } else if (filter === 'custom-date' && startDateVal) {
            const d = new Date(startDateVal);
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
            periodLabel = d.toLocaleDateString('uk-UA');
        } else if (filter === 'custom-range' && startDateVal && endDateVal) {
            const start = new Date(startDateVal);
            const end = new Date(endDateVal);
            const endDay = new Date(end);
            endDay.setDate(endDay.getDate() + 1); // include end day
            query = query.gte('created_at', start.toISOString()).lt('created_at', endDay.toISOString());
            periodLabel = `${new Date(startDateVal).toLocaleDateString('uk-UA')} — ${new Date(endDateVal).toLocaleDateString('uk-UA')}`;
        }

        const labelText = document.getElementById('stat-text-period-label');
        const labelVoice = document.getElementById('stat-voice-period-label');
        if (labelText) labelText.innerText = periodLabel;
        if (labelVoice) labelVoice.innerText = periodLabel;

        const { data: events, error } = await query;
        if (error) throw error;

        if (!events || events.length === 0) {
            ['analytics-text-table', 'analytics-voice-table'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Немає даних</td></tr>';
            });
            return;
        }

        const textEvents = events.filter(e => e.event_type === 'text_news_view');
        const voiceEvents = events.filter(e => e.event_type === 'voice_news_listen');

        // ── TEXT METRICS
        const textSessions = new Set(textEvents.map(e => String(e.session_id || ''))).size;
        const el_tu = document.getElementById('stat-text-users');
        const el_tt = document.getElementById('stat-text-time');
        const el_tp = document.getElementById('stat-text-per-session');
        if (el_tu) el_tu.innerText = textSessions;
        if (textEvents.length > 0) {
            const totalT = textEvents.reduce((a, c) => a + (c.duration_seconds || 0), 0);
            if (el_tt) el_tt.innerText = Math.round(totalT / textEvents.length) + ' сек.';
            if (el_tp) el_tp.innerText = (textEvents.length / (textSessions || 1)).toFixed(1);
        } else {
            if (el_tt) el_tt.innerText = '0 сек.';
            if (el_tp) el_tp.innerText = '0';
        }

        // Scroll Depth gauge
        const scrollEl = document.getElementById('stat-text-scroll');
        if (scrollEl && textEvents.length > 0) {
            const avgScroll = Math.round(textEvents.reduce((a, c) => a + (c.scroll_depth || 0), 0) / textEvents.length);
            scrollEl.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-orange-500 rounded-full" style="width:${avgScroll}%"></div>
                        </div>
                        <span class="font-black text-slate-800 text-sm w-12 text-right">${avgScroll}%</span>
                    </div>`;
        }

        // Top Text Articles
        const textStats = {};
        textEvents.forEach(e => {
            if (!e.target_id) return;
            if (!textStats[e.target_id]) textStats[e.target_id] = { views: 0, time: 0, scroll: 0 };
            textStats[e.target_id].views++;
            textStats[e.target_id].time += (e.duration_seconds || 0);
            textStats[e.target_id].scroll += (e.scroll_depth || 0);
        });
        const topText = Object.entries(textStats)
            .map(([id, s]) => ({ id, views: s.views, avgTime: Math.round(s.time / s.views), avgScroll: Math.round(s.scroll / s.views) }))
            .sort((a, b) => b.views - a.views).slice(0, 7);
        await renderAnalyticsTable(topText, 'analytics-text-table', 'text');

        // ── VOICE METRICS
        const voiceSessions = new Set(voiceEvents.map(e => String(e.session_id || ''))).size;
        const el_vu = document.getElementById('stat-voice-users');
        const el_vt = document.getElementById('stat-voice-time');
        const el_vp = document.getElementById('stat-voice-per-session');
        if (el_vu) el_vu.innerText = voiceSessions;
        if (voiceEvents.length > 0) {
            const totalV = voiceEvents.reduce((a, c) => a + (c.duration_seconds || 0), 0);
            if (el_vt) el_vt.innerText = Math.round(totalV / voiceEvents.length) + ' сек.';
            if (el_vp) el_vp.innerText = (voiceEvents.length / (voiceSessions || 1)).toFixed(1);
        } else {
            if (el_vt) el_vt.innerText = '0 сек.';
            if (el_vp) el_vp.innerText = '0';
        }

        // Audio Completion Rate
        const compEl = document.getElementById('stat-voice-completion');
        if (compEl && voiceEvents.length > 0) {
            const withPct = voiceEvents.filter(e => (e.completion_pct || 0) > 0);
            const avgComp = withPct.length > 0 ? Math.round(withPct.reduce((a, c) => a + c.completion_pct, 0) / withPct.length) : 0;
            const finished = voiceEvents.filter(e => (e.completion_pct || 0) >= 95).length;
            const finishedPct = Math.round((finished / voiceEvents.length) * 100);
            compEl.innerHTML = `
                    <div class="flex items-center gap-3 mb-2">
                        <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500 rounded-full" style="width:${avgComp}%"></div>
                        </div>
                        <span class="font-black text-slate-800 text-sm w-12 text-right">${avgComp}%</span>
                    </div>
                    <p class="text-xs text-slate-400"><span class="font-bold text-indigo-600">${finishedPct}%</span> слухачів дослухали до кінця</p>`;
        }

        // Top Voice Articles
        const voiceStats = {};
        voiceEvents.forEach(e => {
            if (!e.target_id) return;
            if (!voiceStats[e.target_id]) voiceStats[e.target_id] = { views: 0, time: 0, comp: 0, compCount: 0 };
            voiceStats[e.target_id].views++;
            voiceStats[e.target_id].time += (e.duration_seconds || 0);
            if ((e.completion_pct || 0) > 0) {
                voiceStats[e.target_id].comp += e.completion_pct;
                voiceStats[e.target_id].compCount++;
            }
        });
        const topVoice = Object.entries(voiceStats)
            .map(([id, s]) => ({ id, views: s.views, avgTime: Math.round(s.time / s.views), avgComp: s.compCount > 0 ? Math.round(s.comp / s.compCount) : 0 }))
            .sort((a, b) => b.views - a.views).slice(0, 7);
        await renderAnalyticsTable(topVoice, 'analytics-voice-table', 'voice');

        // ── TEXT DEVICE & GEO STATS
        renderDeviceStats(textEvents, 'analytics-text-device-chart');
        renderGeoStats(textEvents, 'analytics-text-geo-list');

        // ── VOICE DEVICE & GEO STATS
        renderDeviceStats(voiceEvents, 'analytics-voice-device-chart');
        renderGeoStats(voiceEvents, 'analytics-voice-geo-list');

    } catch (err) {
        console.error('Analytics load error:', err);
    }
};


function renderDeviceStats(events, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const counts = { mobile: 0, desktop: 0, tablet: 0 };
    const sessionMap = {}; // sessionId -> deviceType
    events.forEach(e => {
        const sid = e.session_id ? String(e.session_id) : null;
        const dev = (e.device_type || 'desktop').toLowerCase();
        if (!sid) return;
        if (!sessionMap[sid]) {
            sessionMap[sid] = dev;
            if (counts[dev] !== undefined) counts[dev]++; else counts.desktop++;
        }
    });
    const total = Object.keys(sessionMap).length || 1;
    el.innerHTML = [
        { key: 'mobile', label: '📱 Мобільний', color: 'bg-orange-500' },
        { key: 'desktop', label: '💻 Десктоп', color: 'bg-indigo-500' },
        { key: 'tablet', label: '📙 Планшет', color: 'bg-emerald-500' }
    ].map(({ key, label, color }) => {
        const pct = Math.round((counts[key] / total) * 100);
        return `
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="font-bold text-slate-700">${label}</span>
                        <span class="font-black text-slate-800">${pct}% <span class="text-slate-400 font-normal">(${counts[key]})</span></span>
                    </div>
                    <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${color} rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
    }).join('');
}

function renderGeoStats(events, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const cities = {};
    const sessionMap = {}; // sessionId -> city
    events.forEach(e => {
        const sid = e.session_id ? String(e.session_id) : null;
        const city = (e.geo_city || '').trim();
        if (!sid) return;
        if (city && !sessionMap[sid]) {
            sessionMap[sid] = city;
            cities[city] = (cities[city] || 0) + 1;
        }
    });
    const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) {
        el.innerHTML = '<p class="text-slate-400 text-sm italic">Поки немає гео-даних. Зʼявляться при нових переглядах.</p>';
        return;
    }
    const maxVal = sorted[0][1];
    el.innerHTML = sorted.map(([city, count], i) => {
        const pct = Math.round((count / maxVal) * 100);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="font-bold text-slate-700">${medal} ${city}</span>
                        <span class="font-black text-orange-600">${count}</span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-400 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
    }).join('');
}

window.resetAnalytics = async (articleId, type) => {
    const choice = confirm('Виберіть дію:\n\nOK — Видалити ТІЛЬКИ показники (час, скрол, % дослуховування), але ЛИШИТИ перегляди.\nСкасувати — Видалити ВСЮ статистику (включаючи перегляди).');

    let mode = 'metrics';
    if (!choice) {
        if (confirm('Видалити ВСЮ статистику для цієї статті (включаючи кількість переглядів)?')) {
            mode = 'all';
        } else {
            return;
        }
    }

    try {
        const eventType = type === 'text' ? 'text_news_view' : 'voice_news_listen';

        if (mode === 'all') {
            const { error } = await _supabase
                .from('analytics_events')
                .delete()
                .eq('target_id', articleId.toString())
                .eq('event_type', eventType);
            if (error) throw error;
        } else {
            const { error } = await _supabase
                .from('analytics_events')
                .update({ duration_seconds: 0, scroll_depth: 0, completion_pct: 0 })
                .eq('target_id', articleId.toString())
                .eq('event_type', eventType);
            if (error) throw error;
        }

        alert('✅ Статистику успішно оновлено!');
        window.loadAnalytics();
    } catch (err) {
        console.error('Reset analytics error:', err);
        alert('❌ Помилка при обробці статистики.');
    }
};

async function renderAnalyticsTable(topData, tableId, type) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    if (topData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Немає даних</td></tr>';
        return;
    }
    const ids = topData.map(d => d.id);
    const { data: newsItems } = await _supabase.from('news').select('id, title').in('id', ids);
    const titleMap = {};
    if (newsItems) newsItems.forEach(n => titleMap[n.id] = n.title);
    tbody.innerHTML = topData.map(item => {
        const extraCol = type === 'text'
            ? `<td class="p-4 text-center font-bold text-emerald-600 text-sm">${item.avgScroll}%</td>`
            : `<td class="p-4 text-center font-bold text-indigo-600 text-sm">${item.avgComp}%</td>`;
        return `
                <tr class="border-b hover:bg-slate-50 transition group">
                    <td class="p-4 font-bold text-slate-800 text-xs">
                        <div class="flex items-center justify-between">
                            <span>${titleMap[item.id] || 'Стаття (' + item.id.substring(0, 6) + '...)'}</span>
                            <button onclick="window.resetAnalytics('${item.id}', '${type}')" 
                                class="opacity-0 group-hover:opacity-100 text-[10px] bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded-lg transition-all font-black uppercase tracking-tighter ml-2">
                                Скинути
                            </button>
                        </div>
                    </td>
                    <td class="p-4 text-center text-slate-500 font-mono font-bold text-sm bg-slate-50">${item.views}</td>
                    <td class="p-4 text-center text-orange-600 font-black text-sm">${item.avgTime}с</td>
                    ${extraCol}
                </tr>`;
    }).join('');
}

// --- AI CONFIG ---
window.saveAIConfig = () => {
    const keyInput = document.getElementById('gemini-api-key');
    if (!keyInput) return;
    const key = keyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        alert('✅ API ключ збережено!');
    } else {
        localStorage.removeItem('gemini_api_key');
        alert('🗑️ API ключ видалено.');
    }
};

window.toggleKeyVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
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

        // Load saved Gemini API key into the settings form
        const savedKey = localStorage.getItem('gemini_api_key') || '';
        const keyInput = document.getElementById('gemini-api-key');
        if (keyInput) keyInput.value = savedKey;
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
    const newSlug = document.getElementById('setting-slug').value;
    const payload = {
        name: document.getElementById('setting-name').value,
        slug: newSlug,
        order_index: parseInt(document.getElementById('setting-order').value) || 0
    };
    const table = type === 'category' ? 'categories' : 'cities';

    try {
        // Check for slug change if editing
        let oldSlug = null;
        if (id) {
            const { data: oldData } = await _supabase.from(table).select('slug').eq('id', id).single();
            oldSlug = oldData?.slug;
        }

        let res;
        if (id) res = await _supabase.from(table).update(payload).eq('id', id);
        else res = await _supabase.from(table).insert([payload]);

        if (res.error) throw res.error;

        // If slug changed, offer to update news articles
        if (id && oldSlug && oldSlug !== newSlug) {
            const newsCountRes = await _supabase.from('news').select('*', { count: 'exact', head: true }).eq(type, oldSlug);
            const count = newsCountRes.count || 0;

            if (count > 0 && confirm(`⚠️ Ви змінили посилання (slug) з "${oldSlug}" на "${newSlug}".\nБажаєте оновити усі новини (${count}), що належать до цієї рубрики/міста?`)) {
                await _supabase.from('news').update({ [type]: newSlug }).eq(type, oldSlug);
                alert("✅ Новини оновлено!");
            }
        }

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

// --- MANAGEMENT OF COMMENTS ---
window.allComments = []; // Store comments for filtering

window.loadCommentsAdmin = async () => {
    const tbody = document.getElementById('comments-table-body');
    if (!tbody || !_supabase) return;

    tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">Завантаження коментарів...</td></tr>';

    const { data, error } = await _supabase
        .from('comments')
        .select('*, news(title)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Comments fetch error:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-red-400 italic">Помилка завантаження.</td></tr>';
        return;
    }

    window.allComments = data;
    window.renderCommentsAdmin(data);
};

window.renderCommentsAdmin = (comments) => {
    const tbody = document.getElementById('comments-table-body');
    if (!tbody) return;

    if (comments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">Коментарів не знайдено.</td></tr>';
        return;
    }

    tbody.innerHTML = comments.map(comment => {
        const isReply = !!comment.parent_id;
        return `
            <tr class="border-b hover:bg-slate-50 transition group">
                <td class="p-6">
                    <div class="flex items-center gap-2">
                        ${isReply ? '<span class="text-orange-500 font-black">↳</span>' : ''}
                        <div>
                            <div class="font-black text-slate-900 text-sm uppercase truncate max-w-[150px]">${comment.user_name}</div>
                            <div class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">${new Date(comment.created_at).toLocaleString('uk-UA')}</div>
                        </div>
                    </div>
                </td>
                <td class="p-6">
                    <div class="text-slate-600 text-sm leading-relaxed max-w-md line-clamp-2 ${isReply ? 'italic text-slate-400' : ''}">${comment.content}</div>
                </td>
                <td class="p-6">
                    <div class="text-xs font-bold text-slate-400 truncate max-w-[200px]">${comment.news?.title || 'Видалена стаття'}</div>
                </td>
                <td class="p-6 text-right space-x-2 whitespace-nowrap">
                    <button onclick="window.deleteComment('${comment.id}')" class="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition">Видалити</button>
                </td>
            </tr>
        `;
    }).join('');
};

window.filterCommentsAdmin = () => {
    const query = document.getElementById('comment-search')?.value.toLowerCase() || '';
    const filtered = window.allComments.filter(c =>
        c.user_name.toLowerCase().includes(query) ||
        c.content.toLowerCase().includes(query) ||
        (c.news?.title || '').toLowerCase().includes(query)
    );
    window.renderCommentsAdmin(filtered);
};

window.deleteComment = async (id) => {
    if (!confirm("Видалити цей коментар назавжди?")) return;
    try {
        const { error } = await _supabase.from('comments').delete().eq('id', id);
        if (error) throw error;
        window.loadCommentsAdmin();
    } catch (err) {
        alert("Помилка при видаленні: " + err.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIBERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
let _allSubscribers = [];

window.loadSubscribers = async () => {
    const token = localStorage.getItem('ifnews_admin_token') || '';
    const tbody = document.getElementById('subscribers-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 italic">Завантаження...</td></tr>';

    try {
        const res = await fetch('/api/subscribe?token=' + encodeURIComponent(token));
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || 'Помилка');

        _allSubscribers = data;
        renderSubscribersTable(data);
        updateSubStats(data);
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-400 italic">Помилка: ${e.message}</td></tr>`;
    }
};

function updateSubStats(data) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now - 7 * 86400000).toISOString();

    document.getElementById('sub-count-total').textContent = data.length;
    document.getElementById('sub-count-today').textContent = data.filter(s => (s.subscribed_at || '').startsWith(todayStr)).length;
    document.getElementById('sub-count-week').textContent = data.filter(s => s.subscribed_at >= weekAgo).length;
}

function renderSubscribersTable(data) {
    const tbody = document.getElementById('subscribers-table-body');
    if (!tbody) return;

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 italic">Підписників ще немає</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(s => {
        const date = s.subscribed_at ? new Date(s.subscribed_at).toLocaleString('uk-UA') : '—';
        const status = s.status === 'active'
            ? '<span class="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-lg uppercase">Активний</span>'
            : '<span class="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-lg uppercase">Неактивний</span>';

        const src = (s.source || 'website').replace(/^https?:\/\/[^/]+/, '').replace('/', '') || 'Сайт';

        return `<tr class="hover:bg-slate-50 transition-colors">
                <td class="p-6 font-bold text-slate-800 text-sm">${s.email}</td>
                <td class="p-6 text-center text-slate-400 text-xs">${src}</td>
                <td class="p-6 text-center">${status}</td>
                <td class="p-6 text-slate-500 text-xs">${date}</td>
                <td class="p-6 text-right">
                    <button onclick="window.deleteSubscriber('${s.id}')"
                        class="text-[10px] font-black text-red-400 hover:text-white hover:bg-red-500 px-4 py-2 rounded-xl transition-all">
                        Видалити
                    </button>
                </td>
            </tr>`;
    }).join('');
}

window.filterSubscribers = () => {
    const q = (document.getElementById('subscriber-search')?.value || '').toLowerCase();
    const filtered = _allSubscribers.filter(s => (s.email || '').toLowerCase().includes(q));
    renderSubscribersTable(filtered);
};

window.deleteSubscriber = async (id) => {
    if (!confirm("Видалити підписника?")) return;
    const token = localStorage.getItem('ifnews_admin_token') || '';
    await fetch(`/api/subscribe?id=${id}&token=${encodeURIComponent(token)}`, { method: 'DELETE' });
    window.loadSubscribers();
};

window.exportSubscribersCSV = () => {
    if (!_allSubscribers.length) { alert('Підписників немає'); return; }
    const csv = ['Email,Дата підписки,Статус,Джерело',
        ..._allSubscribers.map(s =>
            `"${s.email}","${s.subscribed_at || ''}","${s.status || ''}","${s.source || ''}"`
        )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
};



setTimeout(() => { if (_supabase) window.loadSettings(); }, 1000);
window.loadStats();