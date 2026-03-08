/**
 * BUKVA NEWS — Global Footer Component
 * Renders the unified footer into #site-footer-placeholder
 * Usage: <div id="site-footer-placeholder"></div>
 *        <script src="/components/footer.js"></script>
 *        Then call: window.initSiteFooter(supabaseClient)
 */

class SiteFooter {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async init() {
        const socialSettings = await Object.getPrototypeOf(this).loadSettings(this.supabase);
        this.renderShell(socialSettings);
        await this.loadNav();
    }

    async loadSettings(supabase) {
        try {
            const { data } = await supabase.from('settings').select('key, value');
            const social = {};
            if (data) {
                data.forEach(item => { social[item.key] = item.value; });
            }
            return social;
        } catch (e) {
            return {};
        }
    }

    renderShell(social) {
        const el = document.getElementById('site-footer-placeholder');
        if (!el) return;

        el.innerHTML = `
        <footer class="relative bg-slate-950 mt-20 text-white overflow-hidden">
            <!-- Decorative glow -->
            <div class="absolute top-0 left-1/4 w-96 h-96 bg-orange-600 rounded-full blur-[200px] opacity-5 pointer-events-none"></div>
            <div class="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-600 rounded-full blur-[150px] opacity-5 pointer-events-none"></div>
            <!-- Orange top border -->
            <div class="h-[3px] w-full bg-gradient-to-r from-transparent via-orange-600 to-transparent"></div>

            <div class="container mx-auto px-4 pt-20 pb-10">
                <!-- Main grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-16">

                    <!-- Brand column -->
                    <div class="space-y-6">
                        <a href="/" class="flex items-center space-x-3 group w-fit">
                            <div class="relative shrink-0">
                                <img src="/logo_footer.png" alt="BUKVA NEWS" class="w-12 h-12 rounded-2xl object-cover shadow-2xl shadow-orange-500/40 group-hover:rotate-3 transition-transform duration-500">
                                <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-500 border-2 border-slate-950 rounded-full">
                                    <div class="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-60"></div>
                                </div>
                            </div>
                            <div class="leading-none">
                                <span class="text-2xl font-black uppercase tracking-tighter text-white block group-hover:text-orange-50 transition-colors">BUKVA <span class="text-orange-500 group-hover:text-orange-400 transition-colors">NEWS</span></span>
                                <span class="text-[9px] font-black uppercase tracking-[0.35em] text-slate-500 mt-0.5 block">Незалежна Журналістика</span>
                            </div>
                        </a>

                        <p class="text-slate-400 text-sm leading-relaxed max-w-xs">
                            Головне незалежне медіа Івано-Франківщини. Перевірені факти, оперативні події, чесна журналістика.
                        </p>

                        <!-- Social icons -->
                        <div class="flex items-center gap-3">
                            <a href="${social.social_facebook || '#'}" class="w-10 h-10 bg-white/5 hover:bg-[#1877F2] border border-white/10 rounded-xl flex items-center justify-center transition-all duration-300 group" aria-label="Facebook">
                                <svg class="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                            </a>
                            <a href="${social.social_instagram || '#'}" class="w-10 h-10 bg-white/5 hover:bg-pink-600 border border-white/10 rounded-xl flex items-center justify-center transition-all duration-300 group" aria-label="Instagram">
                                <svg class="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                            </a>
                            <a href="${social.social_telegram || '#'}" class="w-10 h-10 bg-white/5 hover:bg-[#229ED9] border border-white/10 rounded-xl flex items-center justify-center transition-all duration-300 group" aria-label="Telegram">
                                <svg class="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/></svg>
                            </a>
                            <a href="/live/" class="w-10 h-10 bg-red-600/20 hover:bg-red-600 border border-red-600/30 rounded-xl flex items-center justify-center transition-all duration-300 group" aria-label="LIVE">
                                <span class="text-xs font-black text-red-400 group-hover:text-white transition-colors">▶</span>
                            </a>
                        </div>
                    </div>

                    <!-- Categories column -->
                    <div>
                        <h4 class="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 mb-6 flex items-center gap-2">
                            <span class="w-1 h-4 bg-orange-600 rounded-full inline-block"></span>
                            Рубрики
                        </h4>
                        <ul id="footer-categories" class="space-y-3">
                            <li><a href="/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Головна</a></li>
                        </ul>
                    </div>

                    <!-- Cities column -->
                    <div>
                        <h4 class="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 mb-6 flex items-center gap-2">
                            <span class="w-1 h-4 bg-orange-600 rounded-full inline-block"></span>
                            Міста
                        </h4>
                        <ul id="footer-cities" class="space-y-3">
                        </ul>
                    </div>

                    <!-- Info column -->
                    <div>
                        <h4 class="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 mb-6 flex items-center gap-2">
                            <span class="w-1 h-4 bg-orange-600 rounded-full inline-block"></span>
                            Про видання
                        </h4>
                        <ul class="space-y-3">
                            <li><a href="/about/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Про нас</a></li>
                            <li><a href="/team/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Команда</a></li>
                            <li><a href="/advertising/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Реклама</a></li>
                            <li><a href="/archive/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Архів новин</a></li>
                        </ul>
                    </div>

                    <!-- Contacts column -->
                    <div>
                        <h4 class="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 mb-6 flex items-center gap-2">
                            <span class="w-1 h-4 bg-orange-600 rounded-full inline-block"></span>
                            Контакти
                        </h4>
                        <ul class="space-y-4 text-sm">
                            <li>
                                <span class="block text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Email</span>
                                <a href="mailto:bukva.news@gmail.com" class="text-slate-300 hover:text-orange-500 transition-colors font-medium">bukva.news@gmail.com</a>
                            </li>
                            <li>
                                <span class="block text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Матеріали та пресрелізи</span>
                                <a href="mailto:bukva.news@gmail.com" class="text-slate-300 hover:text-orange-500 transition-colors font-medium">bukva.news@gmail.com</a>
                            </li>
                            <li class="pt-4">
                                <a href="/live/" class="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/20 hover:bg-red-600 hover:border-red-600 text-red-400 hover:text-white px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300">
                                    <span class="flex h-2 w-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>
                                    LIVE • ЕФІР
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Bottom bar -->
                <div class="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div class="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                        <p class="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">© 2026 BUKVA NEWS. Всі права захищені.</p>
                        <div class="flex gap-4">
                            <a href="/privacy/" class="text-[10px] font-bold text-slate-600 hover:text-orange-500 uppercase tracking-widest transition-colors">Політика конфіденційності</a>
                            <a href="/terms/" class="text-[10px] font-bold text-slate-600 hover:text-orange-500 uppercase tracking-widest transition-colors">Правила використання</a>
                        </div>
                    </div>
                    <p class="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Незалежність · Об'єктивність · Оперативність</p>
                </div>
            </div>
        </footer>`;
    }

    async loadNav() {
        try {
            const [{ data: cats }, { data: cities }] = await Promise.all([
                this.supabase.from('categories').select('name,slug').order('order_index', { ascending: true }),
                this.supabase.from('cities').select('name,slug').order('order_index', { ascending: true })
            ]);

            const catList = document.getElementById('footer-categories');
            if (catList && cats) {
                catList.innerHTML = `<li><a href="/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">Головна</a></li>` +
                    cats.map(c => `<li><a href="/category/${c.slug}/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">${c.name}</a></li>`).join('');
            }

            const cityList = document.getElementById('footer-cities');
            if (cityList && cities) {
                cityList.innerHTML = cities.map(c =>
                    `<li><a href="/${c.slug}/" class="text-slate-400 hover:text-white text-sm font-medium transition-colors hover:translate-x-1 inline-block duration-200">${c.name}</a></li>`
                ).join('');
            }
        } catch (e) {
            console.warn('Footer nav load failed:', e.message);
        }
    }
}

window.initSiteFooter = async (supabaseClient) => {
    const footer = new SiteFooter(supabaseClient);
    await footer.init();
    return footer;
};
