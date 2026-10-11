const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const navigation = html.slice(html.indexOf('function initAdminNavigation()'), html.indexOf('// ── Save Password'));
const ids = Array.from(html.matchAll(/class="admin-nav-link" href="#([^"]+)"/g), match => match[1]);

function fixture({ mobile = false, hash = '', reducedMotion = false } = {}) {
    const listeners = {};
    const frames = [];
    const jumps = [];
    const heights = { header:70, nav:64 };
    const sections = ids.map((id, i) => ({
        id, top:100 + i * 400,
        getBoundingClientRect() { return { top:this.top - window.scrollY }; },
        focus(options) { this.focusOptions = options; }
    }));
    const links = ids.map(id => ({
        hash:'#' + id, attributes:{}, listeners:{},
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; },
        addEventListener(name, fn) { this.listeners[name] = fn; },
        getBoundingClientRect() { return { left:0, right:100, width:100 }; }
    }));
    const rail = { scrollWidth:100, clientWidth:100 };
    const nav = {
        querySelector:() => rail,
        querySelectorAll:() => links,
        getBoundingClientRect:() => ({ height:heights.nav })
    };
    const properties = {};
    const panel = {
        dataset:{},
        style:{ setProperty:(key, value) => { properties[key] = value; } },
        querySelector:selector => selector === '.admin-nav' ? nav : selector === '.admin-topbar' ? { getBoundingClientRect:() => ({ height:heights.header }) } : {}
    };
    const document = { documentElement:{ scrollHeight:4200 }, getElementById:id => id === 'admin-panel' ? panel : sections.find(section => section.id === id) };
    const window = {
        scrollY:0, innerHeight:800, location:{ hash },
        matchMedia:query => ({ matches:query.includes('max-width') ? mobile : reducedMotion }),
        addEventListener:(name, fn) => { listeners[name] = fn; },
        scrollTo:options => { jumps.push(options); window.scrollY = options.top; }
    };
    const history = { replaceState:(_state, _title, value) => { window.location.hash = value; } };
    const context = vm.createContext({ document, window, history, requestAnimationFrame:fn => frames.push(fn) });
    vm.runInContext(navigation + '\ninitAdminNavigation();', context);
    function flush() { while (frames.length) frames.shift()(); }
    flush();
    return { context, document, window, links, sections, properties, listeners, frames, jumps, heights, flush };
}

test('all nine admin sections have unique navigation targets and valid inline scripts', () => {
    assert.equal(ids.length, 9);
    assert.equal(new Set(ids).size, 9);
    for (const id of ids) {
        assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
        assert.ok(html.includes(`id="${id}" tabindex="-1"`));
    }
    assert.match(html, /aria-label="后台功能导航"/);
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script[1]);
});

test('navigation focuses the target, updates its hash and accounts for mobile sticky bars', () => {
    const f = fixture({ mobile:true });
    let prevented = false;
    f.links[3].listeners.click({ button:0, preventDefault:() => { prevented = true; } });
    assert.ok(prevented);
    assert.equal(f.window.location.hash, '#settings-bin');
    assert.equal(f.jumps.at(-1).top, f.sections[3].top - 150);
    assert.equal(f.jumps.at(-1).behavior, 'smooth');
    assert.equal(f.sections[3].focusOptions.preventScroll, true);
    assert.equal(f.links[3].attributes['aria-current'], 'location');
    assert.equal(f.properties['--admin-scroll-offset'], '150px');
    f.heights.header = 90;
    f.listeners.resize();
    assert.equal(f.properties['--admin-scroll-offset'], '170px');
});

test('manual scrolling highlights one section, batches frames and handles page bottom', () => {
    const f = fixture();
    f.window.scrollY = f.sections[5].top - 86;
    f.listeners.scroll();
    f.listeners.scroll();
    assert.equal(f.frames.length, 1);
    f.flush();
    assert.equal(f.links[5].attributes['aria-current'], 'location');
    assert.equal(f.links.filter(link => link.attributes['aria-current']).length, 1);
    f.window.scrollY = 3400;
    f.listeners.scroll();
    f.flush();
    assert.equal(f.links[8].attributes['aria-current'], 'location');
});

test('deep links are whitelisted, motion preference is respected and initialization is idempotent', () => {
    const f = fixture({ hash:'#settings-bin', reducedMotion:true });
    assert.equal(f.jumps.length, 1);
    assert.equal(f.jumps[0].behavior, 'instant');
    f.links[4].listeners.click({ button:0, preventDefault() {} });
    assert.equal(f.jumps.at(-1).behavior, 'instant');
    vm.runInContext('initAdminNavigation();', f.context);
    assert.equal(f.jumps.length, 2);
    f.window.location.hash = '#bin-secret-key';
    f.listeners.hashchange();
    assert.equal(f.jumps.length, 2);
    f.links[0].listeners.click({ button:0, ctrlKey:true, preventDefault() { assert.fail('modified click should stay native'); } });
    assert.equal(f.jumps.length, 2);
    assert.equal(fixture({ hash:'#unknown' }).jumps.length, 0);
});
