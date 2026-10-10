'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createUI(country) {
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
        documentElement: { lang: 'en' },
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
            bin: '535316', precision: 6, source: 'handyapi', country
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
        const countryCell = elements.get('bin-result-grid').children[4];
        assert.equal(countryCell.children[1].textContent, `${flag} ${name} / ${code.toUpperCase()}`);
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
        assert.equal(elements.get('bin-result-grid').children[4].children[1].textContent, expected);
    }
});

test('navigation BIN label includes bank icon', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.match(html, /id="bin-open"[^>]*>🏦 Card BIN\/IIN<\/button>/);
});
