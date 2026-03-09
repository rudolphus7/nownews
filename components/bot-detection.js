/**
 * BUKVA NEWS Bot Detection Utility
 * Simple check for known bots, crawlers and search engine spiders
 */
function isBot() {
    const ua = navigator.userAgent;
    if (!ua) return false;

    const botPatterns = [
        /bot/i, /spider/i, /crawler/i, /google/i, /bing/i, /yandex/i, /slurp/i,
        /duckduckgo/i, /baidu/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
        /embedly/i, /quora\slink\spreview/i, /rogue/i, /showyoubot/i, /outbrain/i,
        /pinterest/i, /slackbot/i, /vkShare/i, /W3C_Validator/i, /redditbot/i,
        /Applebot/i, /Sogou/i, /Exabot/i, /ia_archiver/i
    ];

    const isBotMatch = botPatterns.some(pattern => pattern.test(ua));

    // Additional check: bots often don't have certain window properties
    const isWebdriver = navigator.webdriver;

    if (isBotMatch || isWebdriver) {
        console.log('Bot detected:', ua);
        return true;
    }

    return false;
}

// Export if in environment that supports it, or just keep as global
window.isBot = isBot;
