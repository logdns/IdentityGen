'use strict';

(() => {
    const messages = {
        en: {
            intro: 'Look up an issuing bank using only a 6- or 8-digit BIN/IIN. Never enter a full card number.',
            input: 'BIN / IIN', lookup: 'Look up', close: 'Close', loading: 'Looking up…',
            disclaimer: 'Reference data only. A BIN lookup does not verify card validity, balance or ownership. Unknown fields are not inferred.',
            invalid_bin: 'Enter exactly 6 or 8 digits. Do not enter a full card number.',
            disabled: 'BIN lookup is disabled by the administrator.',
            not_configured: 'HandyAPI is not configured. Contact the administrator.',
            not_found: 'No matching BIN was found.', rate_limit: 'Too many requests. Please try again later.',
            provider_rate_limit: 'The backup service quota is exhausted. Please try again later.',
            provider_auth: 'The provider rejected the API key. Contact the administrator.',
            busy: 'The lookup service is busy. Please try again shortly.',
            error: 'The lookup service is unavailable. Please try again later.',
            success: 'Lookup complete.', source: 'Source', cached: 'Cached',
            fallback: 'Backup source used; HandyAPI was unavailable.',
            approximate: '6-digit prefix match only — this is not an exact match for the requested 8-digit IIN.',
            six: '6-digit BINs may cover multiple issuers or products. Use an 8-digit IIN when available.',
            eight: '8-digit IIN lookup.', unknown: 'Unknown', yes: 'Yes', no: 'No',
            scheme: 'Scheme / network', type: 'Card type', tier: 'Tier / brand', issuer: 'Issuer / bank',
            country: 'Country', luhn: 'Luhn supported', prepaid: 'Prepaid', number_length: 'Card number length',
            bank_url: 'Bank website', bank_phone: 'Bank phone', bank_city: 'Bank city'
        },
        'zh-CN': {
            intro: '仅使用 6 位 BIN 或 8 位 IIN 查询发卡信息。请勿输入完整银行卡号。',
            input: 'BIN / IIN', lookup: '查询', close: '关闭', loading: '正在查询…',
            disclaimer: '数据仅供参考，不代表银行卡有效、余额或持有人验证。未知字段不会猜测补全。',
            invalid_bin: '请输入恰好 6 位或 8 位数字，请勿输入完整银行卡号。',
            disabled: '管理员已关闭 BIN 查询。', not_configured: 'HandyAPI 尚未配置，请联系管理员。',
            not_found: '未找到匹配的 BIN。', rate_limit: '查询过于频繁，请稍后再试。',
            provider_rate_limit: '备用接口配额已用尽，请稍后再试。', provider_auth: '接口拒绝了 API Key，请联系管理员。',
            busy: '查询服务繁忙，请稍后再试。', error: '查询服务暂不可用，请稍后再试。',
            success: '查询完成。', source: '来源', cached: '缓存', fallback: 'HandyAPI 不可用，已使用备用来源。',
            approximate: '仅匹配前 6 位 BIN，并非所输入 8 位 IIN 的精确结果。',
            six: '6 位 BIN 可能对应多个银行或卡产品，建议优先使用 8 位 IIN。', eight: '8 位 IIN 查询。',
            unknown: '未知', yes: '是', no: '否', scheme: '卡组织 / 网络', type: '卡类型', tier: '卡等级 / 品牌',
            issuer: '发卡行', country: '国家 / 地区', luhn: '支持 Luhn 校验', prepaid: '预付卡',
            number_length: '卡号长度', bank_url: '银行网站', bank_phone: '银行电话', bank_city: '银行城市'
        },
        'zh-TW': {
            intro: '僅使用 6 位 BIN 或 8 位 IIN 查詢發卡資訊。請勿輸入完整銀行卡號。',
            input: 'BIN / IIN', lookup: '查詢', close: '關閉', loading: '正在查詢…',
            disclaimer: '資料僅供參考，不代表卡片有效、餘額或持有人驗證。未知欄位不會推測補全。',
            invalid_bin: '請輸入恰好 6 位或 8 位數字，請勿輸入完整卡號。',
            disabled: '管理員已關閉 BIN 查詢。', not_configured: 'HandyAPI 尚未設定，請聯絡管理員。',
            not_found: '找不到匹配的 BIN。', rate_limit: '查詢過於頻繁，請稍後再試。',
            provider_rate_limit: '備用接口配額已用盡，請稍後再試。', provider_auth: '接口拒絕 API Key，請聯絡管理員。',
            busy: '查詢服務忙碌，請稍後再試。', error: '查詢服務暫時無法使用，請稍後再試。',
            success: '查詢完成。', source: '來源', cached: '快取', fallback: 'HandyAPI 無法使用，已使用備用來源。',
            approximate: '僅匹配前 6 位 BIN，並非所輸入 8 位 IIN 的精確結果。',
            six: '6 位 BIN 可能對應多家銀行或卡產品，建議優先使用 8 位 IIN。', eight: '8 位 IIN 查詢。',
            unknown: '未知', yes: '是', no: '否', scheme: '卡組織 / 網路', type: '卡類型', tier: '卡等級 / 品牌',
            issuer: '發卡行', country: '國家 / 地區', luhn: '支援 Luhn 校驗', prepaid: '預付卡',
            number_length: '卡號長度', bank_url: '銀行網站', bank_phone: '銀行電話', bank_city: '銀行城市'
        },
        ja: {
            intro: '6桁の BIN または8桁の IIN のみを入力してください。カード番号全体は入力しないでください。',
            input: 'BIN / IIN', lookup: '検索', close: '閉じる', loading: '検索中…',
            disclaimer: '参考情報です。カードの有効性、残高、所有者を確認するものではありません。不明な項目は推測しません。',
            invalid_bin: '6桁または8桁の数字を入力してください。カード番号全体は入力しないでください。',
            disabled: '管理者が BIN 検索を無効にしました。', not_configured: 'HandyAPI が未設定です。管理者にお問い合わせください。',
            not_found: '該当する BIN がありません。', rate_limit: 'リクエストが多すぎます。しばらくお待ちください。',
            provider_rate_limit: '予備サービスの利用制限に達しました。', provider_auth: 'API キーが拒否されました。管理者にお問い合わせください。',
            busy: 'サービスが混雑しています。', error: '現在検索できません。後でもう一度お試しください。',
            success: '検索が完了しました。', source: '情報源', cached: 'キャッシュ', fallback: 'HandyAPI が利用できないため、予備サービスを使用しました。',
            approximate: '先頭6桁のみの結果です。8桁の IIN の完全一致ではありません。',
            six: '6桁の BIN は複数の銀行や商品に対応する場合があります。8桁の IIN を推奨します。', eight: '8桁の IIN 検索。',
            unknown: '不明', yes: 'はい', no: 'いいえ', scheme: 'ネットワーク', type: 'カード種別', tier: 'グレード / ブランド',
            issuer: '発行銀行', country: '国 / 地域', luhn: 'Luhn 対応', prepaid: 'プリペイド',
            number_length: 'カード番号の桁数', bank_url: '銀行サイト', bank_phone: '銀行電話', bank_city: '銀行所在地'
        }
    };
    const $ = id => document.getElementById(id);
    const dialog = $('bin-dialog');
    let result = null;
    let status = '';
    let loading = false;
    const t = key => (messages[document.documentElement.lang] || messages.en)[key] || messages.en[key] || messages.en.error;

    function render() {
        document.querySelectorAll('[data-bin-i18n]').forEach(el => { el.textContent = t(el.dataset.binI18n); });
        $('bin-close').setAttribute('aria-label', t('close'));
        $('bin-submit').textContent = t(loading ? 'loading' : 'lookup');
        $('bin-submit').disabled = loading;
        $('bin-form').setAttribute('aria-busy', String(loading));
        $('bin-status').textContent = status ? t(status) : '';
        $('bin-status').classList.toggle('bin-error', Boolean(status && !['success', 'loading'].includes(status)));
        $('bin-results').hidden = !result;
        if (!result) return;
        $('bin-result-prefix').textContent = `BIN / IIN ${result.bin}`;
        $('bin-source').textContent = `${t('source')}: ${result.source === 'handyapi' ? 'HandyAPI' : 'Binlist'}${result.cached ? ` · ${t('cached')}` : ''}`;
        const precision = result.precision < result.bin.length ? 'approximate' : result.precision === 6 ? 'six' : 'eight';
        $('bin-precision').textContent = `${result.fallback_reason ? t('fallback') + ' ' : ''}${t(precision)}`;
        const grid = $('bin-result-grid');
        grid.replaceChildren();
        ['scheme', 'type', 'tier', 'issuer', 'country', 'luhn', 'prepaid', 'number_length', 'bank_url', 'bank_phone', 'bank_city'].forEach(key => {
            const dt = document.createElement('dt');
            const dd = document.createElement('dd');
            dt.textContent = t(key);
            const value = key === 'country' ? [result.country.name, result.country.code].filter(Boolean).join(' / ') : result[key];
            dd.textContent = typeof value === 'boolean' ? t(value ? 'yes' : 'no') : value === null || value === undefined || value === '' ? t('unknown') : String(value);
            const cell = document.createElement('div');
            cell.append(dt, dd);
            grid.appendChild(cell);
        });
    }

    $('bin-open').addEventListener('click', () => {
        render();
        dialog.showModal();
        $('bin-input').focus();
    });
    $('bin-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => $('bin-open').focus());
    $('bin-input').addEventListener('input', () => {
        result = null;
        status = '';
        render();
    });
    $('bin-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (loading) return;
        result = null;
        const bin = $('bin-input').value.trim();
        if (!/^(?:\d{6}|\d{8})$/.test(bin)) {
            status = 'invalid_bin';
            render();
            return;
        }
        loading = true;
        $('bin-input').readOnly = true;
        status = 'loading';
        render();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('api?action=binlookup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bin }), signal: controller.signal
            });
            const json = await response.json();
            if (response.ok && json.status === 'ok') { result = json.data; status = 'success'; }
            else status = json.code || 'error';
        } catch (e) { status = 'error'; }
        finally {
            clearTimeout(timer);
            loading = false;
            $('bin-input').readOnly = false;
            render();
        }
    });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
})();
