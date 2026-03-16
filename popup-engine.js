/**
 * BUKVA NEWS | Popup Engine v1.0
 * Lightweight, high-performance popup delivery system.
 */

(function() {
    const SITE_URL = 'https://bukva.news';
    const POPUP_STORAGE_KEY = 'bn_popups_state';

    function getStorage() {
        try {
            return JSON.parse(localStorage.getItem(POPUP_STORAGE_KEY)) || {};
        } catch (e) { return {}; }
    }

    function saveStorage(state) {
        localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(state));
    }

    async function init() {
        try {
            const res = await fetch('/api/popups?active_only=true');
            if (!res.ok) return;
            const popups = await res.json();
            if (!popups || popups.length === 0) return;

            const state = getStorage();
            const sessionID = sessionStorage.getItem('bn_session_id') || Math.random().toString(36).substring(7);
            sessionStorage.setItem('bn_session_id', sessionID);

            popups.forEach(popup => {
                if (shouldShow(popup, state, sessionID)) {
                    setupTrigger(popup);
                }
            });
        } catch (e) {
            console.warn('Popup Engine Error:', e);
        }
    }

    function shouldShow(popup, state, sessionID) {
        const pState = state[popup.id] || {};
        const freq = popup.config.frequency;

        if (freq === 'once' && pState.shown) return false;
        if (freq === 'session' && pState.lastSession === sessionID) return false;

        // Future: Add city/category targeting check here
        
        return true;
    }

    function setupTrigger(popup) {
        const { type, value } = popup.config.triggers;

        if (type === 'timer') {
            setTimeout(() => showPopup(popup), value || 5000);
        } else if (type === 'scroll') {
            const handleScroll = () => {
                const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
                if (scrolled >= (value || 50)) {
                    showPopup(popup);
                    window.removeEventListener('scroll', handleScroll);
                }
            };
            window.addEventListener('scroll', handleScroll);
        } else if (type === 'exit') {
            const handleExit = (e) => {
                if (e.clientY <= 0) {
                    showPopup(popup);
                    document.removeEventListener('mouseleave', handleExit);
                }
            };
            document.addEventListener('mouseleave', handleExit);
        }
    }

    function showPopup(popup) {
        if (document.getElementById(`bn-popup-${popup.id}`)) return;

        // Load premium font if not present
        if (!document.getElementById('bn-premium-font')) {
            const link = document.createElement('link');
            link.id = 'bn-premium-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap';
            document.head.appendChild(link);
        }

        const isMobile = window.innerWidth < 768;
        const pos = isMobile ? popup.config.position.mobile : popup.config.position.desktop;
        
        const imgFit = popup.config.image?.fit || 'cover';
        const imgPos = popup.config.image?.position || 'center';

        // 1. Create Overlay
        const overlay = document.createElement('div');
        overlay.id = `bn-popup-overlay-${popup.id}`;
        overlay.style = `
            position: fixed; inset: 0; z-index: 999999;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(14px) saturate(190%);
            -webkit-backdrop-filter: blur(14px) saturate(190%);
            opacity: 0; transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; align-items: ${pos === 'center' ? 'center' : (pos === 'bottom' ? 'flex-end' : 'center')};
            justify-content: ${pos === 'center' ? 'center' : (pos === 'bottom-right' ? 'flex-end' : 'center')};
            padding: ${isMobile ? '12px' : '40px'};
        `;

        // 2. Create Modal
        const modal = document.createElement('div');
        modal.id = `bn-popup-${popup.id}`;
        
        const modalBaseStyle = `
            background: #fff; border-radius: 3rem; overflow: hidden;
            box-shadow: 
                0 0 0 1px rgba(0,0,0,0.04),
                0 25px 60px -15px rgba(15, 23, 42, 0.35),
                0 50px 100px -25px rgba(15, 23, 42, 0.25);
            transition: all 1s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            font-family: 'Outfit', -apple-system, sans-serif;
            display: flex; flex-direction: column;
            border: 1px solid rgba(255,255,255,0.7);
        `;

        const stateStyle = pos === 'center' 
            ? 'max-width: 520px; width: 100%; transform: scale(0.85) translateY(40px);'
            : (pos === 'bottom-right' ? 'max-width: 400px; width: 100%; transform: translateX(110%) rotate(4deg);' : 'max-width: 100%; width: 100%; transform: translateY(110%);');

        modal.style = modalBaseStyle + stateStyle;

        const imageHtml = popup.image_url ? `
            <div style="position: relative; width: 100%; height: ${isMobile ? '210px' : '300px'}; overflow: hidden; background: #f1f5f9;">
                <img src="${popup.image_url}" style="
                    width: 100%; height: 100%; 
                    object-fit: ${imgFit}; 
                    object-position: ${imgPos};
                    transition: transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1);
                    transform: scale(1.15);
                " onload="this.style.transform='scale(1)'">
                <!-- Double Masking -->
                <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 25%, transparent 75%, #fff 100%);"></div>
            </div>
        ` : '';

        const buttonsHtml = popup.config.buttons.map((b, i) => `
            <a href="${b.link}" target="_blank" style="
                display: flex; align-items: center; justify-content: center; width: 100%; padding: 22px;
                background: ${b.style === 'primary' ? 'linear-gradient(145deg, #f97316 0%, #ea580c 100%)' : '#f8fafc'};
                color: ${b.style === 'primary' ? '#fff' : '#475569'};
                text-align: center; text-decoration: none;
                font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; font-size: 13px;
                border-radius: 1.8rem; margin-top: ${i === 0 ? '0' : '14px'};
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: ${b.style === 'primary' ? '0 12px 24px -8px rgba(234, 88, 12, 0.45)' : 'none'};
                border: ${b.style === 'primary' ? 'none' : '1px solid #f1f5f9'};
            " onmouseover="this.style.transform='translateY(-4px) scale(1.02)'; if('${b.style}'==='primary') this.style.boxShadow='0 20px 40px -10px rgba(234, 88, 12, 0.6)';" onmouseout="this.style.transform='none'; if('${b.style}'==='primary') this.style.boxShadow='0 12px 24px -8px rgba(234, 88, 12, 0.45)';">
                ${b.text}
            </a>
        `).join('');

        modal.innerHTML = `
            <!-- Vector Close Button -->
            <button onclick="this.closest('[id^=bn-popup-overlay]').style.opacity='0'; setTimeout(() => this.closest('[id^=bn-popup-overlay]').remove(), 600);" style="
                position: absolute; top: 24px; right: 24px; width: 44px; height: 44px;
                background: rgba(255,255,255,0.9); border: none; border-radius: 50%; cursor: pointer;
                box-shadow: 0 12px 24px rgba(0,0,0,0.15); z-index: 100;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                backdrop-filter: blur(8px);
            " onmouseover="this.style.transform='rotate(180deg) scale(1.15)'; this.style.background='#fff';" onmouseout="this.style.transform='none'; this.style.background='rgba(255,255,255,0.9)';">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            ${imageHtml}
            <div style="padding: ${isMobile ? '35px 28px' : '50px 45px'}; margin-top: ${imageHtml ? '-30px' : '0'}; position: relative;">
                <div style="color: #1e293b; font-size: 19px; font-weight: 700; line-height: 1.5; margin-bottom: 35px; text-align: ${pos === 'center' ? 'center' : 'left'}; letter-spacing: -0.01em;">
                    ${popup.content_html}
                </div>
                <div style="display: flex; flex-direction: column;">
                    ${buttonsHtml}
                </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #fafafa; border-top: 1px solid #f1f5f9;">
                 <div style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.25em;">
                    BUKVA NEWS <span style="margin: 0 10px; opacity: 0.3;">|</span> PREMIUM CONTENT
                 </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            modal.style.transform = pos === 'center' ? 'scale(1) translateY(0)' : 'translate(0) rotate(0)';
        }, 50);

        // Update tracking
        const state = getStorage();
        state[popup.id] = {
            shown: true,
            lastShown: Date.now(),
            lastSession: sessionStorage.getItem('bn_session_id')
        };
        saveStorage(state);
    }

    // Start engine
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
