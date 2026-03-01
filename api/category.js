const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

async function fetchFromSupabase(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
    return res.json();
}

module.exports = async (req, res) => {
    let slug = req.query.slug;
    if (Array.isArray(slug)) slug = slug[0];

    if (!slug) {
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    let categories = [];
    let cities = [];

    try {
        [categories, cities] = await Promise.all([
            fetchFromSupabase('categories', 'select=*&order=order_index.asc'),
            fetchFromSupabase('cities', 'select=*&order=order_index.asc')
        ]);
    } catch (e) {
        console.error('Supabase fetch error:', e.message);
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    // Find category by slug
    const category = categories.find(c => c.slug === slug);
    if (!category) {
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    const categoryName = category.name;
    const canonicalUrl = `${SITE_URL}/category/${slug}/`;
    const title = `${categoryName} — новини Прикарпаття | IF News`;
    const description = `Новини рубрики «${categoryName}»: всі головні події Івано-Франківщини та Прикарпаття. Читайте оперативно на IF News.`;
    const siteName = 'Прикарпаття News | IF News';

    // Read index.html template
    let htmlContent = '';
    try {
        const possiblePaths = [
            path.join(process.cwd(), 'index.html'),
            path.join(__dirname, '..', 'index.html')
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                htmlContent = fs.readFileSync(p, 'utf8');
                break;
            }
        }
        if (!htmlContent) throw new Error('index.html not found');
    } catch (e) {
        return res.status(500).send('Configuration error');
    }

    const metaTags = `
    <!-- Category Page SEO -->
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="uk-UA" href="${escapeAttr(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@ifnews_pro">
    <meta name="twitter:creator" content="@ifnews_pro">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">

    <!-- Schema.org: BreadcrumbList -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "\u0413\u043e\u043b\u043e\u0432\u043d\u0430",
                "item": "${SITE_URL}/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "${escapeJson(categoryName)}",
                "item": "${escapeJson(canonicalUrl)}"
            }
        ]
    }
    <\/script>

    <style>
        #hero-container { display: none !important; }
        #section-header { display: block !important; }
        #homepage-h1 { display: none !important; }
    </style>
    <!-- End Category SEO -->`;

    // SSR data: passes slug and name so client JS can filter news
    const ssrScript = `<script>
    window.__SSR_CATEGORY_SLUG__ = '${escapeAttr(slug)}';
    window.__SSR_CATEGORY_NAME__ = '${escapeAttr(categoryName)}';
<\/script>`;

    // Build SSR nav from DB data
    const navLinksHtml = categories.map(c =>
        `<a href="/category/${c.slug}/" class="nav-link hover:text-orange-600 transition-colors py-2 border-b-2 border-transparent font-black tracking-tight text-sm${c.slug === slug ? ' text-orange-600 border-orange-600' : ''}" data-category="${c.slug}">${escapeHtml(c.name)}</a>`
    ).join('');

    const mobileCatHtml = categories.map(c =>
        `<a href="/category/${c.slug}/" data-category="${c.slug}" class="py-2 active:text-orange-600 font-bold">${escapeHtml(c.name)}</a>`
    ).join('');

    const cityLinksHtml = cities.map(c =>
        `<a href="/${c.slug}/" class="city-link hover:text-orange-600 transition-colors py-1" data-city="${c.slug}">${escapeHtml(c.name)}</a>`
    ).join('');

    const mobileCityHtml = `<a href="/" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">ВСЯ ОБЛАСТЬ</a>` +
        cities.map(c =>
            `<a href="/${c.slug}/" data-city="${c.slug}" class="bg-slate-50 p-4 rounded-2xl flex items-center justify-center text-center hover:bg-orange-50 hover:text-orange-600 transition h-full font-black text-xs uppercase leading-tight">${escapeHtml(c.name)}</a>`
        ).join('');

    const headerHtml = `
        <!-- Ticker -->
        <div class="bg-slate-900 py-2 overflow-hidden border-b border-white/5">
            <div class="container mx-auto px-4 flex items-center">
                <span class="bg-orange-600 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded mr-4 z-10 shadow-lg">Терміново</span>
                <div class="flex-1 overflow-hidden relative ticker-mask">
                    <div id="news-ticker" class="ticker-animate text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                        ОСТАННІ НОВИНИ ПРИКАРПАТТЯ • ПЕРЕВІРЕНІ ФАКТИ • АКТУАЛЬНІ ПОДІЇ • ОПЕРАТИВНО ТА ЧЕСНО •
                    </div>
                </div>
            </div>
        </div>

        <header class="bg-white/95 backdrop-blur-xl sticky top-0 z-[100] border-b border-slate-100">
            <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" class="flex items-center space-x-4 group">
                    <div class="relative">
                        <span class="bg-orange-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black text-2xl italic tracking-tighter shadow-2xl shadow-orange-200">IF</span>
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 border-2 border-white rounded-full"></div>
                    </div>
                    <div class="leading-none text-left">
                        <span class="text-2xl font-black uppercase tracking-tighter text-slate-900 block mt-1">Прикарпаття <span class="text-orange-600">News</span></span>
                        <span class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-80">Незалежна Журналістика</span>
                    </div>
                </a>

                <nav id="desktop-nav" class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                    ${navLinksHtml}
                    <div class="flex items-center ml-4">
                        <a href="/live/" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
                            <span class="flex h-2.5 w-2.5 relative">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                            </span>
                            <span class="font-black tracking-tighter text-[11px]">LIVE • ЕФІР</span>
                        </a>
                    </div>
                </nav>

                <button id="mobile-menu-toggle" class="md:hidden flex flex-col gap-1.5 p-2">
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
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
                        ${cityLinksHtml}
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
                        <div id="mobile-nav-list" class="flex flex-col gap-5 text-lg font-black uppercase text-slate-800 tracking-tight">
                            ${mobileCatHtml}
                            <div class="pt-4 text-orange-600 font-black">LIVE • РЕПОРТАЖІ</div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">МІСТА</h3>
                        <div id="mobile-city-list" class="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                            ${mobileCityHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // SSR Utility
    const inject = (html, id, value) => {
        const regex = new RegExp(`(id="${id}"[^>]*>)`, 'g');
        return html.replace(regex, `$1${value || ''}`);
    };

    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
    htmlContent = htmlContent.replace(/<meta name="description"[^>]*>/gi, '');
    htmlContent = htmlContent.replace(/<link rel="canonical"[^>]*>/gi, '');
    htmlContent = inject(htmlContent, 'site-header-placeholder', headerHtml);
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>\n${metaTags}\n${ssrScript}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).send(htmlContent);
};

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeJson(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
