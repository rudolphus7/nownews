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

        // 1. Create Overlay
        const overlay = document.createElement('div');
        overlay.id = `bn-popup-overlay-${popup.id}`;
        overlay.style = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(8px);
            opacity: 0; transition: opacity 0.5s ease;
            display: flex; align-items: ${pos === 'center' ? 'center' : (pos === 'bottom' ? 'flex-end' : 'center')};
            justify-content: ${pos === 'center' ? 'center' : (pos === 'bottom-right' ? 'flex-end' : 'center')};
            padding: 20px;
        `;

        // 2. Create Modal
        const modal = document.createElement('div');
        modal.id = `bn-popup-${popup.id}`;
        const modalStyle = pos === 'center' 
            ? 'max-width: 500px; width: 100%; transform: scale(0.9);'
            : (pos === 'bottom-right' ? 'max-width: 400px; width: 100%; transform: translateY(40px);' : 'max-width: 100%; width: 100%; transform: translateY(100%);');

        modal.style = `
            background: #fff; border-radius: 2rem; overflow: hidden;
            box-shadow: 0 40px 80px rgba(0,0,0,0.4);
            transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
            position: relative;
            ${modalStyle}
        `;

        const imageHtml = popup.image_url ? `
            <div style="width: 100%; height: 220px; background: url('${popup.image_url}') center/cover no-repeat;"></div>
        ` : '';

        const buttonsHtml = popup.config.buttons.map(b => `
            <a href="${b.link}" target="_blank" style="
                display: block; width: 100%; padding: 16px;
                background: ${b.style === 'primary' ? '#ea580c' : '#f1f5f9'};
                color: ${b.style === 'primary' ? '#fff' : '#475569'};
                text-align: center; text-decoration: none;
                font-family: 'Inter', sans-serif; font-weight: 900;
                text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px;
                border-radius: 1rem; margin-top: 10px;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                ${b.text}
            </a>
        `).join('');

        modal.innerHTML = `
            <button onclick="this.closest('[id^=bn-popup-overlay]').remove()" style="
                position: absolute; top: 15px; right: 15px; width: 32px; height: 32px;
                background: #fff; border: none; border-radius: 50%; cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10;
                font-size: 20px; font-weight: bold; color: #64748b;
            ">&times;</button>
            ${imageHtml}
            <div style="padding: 35px; font-family: 'Inter', sans-serif;">
                <div style="color: #1e293b; font-size: 16px; font-weight: 500; line-height: 1.6; margin-bottom: 25px;">
                    ${popup.content_html}
                </div>
                ${buttonsHtml}
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            modal.style.transform = pos === 'center' ? 'scale(1)' : 'translate(0)';
        }, 10);

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
