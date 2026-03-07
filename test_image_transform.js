
function optimizeImage(url, width = 800, quality = 80) {
    if (!url) return '';
    const q = width <= 480 ? 50 : (width <= 800 ? 65 : quality);

    // 1. Supabase Storage URLs
    if (url.includes('/storage/v1/object/public/')) {
        return url.replace(
            '/storage/v1/object/public/',
            `/storage/v1/render/image/public/`
        ) + `?width=${width}&quality=${q}&format=webp`;
    }

    // 2. External URLs (Proxy via wsrv.nl)
    if (url.startsWith('http')) {
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${q}&output=webp`;
    }

    return url;
}

const testUrl = "https://i.postimg.cc/HL6Ggbq5/1695897596-5d80c02e93bf76feda54-large.jpg";
console.log("Original URL:", testUrl);
console.log("Optimized Mobile (400px):", optimizeImage(testUrl, 400));
console.log("Optimized Tablet (800px):", optimizeImage(testUrl, 800));

const supabaseUrl = "https://kgrxlznhimwuvwhjfzhv.supabase.co/storage/v1/object/public/news/image.jpg";
console.log("\nSupabase URL:", supabaseUrl);
console.log("Optimized Supabase:", optimizeImage(supabaseUrl, 600));
