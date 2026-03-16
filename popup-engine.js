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

        const isMobile = window.innerWidth < 768;
        const pos = isMobile ? popup.config.position.mobile : popup.config.position.desktop;
        
        // New config values
        const imgFit = popup.config.image?.fit || 'cover';
        const imgPos = popup.config.image?.position || 'center';

        // 1. Create Overlay
        const overlay = document.createElement('div');
        overlay.id = `bn-popup-overlay-${popup.id}`;
        overlay.style = `
            position: fixed; inset: 0; z-index: 999999;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            opacity: 0; transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; align-items: ${pos === 'center' ? 'center' : (pos === 'bottom' ? 'flex-end' : 'center')};
            justify-content: ${pos === 'center' ? 'center' : (pos === 'bottom-right' ? 'flex-end' : 'center')};
            padding: ${isMobile ? '16px' : '40px'};
        `;

        // 2. Create Modal
        const modal = document.createElement('div');
        modal.id = `bn-popup-${popup.id}`;
        
        const modalBaseStyle = `
            background: #fff; border-radius: 2.5rem; overflow: hidden;
            box-shadow: 
                0 0 0 1px rgba(0,0,0,0.05),
                0 20px 50px -10px rgba(15, 23, 42, 0.3),
                0 40px 80px -20px rgba(15, 23, 42, 0.2);
            transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
            position: relative;
            font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
            display: flex; flex-direction: column;
        `;

        const stateStyle = pos === 'center' 
            ? 'max-width: 540px; width: 100%; transform: scale(0.92) translateY(20px);'
            : (pos === 'bottom-right' ? 'max-width: 420px; width: 100%; transform: translateX(100%) rotate(5deg);' : 'max-width: 100%; width: 100%; transform: translateY(100%);');

        modal.style = modalBaseStyle + stateStyle;

        const imageHtml = popup.image_url ? `
            <div style="position: relative; width: 100%; height: ${isMobile ? '200px' : '280px'}; overflow: hidden; background: #f8fafc;">
                <img src="${popup.image_url}" style="
                    width: 100%; height: 100%; 
                    object-fit: ${imgFit}; 
                    object-position: ${imgPos};
                    transition: transform 1.2s cubic-bezier(0.23, 1, 0.32, 1);
                " onload="this.style.transform='scale(1.05)'">
                <div style="position: absolute; inset: 0; box-shadow: inset 0 -40px 60px -20px #fff;"></div>
            </div>
        ` : '';

        const buttonsHtml = popup.config.buttons.map((b, i) => `
            <a href="${b.link}" target="_blank" style="
                display: flex; align-items: center; justify-content: center; width: 100%; padding: 20px;
                background: ${b.style === 'primary' ? 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)' : '#f8fafc'};
                color: ${b.style === 'primary' ? '#fff' : '#475569'};
                text-align: center; text-decoration: none;
                font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; font-size: 13px;
                border-radius: 1.5rem; margin-top: ${i === 0 ? '0' : '12px'};
                transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                box-shadow: ${b.style === 'primary' ? '0 10px 20px -5px rgba(234, 88, 12, 0.3)' : 'none'};
                border: ${b.style === 'primary' ? 'none' : '1px solid #f1f5f9'};
            " onmouseover="this.style.transform='translateY(-2px) scale(1.01)'; if('${b.style}'==='primary') this.style.boxShadow='0 15px 30px -5px rgba(234, 88, 12, 0.5)';" onmouseout="this.style.transform='none'; if('${b.style}'==='primary') this.style.boxShadow='0 10px 20px -5px rgba(234, 88, 12, 0.3)';">
                ${b.text}
            </a>
        `).join('');

        modal.innerHTML = `
            <button onclick="this.closest('[id^=bn-popup-overlay]').style.opacity='0'; setTimeout(() => this.closest('[id^=bn-popup-overlay]').remove(), 500);" style="
                position: absolute; top: 20px; right: 20px; width: 40px; height: 40px;
                background: #fff; border: none; border-radius: 50%; cursor: pointer;
                box-shadow: 0 10px 20px rgba(0,0,0,0.1); z-index: 100;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='rotate(90deg) scale(1.1)'" onmouseout="this.style.transform='none'">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 1L1 13M1 1L13 13" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            ${imageHtml}
            <div style="padding: ${isMobile ? '30px 25px' : '45px 40px'};">
                <div style="color: #334155; font-size: 17px; font-weight: 500; line-height: 1.6; margin-bottom: 35px; text-align: ${pos === 'center' ? 'center' : 'left'};">
                    ${popup.content_html}
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${buttonsHtml}
                </div>
            </div>
            <div style="padding: 15px; text-align: center; border-top: 1px solid #f8fafc;">
                 <span style="font-size: 9px; font-weight: 900; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.2em;">BUKVA NEWS • ОПЕРАТИВНО</span>
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
