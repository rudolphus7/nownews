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
        /Applebot/i, /Sogou/i, /Exabot/i, /ia_archiver/i,
        /GPTBot/i, /ChatGPT-User/i, /ClaudeBot/i, /Claude-Web/i, /Google-Safety/i,
        /ByteSpider/i, /YisouSpider/i, /PetalBot/i, /SemrushBot/i, /AhrefsBot/i,
        /MJ12bot/i, /DotBot/i, /AdsBot-Google/i, /Mediapartners-Google/i,
        /Google-InspectionTool/i, /GoogleOther/i, /bingbot/i, /Amazonbot/i, /YandexBot/i
    ];

    const isBotMatch = botPatterns.some(pattern => pattern.test(ua));

    // Additional check: bots often don't have certain window properties
    // or set specific navigator flags
    const isWebdriver = navigator.webdriver;
    const isHeadless = /HeadlessChrome/i.test(ua);

    if (isBotMatch || isWebdriver || isHeadless) {
        console.log('Bot detected:', ua);
        return true;
    }

    return false;
}

// Export if in environment that supports it, or just keep as global
window.isBot = isBot;
