'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createUI(country, result = {}, lang = 'en') {
    const elements = new Map();
    function element() {
        return {
            textContent: '', value: '535316', children: [], handlers: {},
            classList: { toggle() {} }, setAttribute() {},
            addEventListener(name, handler) { this.handlers[name] = handler; },
            append(...children) { this.children.push(...children); },
            appendChild(child) { this.children.push(child); },
            replaceChildren() { this.children = []; }
        };
    }
    const document = {
        documentElement: { lang },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        createElement: element, querySelectorAll: () => []
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../bin-ui.js'), 'utf8'), {
        document, AbortController, setTimeout, clearTimeout,
        MutationObserver: class { observe() {} },
        fetch: async () => ({ ok: true, json: async () => ({ status: 'ok', data: {
            bin: '535316', precision: 6, source: 'handyapi', country, ...result
        } }) })
    });
    return { document, elements };
}

test('BIN country results display flags from either provider country code', async () => {
    for (const [code, name, flag] of [
        ['US', 'United States', '🇺🇸'], ['GB', 'United Kingdom', '🇬🇧'],
        ['DE', 'Germany', '🇩🇪'], ['TR', 'Türkiye', '🇹🇷'],
        ['au', 'Australia', '🇦🇺'], ['DK', 'Denmark', '🇩🇰'],
        ['JP', 'Japan', '🇯🇵'], ['CN', 'China', '🇨🇳']
    ]) {
        const { document, elements } = createUI({ code, name });
        await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
        assert.equal(elements.get('bin-country').textContent, `${flag} ${name} / ${code.toUpperCase()}`);
    }
});

test('missing or malformed country code preserves text without manufacturing a flag', async () => {
    for (const [country, expected] of [
        [{ name: 'Example country', code: '' }, 'Example country'],
        [{ name: 'Example country', code: '123' }, 'Example country / 123'],
        [{}, 'Unknown'], [undefined, 'Unknown']
    ]) {
        const { document, elements } = createUI(country);
        await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
        assert.equal(elements.get('bin-country').textContent, expected);
    }
});

test('navigation BIN label includes bank icon', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.match(html, /id="bin-open"[^>]*>🏦 Card BIN\/IIN<\/button>/);
});

test('summary highlights issuer; secondary fields stay in collapsed details and preserve false', async () => {
    const { document, elements } = createUI({ code: 'AU', name: 'Australia' }, {
        issuer: '<script>not executable</script>', scheme: 'MASTERCARD', type: 'CREDIT', tier: 'PLATINUM',
        prepaid: false, luhn: true, number_length: 16
    });
    assert.equal(elements.get('bin-empty').hidden, false);
    await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
    assert.equal(elements.get('bin-issuer').textContent, '<script>not executable</script>');
    assert.equal(elements.get('bin-result-grid').children.length, 3);
    assert.equal(elements.get('bin-detail-grid').children.length, 6);
    assert.equal(elements.get('bin-detail-grid').children[1].children[1].textContent, 'No');
    assert.equal(elements.get('bin-details').open, false);
    assert.equal(elements.get('bin-empty').hidden, true);
    assert.equal(elements.get('bin-status').hidden, true);
    assert.equal(elements.get('bin-results').hidden, false);
});

test('precision warnings and state resets survive the compact result layout', async () => {
    const { document, elements } = createUI({ code: 'DK', name: 'Denmark' }, {
        bin: '45717360', precision: 6, fallback_reason: 'provider_timeout'
    });
    await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
    assert.match(elements.get('bin-precision').textContent, /not an exact match/);
    document.getElementById('bin-input').handlers.input();
    assert.equal(elements.get('bin-results').hidden, true);
    assert.equal(elements.get('bin-empty').hidden, false);
    document.getElementById('bin-input').value = 'invalid';
    await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
    assert.equal(elements.get('bin-status').hidden, false);
    assert.equal(elements.get('bin-empty').hidden, true);
    assert.match(elements.get('bin-status').textContent, /exactly 6 or 8/);
});

test('unknown summary and detail values remain localized in all four languages', async () => {
    for (const [lang, unknown] of [['en', 'Unknown'], ['zh-CN', '未知'], ['zh-TW', '未知'], ['ja', '不明']]) {
        const { document, elements } = createUI({}, {}, lang);
        await document.getElementById('bin-form').handlers.submit({ preventDefault() {} });
        assert.equal(elements.get('bin-issuer').textContent, unknown);
        assert.equal(elements.get('bin-country').textContent, unknown);
        assert.equal(elements.get('bin-detail-grid').children[0].children[1].textContent, unknown);
    }
});
