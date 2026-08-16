/* 本地静态服务器：把 dist/ 按 Capacitor 本地服务器方式提供（用于 headless 验证 ESM/importmap 管线）。
   用法: node scripts/serve-dist.cjs <port> */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'dist');
const port = +(process.argv[2] || 8399);
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.map': 'application/json',
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + rel); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
    });
}).listen(port, () => console.log(`serving ${ROOT} at http://127.0.0.1:${port}`));
