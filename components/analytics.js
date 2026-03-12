/**
 * BUKVA NEWS Analytics Module v2.1
 * Tracks: text reading, voice listening, device type, geo city, scroll depth, audio completion
 * Optimized for accuracy: Bot-filtering, deduplication, and visibility awareness.
 */

(function() {
    // ── Session & Identity ───────────────────────────────────────────────────
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
    const DEVICE_TYPE = (function() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
        if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
        if (window.innerWidth <= 768) return 'mobile';
        return 'desktop';
    })();

    // ── Pre-flight Checks ─────────────────────────────────────────────────────
    const isBot = () => {
        if (window.isBot && typeof window.isBot === 'function') {
            return window.isBot();
        }
        // Fallback simple check if bot-detection.js isn't ready
        return /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent) || navigator.webdriver;
    };

    // ── Geo-Location Service ──────────────────────────────────────────────────
    let GEO_CITY = sessionStorage.getItem('bukva_geo_city') || '';
    let isDetectingGeo = false;

    const detectGeo = async () => {
        if (GEO_CITY || isDetectingGeo) return;
        isDetectingGeo = true;
        
        const services = [
            'https://ipapi.co/json/',
            'https://ipwho.is/',
            'https://get.geojs.io/v1/ip/geo.json'
        ];

        for (const url of services) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                const d = await r.json();
                const city = d.city || d.region || d.region_name || '';
                if (city) {
                    GEO_CITY = city;
                    sessionStorage.setItem('bukva_geo_city', GEO_CITY);
                    console.log('Analytics: Geo detected ->', GEO_CITY);
                    break;
                }
            } catch (e) {
                // Silently try next service
            }
        }
        isDetectingGeo = false;
    };

    // Start detection immediately
    detectGeo();

    // ── Main Controller ───────────────────────────────────────────────────────
    window.BukvaAnalytics = {
        sessionId: SESSION_ID,
        deviceType: DEVICE_TYPE,

        // Monitoring State
        currentTextId: null,
        activeTextRow: null,
        textDuration: 0,
        textTimer: null,
        maxScroll: 0,
        _scrollFn: null,

        currentVoiceId: null,
        activeVoiceRow: null,
        voiceDuration: 0,
        voiceTimer: null,
        _audioEl: null,

        // ── TEXT TRACKING ─────────────────────────────────────────────────────
        startTextTracking: async function (articleId, supabase) {
            if (!articleId || !supabase || isBot()) return;
            
            // Avoid re-tracking the same article in the same session instance
            if (this.currentTextId === articleId.toString()) return;
            
            this.stopTextTracking();
            this.currentTextId = articleId.toString();

            // Wait briefly for geo if not ready (non-blocking after 1s)
            if (!GEO_CITY) {
                let attempts = 0;
                while (!GEO_CITY && attempts < 10) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
            }

            const storageKey = `tracked_text_${articleId}`;
            const existingId = localStorage.getItem(storageKey);

            try {
                if (existingId) {
                    // We already have a row for this article in this browser's life
                    // We can choose to update the existing row or just stop.
                    // To keep "Unique Views" accurate, we don't insert a new one.
                    this.activeTextRow = existingId;
                } else {
                    const { data, error } = await supabase
                        .from('analytics_events')
                        .insert([{
                            session_id: SESSION_ID,
                            event_type: 'text_news_view',
                            target_id: articleId.toString(),
                            duration_seconds: 0,
                            device_type: DEVICE_TYPE,
                            geo_city: GEO_CITY || 'Unknown',
                            scroll_depth: 0,
                            completion_pct: 0
                        }])
                        .select('id')
                        .single();

                    if (data && !error) {
                        this.activeTextRow = data.id;
                        localStorage.setItem(storageKey, data.id);
                    }
                }

                if (this.activeTextRow) {
                    this._initScrollWatcher();
                    this.textTimer = setInterval(() => this._pulseText(supabase), 5000);
                }
            } catch (err) {
                console.warn('Analytics: Text entry failed', err);
            }
        },

        _pulseText: async function(supabase) {
            if (document.visibilityState !== 'visible' || !this.activeTextRow) return;
            this.textDuration += 5;
            try {
                await supabase
                    .from('analytics_events')
                    .update({ 
                        duration_seconds: this.textDuration, 
                        scroll_depth: this.maxScroll 
                    })
                    .eq('id', this.activeTextRow);
            } catch (e) {}
        },

        _initScrollWatcher: function() {
            if (this._scrollFn) window.removeEventListener('scroll', this._scrollFn);
            
            this._scrollFn = () => {
                const doc = document.documentElement;
                const winH = window.innerHeight;
                const scrollT = window.scrollY || doc.scrollTop;
                
                // Target article content for better accuracy
                const content = document.getElementById('news-content') || document.getElementById('news-text') || doc;
                const rect = content.getBoundingClientRect();
                
                let pct = 0;
                if (content === doc) {
                    const total = doc.scrollHeight - winH;
                    if (total > 0) pct = Math.round((scrollT / total) * 100);
                } else {
                    const top = rect.top + scrollT;
                    const height = rect.height;
                    const pos = scrollT + winH;
                    pct = Math.round(((pos - top) / height) * 100);
                }

                this.maxScroll = Math.max(this.maxScroll, Math.min(Math.round(pct), 100));
            };
            window.addEventListener('scroll', this._scrollFn, { passive: true });
        },

        stopTextTracking: function() {
            if (this.textTimer) { clearInterval(this.textTimer); this.textTimer = null; }
            if (this._scrollFn) { window.removeEventListener('scroll', this._scrollFn); this._scrollFn = null; }
            this.currentTextId = null;
            this.activeTextRow = null;
            this.textDuration = 0;
            this.maxScroll = 0;
        },

        // ── VOICE TRACKING ────────────────────────────────────────────────────
        startVoiceTracking: async function (trackId, supabase, audioEl) {
            if (!trackId || !supabase || isBot()) return;
            
            this.stopVoiceTracking(false, supabase);
            this.currentVoiceId = trackId.toString();
            this._audioEl = audioEl || null;

            const storageKey = `tracked_voice_${trackId}`;
            const existingId = localStorage.getItem(storageKey);

            try {
                if (existingId) {
                    this.activeVoiceRow = existingId;
                } else {
                    const { data, error } = await supabase
                        .from('analytics_events')
                        .insert([{
                            session_id: SESSION_ID,
                            event_type: 'voice_news_listen',
                            target_id: trackId.toString(),
                            duration_seconds: 0,
                            device_type: DEVICE_TYPE,
                            geo_city: GEO_CITY || 'Unknown',
                            scroll_depth: 0,
                            completion_pct: 0
                        }])
                        .select('id')
                        .single();

                    if (data && !error) {
                        this.activeVoiceRow = data.id;
                        localStorage.setItem(storageKey, data.id);
                    }
                }

                if (this.activeVoiceRow) {
                    this.voiceTimer = setInterval(() => this._pulseVoice(supabase), 3000);
                }
            } catch (err) {
                console.warn('Analytics: Voice entry failed', err);
            }
        },

        _pulseVoice: async function(supabase) {
            if (!this.activeVoiceRow) return;
            this.voiceDuration += 3;
            try {
                await supabase
                    .from('analytics_events')
                    .update({ duration_seconds: this.voiceDuration })
                    .eq('id', this.activeVoiceRow);
            } catch (e) {}
        },

        stopVoiceTracking: async function (isEnd, supabase) {
            if (this.voiceTimer) { clearInterval(this.voiceTimer); this.voiceTimer = null; }

            if (this.activeVoiceRow && supabase) {
                let completion = 0;
                if (isEnd === true) {
                    completion = 100;
                } else if (this._audioEl && this._audioEl.duration > 0) {
                    completion = Math.round((this._audioEl.currentTime / this._audioEl.duration) * 100);
                }
                
                try {
                    await supabase
                        .from('analytics_events')
                        .update({ completion_pct: Math.min(completion, 100) })
                        .eq('id', this.activeVoiceRow);
                } catch (e) {}
            }

            this.currentVoiceId = null;
            this.activeVoiceRow = null;
            this.voiceDuration = 0;
            this._audioEl = null;
        }
    };

    // Global cleanup
    window.addEventListener('beforeunload', () => {
        if (window.BukvaAnalytics) {
            window.BukvaAnalytics.stopTextTracking();
            // We can't reliably update completion_pct in beforeunload due to networking limits,
            // but the last pulse will have recorded the duration.
        }
    });

})();

