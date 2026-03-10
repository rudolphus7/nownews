/**
 * Reusable Site Header Component
 * Handles Ticker, Navigation, City Filters, and Mobile Menu
 * All categories and cities are loaded dynamically from Supabase.
 */

// These will be populated from Supabase — no hardcoded values
const CATEGORIES_UK = {};
const CITIES_UK = {};
const CATEGORY_EN_TO_UK_SLUG = {};

// Expose globally for any other scripts that reference them
window.CATEGORIES_UK = CATEGORIES_UK;
window.CITIES_UK = CITIES_UK;
window.CATEGORY_EN_TO_UK_SLUG = CATEGORY_EN_TO_UK_SLUG;

class SiteHeader {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        // Start empty — populated from Supabase in loadDynamicData()
        this.categories = {}; // slug → name
        this.cities = {};     // slug → name

        // Category slug mappings (same slug used for both DB and URL)
        this.catUkToEn = {};
        this.catEnToUk = {};

        this.currentFilters = this._parseFiltersFromUrl();

        this.isLocal = window.location.hostname === 'localhost' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('127.0.0.1') ||
            window.location.port !== '';

        window.addEventListener('popstate', () => this.syncFilters());
    }

    _parseFiltersFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const pathParts = window.location.pathname.replace(/^\/|\/$/g, '').split('/');

            // Check if first path segment is a known city slug
            let cityFromPath = pathParts[0] && this.cities[pathParts[0]] ? pathParts[0] : null;

            // Check SSR-injected city (from api/city.js)
            if (!cityFromPath && window.__SSR_CITY__) {
                cityFromPath = window.__SSR_CITY__;
            }

            let categoryFromPath = null;
            if (pathParts[0] === 'category' && pathParts[1]) {
                categoryFromPath = this.catUkToEn[pathParts[1]] || pathParts[1];
            }

            // Check SSR-injected category (from api/category.js)
            if (!categoryFromPath && window.__SSR_CATEGORY_SLUG__) {
                categoryFromPath = window.__SSR_CATEGORY_SLUG__;
            }

            return {
                category: categoryFromPath || params.get('category'),
                city: cityFromPath || params.get('city')
            };
        } catch (e) {
            console.error("Filter parsing failed:", e);
            return { category: null, city: null };
        }
    }

    getNewsLink(post) {
        const slug = post.slug || '';
        const id = post.id || '';
        if (!slug) return `/news/?id=${id}`;

        // Hierarchical URLs: /city/slug/ or /category/cat/slug/
        if (post.city && (this.cities[post.city] || CITIES_FALLBACK[post.city])) {
            return `/novyny/${post.city}/${slug}/`;
        }

        const catSlug = post.category ? (this.catEnToUk[post.category] || post.category) : null;
        if (catSlug) {
            return `/category/${catSlug}/${slug}/`;
        }

        return `/${slug}/`;
    }

    syncFilters() {
        this.currentFilters = this._parseFiltersFromUrl();
        this.updateActiveHighlights();
    }

    async init() {
        try {
            this.renderPlaceholder();
            this.setupEventListeners();

            // Hydration: Check if data is already provided by SSR
            if (window.__SSR_CATEGORIES__ && window.__SSR_CITIES__) {
                console.log("Using SSR data for header hydration");
                this._handleDynamicData(window.__SSR_CATEGORIES__, window.__SSR_CITIES__);

                if (window.__SSR_TICKER__) {
                    this._renderTicker(window.__SSR_TICKER__);
                } else {
                    this.loadTickerData();
                }
            } else {
                await this.loadDynamicData();
                this.loadTickerData();
            }

            // Re-parse filters after we have dynamic maps
            this.currentFilters = this._parseFiltersFromUrl();
            this.updateActiveHighlights();
        } catch (e) {
            console.error("Header init failed:", e);
        }
    }

    _safeStorageSet(type, key, val) {
        try {
            const storage = type === 'local' ? window.localStorage : window.sessionStorage;
            if (storage) storage.setItem(key, val);
        } catch (e) { console.warn(`Storage ${type} blocked:`, key); }
    }

    _safeStorageGet(type, key) {
        try {
            const storage = type === 'local' ? window.localStorage : window.sessionStorage;
            return storage ? storage.getItem(key) : null;
        } catch (e) { return null; }
    }

    renderPlaceholder() {
        const headerPlaceholder = document.getElementById('site-header-placeholder');
        if (!headerPlaceholder) return;

        // If it's already pre-rendered by SSR, don't overwrite it to avoid flickering
        // We check if it has any substantial content (more than just whitespace)
        if (headerPlaceholder.innerHTML.trim().length > 0) {
            console.log("Header already pre-rendered, skipping placeholder injection.");
            return;
        }

        headerPlaceholder.innerHTML = `
            <!-- Ticker -->
            <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5">
                <div class="container mx-auto px-4 flex items-center">
                    <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                    <div class="flex-1 overflow-hidden relative ticker-mask">
                        <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                            Завантаження новин... BUKVA NEWS • Перевірені факти • Актуальні події •
                        </div>
                    </div>
                </div>
            </div>

            <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
                <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                    <a href="/" class="flex items-center space-x-3 group">
                        <div class="relative shrink-0">
                            <img src="/logo.png" alt="BUKVA NEWS" class="w-12 h-12 rounded-2xl shadow-2xl shadow-orange-200/60 group-hover:rotate-3 transition-transform duration-500 object-cover">
                            <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div class="leading-none text-left">
                            <span class="text-3xl font-black uppercase tracking-tighter text-slate-900 block mt-1">BUKVA <span class="text-orange-600">NEWS</span></span>
                            <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Незалежна Журналістика</span>
                        </div>
                    </a>
                    
                    <nav id="desktop-nav" class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                        <!-- Categories injected here -->
                    </nav>

                    <button id="mobile-menu-toggle" class="md:hidden flex flex-col gap-1.5 p-2">
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                        <span class="w-6 h-0.5 bg-slate-900 rounded-full transition-all duration-300"></span>
                    </button>
                </div>

                <!-- City Filter Row -->
                <div class="bg-white border-t border-slate-100 overflow-x-auto no-scrollbar shadow-sm">
                    <div class="container mx-auto px-4 py-4 flex items-center space-x-8 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">
                        <span class="text-slate-900 border-r border-slate-200 pr-6 mr-2 flex items-center">
                            <span class="w-1.5 h-4 bg-orange-600 mr-3 rounded-full"></span>
                            ВАШЕ МІСТО
                        </span>
                        <div class="flex items-center gap-6" id="city-nav-list">
                            <!-- Cities injected here -->
                        </div>
                    </div>
                </div>
            </header>

            <!-- Mobile Menu Overlay -->
            <div id="mobile-menu-overlay" class="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl translate-x-full transition-transform duration-500 md:hidden overflow-y-auto">
                <div class="p-8">
                    <div class="flex justify-between items-center mb-12">
                        <a href="/" class="flex items-center space-x-3 group">
                            <div class="relative shrink-0">
                                <img src="/logo.png" alt="BUKVA NEWS" class="w-10 h-10 rounded-xl object-cover shadow-md">
                                <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-500 border border-white rounded-full"></div>
                            </div>
                            <div class="leading-none text-left">
                                <span class="text-xl font-black uppercase tracking-tighter text-slate-900 block">BUKVA <span class="text-orange-600">NEWS</span></span>
                            </div>
                        </a>
                        <button id="close-mobile-menu" class="p-4 -mr-4 text-slate-400 hover:text-orange-600 font-black text-4xl transition-colors">&times;</button>
                    </div>

                    <div class="space-y-8">
                        <div>
                            <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">РУБРИКИ</h3>
                            <div id="mobile-nav-list" class="flex flex-col gap-5 text-lg font-black uppercase text-slate-800 tracking-tight"></div>
                        </div>
                        <div>
                            <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">МІСТА</h3>
                            <div id="mobile-city-list" class="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadDynamicData() {
        try {
            const [catRes, cityRes] = await Promise.all([
                this.supabase.from('categories').select('*').order('order_index', { ascending: true }),
                this.supabase.from('cities').select('*').order('order_index', { ascending: true })
            ]);
            this._handleDynamicData(catRes.data, cityRes.data);
        } catch (err) {
            console.error('Header dynamic data load failed:', err);
        }
    }

    _handleDynamicData(categoriesData, citiesData) {
        if (categoriesData && categoriesData.length > 0) {
            this.categories = {};
            this.catUkToEn = {};
            this.catEnToUk = {};

            categoriesData.forEach(c => {
                this.categories[c.slug] = c.name;
                this.catUkToEn[c.slug] = c.slug;
                this.catEnToUk[c.slug] = c.slug;
                CATEGORIES_UK[c.slug] = c.name;
                CATEGORY_EN_TO_UK_SLUG[c.slug] = c.slug;
            });
            this.renderNav(categoriesData);
        }

        if (citiesData && citiesData.length > 0) {
            this.cities = {};
            citiesData.forEach(c => {
                this.cities[c.slug] = c.name;
                CITIES_UK[c.slug] = c.name;
            });
            this.renderCities(citiesData);
        }
    }

    renderNav(categories) {
        const nav = document.getElementById('desktop-nav');
        const mobileNav = document.getElementById('mobile-nav-list');

        // Check if already rendered by SSR
        if (nav && nav.children.length > 0) {
            console.log("Nav already rendered by SSR, skipping re-render");
            return;
        }

        const liveHtml = `
            <div class="flex items-center ml-4">
                <a href="/live/" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
                    <span class="flex h-2.5 w-2.5 relative">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span class="font-black tracking-tighter text-[11px]">LIVE • ЕФІР</span>
                </a>
            </div>`;

        const html = categories.map(c => {
            return `<a href="/category/${c.slug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm" data-category="${c.slug}">${c.name}</a>`;
        }).join('');

        if (nav) nav.innerHTML = html + liveHtml;
        if (mobileNav) mobileNav.innerHTML = categories.map(c => {
            return `<a href="/category/${c.slug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${c.name}</a>`;
        }).join('') + `<a href="/live/" class="pt-4 text-orange-600 font-black flex items-center gap-2"><span class="flex h-2 w-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>LIVE • ЕФІР</a>`;
    }

    renderCities(cities) {
        const cityContainer = document.getElementById('city-nav-list');
        const mobileCities = document.getElementById('mobile-city-list');

        // Check if already rendered by SSR
        if (cityContainer && cityContainer.children.length > 0) {
            console.log("Cities already rendered by SSR, skipping re-render");
            return;
        }

        // Cities now use path-based URLs: /:city/
        const html = cities.map(c => `
            <a href="/novyny/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1" data-city="${c.slug}">${c.name}</a>
        `).join('');

        if (cityContainer) cityContainer.innerHTML = html;
        if (mobileCities) {
            mobileCities.innerHTML = `
                <a href="/" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">ВСЯ ОБЛАСТЬ</a>
                ${cities.map(c => `<a href="/novyny/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">${c.name}</a>`).join('')}
            `;
        }
    }

    openMenu() {
        const overlay = document.getElementById('mobile-menu-overlay');
        if (overlay) {
            overlay.classList.remove('translate-x-full');
            document.body.style.overflow = 'hidden';
        }
    }

    closeMenu() {
        const overlay = document.getElementById('mobile-menu-overlay');
        if (overlay) {
            overlay.classList.add('translate-x-full');
            document.body.style.overflow = '';
        }
    }

    setupEventListeners() {
        const burgerBtn = document.getElementById('mobile-menu-toggle');
        const closeBtn = document.getElementById('close-mobile-menu');
        const overlay = document.getElementById('mobile-menu-overlay');

        if (burgerBtn) {
            burgerBtn.onclick = () => this.openMenu();
        }

        if (closeBtn) {
            closeBtn.onclick = () => this.closeMenu();
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target.closest('a')) {
                    overlay.classList.add('translate-x-full');
                    document.body.style.overflow = '';
                }
            });
        }

        // Fast Navigation (SPA-like for index)
        document.querySelectorAll('#site-header-placeholder a').forEach(link => {
            link.onclick = async (e) => {
                const url = new URL(link.href, window.location.origin);
                const isIndexPath = url.pathname === '/' || url.pathname === '/index.html';
                const isCurrentIndexPath = window.location.pathname === '/' || window.location.pathname === '/index.html';

                // Check if this is a city path link using dynamically loaded cities
                const cityMatch = url.pathname.match(/^\/([a-z0-9-]+)\/?$/);
                const citySlug = cityMatch && this.cities[cityMatch[1]] ? cityMatch[1] : null;
                const isCityPath = !!citySlug;

                if (isCityPath && isCurrentIndexPath) {
                    // City navigation via path — let Vercel handle SSR rewrite
                    return;
                } else if (isIndexPath && isCurrentIndexPath) {
                    e.preventDefault();
                    const params = new URLSearchParams(url.search);
                    this.currentFilters = {
                        category: params.get('category'),
                        city: null
                    };
                    window.history.pushState(this.currentFilters, '', link.href);
                    this.updateActiveHighlights();

                    // Dispatch custom event for index page to reload news
                    window.dispatchEvent(new CustomEvent('news-filter-changed', { detail: this.currentFilters }));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (this.isLocal && url.pathname.startsWith('/news/')) {
                    // Localhost 404 Fix
                    const slug = url.pathname.replace(/^\/news\//, '').replace(/\/$/, '');
                    if (slug) {
                        e.preventDefault();
                        window.location.href = `/news.html?slug=${slug}`;
                    }
                }
            };
        });
    }

    updateActiveHighlights() {
        document.querySelectorAll('.nav-link, .city-link').forEach(el => {
            el.classList.remove('text-orange-600', 'border-orange-600', 'font-black', 'text-slate-900');
        });

        if (this.currentFilters.category) {
            // Match by data-category attribute (EN slug)
            document.querySelectorAll(`.nav-link[data-category="${this.currentFilters.category}"]`).forEach(el => {
                el.classList.add('text-orange-600', 'border-orange-600');
            });
        }
        if (this.currentFilters.city) {
            // Match by data-city attribute (path-based URLs)
            document.querySelectorAll(`.city-link[data-city="${this.currentFilters.city}"]`).forEach(el => {
                el.classList.add('text-orange-600', 'font-black', 'text-slate-900');
            });
        }
    }

    async loadTickerData() {
        try {
            const { data } = await this.supabase.from('news')
                .select('id, title, slug')
                .eq('is_published', true)
                .order('created_at', { ascending: false })
                .limit(5);

            if (data && data.length > 0) {
                this._renderTicker(data);
            }
        } catch (err) {
            console.warn("Ticker load failed:", err);
        }
    }

    _renderTicker(data) {
        const tickerItems = data.map(n => {
            const link = this.getNewsLink(n);
            return `<a href="${link}" class="hover:text-orange-500 transition-colors mx-4">${n.title}</a>`;
        });
        const separator = `<span class="text-orange-600 font-bold px-2 mx-2">/</span>`;
        const tickerElem = document.getElementById('news-ticker');
        if (tickerElem) {
            // Check if already rendered by SSR - if it contains links, it's already there
            if (tickerElem.innerHTML.includes('<a')) {
                console.log("Ticker already rendered by SSR, skipping re-render");
                return;
            }
            tickerElem.innerHTML = tickerItems.join(separator);
        }
    }
}

// Global initialization — returns a Promise that resolves after dynamic data is loaded
window.initSiteHeader = async (supabaseClient) => {
    const header = new SiteHeader(supabaseClient);
    await header.init();
    return header;
};
