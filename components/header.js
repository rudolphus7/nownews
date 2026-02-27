/**
 * Reusable Site Header Component
 * Handles Ticker, Navigation, City Filters, and Mobile Menu
 */

// EN slug (DB) → UA display name (will be initialized below)
let CATEGORIES_FALLBACK;

// EN slug (DB) → UA URL slug
const CATEGORY_EN_TO_UK_SLUG = {
    'war': 'viyna',
    'politics': 'polityka',
    'economy': 'ekonomika',
    'sport': 'sport',
    'culture': 'kultura',
    'tech': 'tekhnolohii',
    'frankivsk': 'frankivsk',
    'oblast': 'oblast'
};

// UA URL slug → EN slug (DB) — for parsing pathname
const CATEGORY_UK_SLUG_TO_EN = {
    'viyna': 'war',
    'polityka': 'politics',
    'ekonomika': 'economy',
    'sport': 'sport',
    'kultura': 'culture',
    'tekhnolohii': 'tech',
    'frankivsk': 'frankivsk',
    'oblast': 'oblast'
};

const CITIES_UK = {
    'kalush': 'Калуш', 'if': 'Івано-Франківськ', 'kolomyya': 'Коломия',
    'dolyna': 'Долина', 'bolekhiv': 'Болехів', 'nadvirna': 'Надвірна',
    'burshtyn': 'Бурштин', 'kosiv': 'Косів', 'yaremche': 'Яремче'
};

const CATEGORIES_UK = {
    'politics': 'Політика', 'economy': 'Економіка', 'sport': 'Спорт',
    'culture': 'Культура', 'tech': 'Технології', 'frankivsk': 'Франківськ',
    'oblast': 'Область', 'war': 'Війна'
};

const CITIES_FALLBACK = CITIES_UK;
CATEGORIES_FALLBACK = CATEGORIES_UK;

class SiteHeader {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.categories = { ...CATEGORIES_FALLBACK };
        this.cities = { ...CITIES_FALLBACK };
        this.currentFilters = this._parseFiltersFromUrl();

        this.isLocal = window.location.hostname === 'localhost' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('127.0.0.1') ||
            window.location.port !== '';

        window.addEventListener('popstate', () => this.syncFilters());
    }

    _parseFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        // City: /kolomyya/ → city='kolomyya'
        const pathParts = window.location.pathname.replace(/^\/|\/$/g, '').split('/');

        // Priority: /category/cat/ or /city/ or ?query
        let cityFromPath = pathParts[0] && CITIES_FALLBACK[pathParts[0]] ? pathParts[0] : null;

        let categoryFromPath = null;
        if (pathParts[0] === 'category' && pathParts[1]) {
            categoryFromPath = CATEGORY_UK_SLUG_TO_EN[pathParts[1]] || null;
        }

        return {
            category: categoryFromPath || params.get('category'),
            city: cityFromPath || params.get('city')
        };
    }

    getNewsLink(post) {
        const slug = post.slug || '';
        const id = post.id || '';
        if (!slug) return `/news/?id=${id}`;

        // Hierarchical URLs: /city/slug/ or /category/cat/slug/
        if (post.city && CITIES_UK[post.city]) {
            return `/${post.city}/${slug}/`;
        }
        if (post.category && CATEGORY_EN_TO_UK_SLUG[post.category]) {
            return `/category/${CATEGORY_EN_TO_UK_SLUG[post.category]}/${slug}/`;
        }

        return `/news/${slug}/`;
    }

    syncFilters() {
        this.currentFilters = this._parseFiltersFromUrl();
        this.updateActiveHighlights();
    }

    async init() {
        this.renderPlaceholder();
        await this.loadDynamicData();
        this.setupEventListeners();
        this.updateActiveHighlights();
        this.loadTickerData();
    }

    renderPlaceholder() {
        const headerPlaceholder = document.getElementById('site-header-placeholder');
        if (!headerPlaceholder) return;

        headerPlaceholder.innerHTML = `
            <!-- Ticker -->
            <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5">
                <div class="container mx-auto px-4 flex items-center">
                    <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                    <div class="flex-1 overflow-hidden relative ticker-mask">
                        <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                            Завантаження останніх новин Прикарпаття... • Перевірені факти • Актуальні події •
                        </div>
                    </div>
                </div>
            </div>

            <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
                <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                    <a href="/" class="flex items-center space-x-4 group">
                        <div class="relative">
                            <span class="bg-orange-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black text-2xl italic tracking-tighter shadow-2xl shadow-orange-200 group-hover:rotate-6 transition-transform duration-500">IF</span>
                            <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 border-2 border-white rounded-full"></div>
                        </div>
                        <div class="leading-none text-left">
                            <span class="text-2xl font-black uppercase tracking-tighter text-slate-900 block mt-1">Прикарпаття <span class="text-orange-600">News</span></span>
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
                        <a href="/" class="flex items-center space-x-4 group">
                            <div class="relative">
                                <span class="bg-orange-600 text-white w-10 h-10 flex items-center justify-center rounded-xl font-black text-xl italic tracking-tighter">IF</span>
                                <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-900 border border-white rounded-full"></div>
                            </div>
                            <div class="leading-none text-left">
                                <span class="text-xl font-black uppercase tracking-tighter text-slate-900 block">Прикарпаття <span class="text-orange-600">News</span></span>
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

            if (catRes.data?.length > 0) {
                this.categories = {};
                catRes.data.forEach(c => this.categories[c.slug] = c.name);
                this.renderNav(catRes.data);
            } else {
                this.renderNav(Object.keys(CATEGORIES_FALLBACK).map(k => ({ slug: k, name: CATEGORIES_FALLBACK[k] })));
            }

            if (cityRes.data?.length > 0) {
                this.cities = {};
                cityRes.data.forEach(c => this.cities[c.slug] = c.name);
                this.renderCities(cityRes.data);
            } else {
                this.renderCities(Object.keys(CITIES_FALLBACK).map(k => ({ slug: k, name: CITIES_FALLBACK[k] })));
            }
        } catch (err) {
            console.warn("Header dynamic data load failed:", err);
            this.renderNav(Object.keys(CATEGORIES_FALLBACK).map(k => ({ slug: k, name: CATEGORIES_FALLBACK[k] })));
            this.renderCities(Object.keys(CITIES_FALLBACK).map(k => ({ slug: k, name: CITIES_FALLBACK[k] })));
        }
    }

    renderNav(categories) {
        const nav = document.getElementById('desktop-nav');
        const mobileNav = document.getElementById('mobile-nav-list');

        const liveHtml = `
            <div class="flex items-center ml-4">
                <a href="#" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
                    <span class="flex h-2.5 w-2.5 relative">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span class="font-black tracking-tighter text-[11px]">LIVE • ЕФІР</span>
                </a>
            </div>`;

        // Categories use Ukrainian path-based URLs: /category/viyna/
        const html = categories.map(c => {
            const ukSlug = CATEGORY_EN_TO_UK_SLUG[c.slug] || c.slug;
            return `<a href="/category/${ukSlug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm" data-category="${c.slug}">${c.name}</a>`;
        }).join('');

        if (nav) nav.innerHTML = html + liveHtml;
        if (mobileNav) mobileNav.innerHTML = categories.map(c => {
            const ukSlug = CATEGORY_EN_TO_UK_SLUG[c.slug] || c.slug;
            return `<a href="/category/${ukSlug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${c.name}</a>`;
        }).join('') + `<div class="pt-4 text-orange-600 font-black">LIVE • РЕПОРТАЖІ</div>`;
    }

    renderCities(cities) {
        const cityContainer = document.getElementById('city-nav-list');
        const mobileCities = document.getElementById('mobile-city-list');

        // Cities now use path-based URLs: /:city/
        const html = cities.map(c => `
            <a href="/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1" data-city="${c.slug}">${c.name}</a>
        `).join('');

        if (cityContainer) cityContainer.innerHTML = html;
        if (mobileCities) {
            mobileCities.innerHTML = `
                <a href="/" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">ВСЯ ОБЛАСТЬ</a>
                ${cities.map(c => `<a href="/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">${c.name}</a>`).join('')}
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
                const isIndexPath = url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('index.html');
                const isCurrentIndexPath = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

                // Check if this is a city path link (e.g. /kolomyya/)
                const cityMatch = url.pathname.match(/^\/([a-z]+)\/?$/);
                const citySlug = cityMatch && CITIES_FALLBACK[cityMatch[1]] ? cityMatch[1] : null;
                const isCityPath = !!citySlug;

                if (isCityPath && isCurrentIndexPath) {
                    // City navigation via path — do a full navigation to let Vercel rewrite work
                    // (city page SSR is needed so let Vercel handle it)
                    return; // Allow normal link navigation
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
                const tickerItems = data.map(n => {
                    const link = this.getNewsLink(n);
                    return `<a href="${link}" class="hover:text-orange-500 transition-colors mx-4">${n.title}</a>`;
                });
                const separator = `<span class="text-orange-600 font-bold px-2 mx-2">/</span>`;
                const tickerElem = document.getElementById('news-ticker');
                if (tickerElem) tickerElem.innerHTML = tickerItems.join(separator);
            }
        } catch (err) {
            console.warn("Ticker load failed:", err);
        }
    }
}

// Global initialization
window.initSiteHeader = (supabaseClient) => {
    const siteHeader = new SiteHeader(supabaseClient);
    siteHeader.init();
    return siteHeader;
};
