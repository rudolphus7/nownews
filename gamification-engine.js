/**
 * BUKVA NEWS Gamification Engine
 * Synchronized with Oak Gamification (games.html)
 */
class GamificationEngine {
    constructor() {
        this.config = {
            readTimeTarget: 10, // 10 seconds presence
            scrollTarget: 0.5,  // 50% scroll
            rewardAmount: 10,
            solarReward: 5,
        };

        this.state = {
            userId: this.getOrCreateUserId(),
            startTime: Date.now(),
            maxScroll: 0,
            timeSpent: 0,
            awarded: false,
            articleId: this.getArticleId(),
            resources: { aqua_data: 0, solar_insight: 0 },
            quests_state: { p: {}, d: {}, l: '' },
            readIds: [], // PERSISTENT list of awarded articles
            isSynced: false // LOCK: prevent saving before loading
        };

        if (this.state.articleId) {
            console.log(`[Gamification] Active on article: ${this.state.articleId}`);
            this.init();
        } else {
            console.log(`[Gamification] Not on article page.`);
        }
    }

    getOrCreateUserId() {
        let id = localStorage.getItem('bukva_uid');
        if (!id) {
            id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            localStorage.setItem('bukva_uid', id);
        }
        return id;
    }

    getArticleId() {
        const path = window.location.pathname.replace(/\/$/, ""); // remove trailing slash
        if (path.includes('/news/')) return path.split('/news/')[1].replace(/\/$/, "");
        const params = new URLSearchParams(window.location.search);
        if (params.has('slug')) return params.get('slug');
        if (params.has('id')) return params.get('id');
        const slug = path.split('/').pop();
        if (slug && slug.includes('.html')) return slug.replace('.html', '');
        return slug || 'home';
    }

    async init() {
        if (sessionStorage.getItem(`awarded_${this.state.articleId}`)) {
            this.state.awarded = true;
        }

        window.addEventListener('scroll', () => this.trackScroll());
        this.timer = setInterval(() => this.trackTime(), 1000);
        
        await this.syncFromDB();
        this.updateWidgets();
    }

    async syncFromDB() {
        // Find the Supabase CLIENT (must have .from method), not just the library namespace
        this.supabase = [window._supabase, window.supabase, (window.db ? window.db() : null)]
            .find(s => s && typeof s.from === 'function');
        
        if (!this.supabase) {
            console.warn("[Gamification] Supabase client not found (waiting for initialization)...");
            setTimeout(() => this.syncFromDB(), 2000);
            return;
        }

        console.log("[Gamification] Found Supabase Client! Synchronizing progress...");

        try {
            const { data, error } = await this.supabase
                .from('user_gamification')
                .select('aqua_data, solar_insight, quests_state')
                .eq('user_id', this.state.userId)
                .maybeSingle();

            if (data) {
                this.state.resources.aqua_data = data.aqua_data || 0;
                this.state.resources.solar_insight = data.solar_insight || 0;
                this.state.quests_state = data.quests_state || { p: {}, d: {}, l: '' };
                const gs = data.garden_state || {};
                this.state.readIds = gs.read_ids || [];
            } else {
                // New user: grant welcome bonus
                this.state.resources.aqua_data = 50;
                this.state.resources.solar_insight = 30;
                localStorage.setItem('oak_wel2', '1');
                await this.supabase.from('user_gamification').insert([{
                    user_id: this.state.userId,
                    aqua_data: 50,
                    solar_insight: 30,
                    tree_name: 'Мій Дуб'
                }]);
                this.showNotification('🎉 Вітаємо!', 'Ви отримали стартовий бонус: +50 Води та +30 Сонця');
            }
            this.state.isSynced = true;
            console.log("[Gamification] Switched to online mode. Resources synced.");
        } catch (e) {
            console.warn("[Gamification] DB Sync failed", e);
        }
    }

    updateWidgets() {
        document.querySelectorAll('.gamification-aqua-val').forEach(el => el.innerText = this.state.resources.aqua_data);
        document.querySelectorAll('.gamification-solar-val').forEach(el => el.innerText = this.state.resources.solar_insight);
    }

    trackScroll() {
        if (this.state.awarded) return;
        const h = document.documentElement, b = document.body, st = 'scrollTop', sh = 'scrollHeight';
        const percent = (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight);
        if (percent > this.state.maxScroll) this.state.maxScroll = percent;
        this.checkRequirements();
    }

    trackTime() {
        if (this.state.awarded) { clearInterval(this.timer); return; }
        this.state.timeSpent = (Date.now() - this.state.startTime) / 1000;
        if (Math.floor(this.state.timeSpent) === this.config.readTimeTarget) {
            console.log(`[Gamification] Time target reached: ${this.config.readTimeTarget}s`);
        }
        this.checkRequirements();
    }

    checkRequirements() {
        if (this.state.awarded || !this.state.isSynced) return;
        
        // Anti-cheat: Check if this article was ALREADY rewarded in the past
        if (this.state.readIds.includes(this.state.articleId)) {
            console.log("[Gamification] Article already rewarded. Skipping bonus.");
            this.state.awarded = true; // Stop tracking this article
            return;
        }

        if (this.state.timeSpent >= this.config.readTimeTarget || 
            this.state.maxScroll >= this.config.scrollTarget) {
            console.log("[Gamification] Award criteria met. awarding...");
            this.awardResources('aqua_data', this.config.rewardAmount);
        }
    }

    async awardResources(type, amount) {
        if (this.isSaving) {
            console.log("[Gamification] Save already in progress. Queuing (skipping for now)...");
            return;
        }
        this.isSaving = true;

        try {
            if (type === 'aqua_data') {
                this.state.awarded = true;
                sessionStorage.setItem(`awarded_${this.state.articleId}`, 'true');
            }

            // 1. FRESH SYNC: Get absolute latest from DB to avoid overwriting other tabs' progress
            if (this.supabase) {
                const { data: latest, error: syncErr } = await this.supabase
                    .from('user_gamification')
                    .select('aqua_data, solar_insight, quests_state, garden_state')
                    .eq('user_id', this.state.userId)
                    .maybeSingle();
                
                if (latest && !syncErr) {
                    console.log("[Gamification] Fresh sync before save successful.");
                    this.state.resources.aqua_data = latest.aqua_data || 0;
                    this.state.resources.solar_insight = latest.solar_insight || 0;
                    this.state.quests_state = latest.quests_state || { p: {}, d: {}, l: '' };
                    const gs = latest.garden_state || {};
                    this.state.readIds = gs.read_ids || [];
                }
            }

            // 2. APPLY REWARD
            this.state.resources[type] += amount;
            this.updateWidgets();

            // 3. UPDATE QUESTS & TRACKER
            let questMsg = '';
            if (type === 'aqua_data') {
                const lastSync = this.state.quests_state.l ? new Date(this.state.quests_state.l).toDateString() : '';
                const today = new Date().toDateString();
                
                // Only reset if we actually have a record of a previous different day
                if (lastSync && lastSync !== 'Invalid Date' && lastSync !== today) {
                    this.state.quests_state.p = {};
                    this.state.quests_state.d = {};
                    this.state.quests_state.l = new Date().toISOString();
                    console.log("[Gamification] New day detected during award. Progress reset.");
                } else if (!this.state.quests_state.l) {
                    this.state.quests_state.l = new Date().toISOString();
                }
                
                // Increment all read tiers
                this.state.quests_state.p = this.state.quests_state.p || {};
                this.state.quests_state.p['read3'] = (this.state.quests_state.p['read3'] || 0) + 1;
                this.state.quests_state.p['read10'] = (this.state.quests_state.p['read10'] || 0) + 1;
                this.state.quests_state.p['read50'] = (this.state.quests_state.p['read50'] || 0) + 1;
                
                questMsg = ` Завдання оновлено!`;

                // Persistent Read Tracker (avoid duplicates)
                if (!this.state.readIds.includes(this.state.articleId)) {
                    this.state.readIds.push(this.state.articleId);
                }
            }

            // 4. PUSH TO DB
            if (this.supabase) {
                const updateObj = { updated_at: new Date().toISOString() };
                if (type === 'aqua_data') {
                    updateObj.aqua_data = this.state.resources.aqua_data;
                    updateObj.quests_state = this.state.quests_state;
                    updateObj.garden_state = { 
                        read_ids: this.state.readIds,
                        reads: (this.state.readIds.length)
                    };
                } else {
                    updateObj.solar_insight = this.state.resources.solar_insight;
                }
                
                const { error } = await this.supabase
                    .from('user_gamification')
                    .update(updateObj)
                    .eq('user_id', this.state.userId);
                
                if (error) console.error("[Gamification] Save error:", error);
                else console.log("[Gamification] Progress saved to cloud + merged.");
            }

            // 5. NOTIFY
            const icon = type === 'aqua_data' ? '💧' : '☀️';
            const nameStr = type === 'aqua_data' ? 'Води' : 'Сонця';
            this.showNotification(`+${amount} ${nameStr}`, `Новини дають живлення дубу!${questMsg}`);

        } catch (err) {
            console.error("[Gamification] Award error:", err);
        } finally {
            this.isSaving = false;
        }
    }

    showNotification(title, text) {
        let toast = document.getElementById('gam-toast-news');
        if(!toast){
            toast = document.createElement('div');
            toast.id = 'gam-toast-news';
            toast.style.cssText = `
                position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%) translateY(100px);
                background: #0d2010; border: 1px solid rgba(34,197,94,0.4); border-radius: 18px; 
                padding: 12px 18px; font-weight: 800; font-size: 13px; color: #86efac; opacity: 0;
                pointer-events: none; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                z-index: 99999; box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: 'Outfit', sans-serif;
                white-space: nowrap; text-align: center;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `
            <div style="font-size:15px;margin-bottom:4px;color:#fff">${title}</div>
            <div style="font-size:11px;opacity:0.8;font-weight:600">${text}</div>
            <div style="font-size:11px;margin-top:8px;color:#22c55e;font-weight:800;cursor:pointer;text-decoration:underline">Перейти до дуба →</div>
        `;
        toast.onclick = () => window.location.href = '/games/';
        toast.style.pointerEvents = 'auto'; // Enable clicks
        toast.style.cursor = 'pointer';
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(50px)'; }, 5000);
    }
}

// Global hooks for events
window.awardSolarInsight = function() {
    if (window.gamification) {
        window.gamification.awardResources('solar_insight', 5);
    }
};

const gamStyle = document.createElement('style');
gamStyle.innerHTML = `
    @keyframes fadeOutUp {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 0; transform: translateY(-40px); }
    }
`;
document.head.appendChild(gamStyle);

if ((window.location.pathname.includes('/news/') || 
     window.location.pathname.includes('/article.html') || 
     window.location.pathname.includes('/novyny/') || 
     window.location.search.includes('slug=') || 
     window.location.search.includes('id=')) && 
    !window.location.pathname.includes('admin')) {
    console.log("[Gamification] Conditions met. Initializing engine...");
    window.gamification = new GamificationEngine();
} else {
    console.log("[Gamification] Engine ignored for this page.");
}
