'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

test('HTTP integration: authentication, secret protection, fallback, save/clear and limits', async t => {
    // Run a disposable copy with fixture config and mocked HTTPS, never the user's runtime config.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identitygen-bin-test-'));
    for (const file of ['server.js', 'bin-lookup.js', 'ad-code.js', 'index.html', 'bin-ui.js', 'style.css', 'app.js', 'data.js', 'VERSION']) {
        fs.copyFileSync(path.join(__dirname, '..', file), path.join(directory, file));
    }
    const password = 'test-only-admin-password';
    const secret = 'TEST-server-only-secret';
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ password,
        card_bin: { enabled: true, secret_key: secret, publishable_key: 'TEST-publishable', binlist_fallback: true } }));
    fs.writeFileSync(path.join(directory, 'preload.cjs'), `
        const https = require('https');
        const { EventEmitter } = require('events');
        const { Readable } = require('stream');
        https.get = (url, options, callback) => {
            const req = new EventEmitter();
            req.destroy = error => { if (error) req.emit('error', error); req.emit('close'); };
            process.nextTick(() => {
                const primary = url.includes('handyapi');
                const data = primary ? { Status: 'SUCCESS', Scheme: 'VISA', Issuer: 'Fixture Bank', Country: { A2: 'US', Name: 'United States' } }
                    : { scheme: 'visa', bank: { name: 'Backup Bank' }, country: { name: 'Denmark' }, prepaid: false };
                const res = Readable.from([Buffer.from(JSON.stringify(data))]);
                res.statusCode = primary && url.includes('/457173') ? 503 : 200;
                callback(res);
                res.on('end', () => req.emit('close'));
            });
            return req;
        };`);
    const child = spawn(process.execPath, ['--require', path.join(directory, 'preload.cjs'), path.join(directory, 'server.js'), '0'], {
        env: { HOST: '127.0.0.1', HOME: directory, TMPDIR: directory }, stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(async () => {
        child.kill();
        if (child.exitCode === null) await once(child, 'exit');
        fs.rmSync(directory, { recursive: true, force: true });
    });
    let output = '';
    const address = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
        child.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
            if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
        });
        child.once('error', error => { clearTimeout(timer); reject(error); });
    });
    const post = async (action, body) => {
        const response = await fetch(`${address}/api?action=${action}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' }, body: JSON.stringify(body)
        });
        return { http: response.status, json: await response.json() };
    };
    // One partial POST cancellation must not take down the shared request listener.
    await new Promise(resolve => {
        const socket = net.connect(new URL(address).port, '127.0.0.1', () => {
            socket.write('POST /api?action=binlookup HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{');
            setTimeout(() => socket.destroy(), 30);
        });
        socket.on('error', () => {});
        socket.on('close', resolve);
    });
    const publicResponse = await fetch(address + '/api');
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    const publicConfig = await publicResponse.json();
    assert.deepEqual(publicConfig.data.card_bin, { enabled: true });
    assert.equal(JSON.stringify(publicConfig).includes(secret), false);
    const login = await post('login', { password });
    assert.equal(login.http, 200);
    assert.equal(JSON.stringify(login.json).includes(secret), false);
    const token = login.json.token;
    assert.equal((await post('savebin', { token, data: 'invalid' })).http, 400);
    assert.equal((await post('savebin', { token, data: [] })).http, 400);
    assert.equal((await post('binsettings', {})).http, 401);
    assert.equal((await post('savebin', { data: { enabled: false } })).http, 401);
    assert.equal((await post('binlookup', { bin: '535316', provider: 'binlist' })).http, 401);
    const admin = await post('binsettings', { token });
    assert.equal(admin.json.data.card_bin.secret_configured, true);
    assert.equal(JSON.stringify(admin.json).includes(secret), false);
    const invalid = await post('binlookup', { bin: '5353161234567890' });
    assert.equal(invalid.http, 400);
    assert.equal(invalid.json.code, 'invalid_bin');
    const primary = await post('binlookup', { bin: '535316' });
    assert.equal(primary.http, 200, JSON.stringify(primary.json));
    assert.equal(primary.json.data.source, 'handyapi');
    assert.equal(JSON.stringify(primary.json).includes(secret), false);
    const backup = await post('binlookup', { bin: '45717360' });
    assert.equal(backup.json.data.source, 'binlist');
    assert.equal(backup.json.data.precision, 6);
    const save = await post('savebin', { token, data: { secret_key: '', enabled: true } });
    assert.equal(save.http, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'config.json'))).card_bin.secret_key, secret);
    assert.equal(JSON.stringify(save.json).includes(secret), false);
    await post('savebin', { token, data: { clear_secret: true } });
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'config.json'))).card_bin.secret_key, '');
    await post('savebin', { token, data: { enabled: false } });
    assert.equal((await post('binlookup', { bin: '535316' })).json.code, 'disabled');
    assert.equal((await post('binlookup', null)).http, 400);
    for (const url of ['/config.json', '/config.backup.json']) assert.equal((await fetch(address + url)).status, 403);
    assert.equal((await fetch(address + '/bin-ui.js')).status, 200);
    assert.equal((await fetch(address + '/')).status, 200);
    for (let i = 0; i < 15; i++) {
        const response = await post('binlookup', { bin: '535316' });
        if (i === 14) assert.equal(response.http, 429);
    }
    // All password-verifying routes share one failed-attempt bucket; valid sessions remain usable.
    for (let i = 0; i < 10; i++) {
        assert.equal((await post(i % 2 ? 'login' : 'binsettings', { password: 'wrong' })).http, 401);
    }
    assert.equal((await post('login', { password })).http, 429);
    for (const action of ['binsettings', 'savebin', 'save', 'version']) {
        assert.equal((await post(action, { password })).http, 401, action);
    }
    assert.equal((await post('changepwd', { current_password: password, new_password: 'should-not-be-set' })).http, 401);
    assert.equal((await post('binsettings', { token })).http, 200);
    const changed = await post('changepwd', { token, new_password: 'new-test-password' });
    assert.equal(changed.http, 200);
    assert.equal((await post('binsettings', { token })).http, 401);
});
