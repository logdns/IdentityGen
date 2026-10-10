'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { requestJSON } = require('../bin-lookup');

test('rejected provider bodies are terminated with error listeners installed before status branching', async () => {
    const original = https.get;
    let response;
    let requestDestroyed = false;
    try {
        https.get = (url, options, callback) => {
            const request = new EventEmitter();
            request.destroy = () => { requestDestroyed = true; request.emit('close'); };
            process.nextTick(() => {
                response = new EventEmitter();
                response.statusCode = 503;
                response.destroy = () => {
                    assert.ok(response.listenerCount('error') > 0);
                    assert.ok(response.listenerCount('aborted') > 0);
                    response.emit('error', new Error('fixture only'));
                };
                callback(response);
            });
            return request;
        };
        await assert.rejects(requestJSON('https://fixture.invalid/', {}), { code: 'provider_unavailable' });
        assert.equal(requestDestroyed, true);
    } finally { https.get = original; }
});

test('success-body abort, malformed JSON and oversized body are contained', async () => {
    const original = https.get;
    try {
        for (const mode of ['abort', 'json', 'oversize']) {
            https.get = (url, options, callback) => {
                const request = new EventEmitter();
                request.destroy = error => { if (error) request.emit('error', error); request.emit('close'); };
                process.nextTick(() => {
                    const response = new EventEmitter();
                    response.statusCode = 200;
                    callback(response);
                    if (mode === 'abort') response.emit('aborted');
                    else {
                        response.emit('data', Buffer.from(mode === 'json' ? '{invalid' : 'x'.repeat(32769)));
                        response.emit('end');
                    }
                    request.emit('close');
                });
                return request;
            };
            await assert.rejects(requestJSON('https://fixture.invalid/', {}), {
                code: mode === 'abort' ? 'provider_unavailable' : 'invalid_response'
            });
        }
    } finally { https.get = original; }
});
