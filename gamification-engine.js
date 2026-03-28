/**
 * BUKVA NEWS Gamification Engine (v2.0 Professional)
 * Handles persistent tracking, Supabase sync, and visual awards.
 */
class GamificationEngine {
    constructor() {
        this.config = {
            readTimeTarget: 150, 
            scrollTarget: 0.8,    
            rewardAmount: 10,
            solarReward: 2
        };

        this.state = {
            userId: this.getOrCreateUserId(),
            startTime: Date.now(),
            maxScroll: 0,
            timeSpent: 0,
            awarded: false,
            articleId: this.getArticleId(),
            resources: { aqua_data: 0, solar_insight: 0, seeds: 0 }
        };

        if (this.state.articleId) {
            this.init();
        }
    }

    getOrCreateUserId() {
        let id = localStorage.getItem('gamification_user_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('gamification_user_id', id);
        }
        return id;
    }

    getArticleId() {
        const path = window.location.pathname;
        if (path.includes('/news/')) return path.split('/news/')[1];
        const params = new URLSearchParams(window.location.search);
        if (params.has('slug')) return params.get('slug');
        if (params.has('id')) return params.get('id');
        return path.replace(/\//g, '') || 'home';
    }

    async init() {
        // Initial sync from DB
        await this.syncFromDB();

        if (sessionStorage.getItem(`awarded_${this.state.articleId}`)) {
            this.state.awarded = true;
        }

        window.addEventListener('scroll', () => this.trackScroll());
        this.timer = setInterval(() => this.trackTime(), 1000);
        
        this.updateWidgets();
    }

    async syncFromDB() {
        if (!window.supabase) return;
        try {
            const { data, error } = await window.supabase
                .from('user_gamification')
                .select('*')
                .eq('user_id', this.state.userId)
                .single();

            if (data) {
                this.state.resources = {
                    aqua_data: data.aqua_data || 0,
                    solar_insight: data.solar_insight || 0,
                    seeds: data.seeds || 0
                };
            } else {
                // Initialize user if not exists
                await window.supabase.from('user_gamification').insert([{
                    user_id: this.state.userId,
                    aqua_data: 0,
                    solar_insight: 0,
                    seeds: 0
                }]);
            }
            this.updateWidgets();
        } catch (e) {
            console.warn("[Gamification] DB Sync failed, using fallback:", e);
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

        // Push to DB
        if (window.supabase) {
            await window.supabase.rpc('increment_gamification_resource', {
                target_user_id: this.state.userId,
                resource_type: type,
                delta: amount
            });
        }

        const icon = type === 'aqua_data' ? '💧' : '☀️';
        const label = type === 'aqua_data' ? 'Aqua-Data' : 'Solar-Insight';
        this.showNotification(`+${amount} ${label} ${icon}`, 'Ваша активність розвиває місто.');
    }

    showNotification(title, text) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: #2e1065; color: white; padding: 20px;
            border-radius: 20px; border: 1px solid #7c3aed; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 10000; transform: translateY(100px); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-family: 'Inter', sans-serif; max-width: 300px;
        `;
        toast.innerHTML = `
            <div style="font-weight: 900; color: #7c3aed; margin-bottom: 5px; text-transform: uppercase; font-size: 14px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.8;">${text}</div>
            <a href="/games.html" style="display: block; margin-top: 10px; color: #ea580c; font-weight: bold; font-size: 10px; text-transform: uppercase;">Мій Сад →</a>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.transform = 'translateY(0)', 100);
        setTimeout(() => { toast.style.transform = 'translateY(150px)'; setTimeout(() => toast.remove(), 500); }, 8000);
    }
}

// Global hooks for events
window.awardSolarInsight = function() {
    if (window.gamification) {
        window.gamification.awardResources('solar_insight', 2);
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
