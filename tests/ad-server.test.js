'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const AdCode = require('../ad-code');

test('ad API saves exact code/metadata, injects normalized Head and rejects truncation', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identitygen-ad-test-'));
    for (const file of ['server.js','bin-lookup.js','ad-code.js','index.html','VERSION']) {
        fs.copyFileSync(path.join(__dirname, '..', file), path.join(directory, file));
    }
    const password = 'test-only-ad-password';
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ password }));
    const child = spawn(process.execPath, [path.join(directory, 'server.js'), '0'], {
        env:{ HOST:'127.0.0.1', HOME:directory, TMPDIR:directory }, stdio:['ignore','pipe','pipe']
    });
    t.after(async () => {
        if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
        fs.rmSync(directory, { recursive:true, force:true });
    });
    const address = await new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(new Error('Fixture startup timeout')), 5000);
        child.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
            if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
        });
        child.once('error', error => { clearTimeout(timer); reject(error); });
    });
    const post = async body => {
        const res = await fetch(address + '/api?action=save', {
            method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
        });
        return { status:res.status, data:await res.json() };
    };
    const code = 'window.fixtureHead = "广告";';
    const ads = {
        head:{ enabled:true, html:AdCode.encode(code), format:'js', mode:'page' },
        top:{ enabled:true, html:AdCode.encode('<script>document.write("fixture")</script>'), format:'html', mode:'frame' }
    };
    assert.equal((await post({ data:{ads} })).status, 401);
    const saved = await post({ password, data:{ads} });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.data.ads.top, ads.top);
    const publicConfig = await (await fetch(address + '/api')).json();
    assert.deepEqual(publicConfig.data.ads.head, ads.head);
    assert.equal(JSON.stringify(publicConfig).includes(password), false);
    for (const url of ['/', '/index.html']) {
        const response = await fetch(address + url);
        const html = await response.text();
        assert.ok(html.includes(AdCode.normalize(code,'js')));
        assert.ok(html.indexOf(AdCode.normalize(code,'js')) < html.indexOf('</head>'));
    }
    const before = fs.readFileSync(path.join(directory, 'config.json'), 'utf8');
    for (const bad of [
        {top:{enabled:true,html:'x'.repeat(AdCode.MAX_LENGTH+1)}},
        {top:{enabled:true,html:AdCode.PREFIX+'abc'}},
        {top:{enabled:true,html:'javascript:alert(1)',format:'url'}},
        {top:{enabled:true,html:'fixture',mode:'invalid'}},
        []
    ]) {
        assert.equal((await post({password,data:{ads:bad}})).status,400);
        assert.equal(fs.readFileSync(path.join(directory,'config.json'),'utf8'),before);
    }
    const legacy = '<script>window.legacyAd = 1;</script>';
    assert.equal((await post({password,data:{ads:{head:{enabled:true,html:legacy}}}})).status,200);
    assert.ok((await (await fetch(address)).text()).includes(legacy));
    await post({password,data:{ads:{head:{enabled:false,html:legacy}}}});
    assert.equal((await (await fetch(address)).text()).includes(legacy),false);
});
