/**
 * IdentityGen — Lightweight Server
 * 
 * Zero-dependency Node.js server:
 *   - Serves static files (HTML, CSS, JS, images)
 *   - Provides config API (read/write config.json)
 * 
 * Usage:
 *   node server.js              → starts on port 3002
 *   node server.js 8080         → starts on port 8080
 *   PORT=8080 node server.js    → starts on port 8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ─── Configuration ───
const PORT = process.argv[2] || process.env.PORT || 3002;
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');

// ─── MIME Types ───
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
};

// ─── Config Helpers ───
const DEFAULT_CONFIG = {
    password: 'admin',
    map_provider: 'osm',
    google_maps_key: '',
    site_title: '',
    site_footer: ''
};

function readConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 4), 'utf8');
            return { ...DEFAULT_CONFIG };
        }
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...config };
    } catch (e) {
        console.error('Config read error:', e.message);
        return { ...DEFAULT_CONFIG };
    }
}

function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4), 'utf8');
        return true;
    } catch (e) {
        console.error('Config write error:', e.message);
        return false;
    }
}

function getPublicConfig(config) {
    return {
        map_provider: config.map_provider || 'osm',
        google_maps_key: config.google_maps_key || '',
        site_title: config.site_title || '',
        site_footer: config.site_footer || ''
    };
}

// ─── HTTP Helpers ───
function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache'
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// ─── API Handler ───
async function handleAPI(req, res, parsedUrl) {
    const action = parsedUrl.query ? new URLSearchParams(parsedUrl.query).get('action') || '' : '';

    // OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
        return sendJSON(res, 204, null);
    }

    // GET — Read public config (password excluded)
    if (req.method === 'GET' && !action) {
        const config = readConfig();
        return sendJSON(res, 200, {
            status: 'ok',
            data: getPublicConfig(config)
        });
    }

    // POST requests
    if (req.method === 'POST') {
        const input = await readBody(req);

        // ── Login: verify password ──
        if (action === 'login') {
            const config = readConfig();
            if (input.password === (config.password || 'admin')) {
                return sendJSON(res, 200, {
                    status: 'ok',
                    data: getPublicConfig(config)
                });
            } else {
                return sendJSON(res, 401, {
                    status: 'error',
                    message: '密码错误'
                });
            }
        }

        // ── Change password ──
        if (action === 'changepwd') {
            const config = readConfig();
            if (input.current_password !== (config.password || 'admin')) {
                return sendJSON(res, 401, {
                    status: 'error',
                    message: '当前密码错误'
                });
            }
            if (!input.new_password) {
                return sendJSON(res, 400, {
                    status: 'error',
                    message: '新密码不能为空'
                });
            }
            config.password = input.new_password;
            if (writeConfig(config)) {
                return sendJSON(res, 200, { status: 'ok', message: '密码已更新' });
            } else {
                return sendJSON(res, 500, { status: 'error', message: '写入配置文件失败' });
            }
        }

        // ── Save config ──
        if (action === 'save') {
            const config = readConfig();
            if (input.password !== (config.password || 'admin')) {
                return sendJSON(res, 401, {
                    status: 'error',
                    message: '认证失败'
                });
            }
            const allowed = ['map_provider', 'google_maps_key', 'site_title', 'site_footer'];
            const data = input.data || {};
            for (const field of allowed) {
                if (field in data) {
                    config[field] = data[field];
                }
            }
            if (writeConfig(config)) {
                return sendJSON(res, 200, {
                    status: 'ok',
                    message: '配置已保存',
                    data: getPublicConfig(config)
                });
            } else {
                return sendJSON(res, 500, {
                    status: 'error',
                    message: '写入配置文件失败'
                });
            }
        }
    }

    return sendJSON(res, 400, { status: 'error', message: '无效的请求' });
}

// ─── Static File Handler ───
function serveStatic(req, res, filePath) {
    // Block direct access to config.json
    if (path.basename(filePath) === 'config.json') {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end('<h1>404 Not Found</h1>');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

// ─── Server ───
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // API route: /api or /api.php (compatible with PHP version)
    if (pathname === '/api' || pathname === '/api.php') {
        return handleAPI(req, res, parsedUrl);
    }

    // Static files
    if (pathname === '/') pathname = '/index.html';

    // Security: prevent directory traversal
    const filePath = path.join(ROOT, pathname);
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }

    serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║       ⚡ IdentityGen Server             ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║  🌐 http://localhost:${PORT}               ║`);
    console.log(`  ║  🔧 Admin: http://localhost:${PORT}/admin.html ║`);
    console.log('  ║  📋 Press Ctrl+C to stop                ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
});
