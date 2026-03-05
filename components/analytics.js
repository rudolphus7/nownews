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
    activeTextEvent: null,
    activeVoiceEvent: null,
    textInterval: null,
    voiceInterval: null,

    /**
     * Start tracking time spent on a TEXT article
     */
    startTextTracking: async function (articleId, supabaseClient) {
        if (!articleId || !supabaseClient) return;

        // Clear any previous interval
        this.stopTextTracking();

        console.log("Analytics: Starting TEXT tracking for", articleId);

        try {
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
                let duration = 0;

                // Update duration every 5 seconds
                this.textInterval = setInterval(async () => {
                    duration += 5;
                    await supabaseClient
                        .from('analytics_events')
                        .update({ duration_seconds: duration })
                        .eq('id', this.activeTextEvent);
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
        this.activeTextEvent = null;
    },

    /**
     * Start tracking time spent listening to a VOICE article (Live Center)
     */
    startVoiceTracking: async function (trackId, supabaseClient) {
        if (!trackId || !supabaseClient) return;

        // Clear any previous
        this.stopVoiceTracking();

        console.log("Analytics: Starting VOICE tracking for", trackId);

        try {
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
                let duration = 0;

                // Update duration every 3 seconds while playing
                this.voiceInterval = setInterval(async () => {
                    duration += 3;
                    await supabaseClient
                        .from('analytics_events')
                        .update({ duration_seconds: duration })
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
        this.activeVoiceEvent = null;
    }
};

// Stop all tracking if the user leaves the tab/window
window.addEventListener('beforeunload', () => {
    window.BukvaAnalytics.stopTextTracking();
    window.BukvaAnalytics.stopVoiceTracking();
});
