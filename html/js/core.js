const Views = {};

const RESOURCE = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'XS-Robberies';

function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function nui(endpoint, payload = {}) {
    try {
        const res = await fetch(`https://${RESOURCE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        return data === false ? null : data;
    } catch (e) {
        return null;
    }
}

const P = (d, extra = '') => `<path d="${d}" ${extra}/>`;

function svg(inner, size = 16, sw = 1.8) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const ICON_PATHS = {
    store: P('M4 9h16l-1.2 10.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8z') + P('M8.5 9V7a3.5 3.5 0 0 1 7 0v2'),
    bank: P('M3 9.5 12 4l9 5.5') + P('M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18'),
    atm: '<rect x="4" y="4" width="16" height="16" rx="2.5"/>' + P('M8 14h8M8 10h3M8 17h5'),
    jewelry: P('M6 4h12l3 5-9 11L3 9z') + P('M3 9h18M9 4l3 5 3-5M12 9v11'),
    house: P('M4 11 12 4l8 7') + P('M6 9.5V20h12V9.5') + P('M10 20v-5h4v5'),
    vehicle: P('M3 15V9a2 2 0 0 1 2-2h9l4 4h1.5A1.5 1.5 0 0 1 21 12.5V15') + '<circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/>' + P('M9 16.5h6'),
    custom: P('M12 3v4M12 17v4M3 12h4M17 12h4') + '<circle cx="12" cy="12" r="4"/>',
    hack: '<rect x="3" y="4" width="18" height="13" rx="2"/>' + P('M7 9l3 2.5L7 14M12 14h4M8 21h8'),
    tool: P('M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5 6.5 20.5l5.7-5.7a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z'),
    keypad: '<rect x="5" y="3" width="14" height="18" rx="2.5"/>' + P('M9 7.5h.01M12 7.5h.01M15 7.5h.01M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M10 18h4', 'stroke-width="2.6"'),
    camera: '<rect x="3" y="7" width="13" height="10" rx="2"/>' + P('M16 10.5 21 8v8l-5-2.5'),
    power: P('M13 2 4.5 13.5H12L11 22l8.5-11.5H12z'),
    register: '<rect x="4" y="10" width="16" height="10" rx="1.5"/>' + P('M7 10V6h7v4M14 7h4l1 3M8 14h2M12 14h2M16 14h.01M8 17h8'),
    safe: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/>' + P('M12 8v1M12 15v1M8 12h1M15 12h1M6 20v1.5M18 20v1.5'),
    container: P('M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z') + P('M3 8.5 12 13l9-4.5M12 13v7'),
    twoman: '<circle cx="9" cy="8" r="3"/>' + P('M3.5 19a5.5 5.5 0 0 1 11 0') + '<circle cx="17" cy="9" r="2.5"/>' + P('M16 14a4.5 4.5 0 0 1 5 4.5'),
    hostage: '<circle cx="10" cy="8" r="3.5"/>' + P('M3.5 20a6.5 6.5 0 0 1 10-5.5') + '<rect x="15" y="15" width="6" height="5" rx="1"/>' + P('M16.5 15v-1.5a1.5 1.5 0 0 1 3 0V15'),
    hold: P('M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9'),
    doorlock: P('M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18') + P('M14.5 12h.01', 'stroke-width="3"'),
    guard: P('M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z') + P('M9 12l2 2 4-4'),
    laser: P('M4 4v16M20 4v16M4 8h16M4 12h16M4 16h16', 'stroke-dasharray="2 2.5"'),
    escape: P('M5 21V4M5 4h11l-2 4 2 4H5'),
    prop: P('M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z') + P('M3.5 7.5 12 12l8.5-4.5M12 12v9'),
    plus: P('M12 5v14M5 12h14'),
    place: '<circle cx="12" cy="12" r="7"/>' + P('M12 2v4M12 18v4M2 12h4M18 12h4') + '<circle cx="12" cy="12" r="1.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/>' + P('M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'),
    trash: P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6'),
    goto: P('M5 12h14M13 6l6 6-6 6'),
    live: '<circle cx="12" cy="12" r="3"/>' + P('M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14'),
    history: P('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5') + P('M12 7v5l3 2'),
    settings: '<circle cx="12" cy="12" r="3"/>' + P('M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'),
    search: '<circle cx="11" cy="11" r="7"/>' + P('M20 20l-3.5-3.5'),
    zoomIn: '<circle cx="11" cy="11" r="7"/>' + P('M20 20l-3.5-3.5M11 8v6M8 11h6'),
    zoomOut: '<circle cx="11" cy="11" r="7"/>' + P('M20 20l-3.5-3.5M8 11h6'),
    fit: P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
    labels: P('M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z') + P('M7.5 7.5h.01', 'stroke-width="3"'),
    close: P('M6 6l12 12M18 6 6 18'),
    import: P('M12 3v12M7 10l5 5 5-5M4 19h16'),
    export: P('M12 15V3M7 8l5-5 5 5M4 19h16'),
    play: P('M7 4.5v15l12-7.5z'),
    check: P('M5 12.5l4.5 4.5L19 7.5'),
    warn: P('M12 3 2 20h20zM12 10v4M12 17h.01'),
    walk: '<circle cx="13" cy="4.5" r="1.8"/>' + P('M9 21l2.5-6 2.5 2v4M7.5 11.5 10 8.5l3.5-.5 2.5 3.5 3 1M11.5 15l1-6'),
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/>' + P('M8 10V7a4 4 0 0 1 8 0v3'),
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>' + P('M6 9.5v.01M18 14.5v.01', 'stroke-width="2.6"'),
    dirty: P('M5 7h14l-1 13H6z') + P('M9 7V5a3 3 0 0 1 6 0v2M10 12.5c0-1 1-1.5 2-1.5s2 .5 2 1.5-1 1.3-2 1.5-2 .5-2 1.5 1 1.5 2 1.5 2-.5 2-1.5M12 10v1M12 17v1'),
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/>' + P('M2.5 9.5h19M6 15h4'),
    pin: P('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z') + '<circle cx="12" cy="9.5" r="2.5"/>',
    ban: '<circle cx="12" cy="12" r="9"/>' + P('M5.6 5.6l12.8 12.8'),
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    model: P('M4 7l8-4 8 4-8 4z') + P('M4 7v10l8 4 8-4V7M12 11v10'),
    bolt: P('M13 2 4.5 13.5H12L11 22l8.5-11.5H12z'),
    dial: '',
};

function icon(name, size = 16, sw = 1.8) {
    return svg(ICON_PATHS[name] || ICON_PATHS.custom, size, sw);
}

const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="#7cc4ff" stroke-width="2"/><g class="dial"><circle cx="13" cy="13" r="5" stroke="#3b82ff" stroke-width="2"/><path d="M13 6.5v2" stroke="#3b82ff" stroke-width="2" stroke-linecap="round"/></g><path d="M13 2v3M13 21v3M2 13h3M21 13h3" stroke="#7cc4ff" stroke-width="2"/></svg>`;

function rgbOf(colour, alpha) {
    const c = Array.isArray(colour) ? colour : [90, 162, 255];
    return alpha === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function colourVars(colour) {
    return `--c:${rgbOf(colour)};--cd:${rgbOf(colour, .16)};--cb:${rgbOf(colour, .45)};--cg:${rgbOf(colour, .5)}`;
}

function money(n) {
    const v = Math.round(Number(n) || 0);
    if (v >= 1000000) return `$${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}m`;
    if (v >= 10000) return `$${Math.round(v / 1000)}k`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${v}`;
}

function moneyRange(min, max) {
    if (!max && !min) return '—';
    if (Math.round(min) === Math.round(max)) return money(max);
    return `${money(min)}–${money(max).slice(1)}`;
}

function mmss(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function duration(seconds) {
    const s = Math.round(Number(seconds) || 0);
    if (!s) return 'none';
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    const h = s / 3600;
    return `${h.toFixed(h >= 10 ? 0 : 1).replace(/\.0$/, '')}h`;
}

function fmtCoords(c) {
    if (!c) return 'not placed';
    return `${Number(c.x).toFixed(1)}, ${Number(c.y).toFixed(1)}, ${Number(c.z).toFixed(1)}`;
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function joaat(key) {
    const s = String(key).toLowerCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h + s.charCodeAt(i)) >>> 0;
        h = (h + (h << 10)) >>> 0;
        h = (h ^ (h >>> 6)) >>> 0;
    }
    h = (h + (h << 3)) >>> 0;
    h = (h ^ (h >>> 11)) >>> 0;
    h = (h + (h << 15)) >>> 0;
    return h >>> 0;
}

function toUnsigned(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return v < 0 ? v + 4294967296 : v;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
        o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
}

function readInput(el) {
    const t = el.dataset.t || (el.type === 'checkbox' ? 'bool' : el.type === 'number' ? 'num' : 'str');
    if (t === 'bool') return el.checked;
    if (t === 'num') {
        const v = parseFloat(el.value);
        return Number.isFinite(v) ? v : (el.dataset.d !== undefined ? parseFloat(el.dataset.d) : 0);
    }
    if (t === 'list') return el.value.split(',').map(x => x.trim()).filter(Boolean);
    return el.value;
}

function bindForm(root, target, onChange) {
    root._formTarget = target;
    root._formChange = onChange;
    if (root._formBound) return;
    root._formBound = true;

    const resolve = (el) => {
        const t = root._formTarget;
        return typeof t === 'function' ? t(el) : t;
    };

    const handler = (e) => {
        const el = e.target.closest('[data-k]');
        if (!el || !root.contains(el) || el.classList.contains('seg')) return;
        const tgt = resolve(el);
        if (!tgt) return;
        let value = readInput(el);
        if (e.type === 'change' && el.dataset.t === 'num') value = keepInRange(el, value);
        setPath(tgt, el.dataset.k, value);
        root._formChange && root._formChange(el.dataset.k, value, el, e.type);
    };
    root.addEventListener('input', handler);
    root.addEventListener('change', handler);

    root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-seg]');
        if (!btn || !root.contains(btn)) return;
        const group = btn.closest('.seg');
        if (!group || !group.dataset.k) return;
        const tgt = resolve(group);
        if (!tgt) return;
        group.querySelectorAll('[data-seg]').forEach(b => b.classList.toggle('on', b === btn));
        let value = btn.dataset.seg;
        if (group.dataset.t === 'num') value = parseFloat(value);
        setPath(tgt, group.dataset.k, value);
        root._formChange && root._formChange(group.dataset.k, value, group, 'seg');
    });
}

function keepInRange(el, value) {
    if (!Number.isFinite(value)) return value;
    const min = el.min !== '' ? parseFloat(el.min) : -Infinity;
    const max = el.max !== '' ? parseFloat(el.max) : Infinity;
    const kept = Math.min(max, Math.max(min, value));
    if (kept === value) return value;

    el.value = kept;
    const field = el.closest('.f');
    const label = (field && field.querySelector('label') && field.querySelector('label').textContent.trim()) || 'That';
    const unit = (field && field.querySelector('.unit em') && field.querySelector('.unit em').textContent.trim()) || '';
    toast(`${label} set to ${kept}${unit ? ' ' + unit : ''}`, value > max ? `The most it takes is ${max}${unit ? ' ' + unit : ''}.` : `The least it takes is ${min}${unit ? ' ' + unit : ''}.`, 'warning', 3600);
    return kept;
}

function fieldNumber(k, label, value, opts = {}) {
    return `
        <div class="f${opts.wide ? ' wide' : ''}">
            <label>${esc(label)}</label>
            <div class="unit">
                <input type="number" data-k="${esc(k)}" data-t="num" value="${esc(value ?? '')}"
                    ${opts.min !== undefined ? `min="${opts.min}"` : ''} ${opts.max !== undefined ? `max="${opts.max}"` : ''}
                    step="${opts.step || 'any'}" placeholder="${esc(opts.placeholder ?? '')}">
                ${opts.unit ? `<em>${esc(opts.unit)}</em>` : ''}
            </div>
            ${opts.hint ? `<div class="fh">${esc(opts.hint)}</div>` : ''}
        </div>`;
}

function fieldText(k, label, value, opts = {}) {
    return `
        <div class="f${opts.wide ? ' wide' : ''}">
            <label>${esc(label)}</label>
            <input type="text" data-k="${esc(k)}" data-t="${opts.list ? 'list' : 'str'}" value="${esc(value ?? '')}" placeholder="${esc(opts.placeholder || '')}" spellcheck="false">
            ${opts.hint ? `<div class="fh">${esc(opts.hint)}</div>` : ''}
        </div>`;
}

function fieldSelect(k, label, value, options, opts = {}) {
    const list = options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('');
    return `
        <div class="f${opts.wide ? ' wide' : ''}">
            <label>${esc(label)}</label>
            <select data-k="${esc(k)}" data-t="${opts.num ? 'num' : 'str'}">${list}</select>
            ${opts.hint ? `<div class="fh">${esc(opts.hint)}</div>` : ''}
        </div>`;
}

function fieldSeg(k, label, value, options, opts = {}) {
    return `
        <div class="f${opts.wide ? ' wide' : ''}">
            ${label ? `<label>${esc(label)}</label>` : ''}
            <div class="seg" data-k="${esc(k)}" ${opts.num ? 'data-t="num"' : ''}>
                ${options.map(o => `<button type="button" data-seg="${esc(o.value)}" class="${String(o.value) === String(value) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}
            </div>
            ${opts.hint ? `<div class="fh">${esc(opts.hint)}</div>` : ''}
        </div>`;
}

function fieldSwitch(k, label, value, opts = {}) {
    return `
        <div class="f${opts.wide ? ' wide' : ''}">
            <label class="switch"><span class="t">${esc(label)}</span><input type="checkbox" data-k="${esc(k)}" data-t="bool" ${value ? 'checked' : ''}><span class="sw"></span></label>
            ${opts.hint ? `<div class="fh">${esc(opts.hint)}</div>` : ''}
        </div>`;
}

function coordsField(prefix, coords, opts = {}) {
    const c = coords || { x: 0, y: 0, z: 0, h: 0 };
    const cell = (axis, digits, unit) => `
        <div class="unit"><input type="number" step="0.001" data-axis="${axis}" value="${esc(Number(c[axis] || 0).toFixed(digits))}"><em>${unit}</em></div>`;
    return `
        <div class="f wide">
            <label>${esc(opts.label || 'Position')}</label>
            <div class="coords" data-coords="${esc(prefix)}">
                ${cell('x', 2, 'x')}${cell('y', 2, 'y')}${cell('z', 2, 'z')}${cell('h', 1, '°')}
            </div>
            <div class="fh">${esc(opts.hint || 'Type them, or paste x, y, z (and heading) into any box.')}</div>
        </div>`;
}

function bindCoords(root, prefix, getTarget, onChange) {
    const row = root.querySelector(`[data-coords="${prefix}"]`);
    if (!row) return;

    const commit = () => {
        const target = getTarget();
        if (!target) return;
        const next = {};
        row.querySelectorAll('[data-axis]').forEach(input => {
            const v = parseFloat(input.value);
            next[input.dataset.axis] = Number.isFinite(v) ? v : 0;
        });
        onChange(next);
    };

    row.addEventListener('change', commit);

    row.addEventListener('paste', (e) => {
        const raw = (e.clipboardData || window.clipboardData).getData('text') || '';
        const text = raw.replace(/[A-Za-z_]\w*\s*\(/g, '(');
        const parts = text.match(/-?\d+(?:\.\d+)?/g);
        if (!parts || parts.length < 3) return;
        e.preventDefault();
        ['x', 'y', 'z', 'h'].forEach((axis, i) => {
            const field = row.querySelector(`[data-axis="${axis}"]`);
            if (field && parts[i] !== undefined) field.value = parts[i];
        });
        commit();
    });
}

let toastRoot = null;

function toast(title, body = '', type = 'info', ms = 4200) {
    if (!toastRoot) toastRoot = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const mark = { info: 'i', success: '✓', error: '✕', warning: '!' }[type] || 'i';
    el.innerHTML = `<div class="ti">${mark}</div><div><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}</div>`;
    toastRoot.appendChild(el);
    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 320);
    }, ms);
}

function report(result, title, body) {
    if (result && result.ok) {
        if (title) toast(title, body || '', 'success');
        return true;
    }
    toast('That did not work', (result && result.error) || 'The server did not answer.', 'error');
    return false;
}

let modalOpen = null;

function closeModal() {
    if (modalOpen) {
        modalOpen.remove();
        modalOpen = null;
    }
}

function modal({ title, sub = '', body = '', size = '', confirm = null, confirmLabel = 'Save', danger = false, cancelLabel = 'Cancel', onOpen = null, foot = true }) {
    closeModal();
    const host = document.querySelector('.window') || document.body;
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
        <div class="modal ${size}">
            <div class="modal-head">
                <div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
                <button class="icon-btn" data-x>${icon('close', 15)}</button>
            </div>
            <div class="modal-body">${body}</div>
            ${foot ? `<div class="modal-foot">
                <button class="btn" data-x>${esc(confirm ? cancelLabel : 'Close')}</button>
                ${confirm ? `<button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>` : ''}
            </div>` : ''}
        </div>`;
    host.appendChild(back);
    modalOpen = back;

    back.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', closeModal));
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });

    const ok = back.querySelector('[data-ok]');
    if (ok) {
        ok.addEventListener('click', async () => {
            ok.disabled = true;
            const keep = await confirm(back);
            ok.disabled = false;
            if (keep !== false && modalOpen === back) closeModal();
        });
    }

    const first = back.querySelector('input:not([type=checkbox]), textarea');
    if (first) setTimeout(() => first.focus(), 30);
    if (onOpen) onOpen(back);
    return back;
}

function confirmDanger(title, message, onConfirm, label = 'Delete') {
    modal({
        title,
        body: `<div class="hint" style="font-size:13px;color:var(--ink2)">${esc(message)}</div>`,
        confirm: async () => { await onConfirm(); },
        confirmLabel: label,
        danger: true,
    });
}

function itemPicker(k, value, placeholder = 'Any item name', attrs = '') {
    const id = `pk-${Math.random().toString(36).slice(2, 9)}`;
    return `
        <div class="picker" data-picker="${id}">
            <input type="text" id="${id}" class="inp" ${k ? `data-k="${esc(k)}"` : ''} value="${esc(value || '')}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" ${attrs}>
            <div class="picker-list" hidden></div>
            <div class="picker-note"></div>
        </div>`;
}

function itemLabel(name) {
    const found = (State.items || []).find(i => i.name === name);
    return found ? found.label : null;
}

function bindPickers(root) {
    root.querySelectorAll('[data-picker]').forEach(wrap => {
        if (wrap.dataset.bound) return;
        wrap.dataset.bound = '1';

        const input = wrap.querySelector('input');
        const list = wrap.querySelector('.picker-list');
        const note = wrap.querySelector('.picker-note');
        let active = -1;

        const updateNote = () => {
            const v = input.value.trim();
            if (!v) { note.textContent = ''; note.className = 'picker-note'; return; }
            const label = itemLabel(v);
            note.textContent = label ? label : 'Not in your item list. It will still be used.';
            note.className = `picker-note ${label ? 'known' : 'unknown'}`;
        };

        const rows = () => Array.from(list.querySelectorAll('.picker-row'));
        const close = () => { list.hidden = true; active = -1; };

        const choose = (value) => {
            input.value = value;
            updateNote();
            close();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const open = () => {
            const q = input.value.trim().toLowerCase();
            const items = State.items || [];
            const matches = (q ? items.filter(i => i.name.toLowerCase().includes(q) || (i.label || '').toLowerCase().includes(q)) : items).slice(0, 60);
            list.innerHTML = matches.length
                ? matches.map(i => `<div class="picker-row" data-v="${esc(i.name)}"><span>${esc(i.label)}</span><span>${esc(i.name)}</span></div>`).join('')
                : `<div class="picker-empty">${items.length ? 'Nothing matches. Type it anyway and it will be used.' : 'Your inventory sent no item list. Type the item name.'}</div>`;
            list.hidden = false;
            active = -1;
            list.querySelectorAll('.picker-row').forEach(row => row.addEventListener('mousedown', (e) => { e.preventDefault(); choose(row.dataset.v); }));
        };

        input.addEventListener('focus', open);
        input.addEventListener('input', () => { if (document.activeElement === input) open(); updateNote(); });
        input.addEventListener('blur', () => setTimeout(close, 120));
        input.addEventListener('keydown', (e) => {
            const all = rows();
            if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, all.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
            else if (e.key === 'Enter' && active >= 0 && all[active]) { e.preventDefault(); choose(all[active].dataset.v); return; }
            else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); return; }
            else return;
            all.forEach((r, i) => r.classList.toggle('active', i === active));
            if (all[active]) all[active].scrollIntoView({ block: 'nearest' });
        });

        updateNote();
    });
}
