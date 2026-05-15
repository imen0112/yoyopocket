const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
};

http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data2);
            });
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
    });
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Yoyo Pocket on port ${PORT} 🪙`);
});
