const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_PATH || path.join(__dirname, 'data', 'userdata.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');


function loadData() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) { return {}; }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const MIME = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webp': 'image/webp',
};

http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // API: GET user data
    if (req.method === 'GET' && pathname.startsWith('/api/data/')) {
        const username = pathname.split('/')[3]?.toLowerCase();
        if (!username) { res.writeHead(400); res.end('{}'); return; }
        const data = loadData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data[username] || {}));
        return;
    }

    // API: POST save user data
    if (req.method === 'POST' && pathname.startsWith('/api/data/')) {
        const username = pathname.split('/')[3]?.toLowerCase();
        if (!username) { res.writeHead(400); res.end(); return; }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const userData = JSON.parse(body);
                const data = loadData();
                data[username] = userData;
                saveData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"ok":true}');
            } catch(e) {
                res.writeHead(500); res.end('{"ok":false}');
            }
        });
        return;
    }

    // API: POST transfer between users
    if (req.method === 'POST' && pathname === '/api/transfer') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { from, to, currency, amount } = JSON.parse(body);
                const amt = parseFloat(amount);
                if (!from || !to || !currency || !amt || amt <= 0 || from === to) {
                    res.writeHead(400); res.end('{"ok":false,"error":"invalid"}'); return;
                }
                const data = loadData();
                const fromData = data[from] || { wallets: {} };
                const toData   = data[to]   || { wallets: {}, expenses: [], mainCurrency: 'TND' };
                fromData.wallets = fromData.wallets || {};
                toData.wallets   = toData.wallets   || {};
                const fromBal = fromData.wallets[currency] || 0;
                if (fromBal < amt - 0.001) {
                    res.writeHead(400); res.end('{"ok":false,"error":"insufficient"}'); return;
                }
                fromData.wallets[currency] = fromBal - amt;
                if (fromData.wallets[currency] <= 0.001) delete fromData.wallets[currency];
                toData.wallets[currency] = (toData.wallets[currency] || 0) + amt;

                // Save transfer history for both users
                const ts = Date.now();
                fromData.transfers = fromData.transfers || [];
                toData.transfers   = toData.transfers   || [];
                fromData.transfers.unshift({ ts, amount: amt, currency, direction: 'sent',     other: to });
                toData.transfers.unshift(  { ts, amount: amt, currency, direction: 'received', other: from });
                // Keep last 50 entries
                if (fromData.transfers.length > 50) fromData.transfers.length = 50;
                if (toData.transfers.length   > 50) toData.transfers.length   = 50;

                data[from] = fromData;
                data[to]   = toData;
                saveData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch(e) {
                res.writeHead(500); res.end('{"ok":false}');
            }
        });
        return;
    }

    // Static files
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
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

}).listen(PORT, '0.0.0.0', () => console.log(`Yoyo Pocket on port ${PORT} 🪙`));
