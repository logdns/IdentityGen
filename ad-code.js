(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AdCode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const PREFIX = 'identitygen-ad:v1:';
    const MAX_LENGTH = 30000;
    const FORMATS = ['auto', 'html', 'js', 'url'];
    const MODES = ['auto', 'frame', 'page'];
    const SLOTS = ['head', 'top', 'inline', 'footer', 'left', 'right'];

    function decode(value) {
        const raw = String(value || '');
        if (!raw.startsWith(PREFIX)) return raw;
        try {
            const encoded = raw.slice(PREFIX.length);
            if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return '';
            if (typeof Buffer !== 'undefined') return new TextDecoder('utf-8', { fatal:true }).decode(Buffer.from(encoded, 'base64'));
            return new TextDecoder('utf-8', { fatal:true }).decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
        } catch (_) { return ''; }
    }

    function encode(value) {
        const raw = String(value || '');
        if (!raw.trim()) return '';
        if (raw.startsWith(PREFIX)) return raw;
        if (typeof Buffer !== 'undefined') return PREFIX + Buffer.from(raw, 'utf8').toString('base64');
        let binary = '';
        new TextEncoder().encode(raw).forEach(byte => { binary += String.fromCharCode(byte); });
        return PREFIX + btoa(binary);
    }

    function scriptUrl(value) {
        const raw = String(value || '').trim();
        if (!/^(?:https?:)?\/\//i.test(raw)) throw new Error('广告脚本 URL 必须使用 HTTP(S)，生产环境请使用 HTTPS');
        const url = new URL(raw, 'https://example.invalid/');
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('不支持的广告脚本 URL');
        return raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function normalize(value, format = 'auto') {
        const raw = decode(value).trim();
        if (!raw) return '';
        if (!FORMATS.includes(format)) throw new Error('不支持的广告代码类型');
        if (format === 'url' || (format === 'auto' && /^(?:https?:)?\/\/\S+$/i.test(raw))) {
            return `<script src="${scriptUrl(raw)}"></script>`;
        }
        const isJS = format === 'js' || (format === 'auto' && !raw.startsWith('<') &&
            /^(?:\/\*|\/\/|\(?\s*(?:async\s+)?function\b|[!(]|(?:var|let|const|if|window|document|console)\b|[\w$]+(?:\.[\w$]+)*\s*(?:\(|=))|\b(?:atOptions|adsbygoogle|googletag)\b|\bdocument\.(?:write|writeln|createElement)\b|\.js\b/.test(raw));
        if (format !== 'html' && isJS) return `<script>${raw.replace(/<\/script/gi, '<\\/script')}</script>`;
        return raw;
    }

    function executionMode(html, mode = 'auto') {
        if (!MODES.includes(mode)) throw new Error('不支持的广告执行方式');
        if (mode !== 'auto') return mode;
        return /<script\b/i.test(html) && !/adsbygoogle|googletag|googlesyndication\.com|securepubads\.g\.doubleclick\.net/i.test(html) ? 'frame' : 'page';
    }

    return { PREFIX, MAX_LENGTH, FORMATS, MODES, SLOTS, decode, encode, normalize, executionMode };
});
