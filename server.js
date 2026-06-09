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
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ─── Configuration ───
const PORT = process.argv[2] || process.env.PORT || 3002;
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const GIT_TIMEOUT = 45000;
const REMOTE_VERSION_URL = 'https://raw.githubusercontent.com/logdns/IdentityGen/main/VERSION';

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

// ─── Version Helpers ───
function cleanOutput(value) {
    return String(value || '').trim();
}

function safeRemoteUrl(remoteUrl) {
    const value = cleanOutput(remoteUrl);
    if (!value) return '';

    try {
        const parsed = new URL(value);
        parsed.username = '';
        parsed.password = '';
        return parsed.toString();
    } catch (e) {
        return value.replace(/^(https?:\/\/)[^/@]+@/i, '$1');
    }
}

function formatVersion(value) {
    const version = cleanOutput(value).replace(/^v/i, '');
    return version ? `v${version}` : '';
}

function parseVersion(value) {
    const version = cleanOutput(value).replace(/^v/i, '');
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!match) return null;
    return match.slice(1).map(n => parseInt(n, 10));
}

function isNewerVersion(latest, current) {
    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);
    if (!latestParts || !currentParts) return Boolean(latest && current && latest !== current);

    for (let i = 0; i < latestParts.length; i += 1) {
        if (latestParts[i] > currentParts[i]) return true;
        if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
}

function readLocalVersion() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            return formatVersion(fs.readFileSync(VERSION_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Version read error:', e.message);
    }
    return '';
}

function fetchText(remoteUrl, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(remoteUrl, {
            headers: {
                'User-Agent': 'IdentityGen-Version-Check'
            },
            timeout
        }, res => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                body += chunk;
                if (body.length > 1024) req.destroy(new Error('Response too large'));
            });
            res.on('end', () => resolve(body));
        });

        req.on('timeout', () => req.destroy(new Error('Request timed out')));
        req.on('error', reject);
    });
}

async function fetchRemoteVersionFile() {
    const version = await fetchText(REMOTE_VERSION_URL);
    return formatVersion(version);
}

async function runGit(args, options = {}) {
    try {
        const result = await execFileAsync('git', args, {
            cwd: ROOT,
            timeout: options.timeout || GIT_TIMEOUT,
            maxBuffer: 1024 * 1024
        });
        return cleanOutput(result.stdout);
    } catch (e) {
        const message = cleanOutput(e.stderr) || cleanOutput(e.stdout) || e.message || 'Git command failed';
        const err = new Error(message);
        err.code = e.code;
        throw err;
    }
}

async function tryGit(args, fallback = '') {
    try {
        return await runGit(args);
    } catch (e) {
        return fallback;
    }
}

async function getGitTagVersion(ref) {
    const tag = await tryGit(['describe', '--tags', '--abbrev=0', ref]);
    return formatVersion(tag);
}

async function getRemoteFileVersion(ref) {
    if (!ref) return '';
    const version = await tryGit(['show', `${ref}:VERSION`]);
    return formatVersion(version);
}

async function getVersionInfo(options = {}) {
    const localVersion = readLocalVersion();
    const insideWorkTree = await tryGit(['rev-parse', '--is-inside-work-tree']);
    if (insideWorkTree !== 'true') {
        let latestVersion = '';
        let fetch_error = '';
        if (options.fetch) {
            try {
                latestVersion = await fetchRemoteVersionFile();
            } catch (e) {
                fetch_error = e.message;
            }
        }

        return {
            git_available: false,
            update_available: isNewerVersion(latestVersion, localVersion),
            can_update: false,
            state: 'no_git',
            branch: '',
            upstream: '',
            has_upstream: false,
            remote_url: 'https://github.com/logdns/IdentityGen',
            ahead: 0,
            behind: 0,
            fetch_error,
            current_version: localVersion,
            latest_version: latestVersion,
            version_update_available: isNewerVersion(latestVersion, localVersion),
            current: {
                version: localVersion,
                hash: '',
                short: '',
                date: '',
                subject: localVersion ? '本地 VERSION 文件' : ''
            },
            latest: latestVersion ? {
                version: latestVersion,
                hash: '',
                short: '',
                date: '',
                subject: 'GitHub VERSION 文件'
            } : null,
            message: fetch_error
                ? `当前目录不是 Git 仓库，且检查 GitHub VERSION 失败：${fetch_error}`
                : localVersion
                ? '当前目录不是 Git 仓库，无法自动检查和更新版本'
                : '当前目录不是 Git 仓库，且未找到 VERSION 文件'
        };
    }

    const branch = await tryGit(['branch', '--show-current']);
    const configuredUpstream = await tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    const upstream = configuredUpstream || (branch ? `origin/${branch}` : '');
    const remoteName = upstream ? upstream.split('/')[0] : 'origin';
    let fetch_error = '';

    if (options.fetch && remoteName) {
        try {
            await runGit(['fetch', '--quiet', '--prune', remoteName], { timeout: 90000 });
        } catch (e) {
            fetch_error = e.message;
        }
    }

    const hash = await tryGit(['rev-parse', 'HEAD']);
    const date = await tryGit(['log', '-1', '--format=%cI']);
    const subject = await tryGit(['log', '-1', '--format=%s']);
    const remoteUrl = await tryGit(['config', '--get', `remote.${remoteName}.url`]);
    const remoteHash = upstream ? await tryGit(['rev-parse', upstream]) : '';
    const remoteDate = remoteHash ? await tryGit(['log', '-1', '--format=%cI', upstream]) : '';
    const remoteSubject = remoteHash ? await tryGit(['log', '-1', '--format=%s', upstream]) : '';
    const currentVersion = localVersion || await getGitTagVersion('HEAD') || (hash ? `commit-${hash.slice(0, 7)}` : '');
    const latestVersion = remoteHash
        ? (await getRemoteFileVersion(upstream) || await getGitTagVersion(upstream) || `commit-${remoteHash.slice(0, 7)}`)
        : '';

    let ahead = 0;
    let behind = 0;
    if (remoteHash) {
        const counts = await tryGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
        const parts = counts.split(/\s+/).map(n => parseInt(n, 10));
        ahead = Number.isFinite(parts[0]) ? parts[0] : 0;
        behind = Number.isFinite(parts[1]) ? parts[1] : 0;
    }

    let state = 'unknown';
    if (!remoteHash) state = 'no_remote';
    else if (ahead > 0 && behind > 0) state = 'diverged';
    else if (behind > 0) state = 'outdated';
    else if (ahead > 0) state = 'ahead';
    else state = 'up_to_date';

    return {
        git_available: true,
        update_available: behind > 0,
        can_update: state === 'outdated',
        state,
        branch: branch || 'HEAD',
        upstream,
        has_upstream: Boolean(configuredUpstream),
        remote_url: safeRemoteUrl(remoteUrl),
        ahead,
        behind,
        fetch_error,
        current_version: currentVersion,
        latest_version: latestVersion,
        version_update_available: isNewerVersion(latestVersion, currentVersion),
        current: {
            version: currentVersion,
            hash,
            short: hash ? hash.slice(0, 7) : '',
            date,
            subject
        },
        latest: remoteHash ? {
            version: latestVersion,
            hash: remoteHash,
            short: remoteHash.slice(0, 7),
            date: remoteDate,
            subject: remoteSubject
        } : null
    };
}

async function updateVersion() {
    const before = await getVersionInfo({ fetch: true });

    if (!before.git_available) {
        return { ok: false, statusCode: 400, message: before.message, data: before };
    }
    if (before.fetch_error) {
        return { ok: false, statusCode: 502, message: `检查远端版本失败：${before.fetch_error}`, data: before };
    }
    if (!before.update_available) {
        return { ok: true, message: '当前已是最新版本', data: before };
    }
    if (!before.can_update) {
        return {
            ok: false,
            statusCode: 409,
            message: '当前分支与远端存在本地提交或分叉，不能自动更新。请先手动处理 Git 状态。',
            data: before
        };
    }

    const dirty = await tryGit(['status', '--porcelain']);
    if (dirty) {
        return {
            ok: false,
            statusCode: 409,
            message: '检测到本地代码有未提交修改，已停止自动更新，避免覆盖本地改动。',
            data: before
        };
    }

    const pullArgs = before.has_upstream ? ['pull', '--ff-only'] : ['pull', '--ff-only', 'origin', before.branch];
    try {
        const output = await runGit(pullArgs, { timeout: 120000 });
        const after = await getVersionInfo();
        after.update_output = output;
        return { ok: true, message: '版本已更新，请按需重启服务使服务端代码生效。', data: after };
    } catch (e) {
        return { ok: false, statusCode: 500, message: `更新失败：${e.message}`, data: before };
    }
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

        // ── Version status/check/update ──
        if (action === 'version' || action === 'checkversion' || action === 'updateversion') {
            const config = readConfig();
            if (input.password !== (config.password || 'admin')) {
                return sendJSON(res, 401, {
                    status: 'error',
                    message: '认证失败'
                });
            }

            if (action === 'updateversion') {
                const result = await updateVersion();
                return sendJSON(res, result.ok ? 200 : (result.statusCode || 500), {
                    status: result.ok ? 'ok' : 'error',
                    message: result.message,
                    data: result.data
                });
            }

            const data = await getVersionInfo({ fetch: action === 'checkversion' });
            return sendJSON(res, 200, {
                status: data.fetch_error ? 'error' : 'ok',
                message: data.fetch_error ? `检查远端版本失败：${data.fetch_error}` : '',
                data
            });
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
