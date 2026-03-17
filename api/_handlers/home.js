const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    let htmlContent = '';
    try {
        const templatePath = path.join(process.cwd(), 'main_template.html');
        if (fs.existsSync(templatePath)) {
            htmlContent = fs.readFileSync(templatePath, 'utf8');
        } else {
            // Fallback during transition
            const indexPath = path.join(process.cwd(), 'index.html');
            if (fs.existsSync(indexPath)) {
                htmlContent = fs.readFileSync(indexPath, 'utf8');
            } else {
                throw new Error('main_template.html not found');
            }
        }
    } catch (e) {
        console.error('Home Handler Error:', e);
        return res.status(500).send('Internal Server Error');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(htmlContent);
};
