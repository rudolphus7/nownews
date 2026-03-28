/**
 * BUKVA NEWS Gamification Engine
 * Synchronized with Oak Gamification (games.html)
 */
class GamificationEngine {
    constructor() {
        this.config = {
            readTimeTarget: 25, // lowered to 25s for better UX
            scrollTarget: 0.7,  // lowered to 70% scroll target
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
            quests_state: { p: {}, d: {}, l: '' }
        };

        if (this.state.articleId) {
            this.init();
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
        if (!window.supabase) return;
        try {
            const { data, error } = await window.supabase
                .from('user_gamification')
                .select('aqua_data, solar_insight, quests_state')
                .eq('user_id', this.state.userId)
                .maybeSingle();

            if (data) {
                this.state.resources.aqua_data = data.aqua_data || 0;
                this.state.resources.solar_insight = data.solar_insight || 0;
                this.state.quests_state = data.quests_state || { p: {}, d: {}, l: '' };
            } else {
                // New user: grant welcome bonus
                this.state.resources.aqua_data = 50;
                this.state.resources.solar_insight = 30;
                localStorage.setItem('oak_wel2', '1');
                await window.supabase.from('user_gamification').insert([{
                    user_id: this.state.userId,
                    aqua_data: 50,
                    solar_insight: 30,
                    tree_name: 'Мій Дуб'
                }]);
                this.showNotification('🎉 Вітаємо!', 'Ви отримали стартовий бонус: +50 Води та +30 Сонця');
            }
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
        this.checkRequirements();
    }

    checkRequirements() {
        if (this.state.awarded) return;
        if (this.state.timeSpent >= this.config.readTimeTarget && 
            this.state.maxScroll >= this.config.scrollTarget) {
            this.awardResources('aqua_data', this.config.rewardAmount);
        }
    }

    async awardResources(type, amount) {
        if (type === 'aqua_data') {
            this.state.awarded = true;
            sessionStorage.setItem(`awarded_${this.state.articleId}`, 'true');
        }

        this.state.resources[type] += amount;
        this.updateWidgets();

        // Update Quest Progress
        let questMsg = '';
        if (type === 'aqua_data') {
            const lastDay = this.state.quests_state.l ? new Date(this.state.quests_state.l).toDateString() : '';
            const today = new Date().toDateString();
            if (lastDay !== today) {
                this.state.quests_state.p = {};
                this.state.quests_state.d = {};
                this.state.quests_state.l = new Date().toISOString();
            }
            
            this.state.quests_state.p['read3'] = (this.state.quests_state.p['read3'] || 0) + 1;
            const prog = this.state.quests_state.p['read3'];
            questMsg = ` Прочитано новин: ${prog}/3.`;
        }

        // Push to DB directly by updating row
        if (window.supabase) {
            const updateObj = { updated_at: new Date().toISOString() };
            if (type === 'aqua_data') {
                updateObj.aqua_data = this.state.resources.aqua_data;
                updateObj.quests_state = this.state.quests_state;
            } else {
                updateObj.solar_insight = this.state.resources.solar_insight;
            }
            
            await window.supabase
                .from('user_gamification')
                .update(updateObj)
                .eq('user_id', this.state.userId);
        }

        const icon = type === 'aqua_data' ? '💧' : '☀️';
        const nameStr = type === 'aqua_data' ? 'Води' : 'Сонця';
        this.showNotification(`+${amount} ${nameStr}`, `Новини дають живлення дубу!${questMsg}`);
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
            <div style="font-size:10px;margin-top:6px;color:#22c55e">Перейти до дуба →</div>
        `;
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

if ((window.location.pathname.includes('/news/') || window.location.search.includes('slug=') || window.location.search.includes('id=')) && !window.location.pathname.includes('admin')) {
    window.gamification = new GamificationEngine();
}
