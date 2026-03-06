const handler = require('./api/sitemap.js');

const req = {
    query: { type: 'posts' }
};

const res = {
    setHeader: (name, value) => {
        console.log(`[Header] ${name}: ${value}`);
    },
    status: (code) => {
        console.log(`[Status] ${code}`);
        return res;
    },
    send: (content) => {
        console.log(`[Content Length] ${content.length}`);
        console.log(`[Sample Content]`, content.substring(0, 500) + '...\n\n...' + content.substring(content.length - 150));
    }
};

console.log("Starting sitemap test...");
handler(req, res).then(() => {
    console.log("Done");
}).catch(e => {
    console.error("Error running handler:", e);
});
