'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBinLookup, BinError, normalizeResult } = require('../bin-lookup');
const config = { enabled: true, secret_key: 'TEST-secret', publishable_key: 'TEST-public', binlist_fallback: true };
const handy = { Status: 'SUCCESS', Scheme: 'MASTERCARD', Type: 'CREDIT', Issuer: 'Example Bank',
    CardTier: 'PLATINUM', Country: { A2: 'AU', Name: 'Australia' }, Luhn: true };
const binlist = { scheme: 'visa', type: 'debit', prepaid: false, number: { length: 16, luhn: true },
    country: { alpha2: 'DK', name: 'Denmark' }, bank: { name: 'Backup Bank' } };

test('only six/eight digits are accepted; full card numbers never reach upstream', async () => {
    let calls = 0;
    const service = createBinLookup({ request: async () => { calls++; return handy; } });
    for (const bin of ['53531', '5353160', '535316000', '5353161234567890', ' 535316', '535-316', 535316, null, '１２３４５６']) {
        await assert.rejects(service.lookup(bin, config), { code: 'invalid_bin', status: 400 });
    }
    assert.equal(calls, 0);
    assert.equal((await service.lookup('535316', config)).precision, 6);
    assert.equal((await service.lookup('53531600', config)).precision, 8);
});

test('HandyAPI uses secret header, normalizes fields and does not mix unknown fields', async () => {
    const calls = [];
    const service = createBinLookup({ request: async (...args) => { calls.push(args); return handy; } });
    const result = await service.lookup('535316', config);
    assert.deepEqual(calls, [['https://data.handyapi.com/bin/535316', { 'x-api-key': 'TEST-secret' }]]);
    assert.equal(result.source, 'handyapi');
    assert.equal(result.prepaid, null);
    assert.equal(result.bank_url, '');
    assert.equal(JSON.stringify(result).includes('TEST-secret'), false);
});

test('Binlist fallback marks six-digit approximation and preserves false/null', async () => {
    const calls = [];
    const service = createBinLookup({ request: async (url, headers) => {
        calls.push([url, headers]);
        if (url.includes('handyapi')) throw new BinError('provider_timeout');
        return binlist;
    } });
    const result = await service.lookup('45717360', config);
    assert.equal(result.bin, '45717360');
    assert.equal(result.queried_bin, '457173');
    assert.equal(result.precision, 6);
    assert.equal(result.fallback_reason, 'provider_timeout');
    assert.equal(result.prepaid, false);
    assert.deepEqual(calls[1], ['https://lookup.binlist.net/457173', { 'Accept-Version': '3' }]);
});

test('malformed response, 404, 429, authentication failures all trigger fallback', async () => {
    for (const code of ['invalid_response', 'not_found', 'provider_rate_limit', 'provider_auth']) {
        const service = createBinLookup({ request: async url => {
            if (url.includes('handyapi')) {
                if (code === 'invalid_response') return { Status: 'SUCCESS' };
                throw new BinError(code);
            }
            return binlist;
        } });
        assert.equal((await service.lookup('457173', config)).fallback_reason, code);
    }
});

test('disabled feature, disabled fallback and invalid provider cannot call upstream', async () => {
    let calls = 0;
    const service = createBinLookup({ request: async () => { calls++; throw new BinError('provider_auth'); } });
    await assert.rejects(service.lookup('535316', { ...config, enabled: false }), { code: 'disabled' });
    await assert.rejects(service.lookup('535316', config, 'https://attacker.invalid'), { code: 'invalid_provider' });
    assert.equal(calls, 0);
    await assert.rejects(service.lookup('535316', { ...config, binlist_fallback: false }), { code: 'provider_auth' });
    assert.equal(calls, 1);
    await assert.rejects(service.lookup('535316', config, 'handyapi'), { code: 'provider_auth' });
    assert.equal(calls, 2);
});

test('publishable fallback credential and no-key backup', async () => {
    const headers = [];
    const service = createBinLookup({ request: async (url, header) => {
        headers.push(header); return url.includes('handyapi') ? handy : binlist;
    } });
    await service.lookup('535316', { ...config, secret_key: '' });
    assert.equal(headers[0]['x-api-key'], 'TEST-public');
    assert.equal((await service.lookup('457173', { ...config, secret_key: '', publishable_key: '' })).source, 'binlist');
});

test('cache deduplication, expiry and credential rotation', async () => {
    let clock = 100000000;
    let calls = 0;
    const service = createBinLookup({ now: () => clock, request: async () => { calls++; return handy; } });
    await Promise.all(Array.from({ length: 10 }, () => service.lookup('535316', config)));
    assert.equal(calls, 1);
    assert.equal((await service.lookup('535316', config)).cached, true);
    await service.lookup('535316', { ...config, secret_key: 'changed' });
    assert.equal(calls, 2);
    clock += 86400001;
    assert.equal((await service.lookup('535316', config)).cached, false);
    assert.equal(calls, 3);
});

test('Binlist five calls/hour budget and 429 cooldown', async () => {
    let clock = 100000000;
    let calls = 0;
    const service = createBinLookup({ now: () => clock, request: async () => { calls++; return binlist; } });
    for (let i = 0; i < 5; i++) await service.lookup(String(457173 + i), config, 'binlist');
    assert.equal((await service.lookup('457173', config, 'binlist')).cached, true);
    await assert.rejects(service.lookup('500000', config, 'binlist'), { code: 'provider_rate_limit' });
    assert.equal(calls, 5);
    clock += 3600001;
    await service.lookup('500000', config, 'binlist');
    assert.equal(calls, 6);
    const blocked = createBinLookup({ request: async () => { calls++; throw new BinError('provider_rate_limit'); } });
    await assert.rejects(blocked.lookup('457173', config, 'binlist'), { code: 'provider_rate_limit' });
    await assert.rejects(blocked.lookup('457173', config, 'binlist'), { code: 'provider_rate_limit' });
    assert.equal(calls, 7);
});

test('global quota and concurrent-task cap bound upstream usage', async () => {
    const service = createBinLookup({ request: async () => handy });
    for (let i = 0; i < 30; i++) await service.lookup(String(535316 + i), config);
    await assert.rejects(service.lookup('600000', config), { code: 'rate_limit' });
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    const busy = createBinLookup({ request: async () => { await wait; return handy; } });
    const pending = Array.from({ length: 8 }, (_, i) => busy.lookup(String(535316 + i), config));
    await assert.rejects(busy.lookup('600000', config), { code: 'busy' });
    release();
    await Promise.all(pending);
});

test('unknown values remain unknown and strings have bounded lengths', () => {
    const result = normalizeResult({ ...handy, Luhn: 'false', Issuer: '<script>alert(1)</script>' + 'x'.repeat(400) }, 'handyapi', '535316', '535316');
    assert.equal(result.luhn, null);
    assert.equal(result.issuer.length, 200);
    assert.throws(() => normalizeResult([], 'binlist', '535316', '535316'), { code: 'invalid_response' });
});
