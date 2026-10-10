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
 *   HOST=0.0.0.0 node server.js → explicitly exposes all interfaces
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const crypto = require('crypto');
const net = require('net');
const { createBinLookup } = require('./bin-lookup');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ─── Configuration ───
const PORT = process.argv[2] || process.env.PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const GIT_TIMEOUT = 45000;
const MAX_BODY_SIZE = 256 * 1024;
const REMOTE_VERSION_URL = 'https://raw.githubusercontent.com/logdns/IdentityGen/main/VERSION';
const RESTART_DELAY_MS = 1200;

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
    site_footer: '',
    default_language: 'en',
    card_bin: { enabled: true, publishable_key: '', secret_key: '', binlist_fallback: true },
    ads: {
        head: { enabled: false, html: '' },
        top: { enabled: false, html: '' },
        inline: { enabled: false, html: '' },
        footer: { enabled: false, html: '' }
    },
    donation: {
        enabled: false,
        title: '',
        note: '',
        items: []
    }
};

const LANGS = new Set(['en', 'zh-CN', 'zh-TW', 'ja']);
const AD_SLOTS = ['head', 'top', 'inline', 'footer'];
const SESSIONS = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 6;
const LOGIN_ATTEMPTS = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const AD_STORAGE_PREFIX = 'identitygen-ad:v1:';

function createSession() {
    const token = crypto.randomBytes(24).toString('hex');
    SESSIONS.set(token, Date.now() + SESSION_TTL);
    return token;
}

function isAuthenticated(req, input, config) {
    const token = input.token || '';
    const expires = SESSIONS.get(token);
    if (expires && expires >= Date.now()) {
        SESSIONS.set(token, Date.now() + SESSION_TTL);
        return true;
    }
    if (token) SESSIONS.delete(token);
    // Compatibility credentials must share the same budget as the login route.
    if (!input.password || !canAttemptLogin(req)) return false;
    if (input.password === (config.password || 'admin')) {
        clearLoginFailures(req);
        return true;
    }
    recordLoginFailure(req);
    return false;
}

function getClientKey(req) {
    const peer = (req && req.socket && req.socket.remoteAddress) || 'unknown';
    const normalizedPeer = peer.startsWith('::ffff:') ? peer.slice(7) : peer;
    const isLoopbackPeer = normalizedPeer === '::1' || normalizedPeer.startsWith('127.');

    // Trust the documented Nginx X-Real-IP header only when the direct peer is
    // loopback. Direct clients cannot create arbitrary limiter identities.
    const forwarded = req && req.headers && req.headers['x-real-ip'];
    if (isLoopbackPeer && typeof forwarded === 'string') {
        const clientAddress = forwarded.trim();
        if (net.isIP(clientAddress)) return `proxy:${clientAddress}`;
    }

    return `socket:${peer}`;
}

function canAttemptLogin(req) {
    const now = Date.now();
    const key = getClientKey(req);
    const current = LOGIN_ATTEMPTS.get(key);
    if (!current || current.resetAt <= now) {
        LOGIN_ATTEMPTS.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
        return true;
    }
    return current.count < LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(req) {
    const now = Date.now();
    const key = getClientKey(req);
    const current = LOGIN_ATTEMPTS.get(key);
    if (!current || current.resetAt <= now) {
        LOGIN_ATTEMPTS.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
        current.count += 1;
    }
    if (LOGIN_ATTEMPTS.size > 10000) {
        for (const [entryKey, entry] of LOGIN_ATTEMPTS) {
            if (entry.resetAt <= now) LOGIN_ATTEMPTS.delete(entryKey);
        }
    }
}

function clearLoginFailures(req) {
    LOGIN_ATTEMPTS.delete(getClientKey(req));
}

function limitString(value, maxLength) {
    return String(value == null ? '' : value).slice(0, maxLength);
}

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function stripUnsafeHtml(value, maxLength = 5000) {
    return limitString(value, maxLength)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
        .replace(/\s(href|src)\s*=\s*javascript:[^\s>]*/gi, '');
}

function normalizeSiteFooter(value) {
    const footer = stripUnsafeHtml(value || '', 2000);
    if (/github\.com\/logdns\/IdentityGen/i.test(footer)) return '© 2026 IdentityGen.Xyz';
    return footer;
}

function sanitizePublicUrl(value) {
    const raw = limitString(value, 500).trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch (e) {
        return '';
    }
    return '';
}

function normalizeAdSlot(slot) {
    const input = slot && typeof slot === 'object' ? slot : {};
    return {
        enabled: toBoolean(input.enabled),
        html: limitString(input.html || '', 30000)
    };
}

function normalizeAds(ads) {
    const input = ads && typeof ads === 'object' ? ads : {};
    return AD_SLOTS.reduce((acc, slot) => {
        acc[slot] = normalizeAdSlot(input[slot]);
        return acc;
    }, {});
}

function decodeAdHtml(value) {
    const raw = String(value || '');
    if (!raw.startsWith(AD_STORAGE_PREFIX)) return raw;

    try {
        return Buffer.from(raw.slice(AD_STORAGE_PREFIX.length), 'base64').toString('utf8');
    } catch (e) {
        return '';
    }
}

function getHeadAdHtml() {
    const config = readConfig();
    const headAd = config.ads && config.ads.head ? config.ads.head : {};
    if (!headAd.enabled) return '';
    return decodeAdHtml(headAd.html).trim();
}

function injectHeadAd(html) {
    const headAdHtml = getHeadAdHtml();
    if (!headAdHtml) return html;

    const marker = '</head>';
    const index = html.toLowerCase().lastIndexOf(marker);
    if (index === -1) return html;

    return `${html.slice(0, index)}\n    ${headAdHtml}\n${html.slice(index)}`;
}

function normalizeDonation(donation) {
    const input = donation && typeof donation === 'object' ? donation : {};
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const items = rawItems.slice(0, 8).map(item => {
        const value = item && typeof item === 'object' ? item : {};
        return {
            coin: limitString(value.coin, 24).trim(),
            network: limitString(value.network, 40).trim(),
            address: limitString(value.address, 180).trim(),
            url: sanitizePublicUrl(value.url)
        };
    }).filter(item => item.coin && item.address);

    return {
        enabled: toBoolean(input.enabled),
        title: limitString(input.title, 80).trim(),
        note: limitString(input.note, 240).trim(),
        items
    };
}

function normalizeConfig(config) {
    const input = config && typeof config === 'object' ? config : {};
    return {
        ...DEFAULT_CONFIG,
        ...input,
        password: limitString(input.password || DEFAULT_CONFIG.password, 200),
        map_provider: input.map_provider === 'google' ? 'google' : 'osm',
        google_maps_key: limitString(input.google_maps_key, 300).trim(),
        site_title: limitString(input.site_title, 80).trim(),
        site_footer: normalizeSiteFooter(input.site_footer),
        default_language: LANGS.has(input.default_language) ? input.default_language : DEFAULT_CONFIG.default_language,
        card_bin: normalizeBinConfig(input.card_bin),
        ads: normalizeAds(input.ads),
        donation: normalizeDonation(input.donation)
    };
}

function normalizeBinConfig(value) {
    const input = value && typeof value === 'object' ? value : {};
    const key = value => /^[A-Za-z0-9_-]{1,200}$/.test(String(value || '')) ? String(value) : '';
    return {
        enabled: input.enabled === undefined ? true : toBoolean(input.enabled),
        publishable_key: key(input.publishable_key),
        secret_key: key(input.secret_key),
        binlist_fallback: input.binlist_fallback === undefined ? true : toBoolean(input.binlist_fallback)
    };
}

function getBinAdminConfig(config) {
    return { ...getPublicConfig(config), card_bin: {
        enabled: config.card_bin.enabled,
        publishable_key: config.card_bin.publishable_key,
        secret_configured: Boolean(config.card_bin.secret_key),
        binlist_fallback: config.card_bin.binlist_fallback
    } };
}

const binLookup = createBinLookup();
const BIN_CLIENTS = new Map();
function canQueryBin(req) {
    const now = Date.now();
    const key = getClientKey(req);
    for (const [client, entry] of BIN_CLIENTS) {
        if (entry.expires <= now) BIN_CLIENTS.delete(client);
    }
    let entry = BIN_CLIENTS.get(key);
    if (!entry) {
        if (BIN_CLIENTS.size >= 2000) return false;
        entry = { count: 0, expires: now + 60000 };
        BIN_CLIENTS.set(key, entry);
    }
    return ++entry.count <= 12;
}

function readConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            const initialConfig = {
                ...DEFAULT_CONFIG,
                password: crypto.randomBytes(24).toString('base64url')
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 4), { encoding: 'utf8', mode: 0o600 });
            console.warn('[security] Generated a random admin password for first launch. Read config.json locally and change it after signing in.');
            return normalizeConfig(initialConfig);
        }
        try { fs.chmodSync(CONFIG_FILE, 0o600); } catch (e) { /* best effort on non-POSIX filesystems */ }
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(raw);
        if (!config.password || config.password === 'admin') {
            config.password = crypto.randomBytes(24).toString('base64url');
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalizeConfig(config), null, 4), { encoding: 'utf8', mode: 0o600 });
            fs.chmodSync(CONFIG_FILE, 0o600);
            console.warn('[security] Replaced the default admin password. Read the new password from config.json locally.');
        }
        return normalizeConfig(config);
    } catch (e) {
        console.error('Config read error:', e.message);
        return normalizeConfig({
            ...DEFAULT_CONFIG,
            password: crypto.randomBytes(24).toString('base64url')
        });
    }
}

function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalizeConfig(config), null, 4), { encoding: 'utf8', mode: 0o600 });
        try { fs.chmodSync(CONFIG_FILE, 0o600); } catch (e) { /* best effort on non-POSIX filesystems */ }
        return true;
    } catch (e) {
        console.error('Config write error:', e.message);
        return false;
    }
}

function getPublicConfig(config) {
    return {
        map_provider: config.map_provider || 'osm',
        google_maps_key: config.map_provider === 'google' ? (config.google_maps_key || '') : '',
        site_title: config.site_title || '',
        site_footer: config.site_footer || '',
        default_language: LANGS.has(config.default_language) ? config.default_language : 'en',
        card_bin: { enabled: config.card_bin.enabled },
        ads: normalizeAds(config.ads),
        donation: normalizeDonation(config.donation)
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

function parseGitStatus(porcelain) {
    return cleanOutput(porcelain)
        .split('\n')
        .map(line => ({
            raw: line,
            index: line.slice(0, 1),
            worktree: line.slice(1, 2),
            path: line.slice(3)
        }))
        .filter(item => item.raw && item.path);
}

function formatDirtyFiles(files) {
    return files
        .slice(0, 8)
        .map(file => `${file.index}${file.worktree} ${file.path}`.trim())
        .join('，');
}

function createStashMessage() {
    return `identitygen-auto-update-${Date.now()}`;
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
            } : {
                version: latestVersion,
                hash: '',
                short: '',
                date: '',
                subject: ''
            },
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

    let fetch_output = '';
    if (options.fetch && remoteName) {
        try {
            fetch_output = await runGit(['fetch', '--prune', remoteName], { timeout: 90000 });
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
        fetch_output,
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

    const dirty = parseGitStatus(await tryGit(['status', '--porcelain']));
    const stashMessage = createStashMessage();
    let stashed = false;

    if (dirty.length) {
        try {
            const stashOutput = await runGit(['stash', 'push', '--include-untracked', '-m', stashMessage], { timeout: 120000 });
            stashed = !/No local changes to save/i.test(stashOutput);
        } catch (e) {
            const dirtyFiles = formatDirtyFiles(dirty);
            return {
                ok: false,
                statusCode: 409,
                message: `检测到本地代码有未提交修改，且自动暂存失败：${dirtyFiles}。错误：${e.message}`,
                data: {
                    ...before,
                    dirty_files: dirty
                }
            };
        }
    }

    const pullArgs = before.has_upstream ? ['pull', '--ff-only'] : ['pull', '--ff-only', 'origin', before.branch];
    try {
        const output = await runGit(pullArgs, { timeout: 120000 });
        const after = await getVersionInfo();
        after.update_output = output;
        after.stashed_local_changes = stashed;
        return {
            ok: true,
            message: stashed
                ? '版本已更新；本地未提交改动已自动暂存，服务即将自动重启。'
                : '版本已更新，服务即将自动重启以加载新代码。',
            data: after
        };
    } catch (e) {
        if (stashed) {
            await tryGit(['stash', 'pop']);
        }
        return {
            ok: false,
            statusCode: 500,
            message: stashed
                ? `更新失败，已尝试恢复本地未提交改动：${e.message}`
                : `更新失败：${e.message}`,
            data: before
        };
    }
}

function isPm2Process() {
    return Boolean(process.env.pm_id || process.env.PM2_HOME);
}

function scheduleServerRestart(reason) {
    const label = reason || 'server restart requested';
    console.log(`[restart] ${label}`);

    setTimeout(() => {
        if (isPm2Process()) {
            console.log('[restart] PM2 detected, exiting current process for PM2 restart');
            process.exit(0);
            return;
        }

        console.log('[restart] closing server and starting a replacement process');
        server.close(() => {
            const child = spawn(process.execPath, process.argv.slice(1), {
                cwd: ROOT,
                env: process.env,
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            process.exit(0);
        });

        setTimeout(() => {
            console.error('[restart] graceful restart timed out, exiting current process');
            process.exit(0);
        }, 5000).unref();
    }, RESTART_DELAY_MS).unref();
}

// ─── HTTP Helpers ───
function sendJSON(req, res, statusCode, data) {
    const body = JSON.stringify(data);
    const origin = req && req.headers ? req.headers.origin : '';
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer'
    };
    if (origin) {
        try {
            const originUrl = new URL(origin);
            const host = req.headers.host || '';
            if (originUrl.host === host) headers['Access-Control-Allow-Origin'] = origin;
        } catch (e) { /* ignore invalid origin */ }
    }
    res.writeHead(statusCode, {
        ...headers
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let tooLarge = false;
        req.on('data', chunk => {
            if (tooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                tooLarge = true;
                body = '';
            }
        });
        req.on('end', () => {
            if (tooLarge) {
                resolve({ __body_too_large: true });
                return;
            }
            try {
                const input = body ? JSON.parse(body) : {};
                resolve(input && typeof input === 'object' && !Array.isArray(input) ? input : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// ─── API Handler ───
async function handleAPI(req, res, parsedUrl) {
    const action = parsedUrl.searchParams
        ? parsedUrl.searchParams.get('action') || ''
        : parsedUrl.query
            ? new URLSearchParams(parsedUrl.query).get('action') || ''
            : '';

    // OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
        return sendJSON(req, res, 204, null);
    }

    // GET — Read public config (password excluded)
    if (req.method === 'GET' && !action) {
        const config = readConfig();
        return sendJSON(req, res, 200, {
            status: 'ok',
            data: getPublicConfig(config)
        });
    }

    // POST requests
    if (req.method === 'POST') {
        let input;
        try { input = await readBody(req); }
        catch (e) {
            if (!req.destroyed && !res.destroyed) {
                return sendJSON(req, res, 400, { status: 'error', code: 'invalid_request' });
            }
            return;
        }
        if (input.__body_too_large) {
            return sendJSON(req, res, 413, {
                status: 'error',
                message: '请求内容过大'
            });
        }

        if (action === 'binlookup' || action === 'binsettings' || action === 'savebin') {
            const config = readConfig();
            const provider = input.provider || 'auto';
            if ((action !== 'binlookup' || provider !== 'auto') && !isAuthenticated(req, input, config)) {
                return sendJSON(req, res, 401, { status: 'error', code: 'unauthorized', message: '认证失败' });
            }
            if (action === 'binsettings') return sendJSON(req, res, 200, { status: 'ok', data: getBinAdminConfig(config) });
            if (action === 'savebin') {
                const data = input.data;
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    return sendJSON(req, res, 400, { status: 'error', message: 'BIN 配置必须是 JSON 对象' });
                }
                const next = { ...config.card_bin };
                for (const field of ['enabled', 'publishable_key', 'binlist_fallback']) {
                    if (field in data) next[field] = data[field];
                }
                // An empty password input preserves the existing secret. Clearing is explicit.
                if (data.clear_secret === true) next.secret_key = '';
                else if (typeof data.secret_key === 'string' && data.secret_key.trim()) next.secret_key = data.secret_key.trim();
                if ([next.publishable_key, next.secret_key].some(value => value && !/^[A-Za-z0-9_-]{1,200}$/.test(value))) {
                    return sendJSON(req, res, 400, { status: 'error', message: 'API Key 格式不正确' });
                }
                config.card_bin = normalizeBinConfig(next);
                if (!writeConfig(config)) return sendJSON(req, res, 500, { status: 'error', message: '配置保存失败' });
                return sendJSON(req, res, 200, { status: 'ok', data: getBinAdminConfig(config) });
            }
            if (!canQueryBin(req)) return sendJSON(req, res, 429, { status: 'error', code: 'rate_limit' });
            try {
                const data = await binLookup.lookup(input.bin, config.card_bin, provider);
                return sendJSON(req, res, 200, { status: 'ok', data });
            } catch (error) {
                return sendJSON(req, res, error.status || 502, { status: 'error', code: error.code || 'provider_unavailable' });
            }
        }

        // ── Login: verify password ──
        if (action === 'login') {
            if (!canAttemptLogin(req)) {
                return sendJSON(req, res, 429, {
                    status: 'error',
                    message: '登录尝试过于频繁，请 15 分钟后重试'
                });
            }
            const config = readConfig();
            if (input.password === (config.password || 'admin')) {
                clearLoginFailures(req);
                return sendJSON(req, res, 200, {
                    status: 'ok',
                    token: createSession(),
                    data: getPublicConfig(config)
                });
            } else {
                recordLoginFailure(req);
                return sendJSON(req, res, 401, {
                    status: 'error',
                    message: '密码错误'
                });
            }
        }

        // ── Change password ──
        if (action === 'changepwd') {
            const config = readConfig();
            const credentials = { ...input, password: input.password || input.current_password };
            if (!isAuthenticated(req, credentials, config)) {
                return sendJSON(req, res, 401, {
                    status: 'error',
                    message: '认证失败'
                });
            }
            if (!input.new_password || String(input.new_password).length < 6 || String(input.new_password).length > 200) {
                return sendJSON(req, res, 400, {
                    status: 'error',
                    message: '新密码长度需为 6-200 个字符'
                });
            }
            config.password = String(input.new_password);
            if (writeConfig(config)) {
                SESSIONS.clear();
                return sendJSON(req, res, 200, { status: 'ok', message: '密码已更新' });
            } else {
                return sendJSON(req, res, 500, { status: 'error', message: '写入配置文件失败' });
            }
        }

        // ── Save config ──
        if (action === 'save') {
            const config = readConfig();
            if (!isAuthenticated(req, input, config)) {
                return sendJSON(req, res, 401, {
                    status: 'error',
                    message: '认证失败'
                });
            }
            const allowed = ['map_provider', 'google_maps_key', 'site_title', 'site_footer', 'default_language', 'ads', 'donation'];
            const data = input.data || {};
            for (const field of allowed) {
                if (field in data) {
                    config[field] = data[field];
                }
            }
            const normalized = normalizeConfig(config);
            if (writeConfig(normalized)) {
                return sendJSON(req, res, 200, {
                    status: 'ok',
                    message: '配置已保存',
                    data: getPublicConfig(normalized)
                });
            } else {
                return sendJSON(req, res, 500, {
                    status: 'error',
                    message: '写入配置文件失败'
                });
            }
        }

        // ── Version status/check/update ──
        if (action === 'version' || action === 'checkversion' || action === 'updateversion') {
            const config = readConfig();
            if (!isAuthenticated(req, input, config)) {
                return sendJSON(req, res, 401, {
                    status: 'error',
                    message: '认证失败'
                });
            }

            if (action === 'updateversion') {
                const result = await updateVersion();
                const restartScheduled = Boolean(result.ok && result.data && result.data.update_output);
                if (restartScheduled) result.data.server_restart_scheduled = true;
                sendJSON(req, res, result.ok ? 200 : (result.statusCode || 500), {
                    status: result.ok ? 'ok' : 'error',
                    message: result.message,
                    data: result.data
                });
                if (restartScheduled) scheduleServerRestart('version update completed');
                return;
            }

            const data = await getVersionInfo({ fetch: action === 'checkversion' });
            return sendJSON(req, res, 200, {
                status: data.fetch_error ? 'error' : 'ok',
                message: data.fetch_error ? `检查远端版本失败：${data.fetch_error}` : '',
                data
            });
        }
    }

    return sendJSON(req, res, 400, { status: 'error', message: '无效的请求' });
}

// ─── Static File Handler ───
function serveStatic(req, res, filePath) {
    const rel = path.relative(ROOT, filePath);
    const parts = rel.split(path.sep);
    const basename = path.basename(filePath).toLowerCase();
    const isConfigFile = basename === 'config.json'
        || basename.startsWith('config.')
        || basename.startsWith('config-')
        || basename.startsWith('config_');

    // Block runtime config, its common backup variants, and hidden/internal files.
    if (isConfigFile || parts.some(part => part.startsWith('.'))) {
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
        const isIndexHtml = path.basename(filePath) === 'index.html';

        const headers = {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css'
                ? 'no-cache'
                : 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'no-referrer'
        };

        if (isIndexHtml) {
            fs.readFile(filePath, 'utf8', (readErr, html) => {
                if (readErr) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Internal Server Error');
                }
                res.writeHead(200, headers);
                res.end(injectHeadAd(html));
            });
            return;
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    });
}

// ─── Server ───
const server = http.createServer(async (req, res) => {
    let parsedUrl;
    try {
        parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request');
    }
    let pathname;
    try {
        pathname = decodeURIComponent(parsedUrl.pathname);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request');
    }

    if (pathname.includes('\0')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request');
    }

    // API route: /api or /api.php (compatible with PHP version)
    if (pathname === '/api' || pathname === '/api.php') {
        try { return await handleAPI(req, res, parsedUrl); }
        catch (e) {
            // Contain one request's asynchronous failure without exposing internals.
            if (!res.destroyed && !res.headersSent) {
                return sendJSON(req, res, 500, { status: 'error', code: 'request_failed' });
            }
            if (!res.destroyed) res.destroy();
            return;
        }
    }

    // Static files
    if (pathname === '/') pathname = '/index.html';

    // Security: prevent directory traversal
    const filePath = path.resolve(ROOT, `.${pathname}`);
    const relativePath = path.relative(ROOT, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }

    serveStatic(req, res, filePath);
});

server.listen(PORT, HOST, () => {
    const listeningPort = server.address().port;
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║       ⚡ IdentityGen Server             ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║  🌐 http://${HOST}:${listeningPort}               ║`);
    console.log(`  ║  🔧 Admin: http://${HOST}:${listeningPort}/admin.html ║`);
    console.log('  ║  📋 Press Ctrl+C to stop                ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
});
