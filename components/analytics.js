/**
 * BUKVA NEWS Analytics Module
 * Handles session generation and tracking text/voice news consumption.
 */

// 1. Session Management
function getOrCreateSessionId() {
    let sessionId = localStorage.getItem('bukva_session_id');
    if (!sessionId) {
        // Generate a random unique ID for the session/user
        sessionId = crypto.randomUUID ? crypto.randomUUID() : 'session_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('bukva_session_id', sessionId);
    }
    return sessionId;
}

const SESSION_ID = getOrCreateSessionId();

window.BukvaAnalytics = {
    sessionId: SESSION_ID,

    // Text State
    currentTextArticleId: null,
    activeTextEvent: null,
    textDuration: 0,
    textInterval: null,

    // Voice State
    currentVoiceTrackId: null,
    activeVoiceEvent: null,
    voiceDuration: 0,
    voiceInterval: null,

    /**
     * Start tracking time spent on a TEXT article
     */
    startTextTracking: async function (articleId, supabaseClient) {
        if (!articleId || !supabaseClient) return;

        // Clear any previous interval
        this.stopTextTracking();

        if (this.currentTextArticleId !== articleId.toString()) {
            this.currentTextArticleId = articleId.toString();
            this.activeTextEvent = null;
            this.textDuration = 0;
        }

        console.log("Analytics: Starting/Resuming TEXT tracking for", articleId);

        try {
            if (!this.activeTextEvent) {
                // Create an initial record
                const { data, error } = await supabaseClient
                    .from('analytics_events')
                    .insert([{
                        session_id: this.sessionId,
                        event_type: 'text_news_view',
                        target_id: articleId.toString(),
                        duration_seconds: 0
                    }])
                    .select('id')
                    .single();

                if (data && !error) {
                    this.activeTextEvent = data.id;
                    this.textDuration = 0;
                }
            }

            if (this.activeTextEvent) {
                // Update duration every 5 seconds
                this.textInterval = setInterval(async () => {
                    // Only count time if tab is visible and voice isn't playing
                    if (document.visibilityState === 'visible') {
                        this.textDuration += 5;
                        await supabaseClient
                            .from('analytics_events')
                            .update({ duration_seconds: this.textDuration })
                            .eq('id', this.activeTextEvent);
                    }
                }, 5000);
            }
        } catch (e) {
            console.error("Analytics error (text tracking):", e);
        }
    },

    stopTextTracking: function () {
        if (this.textInterval) {
            clearInterval(this.textInterval);
            this.textInterval = null;
        }
    },

    /**
     * Start tracking time spent listening to a VOICE article (Live Center)
     */
    startVoiceTracking: async function (trackId, supabaseClient) {
        if (!trackId || !supabaseClient) return;

        // Clear any previous
        this.stopVoiceTracking();

        if (this.currentVoiceTrackId !== trackId.toString()) {
            this.currentVoiceTrackId = trackId.toString();
            this.activeVoiceEvent = null;
            this.voiceDuration = 0;
        }

        console.log("Analytics: Starting/Resuming VOICE tracking for", trackId);

        try {
            if (!this.activeVoiceEvent) {
                const { data, error } = await supabaseClient
                    .from('analytics_events')
                    .insert([{
                        session_id: this.sessionId,
                        event_type: 'voice_news_listen',
                        target_id: trackId.toString(),
                        duration_seconds: 0
                    }])
                    .select('id')
                    .single();

                if (data && !error) {
                    this.activeVoiceEvent = data.id;
                    this.voiceDuration = 0;
                }
            }

            if (this.activeVoiceEvent) {
                // Update duration every 3 seconds while playing
                this.voiceInterval = setInterval(async () => {
                    this.voiceDuration += 3;
                    await supabaseClient
                        .from('analytics_events')
                        .update({ duration_seconds: this.voiceDuration })
                        .eq('id', this.activeVoiceEvent);
                }, 3000);
            }
        } catch (e) {
            console.error("Analytics error (voice tracking):", e);
        }
    },

    stopVoiceTracking: function () {
        if (this.voiceInterval) {
            clearInterval(this.voiceInterval);
            this.voiceInterval = null;
        }
    }
};

// Stop all tracking if the user leaves the tab/window
window.addEventListener('beforeunload', () => {
    window.BukvaAnalytics.stopTextTracking();
    window.BukvaAnalytics.stopVoiceTracking();
});

// Pause text tracking when the user switches tabs or minimizes the window
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Technically it's paused by the interval check, but we could explicitly stop it here if we wanted
    } else if (document.visibilityState === 'visible') {
        // We rely on the interval check to resume counting when visible
    }
});
