const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const SITE_URL = process.env.SITE_URL || 'https://ifnews-omega.vercel.app';

const CITIES_MAP = {
    'kalush': 'Калуш',
    'if': 'Івано-Франківськ',
    'kolomyya': 'Коломия',
    'dolyna': 'Долина',
    'bolekhiv': 'Болехів',
    'nadvirna': 'Надвірна',
    'burshtyn': 'Бурштин',
    'kosiv': 'Косів',
    'yaremche': 'Яремче'
};

module.exports = async (req, res) => {
    // City slug comes from query string: /api/city?city=kolomyya
    // (Vercel rewrite maps /:city/ → /api/city?city=:city)
    let city = req.query.city;
    if (Array.isArray(city)) city = city[0];

    if (!city || !CITIES_MAP[city]) {
        res.status(404).send('City not found');
        return;
    }

    const cityName = CITIES_MAP[city];
    const canonicalUrl = `${SITE_URL}/${city}/`;
    const title = `Новини ${cityName} сьогодні — останні події | Прикарпаття News`;
    const description = `Актуальні новини ${cityName}: місцеві події, факти, оперативна інформація. Слідкуйте за головними новинами першими на IF News.`;
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
        console.error('Template Error:', e);
        return res.status(500).send('Configuration error');
    }

    // Build SEO meta block
    const metaTags = `
    <!-- City Page SEO -->
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
                "name": "${escapeJson(cityName)}",
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
    <!-- End City SEO -->`;

    // Inject SSR data for the city filter
    const ssrScript = `<script>
    window.__SSR_CITY__ = '${city}';
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
                    <div class="text-[11px] font-bold text-slate-300 uppercase tracking-widest py-1">
                        ОСТАННІ НОВИНИ ПРИКАРПАТТЯ • ПЕРЕВІРЕНІ ФАКТИ • АКТУАЛЬНІ ПОДІЇ •
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
                
                <nav class="hidden md:flex items-center gap-6 text-[12px] font-black uppercase tracking-wider text-slate-600">
                    ${Object.keys(CATEGORY_EN_TO_UK_SLUG).map(key => `
                        <a href="/category/${CATEGORY_EN_TO_UK_SLUG[key]}" class="hover:text-orange-600 transition-colors">${CAT_DISPLAY[key] || key}</a>
                    `).join('')}
                </nav>

                <button class="md:hidden flex flex-col gap-1.5 p-2">
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                    <span class="w-6 h-0.5 bg-slate-900 rounded-full"></span>
                </button>
            </div>
        </header>
    `;

    // Replace <title> and inject metas before </head>
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

    // Remove existing canonical/description if already in HTML (avoid duplicates)
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
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
