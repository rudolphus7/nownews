/**
 * BUKVA NEWS Gamification Engine
 * Tracks reading time and scroll depth to award Aqua-Data.
 */
class GamificationEngine {
    constructor() {
        this.config = {
            readTimeTarget: 150, // 2.5 minutes in seconds
            scrollTarget: 0.8,    // 80% scroll
            rewardAmount: 10,
            solarReward: 2
        };

        this.state = {
            startTime: Date.now(),
            maxScroll: 0,
            timeSpent: 0,
            awarded: false,
            articleId: this.getArticleId()
        };

        if (this.state.articleId) {
            this.init();
        }
    }

    getArticleId() {
        const path = window.location.pathname;
        if (path.includes('/news/')) return path.split('/news/')[1];
        if (window.location.search.includes('slug=')) {
            const params = new URLSearchParams(window.location.search);
            return params.get('slug');
        }
        return path.replace(/\//g, '') || 'home';
    }

    init() {
        if (sessionStorage.getItem(`awarded_${this.state.articleId}`)) {
            this.state.awarded = true;
        }

        window.addEventListener('scroll', () => this.trackScroll());
        this.timer = setInterval(() => this.trackTime(), 1000);
        
        this.updateWidgets();
        console.log(`[Gamification] Tracking started for: ${this.state.articleId}`);
    }

    updateWidgets() {
        const aqua = localStorage.getItem('aqua_data') || '0';
        const solar = localStorage.getItem('solar_insight') || '0';
        
        document.querySelectorAll('.gamification-aqua-val').forEach(el => el.innerText = aqua);
        document.querySelectorAll('.gamification-solar-val').forEach(el => el.innerText = solar);
    }

    trackScroll() {
        if (this.state.awarded) return;

        const h = document.documentElement, 
              b = document.body,
              st = 'scrollTop',
              sh = 'scrollHeight';
        const percent = (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight);
        
        if (percent > this.state.maxScroll) {
            this.state.maxScroll = percent;
        }

        this.checkRequirements();
    }

    trackTime() {
        if (this.state.awarded) {
            clearInterval(this.timer);
            return;
        }

        this.state.timeSpent = (Date.now() - this.state.startTime) / 1000;
        this.checkRequirements();

        if (Math.floor(this.state.timeSpent) % 30 === 0 && this.state.timeSpent > 0) {
            console.log(`[Gamification] Progress: ${Math.round(this.state.timeSpent)}s read, ${Math.round(this.state.maxScroll * 100)}% scroll`);
        }
    }

    checkRequirements() {
        if (this.state.awarded) return;

        if (this.state.timeSpent >= this.config.readTimeTarget && 
            this.state.maxScroll >= this.config.scrollTarget) {
            this.awardResources();
        }
    }

    awardResources() {
        this.state.awarded = true;
        sessionStorage.setItem(`awarded_${this.state.articleId}`, 'true');

        let aqua = parseInt(localStorage.getItem('aqua_data') || '0');
        aqua += this.config.rewardAmount;
        localStorage.setItem('aqua_data', aqua.toString());

        this.updateWidgets();
        this.showNotification(`+${this.config.rewardAmount} Aqua-Data 💧`, 'Ви уважний читач! Місто розвивається.');
    }

    showNotification(title, text) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2e1065;
            color: white;
            padding: 20px;
            border-radius: 20px;
            border: 1px solid #7c3aed;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 10000;
            transform: translateY(100px);
            transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-family: 'Inter', sans-serif;
            max-width: 300px;
        `;
        toast.innerHTML = `
            <div style="font-weight: 900; color: #7c3aed; margin-bottom: 5px; text-transform: uppercase; font-size: 14px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.8;">${text}</div>
            <a href="/games.html" style="display: block; margin-top: 10px; color: #ea580c; font-weight: bold; font-size: 10px; text-transform: uppercase;">Подивитись мій сад →</a>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.transform = 'translateY(0)', 100);
        setTimeout(() => {
            toast.style.transform = 'translateY(150px)';
            setTimeout(() => toast.remove(), 500);
        }, 8000);
    }
}

window.awardSolarInsight = function() {
    let solar = parseInt(localStorage.getItem('solar_insight') || '0');
    solar += 2;
    localStorage.setItem('solar_insight', solar.toString());
    
    document.querySelectorAll('.gamification-solar-val').forEach(el => el.innerText = solar);
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #1e1b4b;
        color: white;
        padding: 10px 20px;
        border-radius: 15px;
        border: 1px solid #7c3aed;
        z-index: 10001;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: bold;
        pointer-events: none;
        animation: fadeOutUp 2s forwards;
    `;
    toast.innerHTML = `+2 Solar-Insight ☀️`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2100);
};

const gamStyle = document.createElement('style');
gamStyle.innerHTML = `
    @keyframes fadeOutUp {
        0% { opacity: 0; transform: translateY(20px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-40px); }
    }
`;
document.head.appendChild(gamStyle);

if (window.location.pathname.includes('/news/') || window.location.search.includes('slug=')) {
    window.gamification = new GamificationEngine();
}
