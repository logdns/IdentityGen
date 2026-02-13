// ═══════════════════════════════════════════════
// APP.JS — FakerAPI + Nominatim + i18n + Map
// ═══════════════════════════════════════════════

let currentCountry = 'us';
let currentLang = 'zh';
let currentIdentity = {};
let currentTheme = localStorage.getItem('idgen_theme') || 'light';

const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const CP = 'idgen_';
const gc = k => localStorage.getItem(CP + k);

// ═══════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════
const I18N = {
    zh: {
        nav_us: '美国', nav_uk: '英国',
        hero_badge: '🔥 实时数据驱动',
        hero_title: '随机身份信息生成器',
        hero_sub: '一键生成真实格式的美国和英国个人信息，支持地址、电话、邮箱等',
        select_label: '选择地区', generate_btn: '生成新身份',
        loading_text: '正在获取真实地址数据...',
        label_name: '姓名', label_gender: '性别', label_dob: '出生日期',
        label_phone: '电话号码', label_email: '电子邮箱',
        label_street: '街道地址', label_city: '城市',
        label_state_us: '州', label_zip_us: '邮政编码', label_ssn_us: '社会安全号码',
        label_state_uk: '地区', label_zip_uk: '邮编', label_ssn_uk: '国民保险号码',
        label_fulladdr: '完整地址', label_website: '个人网站',
        click_copy: '点击复制', copy_all: '复制全部信息',
        map_title: '📍 地图定位',
        footer: '© 2026 IdentityGen · by <a href="https://github.com/logdns/IdentityGen" target="_blank">github.com/logdns/IdentityGen</a>',
        toast_copied: '✅ 已复制', toast_all: '✅ 全部信息已复制',
        random_state: '🎲 随机选择', random_region: '🎲 随机选择',
        gender_male: '男', gender_female: '女', gender_other: '其他',
        copied_label: '已复制!',
        map_note_osm: '',
        map_note_google: '',
        api_error: '⚠️ 数据请求失败，使用本地数据',
        lang_switch: 'EN',
        theme_light: '☀️',
        theme_dark: '🌙',
    },
    en: {
        nav_us: 'US', nav_uk: 'UK',
        hero_badge: '🔥 Live Data-Driven',
        hero_title: 'Random Identity Generator',
        hero_sub: 'Generate realistic US & UK personal info with addresses, phone numbers & more',
        select_label: 'Region', generate_btn: 'Generate New',
        loading_text: 'Fetching real address data...',
        label_name: 'Full Name', label_gender: 'Gender', label_dob: 'Date of Birth',
        label_phone: 'Phone', label_email: 'Email',
        label_street: 'Street Address', label_city: 'City',
        label_state_us: 'State', label_zip_us: 'ZIP Code', label_ssn_us: 'SSN',
        label_state_uk: 'Region', label_zip_uk: 'Postcode', label_ssn_uk: 'NI Number',
        label_fulladdr: 'Full Address', label_website: 'Website',
        click_copy: 'Copy', copy_all: 'Copy All Info',
        map_title: '📍 Map Location',
        footer: '© 2026 IdentityGen · by <a href="https://github.com/logdns/IdentityGen" target="_blank">github.com/logdns/IdentityGen</a>',
        toast_copied: '✅ Copied', toast_all: '✅ All info copied',
        random_state: '🎲 Random', random_region: '🎲 Random',
        gender_male: 'Male', gender_female: 'Female', gender_other: 'Other',
        copied_label: 'Copied!',
        map_note_osm: '',
        map_note_google: '',
        api_error: '⚠️ Data request failed, using local data',
        lang_switch: '中文',
        theme_light: '☀️',
        theme_dark: '🌙',
    }
};

function t(key) { return I18N[currentLang][key] || key; }

function applyI18n() {
    const sfx = currentCountry === 'uk' ? '_uk' : '_us';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (k === 'label_state') { el.textContent = t('label_state' + sfx); return; }
        if (k === 'label_zip') { el.textContent = t('label_zip' + sfx); return; }
        if (k === 'label_ssn') { el.textContent = t('label_ssn' + sfx); return; }
        if (k === 'footer') { el.innerHTML = t(k); return; }
        const v = I18N[currentLang][k];
        if (v) el.textContent = v;
    });

    // Lang toggle — show what you'll switch TO
    $('lang-text').textContent = t('lang_switch');
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

    // Map note
    const prov = gc('map_provider') || 'osm';
    const noteKey = (prov === 'google' && gc('google_maps_key')) ? 'map_note_google' : 'map_note_osm';
    $('map-note').innerHTML = t(noteKey);

    // Custom branding
    const ct = gc('site_title'); if (ct) $('site-logo').textContent = ct;
    const cf = gc('site_footer'); if (cf) $('footer-text').innerHTML = cf;
}

function toggleLang() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    applyI18n();
    populateSelect();
    if (currentIdentity.name) renderIdentity();
}

// ═══════════════════════════════════════
// Theme
// ═══════════════════════════════════════
function applyTheme(theme) {
    currentTheme = theme;
    document.body.classList.toggle('dark-mode', theme === 'dark');
    localStorage.setItem('idgen_theme', theme);
    const btn = $('theme-btn');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
}

function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    initParticles();
    setupCountryNav();
    applyI18n();
    populateSelect();
    generateIdentity();
});

function setupCountryNav() {
    document.querySelectorAll('.country-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.dataset.country;
            if (c === currentCountry) return;
            currentCountry = c;
            document.querySelectorAll('.country-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.body.classList.toggle('uk-mode', c === 'uk');
            applyI18n();
            populateSelect();
            generateIdentity();
        });
    });
}

function populateSelect() {
    const sel = $('region-select');
    sel.innerHTML = '';
    if (currentCountry === 'us') {
        addOpt(sel, '', t('random_state'));
        DATA.us.states.forEach(s => addOpt(sel, s.abbr, `${s.full} (${s.abbr})`));
    } else {
        addOpt(sel, '', t('random_region'));
        DATA.uk.regions.forEach(r => addOpt(sel, r, r));
    }
}
function addOpt(sel, v, txt) {
    const o = document.createElement('option');
    o.value = v; o.textContent = txt; sel.appendChild(o);
}

// ═══════════════════════════════════════
// State / Region coordinate data
// (from original us.js / uk.js)
// ═══════════════════════════════════════
const STATE_COORDS = {
    "AL": [{ lat: 32.377716, lng: -86.300568 }, { lat: 33.520661, lng: -86.802490 }],
    "AK": [{ lat: 61.216583, lng: -149.899597 }, { lat: 58.301598, lng: -134.419998 }],
    "AZ": [{ lat: 33.448376, lng: -112.074036 }, { lat: 34.048927, lng: -111.093735 }],
    "AR": [{ lat: 34.746483, lng: -92.289597 }, { lat: 36.082157, lng: -94.171852 }],
    "CA": [{ lat: 36.778259, lng: -119.417931 }, { lat: 34.052235, lng: -118.243683 }],
    "CO": [{ lat: 39.739235, lng: -104.990250 }, { lat: 38.833881, lng: -104.821365 }],
    "CT": [{ lat: 41.763710, lng: -72.685097 }, { lat: 41.308273, lng: -72.927887 }],
    "DE": [{ lat: 39.739072, lng: -75.539787 }, { lat: 38.774055, lng: -75.139351 }],
    "FL": [{ lat: 30.332184, lng: -81.655647 }, { lat: 25.761681, lng: -80.191788 }],
    "GA": [{ lat: 33.749001, lng: -84.387985 }, { lat: 32.083541, lng: -81.099831 }],
    "HI": [{ lat: 21.306944, lng: -157.858337 }, { lat: 19.896767, lng: -155.582779 }],
    "ID": [{ lat: 43.615021, lng: -116.202316 }, { lat: 47.677683, lng: -116.780466 }],
    "IL": [{ lat: 41.878113, lng: -87.629799 }, { lat: 40.633125, lng: -89.398529 }],
    "IN": [{ lat: 39.768402, lng: -86.158066 }, { lat: 41.593369, lng: -87.346427 }],
    "IA": [{ lat: 41.586834, lng: -93.625000 }, { lat: 42.500000, lng: -94.166672 }],
    "KS": [{ lat: 39.099728, lng: -94.578568 }, { lat: 37.687176, lng: -97.330055 }],
    "KY": [{ lat: 38.252666, lng: -85.758453 }, { lat: 37.839333, lng: -84.270020 }],
    "LA": [{ lat: 30.695366, lng: -91.187393 }, { lat: 29.951065, lng: -90.071533 }],
    "ME": [{ lat: 44.310623, lng: -69.779490 }, { lat: 43.661471, lng: -70.255325 }],
    "MD": [{ lat: 38.978447, lng: -76.492180 }, { lat: 39.290386, lng: -76.612190 }],
    "MA": [{ lat: 42.360081, lng: -71.058884 }, { lat: 42.313373, lng: -71.057083 }],
    "MI": [{ lat: 42.732536, lng: -84.555534 }, { lat: 42.331429, lng: -83.045753 }],
    "MN": [{ lat: 44.953703, lng: -93.089958 }, { lat: 44.977753, lng: -93.265015 }],
    "MS": [{ lat: 32.298756, lng: -90.184807 }, { lat: 32.366806, lng: -88.703705 }],
    "MO": [{ lat: 38.576702, lng: -92.173516 }, { lat: 38.627003, lng: -90.199402 }],
    "MT": [{ lat: 46.878717, lng: -113.996586 }, { lat: 45.783287, lng: -108.500690 }],
    "NE": [{ lat: 41.256538, lng: -95.934502 }, { lat: 40.813618, lng: -96.702595 }],
    "NV": [{ lat: 39.163914, lng: -119.767403 }, { lat: 36.114647, lng: -115.172813 }],
    "NH": [{ lat: 43.208137, lng: -71.538063 }, { lat: 42.995640, lng: -71.454789 }],
    "NJ": [{ lat: 40.058323, lng: -74.405663 }, { lat: 39.364285, lng: -74.422928 }],
    "NM": [{ lat: 35.084385, lng: -106.650421 }, { lat: 32.319939, lng: -106.763653 }],
    "NY": [{ lat: 40.712776, lng: -74.005974 }, { lat: 43.299427, lng: -74.217933 }],
    "NC": [{ lat: 35.779591, lng: -78.638176 }, { lat: 35.227085, lng: -80.843124 }],
    "ND": [{ lat: 46.825905, lng: -100.778275 }, { lat: 46.877186, lng: -96.789803 }],
    "OH": [{ lat: 39.961178, lng: -82.998795 }, { lat: 41.499321, lng: -81.694359 }],
    "OK": [{ lat: 35.467560, lng: -97.516426 }, { lat: 36.153980, lng: -95.992775 }],
    "OR": [{ lat: 44.046236, lng: -123.022029 }, { lat: 45.505917, lng: -122.675049 }],
    "PA": [{ lat: 40.273191, lng: -76.886701 }, { lat: 39.952583, lng: -75.165222 }],
    "RI": [{ lat: 41.824009, lng: -71.412834 }, { lat: 41.580095, lng: -71.477429 }],
    "SC": [{ lat: 34.000710, lng: -81.034814 }, { lat: 32.776474, lng: -79.931051 }],
    "SD": [{ lat: 44.366787, lng: -100.353760 }, { lat: 43.544595, lng: -96.731103 }],
    "TN": [{ lat: 36.162663, lng: -86.781601 }, { lat: 35.149532, lng: -90.048981 }],
    "TX": [{ lat: 30.267153, lng: -97.743057 }, { lat: 29.760427, lng: -95.369804 }],
    "UT": [{ lat: 40.760780, lng: -111.891045 }, { lat: 37.774929, lng: -111.920414 }],
    "VT": [{ lat: 44.260059, lng: -72.575386 }, { lat: 44.475883, lng: -73.212074 }],
    "VA": [{ lat: 37.540726, lng: -77.436050 }, { lat: 36.852924, lng: -75.977982 }],
    "WA": [{ lat: 47.606209, lng: -122.332069 }, { lat: 47.252876, lng: -122.444290 }],
    "WV": [{ lat: 38.349820, lng: -81.632622 }, { lat: 39.629527, lng: -79.955896 }],
    "WI": [{ lat: 43.073051, lng: -89.401230 }, { lat: 43.038902, lng: -87.906471 }],
    "WY": [{ lat: 41.140259, lng: -104.820236 }, { lat: 44.276569, lng: -105.507391 }]
};

const REGION_COORDS = {
    "England": [{ lat: 51.5074, lng: -0.1278 }, { lat: 53.4808, lng: -2.2426 }],
    "Scotland": [{ lat: 55.9533, lng: -3.1883 }, { lat: 57.1497, lng: -2.0943 }],
    "Wales": [{ lat: 51.4816, lng: -3.1791 }, { lat: 53.2304, lng: -4.1297 }],
    "Northern Ireland": [{ lat: 54.5973, lng: -5.9301 }, { lat: 54.9966, lng: -7.3086 }]
};

// ═══════════════════════════════════════
// Nominatim reverse geocode
// ═══════════════════════════════════════
function getRandomCoord(coordsArray) {
    const base = pick(coordsArray);
    return {
        lat: base.lat + (Math.random() - 0.5) * 0.1,
        lng: base.lng + (Math.random() - 0.5) * 0.1
    };
}

async function fetchRealAddress(coordsArray) {
    for (let i = 0; i < 10; i++) {
        try {
            const loc = getRandomCoord(coordsArray);
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=18&addressdetails=1&accept-language=en`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'IdentityGen/1.0', 'Accept-Language': 'en-US,en;q=0.9' } });
            const data = await resp.json();
            if (data && data.address && data.address.road) {
                return {
                    houseNumber: data.address.house_number || String(randInt(1, 999)),
                    road: data.address.road,
                    city: data.address.city || data.address.town || data.address.village || data.address.county || '',
                    postcode: data.address.postcode || '',
                    state: data.address.state || '',
                    lat: loc.lat,
                    lng: loc.lng
                };
            }
        } catch (e) { /* retry */ }
    }
    return null; // fallback needed
}

// ═══════════════════════════════════════
// Generate Identity
// ═══════════════════════════════════════
async function generateIdentity() {
    const btn = $('gen-btn');
    const loading = $('loading');
    const grid = $('info-grid');

    btn.classList.add('loading');
    loading.style.display = 'flex';
    grid.style.opacity = '0.25';
    grid.style.pointerEvents = 'none';

    try {
        if (currentCountry === 'us') await generateUS();
        else await generateUK();
    } catch (e) {
        console.error('Generate error:', e);
        showToast(t('api_error'));
        buildLocalFallback();
    }

    btn.classList.remove('loading');
    loading.style.display = 'none';
    grid.style.opacity = '1';
    grid.style.pointerEvents = '';

    document.querySelectorAll('.info-card').forEach((c, i) => {
        c.style.animation = 'none';
        c.offsetHeight;
        c.style.animation = `fadeUp 0.35s ease ${i * 0.03}s both`;
    });
}

async function generateUS() {
    const selVal = $('region-select').value;
    const st = selVal ? DATA.us.states.find(s => s.abbr === selVal) : pick(DATA.us.states);
    const abbr = st.abbr;

    // Fetch person from FakerAPI + real address from Nominatim in parallel
    const [personData, addrData] = await Promise.all([
        fetchPerson('en_US'),
        fetchRealAddress(STATE_COORDS[abbr])
    ]);

    const person = personData || localPerson('us');
    const realAddr = addrData;

    let street, city, zip;
    if (realAddr) {
        street = `${realAddr.houseNumber} ${realAddr.road}`;
        city = realAddr.city || pick(DATA.us.cities[abbr] || ['Springfield']);
        zip = realAddr.postcode || genUSZip();
    } else {
        street = `${randInt(100, 9999)} ${pick(DATA.us.streets)}`;
        city = pick(DATA.us.cities[abbr] || ['Springfield']);
        zip = genUSZip();
    }

    const phone = genUSPhone(abbr);
    // Full address format: 街道地址, 城市, State, 邮编
    const fullAddr = `${street}, ${city}, ${st.full} ${abbr}, ${zip}`;

    currentIdentity = {
        name: `${person.firstname} ${person.lastname}`,
        genderRaw: person.gender || (Math.random() < 0.5 ? 'male' : 'female'),
        dob: person.birthday || genDOB(randInt(18, 75)),
        phone, email: person.email || genEmail(person.firstname, person.lastname, 'us'),
        address: street, city,
        state: `${st.full} (${abbr})`, zip,
        ssn: genSSN(),
        website: person.website || '—',
        fullAddress: fullAddr,
        lat: realAddr ? realAddr.lat : null,
        lng: realAddr ? realAddr.lng : null
    };

    renderIdentity();
    updateMap(fullAddr);
}

async function generateUK() {
    const selVal = $('region-select').value;
    const region = selVal || pick(DATA.uk.regions);

    const [personData, addrData] = await Promise.all([
        fetchPerson('en_GB'),
        fetchRealAddress(REGION_COORDS[region])
    ]);

    const person = personData || localPerson('uk');
    const realAddr = addrData;

    let street, city, zip;
    if (realAddr) {
        street = `${realAddr.houseNumber} ${realAddr.road}`;
        city = realAddr.city || pick(DATA.uk.cities[region] || ['London']);
        zip = realAddr.postcode || genUKPostcode(region);
    } else {
        street = `${randInt(1, 150)} ${pick(DATA.uk.streets)}`;
        city = pick(DATA.uk.cities[region] || ['London']);
        zip = genUKPostcode(region);
    }

    const phone = genUKPhone(region);
    const fullAddr = `${street}, ${city}, ${region}, ${zip}`;

    currentIdentity = {
        name: `${person.firstname} ${person.lastname}`,
        genderRaw: person.gender || (Math.random() < 0.5 ? 'male' : 'female'),
        dob: person.birthday || genDOB(randInt(18, 75)),
        phone, email: person.email || genEmail(person.firstname, person.lastname, 'uk'),
        address: street, city, state: region, zip,
        ssn: genNI(),
        website: person.website || '—',
        fullAddress: fullAddr,
        lat: realAddr ? realAddr.lat : null,
        lng: realAddr ? realAddr.lng : null
    };

    renderIdentity();
    updateMap(fullAddr);
}

// ═══════════════════════════════════════
// FakerAPI fetch
// ═══════════════════════════════════════
async function fetchPerson(locale) {
    try {
        const resp = await fetch(`https://fakerapi.it/api/v2/persons?_quantity=1&_locale=${locale}`);
        const json = await resp.json();
        if (json.status === 'OK' && json.data && json.data[0]) return json.data[0];
    } catch (e) { /* fallback */ }
    return null;
}

function localPerson(country) {
    const g = Math.random() < 0.5 ? 'male' : 'female';
    const set = country === 'uk' ? DATA.uk : DATA.us;
    return {
        firstname: pick(set.firstNames[g]),
        lastname: pick(set.lastNames),
        gender: g,
        birthday: genDOB(randInt(18, 75)),
        email: null,
        website: '—'
    };
}

function buildLocalFallback() {
    if (currentCountry === 'us') {
        const st = pick(DATA.us.states); const a = st.abbr;
        const p = localPerson('us');
        const street = `${randInt(100, 9999)} ${pick(DATA.us.streets)}`;
        const city = pick(DATA.us.cities[a] || ['Springfield']);
        const zip = genUSZip();
        currentIdentity = {
            name: `${p.firstname} ${p.lastname}`, genderRaw: p.gender,
            dob: p.birthday, phone: genUSPhone(a),
            email: genEmail(p.firstname, p.lastname, 'us'),
            address: street, city, state: `${st.full} (${a})`, zip,
            ssn: genSSN(), website: '—',
            fullAddress: `${street}, ${city}, ${st.full} ${a}, ${zip}`
        };
    } else {
        const region = pick(DATA.uk.regions);
        const p = localPerson('uk');
        const street = `${randInt(1, 150)} ${pick(DATA.uk.streets)}`;
        const city = pick(DATA.uk.cities[region] || ['London']);
        const zip = genUKPostcode(region);
        currentIdentity = {
            name: `${p.firstname} ${p.lastname}`, genderRaw: p.gender,
            dob: p.birthday, phone: genUKPhone(region),
            email: genEmail(p.firstname, p.lastname, 'uk'),
            address: street, city, state: region, zip,
            ssn: genNI(), website: '—',
            fullAddress: `${street}, ${city}, ${region}, ${zip}`
        };
    }
    renderIdentity();
    updateMap(currentIdentity.fullAddress);
}

function renderIdentity() {
    const ci = currentIdentity;
    const gMap = { male: 'gender_male', female: 'gender_female', other: 'gender_other' };
    $('val-name').textContent = ci.name;
    $('val-gender').textContent = t(gMap[ci.genderRaw] || 'gender_other');
    $('val-dob').textContent = ci.dob;
    $('val-phone').textContent = ci.phone;
    $('val-email').textContent = ci.email;
    $('val-address').textContent = ci.address;
    $('val-city').textContent = ci.city;
    $('val-state').textContent = ci.state;
    $('val-zip').textContent = ci.zip;
    $('val-ssn').textContent = ci.ssn;
    $('val-website').textContent = ci.website;
    $('val-fulladdr').textContent = ci.fullAddress;
}

// ═══════════════════════════════════════
// Map
// ═══════════════════════════════════════
function updateMap(address) {
    const iframe = $('map-iframe');
    const provider = gc('map_provider') || 'osm';
    const key = gc('google_maps_key') || '';
    if (provider === 'google' && key) {
        iframe.src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(address)}`;
    } else {
        iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    }
}

// ═══════════════════════════════════════
// Generators
// ═══════════════════════════════════════
function genDOB(age) {
    const y = new Date().getFullYear() - age;
    return `${y}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
}
function genUSZip() { return String(randInt(10000, 99999)); }
function genSSN() { return `${randInt(100, 999)}-${randInt(10, 99)}-${randInt(1000, 9999)}`; }
function genEmail(fn, ln, country) {
    const domains = country === 'uk'
        ? ['gmail.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.co.uk', 'btinternet.com']
        : ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    return `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1, 999)}@${pick(domains)}`;
}
function genUSPhone(st) {
    const codes = DATA.us.areaCodes[st] || ['555'];
    return `+1 (${pick(codes)}) ${randInt(200, 899)}-${String(randInt(1000, 9999))}`;
}
function genUKPostcode(region) {
    const area = pick(DATA.uk.postcodeAreas[region] || ['SW']);
    return `${area}${randInt(1, 99)} ${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`;
}
function genUKPhone(region) {
    if (Math.random() < 0.7) {
        const pre = '0' + pick(['7', '74', '75', '77', '78', '79']);
        return `+44 ${pre}${String(randInt(0, 999)).padStart(3, '0')} ${String(randInt(0, 999999)).padStart(6, '0')}`;
    }
    const codes = DATA.uk.landlineCodes[region] || ['020'];
    const code = pick(codes);
    const rem = 10 - code.length;
    const local = String(randInt(0, Math.pow(10, rem) - 1)).padStart(rem, '0');
    return `+44 ${code} ${local}`;
}
function genNI() {
    const pfx = pick(['AA', 'AB', 'AE', 'AH', 'AK', 'AL', 'AM', 'AP', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BE']);
    const n = String(randInt(100000, 999999));
    return `${pfx} ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${pick(['A', 'B', 'C', 'D'])}`;
}

// ═══════════════════════════════════════
// Copy
// ═══════════════════════════════════════
function copyField(el) {
    const val = el.querySelector('.card-value').textContent;
    if (!val || val === '—') return;
    navigator.clipboard.writeText(val).then(() => {
        showToast(t('toast_copied'));
        el.classList.add('copied');
        const badge = el.querySelector('.card-badge');
        if (badge) badge.textContent = t('copied_label');
        setTimeout(() => {
            el.classList.remove('copied');
            if (badge) badge.textContent = t('click_copy');
        }, 1500);
    });
}

function copyAll() {
    const ci = currentIdentity;
    const sfx = currentCountry === 'uk' ? '_uk' : '_us';
    const gMap = { male: 'gender_male', female: 'gender_female', other: 'gender_other' };
    const lines = [
        `${t('label_name')}: ${ci.name}`,
        `${t('label_gender')}: ${t(gMap[ci.genderRaw] || 'gender_other')}`,
        `${t('label_dob')}: ${ci.dob}`,
        `${t('label_phone')}: ${ci.phone}`,
        `${t('label_email')}: ${ci.email}`,
        `${t('label_street')}: ${ci.address}`,
        `${t('label_city')}: ${ci.city}`,
        `${t('label_state' + sfx)}: ${ci.state}`,
        `${t('label_zip' + sfx)}: ${ci.zip}`,
        `${t('label_ssn' + sfx)}: ${ci.ssn}`,
        `${t('label_website')}: ${ci.website}`,
        `${t('label_fulladdr')}: ${ci.fullAddress}`
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => showToast(t('toast_all')));
}

function showToast(msg) {
    const toast = $('toast');
    $('toast-text').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

// ═══════════════════════════════════════
// Particle Background
// ═══════════════════════════════════════
function initParticles() {
    const canvas = $('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 45; i++) {
        particles.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
            r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.35 + 0.08
        });
    }
    (function draw() {
        ctx.clearRect(0, 0, w, h);
        const pc = getComputedStyle(document.body).getPropertyValue('--particle-color').trim() || '99,102,241';
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${pc},${p.a})`; ctx.fill();
        }
        for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 140) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(${pc},${0.05 * (1 - d / 140)})`; ctx.stroke(); }
        }
        requestAnimationFrame(draw);
    })();
}
