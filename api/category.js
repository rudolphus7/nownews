const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

/**
 * Bidirectional category mapping:
 * - UK_SLUG_TO_EN: /category/viyna/ → 'war' (for DB queries)
 * - EN_TO_UK_SLUG: 'war' → 'viyna' (for generating URLs)
 * - UK_SLUG_TO_NAME: 'viyna' → 'Війна' (for display)
 */
const UK_SLUG_TO_EN = {
    'viyna': 'war',
    'polityka': 'politics',
    'ekonomika': 'economy',
    'sport': 'sport',
    'kultura': 'culture',
    'tekhnolohii': 'tech',
    'frankivsk': 'frankivsk',
    'oblast': 'oblast'
};

const UK_SLUG_TO_NAME = {
    'viyna': 'Війна',
    'polityka': 'Політика',
    'ekonomika': 'Економіка',
    'sport': 'Спорт',
    'kultura': 'Культура',
    'tekhnolohii': 'Технології',
    'frankivsk': 'Франківськ',
    'oblast': 'Область'
};

module.exports = async (req, res) => {
    // Vercel rewrite: /category/viyna/ → /api/category?slug=viyna
    let slug = req.query.slug;
    if (Array.isArray(slug)) slug = slug[0];

    if (!slug || !UK_SLUG_TO_NAME[slug]) {
        // Unknown category slug — fallback to homepage
        res.setHeader('Location', '/');
        return res.status(302).end();
    }

    const categoryName = UK_SLUG_TO_NAME[slug];
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
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(siteName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:locale" content="uk_UA">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
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

    // SSR data: passes the EN slug so index.html JS can filter news by DB category
    const ssrScript = `<script>
    window.__SSR_CATEGORY_SLUG__ = '${slug}';
    window.__SSR_CATEGORY_EN__ = '${UK_SLUG_TO_EN[slug]}';
<\/script>`;

    const CAT_DISPLAY = {
        'politics': 'Політика', 'economy': 'Економіка', 'sport': 'Спорт',
        'culture': 'Культура', 'tech': 'Технології', 'frankivsk': 'Франківськ',
        'oblast': 'Область', 'war': 'Війна'
    };
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

    // SSR Utility
    const inject = (html, id, value) => {
        const regex = new RegExp(`(id="${id}"[^>]*>)`, 'g');
        return html.replace(regex, `$1${value || ''}`);
    };

    // SSR Header Injection
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
                    ${Object.keys(CATEGORY_EN_TO_UK_SLUG).map(key => `
                        <a href="/category/${CATEGORY_EN_TO_UK_SLUG[key]}/" class="hover:text-orange-600 transition-colors py-2 font-black tracking-tight text-sm">${CAT_DISPLAY[key] || key}</a>
                    `).join('')}
                    <div class="flex items-center ml-4">
                        <a href="#" class="bg-indigo-950 text-white px-5 py-2.5 rounded-xl transition hover:bg-slate-900 shadow-xl shadow-indigo-100 flex items-center gap-3 group border border-white/10">
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
                        <a href="/kalush/" class="hover:text-orange-600 transition-colors">Калуш</a>
                        <a href="/if/" class="hover:text-orange-600 transition-colors">Франківськ</a>
                        <a href="/kolomyya/" class="hover:text-orange-600 transition-colors">Коломия</a>
                        <a href="/dolyna/" class="hover:text-orange-600 transition-colors">Долина</a>
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
                            ${Object.keys(CATEGORY_EN_TO_UK_SLUG).map(key => `
                                <a href="/category/${CATEGORY_EN_TO_UK_SLUG[key]}/" class="py-2 active:text-orange-600 font-bold">${CAT_DISPLAY[key] || key}</a>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Inject into template
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
    htmlContent = htmlContent.replace(/<meta name="description"[^>]*>/gi, '');
    htmlContent = htmlContent.replace(/<link rel="canonical"[^>]*>/gi, '');
    htmlContent = inject(htmlContent, 'site-header-placeholder', headerHtml);
    htmlContent = htmlContent.replace('</head>', `${ssrScript}\n${metaTags}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
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
