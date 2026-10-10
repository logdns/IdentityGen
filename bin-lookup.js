'use strict';

const https = require('https');
const crypto = require('crypto');

class BinError extends Error {
    constructor(code, status = 502) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

function requestJSON(url, headers) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers }, res => {
            res.on('error', () => reject(new BinError('provider_unavailable')));
            res.on('aborted', () => reject(new BinError('provider_unavailable')));
            if (res.statusCode !== 200) {
                const error = new BinError(res.statusCode === 404 ? 'not_found'
                    : res.statusCode === 429 ? 'provider_rate_limit'
                        : [401, 403].includes(res.statusCode) ? 'provider_auth' : 'provider_unavailable',
                res.statusCode === 404 ? 404 : 502);
                reject(error);
                // Do not drain unbounded error bodies after releasing the lookup task.
                res.destroy();
                req.destroy();
                return;
            }
            let size = 0;
            const chunks = [];
            res.on('data', chunk => {
                size += chunk.length;
                if (size > 32768) req.destroy(new BinError('invalid_response'));
                else chunks.push(chunk);
            });
            res.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
                catch (e) { reject(new BinError('invalid_response')); }
            });
        });
        // A wall-clock deadline also bounds slow-drip responses and connection setup.
        const timer = setTimeout(() => req.destroy(new BinError('provider_timeout')), 6000);
        req.on('close', () => clearTimeout(timer));
        req.on('error', error => reject(error instanceof BinError ? error : new BinError('provider_unavailable')));
    });
}

const text = value => typeof value === 'string' ? value.trim().slice(0, 200) : '';
const boolean = value => typeof value === 'boolean' ? value : null;

function normalizeResult(raw, source, bin, queriedBin) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BinError('invalid_response');
    const handy = source === 'handyapi';
    if (handy && raw.Status !== 'SUCCESS') throw new BinError('invalid_response');
    const country = (handy ? raw.Country : raw.country) || {};
    const bank = raw.bank || {};
    const result = {
        bin, queried_bin: queriedBin, precision: queriedBin.length, source,
        scheme: text(handy ? raw.Scheme : raw.scheme),
        type: text(handy ? raw.Type : raw.type),
        tier: text(handy ? raw.CardTier : raw.brand),
        issuer: text(handy ? raw.Issuer : bank.name),
        country: { name: text(handy ? country.Name : country.name), code: text(handy ? country.A2 : country.alpha2) },
        luhn: boolean(handy ? raw.Luhn : (raw.number || {}).luhn),
        prepaid: handy ? null : boolean(raw.prepaid),
        number_length: !handy && Number.isInteger((raw.number || {}).length)
            && raw.number.length > 0 && raw.number.length <= 19 ? raw.number.length : null,
        bank_url: handy ? '' : text(bank.url),
        bank_phone: handy ? '' : text(bank.phone),
        bank_city: handy ? '' : text(bank.city)
    };
    if (!result.scheme && !result.issuer && !result.country.name) throw new BinError('invalid_response');
    return result;
}

function createBinLookup({ request = requestJSON, now = Date.now } = {}) {
    const cache = new Map();
    const pending = new Map();
    let upstreamWindow = { start: 0, count: 0 };
    let binlistWindow = { start: 0, count: 0 };
    let binlistBlockedUntil = 0;

    async function providerLookup(source, bin, config) {
        const time = now();
        if (time - upstreamWindow.start >= 60000) upstreamWindow = { start: time, count: 0 };
        if (upstreamWindow.count >= 30) throw new BinError('rate_limit', 429);
        let raw;
        let queriedBin = bin;
        if (source === 'handyapi') {
            const key = config.secret_key || config.publishable_key;
            if (!key) throw new BinError('not_configured', 503);
            upstreamWindow.count++;
            raw = await request(`https://data.handyapi.com/bin/${bin}`, { 'x-api-key': key });
        } else {
            if (!config.binlist_fallback) throw new BinError('fallback_disabled', 503);
            if (time - binlistWindow.start >= 3600000) binlistWindow = { start: time, count: 0 };
            if (time < binlistBlockedUntil || binlistWindow.count >= 5) throw new BinError('provider_rate_limit', 429);
            binlistWindow.count++;
            upstreamWindow.count++;
            // Binlist's free tier does not promise eight-digit coverage. Do not label a six-digit match as exact.
            queriedBin = bin.slice(0, 6);
            try {
                raw = await request(`https://lookup.binlist.net/${queriedBin}`, { 'Accept-Version': '3' });
            } catch (error) {
                if (error.code === 'provider_rate_limit') binlistBlockedUntil = now() + 3600000;
                throw error;
            }
        }
        return normalizeResult(raw, source, bin, queriedBin);
    }

    async function lookup(bin, config, source = 'auto') {
        if (typeof bin !== 'string' || !/^(?:\d{6}|\d{8})$/.test(bin)) throw new BinError('invalid_bin', 400);
        if (!['auto', 'handyapi', 'binlist'].includes(source)) throw new BinError('invalid_provider', 400);
        if (!config.enabled) throw new BinError('disabled', 503);
        const fingerprint = crypto.createHash('sha256')
            .update(JSON.stringify([config.secret_key, config.publishable_key, config.binlist_fallback])).digest('hex');
        const cacheKey = `${fingerprint}:${source}:${bin}`;
        const entry = cache.get(cacheKey);
        if (entry && entry.expires > now()) return { ...entry.data, cached: true };
        if (entry) cache.delete(cacheKey);
        if (pending.has(cacheKey)) return pending.get(cacheKey);
        if (pending.size >= 8) throw new BinError('busy', 429);
        const task = (async () => {
            let data;
            if (source !== 'auto') data = await providerLookup(source, bin, config);
            else {
                try { data = await providerLookup('handyapi', bin, config); }
                catch (primaryError) {
                    if (!config.binlist_fallback || primaryError.code === 'rate_limit') throw primaryError;
                    data = await providerLookup('binlist', bin, config);
                    data.fallback_reason = primaryError.code;
                }
            }
            data = { ...data, cached: false, fetched_at: new Date(now()).toISOString() };
            if (cache.size >= 500) cache.delete(cache.keys().next().value);
            cache.set(cacheKey, { data, expires: now() + 86400000 });
            return data;
        })();
        pending.set(cacheKey, task);
        try { return await task; }
        finally { pending.delete(cacheKey); }
    }
    return { lookup };
}

module.exports = { BinError, createBinLookup, normalizeResult, requestJSON };
