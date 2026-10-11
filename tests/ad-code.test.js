'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AdCode = require('../ad-code');

test('ad encoding roundtrips Unicode and legacy HTML identically in Node and browser', () => {
    const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, atob, btoa, URL });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'ad-code.js'), 'utf8'), context);
    for (const raw of ['<script>console.log("广告 🇩🇪");</script>', 'console.log("fixture")', '']) {
        const encoded = AdCode.encode(raw);
        assert.equal(context.AdCode.encode(raw), encoded);
        assert.equal(context.AdCode.decode(encoded), raw);
        assert.equal(AdCode.decode(encoded), raw);
        assert.equal(AdCode.encode(encoded), encoded);
    }
    assert.equal(AdCode.decode('<div>legacy</div>'), '<div>legacy</div>');
    assert.equal(AdCode.decode(AdCode.PREFIX + 'abc'), '');
    assert.equal(context.AdCode.decode(AdCode.PREFIX + '!bad!'), '');
});

test('HTML, raw JS and script URLs use the same normalizer for Head and body', () => {
    const html = '<ins class="adsbygoogle"></ins><script async src="https://example.invalid/ad.js"></script>';
    assert.equal(AdCode.normalize(AdCode.encode(html)), html);
    for (const js of ['console.log("fixture");', 'initBanner();', 'const ad = 1;', '// fixture\ndocument.write("ad");']) {
        assert.equal(AdCode.normalize(js), `<script>${js}</script>`);
    }
    assert.equal(AdCode.normalize('customCode', 'js'), '<script>customCode</script>');
    assert.equal(AdCode.normalize('<p>fixture</p>', 'html'), '<p>fixture</p>');
    assert.equal(AdCode.normalize('const x = "</script>";', 'js'), '<script>const x = "<\\/script>";</script>');
    assert.equal(AdCode.normalize('https://example.invalid/a.js?v=1&x=2'), '<script src="https://example.invalid/a.js?v=1&amp;x=2"></script>');
    assert.throws(() => AdCode.normalize('javascript:alert(1)', 'url'));
    assert.throws(() => AdCode.normalize('data:text/javascript,foo()', 'url'));
    assert.throws(() => AdCode.normalize('x', 'invalid'));
});

test('legacy JS defaults to a separate document while AdSense stays in the host page', () => {
    assert.equal(AdCode.executionMode('<script>document.write("ad")</script>'), 'frame');
    assert.equal(AdCode.executionMode('<div>static banner</div>'), 'page');
    assert.equal(AdCode.executionMode('<ins class="adsbygoogle"></ins><script>(adsbygoogle=[]).push({})</script>'), 'page');
    assert.equal(AdCode.executionMode('<script>googletag.cmd.push(function(){})</script>'), 'page');
    assert.equal(AdCode.executionMode('<script>custom()</script>', 'page'), 'page');
    assert.equal(AdCode.executionMode('<div>ad</div>', 'frame'), 'frame');
    assert.throws(() => AdCode.executionMode('', 'invalid'));
});
