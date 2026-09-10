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
        return await res.json();
    } catch (e) {
        return null;
    }
}

const TOAST_ICONS = { info: 'i', success: '✓', error: '✕', warning: '!' };

function toast(title, body = '', type = 'info', duration = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <div class="toast-icon">${TOAST_ICONS[type] || 'i'}</div>
        <div class="toast-content">
            <div class="toast-title">${esc(title)}</div>
            ${body ? `<div class="toast-body">${esc(body)}</div>` : ''}
        </div>`;

    document.getElementById('toast-container').appendChild(el);

    setTimeout(() => {
        el.style.transition = 'opacity .3s ease, transform .3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

function reportResult(result, successTitle, successBody) {
    if (result && result.ok) {
        if (successTitle) toast(successTitle, successBody || '', 'success');
        return true;
    }
    toast('Could not save', (result && result.error) || 'The server refused it.', 'error');
    return false;
}

function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

function modal(title, bodyHtml, onConfirm, confirmLabel = 'Save', size = '') {
    const root = document.getElementById('modal-root');
    const readOnly = typeof onConfirm !== 'function';

    root.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal ${size}">
                <div class="modal-header">
                    <div class="modal-title">${esc(title)}</div>
                    <button class="modal-close" data-modal-cancel>&times;</button>
                </div>
                <div class="modal-body">${bodyHtml}</div>
                <div class="modal-footer">
                    ${readOnly ? '' : '<button class="btn btn-ghost" data-modal-cancel>Cancel</button>'}
                    <button class="btn ${readOnly ? 'btn-ghost' : 'btn-primary'}" data-modal-confirm>
                        ${esc(readOnly ? 'Close' : confirmLabel)}
                    </button>
                </div>
            </div>
        </div>`;

    root.querySelectorAll('[data-modal-cancel]').forEach(el =>
        el.addEventListener('click', closeModal));

    root.querySelector('[data-modal-confirm]').addEventListener('click', async (e) => {
        if (readOnly) { closeModal(); return; }

        const btn = e.currentTarget;
        btn.disabled = true;
        const keepOpen = await onConfirm();
        btn.disabled = false;
        if (keepOpen !== false) closeModal();
    });

    const first = root.querySelector('input, textarea, select');
    if (first) first.focus();
}

function confirmDanger(title, message, onConfirm, confirmLabel = 'Delete') {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">${esc(title)}</div>
                    <button class="modal-close" data-modal-cancel>&times;</button>
                </div>
                <div class="modal-body"><div class="field-hint" style="font-size:12.5px">${esc(message)}</div></div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" data-modal-cancel>Cancel</button>
                    <button class="btn btn-danger" data-modal-confirm>${esc(confirmLabel)}</button>
                </div>
            </div>
        </div>`;

    root.querySelectorAll('[data-modal-cancel]').forEach(el =>
        el.addEventListener('click', closeModal));

    root.querySelector('[data-modal-confirm]').addEventListener('click', async () => {
        await onConfirm();
        closeModal();
    });
}

const val = (id) => (document.getElementById(id)?.value || '').trim();
const num = (id, fallback = 0) => {
    const raw = parseFloat(val(id));
    return Number.isFinite(raw) ? raw : fallback;
};
const checked = (id) => document.getElementById(id)?.checked === true;

function rgb(colour, alpha) {
    if (!Array.isArray(colour)) return `rgba(25,224,140,${alpha})`;
    return `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`;
}

function rgbSolid(colour) {
    if (!Array.isArray(colour)) return '#19e08c';
    return `rgb(${colour[0]},${colour[1]},${colour[2]})`;
}

function fmtCoords(c) {
    if (!c) return 'not placed';
    return `${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`;
}

function fmtDuration(seconds) {
    if (!seconds) return 'none';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

function emptyState(mark, title, body, actionHtml = '') {
    return `
        <div class="empty">
            <div class="empty-mark">${mark}</div>
            <div class="empty-title">${esc(title)}</div>
            <div class="empty-body">${esc(body)}</div>
            ${actionHtml}
        </div>`;
}

function fieldControl(field, value, idPrefix = 'f') {
    const id = `${idPrefix}-${field.key}`;
    const v = value === undefined || value === null ? field.default : value;

    if (field.type === 'toggle') {
        return `
            <div class="field">
                <label class="toggle">
                    <input type="checkbox" id="${id}" ${v ? 'checked' : ''}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">${esc(field.label)}</span>
                </label>
                ${field.hint ? `<div class="field-hint">${esc(field.hint)}</div>` : ''}
            </div>`;
    }

    let control;
    if (field.type === 'select') {
        const opts = (field.options || []).map(o =>
            `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
        control = `<select id="${id}">${opts}</select>`;
    } else if (field.type === 'number') {
        control = `
            <div class="unit-input">
                <input type="number" id="${id}" value="${esc(v)}"
                    ${field.min !== undefined ? `min="${field.min}"` : ''}
                    ${field.max !== undefined ? `max="${field.max}"` : ''}
                    step="${field.step || 'any'}">
                ${field.unit ? `<span class="unit">${esc(field.unit)}</span>` : ''}
            </div>`;
    } else {
        control = `<input type="text" id="${id}" value="${esc(v)}" placeholder="${esc(field.placeholder || '')}">`;
    }

    return `
        <div class="field${field.wide ? ' wide' : ''}">
            <label class="field-label" for="${id}">${esc(field.label)}</label>
            ${control}
            ${field.hint ? `<div class="field-hint">${esc(field.hint)}</div>` : ''}
        </div>`;
}

function readField(field, idPrefix = 'f') {
    const id = `${idPrefix}-${field.key}`;
    if (field.type === 'toggle') return checked(id);
    if (field.type === 'number') return num(id, field.default || 0);
    return val(id);
}

// Coordinates you can type, or paste whole. Pasting "24.62, -1347.29, 29.49"
// into any of the boxes fills all of them — that is the shape every dev tool,
// wiki page and MLO readme hands you.
function coordRow(prefix, coords, withHeading = true) {
    const c = coords || { x: 0, y: 0, z: 0, h: 0 };

    return `
        <div class="input-row" id="${prefix}-row">
            <div class="unit-input">
                <input type="number" step="0.001" id="${prefix}-x" value="${esc(Number(c.x || 0).toFixed(3))}" data-coord>
                <span class="unit">x</span>
            </div>
            <div class="unit-input">
                <input type="number" step="0.001" id="${prefix}-y" value="${esc(Number(c.y || 0).toFixed(3))}" data-coord>
                <span class="unit">y</span>
            </div>
            <div class="unit-input">
                <input type="number" step="0.001" id="${prefix}-z" value="${esc(Number(c.z || 0).toFixed(3))}" data-coord>
                <span class="unit">z</span>
            </div>
            ${withHeading ? `
            <div class="unit-input">
                <input type="number" step="0.1" id="${prefix}-h" value="${esc(Number(c.h || 0).toFixed(1))}" data-coord>
                <span class="unit">&deg;</span>
            </div>` : ''}
        </div>`;
}

function readCoords(prefix, fallback) {
    const f = fallback || { x: 0, y: 0, z: 0, h: 0 };
    return {
        x: num(`${prefix}-x`, f.x || 0),
        y: num(`${prefix}-y`, f.y || 0),
        z: num(`${prefix}-z`, f.z || 0),
        h: document.getElementById(`${prefix}-h`) ? num(`${prefix}-h`, f.h || 0) : (f.h || 0),
    };
}

// One paste of "x, y, z" (or "vector3(x, y, z)", or "x y z") fills the row.
function bindCoordPaste(prefix) {
    const row = document.getElementById(`${prefix}-row`);
    if (!row) return;

    row.addEventListener('paste', (e) => {
        const raw = (e.clipboardData || window.clipboardData).getData('text') || '';

        // Drop the wrapper before looking for numbers — the 4 in "vector4(...)"
        // is not a coordinate.
        const text = raw.replace(/[A-Za-z_]\w*\s*\(/g, '(');

        const parts = text.match(/-?\d+(?:\.\d+)?/g);
        if (!parts || parts.length < 3) return;

        e.preventDefault();
        ['x', 'y', 'z', 'h'].forEach((axis, i) => {
            const field = document.getElementById(`${prefix}-${axis}`);
            if (field && parts[i] !== undefined) field.value = parts[i];
        });
    });
}


// An item box you can search or just type into. A dropdown of a few thousand
// ox_inventory items is unusable, and a dropdown can never offer an item that
// was added after the panel opened — so this filters as you type and keeps
// whatever you type, whether we know the item or not.
function itemPicker(id, value, placeholder = 'Any item name') {
    return `
        <div class="picker" data-picker-for="${esc(id)}">
            <input type="text" id="${esc(id)}" class="picker-input" value="${esc(value || '')}"
                   placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false">
            <div class="picker-list" id="${esc(id)}-list" hidden></div>
            <div class="picker-note" id="${esc(id)}-note"></div>
        </div>`;
}

function itemLabel(name) {
    const found = (State.items || []).find(i => i.name === name);
    return found ? found.label : null;
}

function pickerNote(id) {
    const note = document.getElementById(`${id}-note`);
    const input = document.getElementById(id);
    if (!note || !input) return;

    const value = input.value.trim();
    if (value === '') { note.textContent = ''; note.className = 'picker-note'; return; }

    const label = itemLabel(value);
    if (label) {
        note.textContent = label;
        note.className = 'picker-note known';
    } else {
        note.textContent = 'Not in your items list. It will still be used.';
        note.className = 'picker-note unknown';
    }
}

function bindItemPickers(root = document) {
    root.querySelectorAll('[data-picker-for]').forEach(wrap => {
        if (wrap.dataset.bound === '1') return;
        wrap.dataset.bound = '1';

        const id = wrap.dataset.pickerFor;
        const input = document.getElementById(id);
        const list = document.getElementById(`${id}-list`);
        if (!input || !list) return;

        let active = -1;

        const rows = () => Array.from(list.querySelectorAll('.picker-row'));

        const highlight = (index) => {
            const all = rows();
            active = Math.max(-1, Math.min(index, all.length - 1));
            all.forEach((row, i) => row.classList.toggle('active', i === active));
            if (active >= 0) all[active].scrollIntoView({ block: 'nearest' });
        };

        const close = () => { list.hidden = true; active = -1; };

        const open = () => {
            const query = input.value.trim().toLowerCase();
            const items = State.items || [];

            const matches = (query === ''
                ? items
                : items.filter(i =>
                    i.name.toLowerCase().includes(query) ||
                    (i.label || '').toLowerCase().includes(query))
            ).slice(0, 60);

            if (matches.length === 0) {
                list.innerHTML = items.length === 0
                    ? '<div class="picker-empty">No item list came back from your inventory. Type the item name.</div>'
                    : '<div class="picker-empty">Nothing matches. Type it anyway and it will be used.</div>';
            } else {
                list.innerHTML = matches.map(i => `
                    <div class="picker-row" data-value="${esc(i.name)}">
                        <span class="picker-row-label">${esc(i.label)}</span>
                        <span class="picker-row-name">${esc(i.name)}</span>
                    </div>`).join('');
            }

            list.hidden = false;
            active = -1;

            list.querySelectorAll('.picker-row').forEach(row => {
                row.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = row.dataset.value;
                    pickerNote(id);
                    close();
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        };

        input.addEventListener('focus', open);
        input.addEventListener('input', () => { open(); pickerNote(id); });
        input.addEventListener('blur', () => { setTimeout(close, 120); pickerNote(id); });

        input.addEventListener('keydown', (e) => {
            if (list.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { open(); return; }

            if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
            else if (e.key === 'Enter') {
                const all = rows();
                if (active >= 0 && all[active]) {
                    e.preventDefault();
                    input.value = all[active].dataset.value;
                    pickerNote(id);
                    close();
                }
            } else if (e.key === 'Escape' && !list.hidden) {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        });

        pickerNote(id);
    });
}
