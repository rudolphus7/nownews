/**
 * BUKVA NEWS Analytics Module v2
 * Tracks: text reading, voice listening, device type, geo city, scroll depth, audio completion
 */

// ── Session Management ───────────────────────────────────────────────────────
function getOrCreateSessionId() {
    try {
        let sessionId = localStorage.getItem('bukva_session_id');
        if (!sessionId) {
            sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'session_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('bukva_session_id', sessionId);
        }
        return sessionId;
    } catch (e) {
        return 'session_temp_' + Date.now();
    }
}
const SESSION_ID = getOrCreateSessionId();

// ── Device Detection ─────────────────────────────────────────────────────────
function detectDevice() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
    if (window.innerWidth <= 768) return 'mobile';
    return 'desktop';
}
const DEVICE_TYPE = detectDevice();

// ── Geo City Detection (once per session, cached) ─────────────────────────────
let GEO_CITY = '';
try {
    GEO_CITY = sessionStorage.getItem('bukva_geo_city') || '';
    if (!GEO_CITY) {
        fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(d => {
                GEO_CITY = d.city || d.region || '';
                sessionStorage.setItem('bukva_geo_city', GEO_CITY);
            })
            .catch(() => { GEO_CITY = ''; });
    }
} catch (e) { GEO_CITY = ''; }

// ── Main Analytics Object ─────────────────────────────────────────────────────
window.BukvaAnalytics = {
    sessionId: SESSION_ID,
    deviceType: DEVICE_TYPE,

    // Text State
    currentTextArticleId: null,
    activeTextEvent: null,
    textDuration: 0,
    textInterval: null,
    scrollDepth: 0,
    _scrollHandler: null,

    // Voice State
    currentVoiceTrackId: null,
    activeVoiceEvent: null,
    voiceDuration: 0,
    voiceInterval: null,
    _currentAudioEl: null,

    // ── TEXT TRACKING ────────────────────────────────────────────────────────
    startTextTracking: async function (articleId, supabaseClient) {
        if (!articleId || !supabaseClient) return;
        this.stopTextTracking();

        if (this.currentTextArticleId !== articleId.toString()) {
            this.currentTextArticleId = articleId.toString();
            this.activeTextEvent = null;
            this.textDuration = 0;
            this.scrollDepth = 0;
        }

        console.log('Analytics: TEXT tracking for', articleId, '| device:', DEVICE_TYPE, '| city:', GEO_CITY || '?');

        try {
            if (!this.activeTextEvent) {
                const { data, error } = await supabaseClient
                    .from('analytics_events')
                    .insert([{
                        session_id: this.sessionId,
                        event_type: 'text_news_view',
                        target_id: articleId.toString(),
                        duration_seconds: 0,
                        device_type: DEVICE_TYPE,
                        geo_city: GEO_CITY,
                        scroll_depth: 0,
                        completion_pct: 0
                    }])
                    .select('id')
                    .single();

                if (data && !error) {
                    this.activeTextEvent = data.id;
                }
            }

            if (this.activeTextEvent) {
                // Scroll depth watcher
                this._startScrollTracking(supabaseClient);

                // Duration updater every 5 seconds (only when tab visible)
                this.textInterval = setInterval(async () => {
                    if (document.visibilityState !== 'visible') return;
                    this.textDuration += 5;
                    await supabaseClient
                        .from('analytics_events')
                        .update({ duration_seconds: this.textDuration, scroll_depth: this.scrollDepth })
                        .eq('id', this.activeTextEvent);
                }, 5000);
            }
        } catch (e) {
            console.error('Analytics error (text):', e);
        }
    },

    _startScrollTracking: function (supabaseClient) {
        if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler);
        this._scrollHandler = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;

            // Fix: Target the actual article content if it exists, otherwise fallback to document
            const targetEl = document.getElementById('news-content') || document.getElementById('news-text') || document.documentElement;
            const rect = targetEl.getBoundingClientRect();
            const winHeight = window.innerHeight;

            let pct = 0;
            if (targetEl === document.documentElement) {
                const docHeight = document.documentElement.scrollHeight - winHeight;
                if (docHeight > 0) pct = Math.round((scrollTop / docHeight) * 100);
            } else {
                // If we have a target element, 100% is when the BOTTOM of the element enters the viewport
                // or when we've scrolled past it.
                const elementTop = rect.top + scrollTop;
                const elementHeight = rect.height;
                const scrollPosition = scrollTop + winHeight;
                const offsetTop = elementTop;

                // percentage = (how much of the element we've seen) / (element height)
                // but we want 100% when the bottom of the article is visible.
                const seenHeight = Math.max(0, scrollPosition - offsetTop);
                pct = Math.round((seenHeight / elementHeight) * 100);
            }

            if (pct > this.scrollDepth) {
                this.scrollDepth = Math.min(pct, 100);
            }
        };
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
    },

    stopTextTracking: function () {
        if (this.textInterval) { clearInterval(this.textInterval); this.textInterval = null; }
        if (this._scrollHandler) { window.removeEventListener('scroll', this._scrollHandler); this._scrollHandler = null; }
    },

    // ── VOICE TRACKING ───────────────────────────────────────────────────────
    startVoiceTracking: async function (trackId, supabaseClient, audioElement) {
        if (!trackId || !supabaseClient) return;
        await this.stopVoiceTracking(false, supabaseClient);

        if (this.currentVoiceTrackId !== trackId.toString()) {
            this.currentVoiceTrackId = trackId.toString();
            this.activeVoiceEvent = null;
            this.voiceDuration = 0;
        }
        this._currentAudioEl = audioElement || null;

        console.log('Analytics: VOICE tracking for', trackId, '| device:', DEVICE_TYPE, '| city:', GEO_CITY || '?');

        try {
            if (!this.activeVoiceEvent) {
                const { data, error } = await supabaseClient
                    .from('analytics_events')
                    .insert([{
                        session_id: this.sessionId,
                        event_type: 'voice_news_listen',
                        target_id: trackId.toString(),
                        duration_seconds: 0,
                        device_type: DEVICE_TYPE,
                        geo_city: GEO_CITY,
                        scroll_depth: 0,
                        completion_pct: 0
                    }])
                    .select('id')
                    .single();

                if (data && !error) {
                    this.activeVoiceEvent = data.id;
                }
            }

            if (this.activeVoiceEvent) {
                this.voiceInterval = setInterval(async () => {
                    this.voiceDuration += 3;
                    await supabaseClient
                        .from('analytics_events')
                        .update({ duration_seconds: this.voiceDuration })
                        .eq('id', this.activeVoiceEvent);
                }, 3000);
            }
        } catch (e) {
            console.error('Analytics error (voice):', e);
        }
    },

    /**
     * Stop voice tracking and record completion %
     * @param {boolean} completed - true if audio ended naturally (played to end)
     * @param {object} supabaseClient
     */
    stopVoiceTracking: async function (completed, supabaseClient) {
        if (this.voiceInterval) { clearInterval(this.voiceInterval); this.voiceInterval = null; }

        // Record completion
        if (this.activeVoiceEvent && supabaseClient) {
            let pct = 0;
            if (completed === true) {
                pct = 100;
            } else if (this._currentAudioEl && this._currentAudioEl.duration > 0) {
                pct = Math.round((this._currentAudioEl.currentTime / this._currentAudioEl.duration) * 100);
                pct = Math.min(pct, 100);
            }
            try {
                await supabaseClient
                    .from('analytics_events')
                    .update({ completion_pct: pct })
                    .eq('id', this.activeVoiceEvent);
            } catch (e) { /* silent */ }
        }

        this.activeVoiceEvent = null; // Important: Clear the ID
        this._currentAudioEl = null;
    }
};

// Stop all tracking when leaving
window.addEventListener('beforeunload', () => {
    window.BukvaAnalytics.stopTextTracking();
    window.BukvaAnalytics.stopVoiceTracking(false, null);
});
