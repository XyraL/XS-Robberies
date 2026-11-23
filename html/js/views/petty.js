const PETTY_ARRAYS = ['peds.models', 'peds.exclude', 'models', 'vehicles.classes', 'spots', 'payout.items'];

const PETTY_PROPS = {
    package: [
        { model: 'prop_cs_cardbox_01', label: 'Cardboard box' },
        { model: 'prop_cs_package_01', label: 'Parcel' },
        { model: 'hei_prop_heist_box', label: 'Taped box' },
    ],
    tipjar: [
        { model: 'hei_heist_acc_jar_01', label: 'Glass jar' },
        { model: 'prop_lime_jar', label: 'Small jar' },
    ],
};

const PETTY_TARGET_TEXT = {
    ped: 'People on the street',
    aim: 'Anyone you aim a gun at',
    vehicle: 'Parked cars',
    model: 'Props in the world',
    spot: 'Spots you place',
};

const PettyView = {
    el: null,
    data: null,
    sel: 'pickpocket',
    dirty: new Set(),
    loading: false,

    fix(value, path = '') {
        if (Array.isArray(value)) return value.map(v => PettyView.fix(v, path));
        if (value && typeof value === 'object') {
            if (PETTY_ARRAYS.includes(path) || ['clerks', 'list', 'items'].includes(path.split('.').pop())) {
                if (!Object.keys(value).length) return [];
            }
            const out = {};
            Object.keys(value).forEach(k => { out[k] = PettyView.fix(value[k], path ? `${path}.${k}` : k); });
            return out;
        }
        return value;
    },

    arrays(cfg) {
        if (!cfg) return cfg;
        PETTY_ARRAYS.forEach(path => {
            const value = getPath(cfg, path);
            if (value !== undefined && !Array.isArray(value)) setPath(cfg, path, []);
        });
        return cfg;
    },

    async load(force = false) {
        if (PettyView.data && !force) return true;
        if (PettyView.loading) return false;
        PettyView.loading = true;
        const res = await nui('getPetty');
        PettyView.loading = false;
        if (!res || !res.ok) {
            toast('Petty crime did not load', (res && res.error) || 'The server did not answer.', 'error');
            return false;
        }
        PettyView.take(res);
        return true;
    },

    take(res) {
        const data = PettyView.fix(res);
        Object.keys(data.config || {}).forEach(id => PettyView.arrays(data.config[id]));
        (data.catalogue.kinds || []).forEach(k => PettyView.arrays(k.defaults));
        data.shops = data.shops || { clerks: [] };
        data.shops.clerks = Array.isArray(data.shops.clerks) ? data.shops.clerks : [];
        data.openables = data.openables || { list: [] };
        data.openables.list = Array.isArray(data.openables.list) ? data.openables.list : [];
        data.openables.list.forEach(o => {
            o.payout = o.payout || {};
            o.payout.cash = o.payout.cash || { account: 'cash', min: 0, max: 0 };
            o.payout.items = Array.isArray(o.payout.items) ? o.payout.items : [];
        });
        data.saved = data.saved || {};
        data.stats = data.stats || {};
        PettyView.data = data;
        PettyView.dirty.clear();
    },

    kinds() {
        return (PettyView.data && PettyView.data.catalogue.kinds) || [];
    },

    kind(id) {
        return PettyView.kinds().find(k => k.id === id) || null;
    },

    group(id) {
        return ((PettyView.data && PettyView.data.catalogue.groups) || []).find(g => g.id === id) || { label: id, colour: [90, 162, 255] };
    },

    cfg(id) {
        return PettyView.data && PettyView.data.config[id];
    },

    colourOf(id) {
        if (id === '_shops') return PettyView.group('shop').colour;
        if (id === '_open') return [124, 196, 255];
        const kind = PettyView.kind(id);
        return kind ? PettyView.group(kind.group).colour : [90, 162, 255];
    },

    onCount() {
        return PettyView.kinds().filter(k => (PettyView.cfg(k.id) || {}).enabled).length;
    },

    missingItem(name) {
        if (!name) return false;
        if (!(State.items || []).length) return false;
        return !itemLabel(name);
    },

    status(kind) {
        const cfg = PettyView.cfg(kind.id) || {};
        if (!cfg.enabled) return { text: 'Off', tone: '' };
        if (kind.target === 'spot' && !(cfg.spots || []).length) return { text: 'Place spots to use it', tone: 'warn' };
        if (kind.target === 'model' && !(cfg.models || []).length) return { text: 'No models picked', tone: 'warn' };
        if (cfg.item && PettyView.missingItem(cfg.item.name)) return { text: `Needs ${cfg.item.name}, not in your items`, tone: 'warn' };
        const stat = PettyView.data.stats[kind.id];
        let text = kind.target === 'spot' ? `${cfg.spots.length} spot${cfg.spots.length === 1 ? '' : 's'}`
            : kind.target === 'model' ? `${cfg.models.length} model${cfg.models.length === 1 ? '' : 's'}`
            : kind.target === 'ped' && cfg.peds && cfg.peds.gender === 'female' ? 'Women on the street'
            : kind.target === 'ped' && cfg.peds && cfg.peds.gender === 'male' ? 'Men on the street'
            : PETTY_TARGET_TEXT[kind.target];
        if (stat && stat.hits) text += ` · ${stat.hits} hit${stat.hits === 1 ? '' : 's'}`;
        return { text, tone: 'on' };
    },

    clerk(name, t, shops) {
        shops = shops || {};
        const watch = Math.max(1, Math.floor(Number(shops.watch) || 8));
        const away = Math.max(1, Math.floor(Number(shops.away) || 7));
        const jitter = Math.max(0, Math.floor(Number(shops.jitter) || 0));
        const cycle = watch + away + jitter;
        let h = 0;
        new TextEncoder().encode(String(name || '')).forEach(b => { h = (h * 31 + b) % 1000003; });
        const seed = h % 997;
        const start = (index) => {
            const shift = Math.floor((index * 7919 + seed * 104729) % 10007) % (jitter + 1);
            return Math.max(1, watch + shift - Math.floor(jitter / 2));
        };
        const tt = (Number(t) || 0) + seed;
        const index = Math.floor(tt / cycle);
        const pos = tt - index * cycle;
        const from = start(index);
        const to = from + away;
        if (pos >= from && pos < to) return { state: 'away', left: to - pos, window: index };
        if (pos < from) return { state: 'watching', left: from - pos };
        return { state: 'watching', left: cycle - pos + start(index + 1) };
    },

    async render(el) {
        PettyView.el = el;
        if (!PettyView.data) {
            el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading petty crime</div>';
            const ok = await PettyView.load();
            if (!el.isConnected) return;
            if (!ok) {
                el.innerHTML = `<div class="empty inline"><div class="mark">${icon('hand', 30, 1.5)}</div><h3>Could not load petty crime</h3><p>The server did not send it. Check the server console.</p></div>`;
                return;
            }
            renderRail();
        }

        if (!PettyView.kind(PettyView.sel) && !['_shops', '_open'].includes(PettyView.sel)) PettyView.sel = PettyView.kinds()[0].id;

        el.innerHTML = `
            <div class="pt">
                <aside class="pt-list" id="pt-list"></aside>
                <section class="pt-edit" id="pt-edit"></section>
            </div>`;

        PettyView.renderList();
        PettyView.renderEditor();
    },

    renderList() {
        const el = PettyView.el && PettyView.el.querySelector('#pt-list');
        if (!el) return;
        const on = PettyView.data.on !== false;
        const groups = PettyView.data.catalogue.groups || [];

        const card = (id, title, sub, tone, ic, colour, switchable, enabled) => `
            <div class="pt-card ${PettyView.sel === id ? 'on' : ''} ${switchable && !enabled ? 'off' : ''}" data-kind="${esc(id)}" style="${colourVars(colour)}">
                <div class="ti">${icon(ic, 16)}</div>
                <div class="tx"><b>${esc(title)}${PettyView.dirty.has(id) ? ' <i class="pt-dot" title="Not saved"></i>' : ''}</b><small class="${tone ? `t-${tone}` : ''}">${esc(sub)}</small></div>
                ${switchable ? `<label class="switch bare" title="${enabled ? 'On' : 'Off'}"><input type="checkbox" data-flip="${esc(id)}" ${enabled ? 'checked' : ''}><span class="sw"></span></label>` : '<span class="pt-chev">›</span>'}
            </div>`;

        el.innerHTML = `
            <div class="pt-master ${on ? '' : 'off'}">
                <div class="t"><b>${on ? 'Petty crime is on' : 'Petty crime is off'}</b><small>${on ? `${PettyView.onCount()} of ${PettyView.kinds().length} switched on` : 'Nothing below works until you turn it back on.'}</small></div>
                <label class="switch bare"><input type="checkbox" id="pt-master" ${on ? 'checked' : ''}><span class="sw"></span></label>
            </div>
            ${groups.map(g => `
                <div class="group-label">${esc(g.label)}</div>
                ${PettyView.kinds().filter(k => k.group === g.id).map(k => {
                    const cfg = PettyView.cfg(k.id) || {};
                    const s = PettyView.status(k);
                    return card(k.id, k.label, s.text, s.tone, k.icon, g.colour, true, cfg.enabled);
                }).join('')}
                ${g.id === 'shop' ? card('_shops', 'Shop clerks', `${PettyView.data.shops.watch}s watching, ${PettyView.data.shops.away}s away · ${PettyView.data.shops.clerks.length} placed`, '', 'clerk', g.colour, false) : ''}`).join('')}
            <div class="group-label">Loot</div>
            ${card('_open', 'Things to open', `${PettyView.data.openables.list.filter(o => o.enabled).length} items open into loot`, '', 'open', [124, 196, 255], false)}`;

        el.querySelectorAll('[data-kind]').forEach(row => row.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            PettyView.sel = row.dataset.kind;
            PettyView.renderList();
            PettyView.renderEditor();
        }));

        el.querySelectorAll('[data-flip]').forEach(input => input.addEventListener('change', async () => {
            const id = input.dataset.flip;
            const cfg = PettyView.cfg(id);
            cfg.enabled = input.checked;
            const ok = await PettyView.save(id, true);
            if (ok) toast(cfg.enabled ? 'Switched on' : 'Switched off', PettyView.kind(id).label, cfg.enabled ? 'success' : 'info', 2200);
            else { cfg.enabled = !input.checked; PettyView.renderList(); }
        }));

        el.querySelector('#pt-master').addEventListener('change', async (e) => {
            const value = e.target.checked;
            const res = await nui('saveTunables', { pettyEnabled: value });
            if (!report(res, value ? 'Petty crime on' : 'Petty crime off', value ? 'Players can do it again.' : 'Nobody can start one until you turn it back on.')) {
                e.target.checked = !value;
                return;
            }
            State.settings = res.settings || State.settings;
            PettyView.data.on = value;
            PettyView.renderList();
            refresh({ rail: true });
        });
    },

    markDirty(id) {
        const first = !PettyView.dirty.has(id);
        PettyView.dirty.add(id);
        if (first) PettyView.renderList();
        const chip = PettyView.el && PettyView.el.querySelector('#pt-dirty');
        if (chip) chip.classList.remove('hidden');
        const save = PettyView.el && PettyView.el.querySelector('[data-save]');
        if (save) save.classList.add('pulse');
    },

    payloadFor(id) {
        if (id === '_shops') return PettyView.data.shops;
        if (id === '_open') return PettyView.data.openables;
        return PettyView.cfg(id);
    },

    async save(id, quiet = false) {
        const res = await nui('savePetty', { kind: id, config: PettyView.payloadFor(id) });
        if (!res || !res.ok) {
            toast('Not saved', (res && res.error) || 'The server refused it.', 'error');
            return false;
        }
        const clean = PettyView.fix(res.config);
        if (id === '_shops') {
            clean.clerks = Array.isArray(clean.clerks) ? clean.clerks : [];
            PettyView.data.shops = clean;
        } else if (id === '_open') {
            clean.list = Array.isArray(clean.list) ? clean.list : [];
            clean.list.forEach(o => { o.payout.items = Array.isArray(o.payout.items) ? o.payout.items : []; });
            PettyView.data.openables = clean;
        } else {
            PettyView.data.config[id] = PettyView.arrays(clean);
        }
        PettyView.data.saved = res.saved || PettyView.data.saved;
        PettyView.dirty.delete(id);
        if (!quiet) toast('Saved', id === '_shops' ? 'Shop clerks' : id === '_open' ? 'Things to open' : PettyView.kind(id).label, 'success', 2200);
        PettyView.renderList();
        if (PettyView.sel === id) PettyView.renderEditor();
        renderRail();
        return true;
    },

    reset(id) {
        const name = id === '_shops' ? 'Shop clerks' : id === '_open' ? 'Things to open' : PettyView.kind(id).label;
        const spots = id !== '_open' && id !== '_shops' && (PettyView.cfg(id).spots || []).length;
        confirmDanger(`Reset ${name}?`, `Everything goes back to how it shipped${spots ? `, and the ${spots} spot${spots === 1 ? '' : 's'} you placed are removed` : ''}${id === '_shops' && PettyView.data.shops.clerks.length ? ', and the clerks you placed are removed' : ''}.`, async () => {
            const res = await nui('resetPetty', id);
            if (!report(res, 'Reset', name)) return;
            PettyView.take(res);
            PettyView.renderList();
            PettyView.renderEditor();
        }, 'Reset');
    },

    head(id, title, kicker, blurb, ic) {
        return `
            <div class="pt-head" style="${colourVars(PettyView.colourOf(id))}">
                <div class="ic">${icon(ic, 22, 1.6)}</div>
                <div class="grow">
                    <div class="k">${esc(kicker)}</div>
                    <h3>${esc(title)}</h3>
                    <div class="hint">${esc(blurb)}</div>
                </div>
                <div class="acts">
                    <span class="chip dirty ${PettyView.dirty.has(id) ? '' : 'hidden'}" id="pt-dirty">UNSAVED</span>
                    ${PettyView.data.saved[id] ? '' : '<span class="chip">AS SHIPPED</span>'}
                    <button class="btn sm ghost" data-reset>Reset</button>
                    <button class="btn primary ${PettyView.dirty.has(id) ? 'pulse' : ''}" data-save>Save</button>
                </div>
            </div>`;
    },

    renderEditor() {
        const el = PettyView.el && PettyView.el.querySelector('#pt-edit');
        if (!el) return;
        const fresh = el.cloneNode(false);
        el.replaceWith(fresh);

        if (PettyView.sel === '_shops') PettyView.shopsEditor(fresh);
        else if (PettyView.sel === '_open') PettyView.openEditor(fresh);
        else PettyView.kindEditor(fresh, PettyView.sel);

        fresh.querySelector('[data-save]')?.addEventListener('click', () => PettyView.save(PettyView.sel));
        fresh.querySelector('[data-reset]')?.addEventListener('click', () => PettyView.reset(PettyView.sel));
    },

    summary(kind, cfg) {
        const pay = cfg.payout || {};
        const cash = pay.cash || {};
        const items = (pay.items || []).length + (pay.lootTable ? 1 : 0);
        const pills = [];
        pills.push(`<span class="pt-pill green">${icon('cash', 12)} ${cash.max > 0 ? esc(moneyRange(cash.min, cash.max)) : 'No cash'}${items ? ` + ${items} item${items === 1 ? '' : 's'}` : ''}</span>`);
        pills.push(`<span class="pt-pill">${icon('hold', 12)} ${esc(cfg.duration)}s${!(kind && kind.target === 'aim') && cfg.minigame && cfg.minigame !== 'none' ? ' + minigame' : ''}</span>`);
        pills.push(`<span class="pt-pill ${cfg.alert.chance >= 30 ? 'red' : ''}">${icon('live', 12)} Police ${esc(cfg.alert.chance)}%${cfg.alert.delay ? ` after ${esc(cfg.alert.delay)}s` : ''}</span>`);
        if (kind && kind.risk === 'shock' && cfg.shock > 0) pills.push(`<span class="pt-pill red">${icon('bolt', 12)} Shock ${esc(cfg.shock)}%</span>`);
        if (cfg.witness && cfg.witness.chance > 0) pills.push(`<span class="pt-pill">${icon('twoman', 12)} Witnesses ${esc(cfg.witness.chance)}%</span>`);
        if (cfg.vehicles && cfg.vehicles.alarm > 0) pills.push(`<span class="pt-pill gold">${icon('bolt', 12)} Alarm ${esc(cfg.vehicles.alarm)}%</span>`);
        if (kind.group === 'shop') pills.push(`<span class="pt-pill violet">${icon('clerk', 12)} Clerk decides</span>`);
        pills.push(`<span class="pt-pill">${icon('history', 12)} ${esc(cfg.cooldown.target)} min · ${esc(cfg.cooldown.player)} min</span>`);
        if (cfg.item && cfg.item.name) pills.push(`<span class="pt-pill ${PettyView.missingItem(cfg.item.name) ? 'gold' : ''}">${icon('tool', 12)} ${esc(itemLabel(cfg.item.name) || cfg.item.name)}</span>`);
        return pills.join('');
    },

    chips(path, list, placeholder) {
        return `
            <div class="pt-chips" data-chips="${esc(path)}">
                ${(list || []).map((m, i) => `<span class="model-chip">${esc(modelName(m))}<button data-chip-drop="${esc(path)}:${i}" title="Remove">×</button></span>`).join('')}
                <input class="inp pt-chip-add" data-chip-add="${esc(path)}" placeholder="${esc(placeholder)}" spellcheck="false">
            </div>`;
    },

    minigameField(k, value) {
        const groups = new Map();
        (State.minigames || []).forEach(m => {
            const g = m.id === 'none' ? '' : (m.group || (m.provider === 'xs' ? 'Built in' : (m.resource || m.provider)));
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(m);
        });
        const option = (m) => `<option value="${esc(m.id)}" ${m.id === value ? 'selected' : ''} ${m.available || m.fallback ? '' : 'disabled'}>${esc(m.label)}${m.available ? '' : m.fallback ? ` (${esc(m.resource)} not running)` : ' (not running)'}</option>`;
        const list = [...groups.entries()].map(([g, items]) => g ? `<optgroup label="${esc(g)}">${items.map(option).join('')}</optgroup>` : items.map(option).join('')).join('');
        return `
            <div class="f wide">
                <label>Minigame</label>
                <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                    <select class="sel" data-k="${esc(k)}">${list}</select>
                    <button class="btn sm" data-try-mg title="Play it">${icon('play', 12)} Try</button>
                </div>
                ${mgFallbackHint(value)}
            </div>`;
    },

    payoutBlock(prefix, payout, opts = {}) {
        const cash = payout.cash || {};
        const tables = [{ value: '', label: 'None' }].concat((State.loot || []).map(t => ({ value: t.id, label: t.label })));
        return `
            <div class="grid3">
                ${fieldSelect(`${prefix}cash.account`, 'Paid as', cash.account || 'cash', [{ value: 'cash', label: 'Cash' }, { value: 'dirty', label: 'Dirty money' }, { value: 'bank', label: 'Bank' }])}
                ${fieldNumber(`${prefix}cash.min`, 'Least', cash.min ?? 0, { min: 0, unit: '$' })}
                ${fieldNumber(`${prefix}cash.max`, 'Most', cash.max ?? 0, { min: 0, unit: '$' })}
                ${fieldSelect(`${prefix}lootTable`, 'Loot table', payout.lootTable || '', tables, { wide: true })}
            </div>
            <div class="f-label" style="margin:12px 0 2px">Items</div>
            ${(payout.items || []).map((it, i) => `
                <div class="item-row">
                    ${itemPicker(`${prefix}items.${i}.item`, it.item)}
                    <div class="unit"><input class="inp" type="number" min="1" data-k="${prefix}items.${i}.min" data-t="num" value="${esc(it.min ?? 1)}"><em>min</em></div>
                    <div class="unit"><input class="inp" type="number" min="1" data-k="${prefix}items.${i}.max" data-t="num" value="${esc(it.max ?? 1)}"><em>max</em></div>
                    <div class="unit"><input class="inp" type="number" min="1" max="100" data-k="${prefix}items.${i}.chance" data-t="num" value="${esc(it.chance ?? 100)}"><em>%</em></div>
                    <button class="icon-btn" data-item-drop="${esc(opts.owner || '')}:${i}" title="Remove">${icon('close', 13)}</button>
                </div>`).join('') || '<div class="hint">No items. Cash only.</div>'}
            <button class="btn xs" style="margin-top:10px" data-item-add="${esc(opts.owner || '')}">${icon('plus', 12)} Add an item</button>`;
    },

    targetBlock(kind, cfg) {
        if (kind.target === 'ped' || kind.target === 'aim') {
            const p = cfg.peds;
            return `
                <div class="grid2">
                    ${fieldSeg('peds.gender', '', p.gender, [{ value: 'any', label: 'Anyone' }, { value: 'male', label: 'Men' }, { value: 'female', label: 'Women' }], { wide: true })}
                    ${fieldSwitch('peds.skipCops', 'Leave police, security and the army alone', p.skipCops, { wide: true })}
                    ${fieldSwitch('peds.skipMission', 'Leave people other scripts placed alone', p.skipMission, { wide: true, hint: 'Shopkeepers, job NPCs, anything a script spawned. Only people walking around get picked.' })}
                    <div class="f wide"><label>Only these peds</label>${PettyView.chips('peds.models', p.models, 'Empty means anyone. Type a ped model, Enter')}</div>
                    <div class="f wide"><label>Never these peds</label>${PettyView.chips('peds.exclude', p.exclude, 'Type a ped model, Enter')}</div>
                    ${fieldNumber('reach', kind.target === 'aim' ? 'Aim from up to' : 'Reach', cfg.reach, { min: 0.5, max: 25, unit: 'm', hint: kind.target === 'aim' ? 'How far away they can be while you hold them up.' : '' })}
                </div>`;
        }

        if (kind.target === 'vehicle') {
            const v = cfg.vehicles;
            return `
                <div class="f wide"><label>Vehicle classes</label>
                    <div class="tags">${(PettyView.data.catalogue.classes || []).map(c => `<span class="tag ${(v.classes || []).includes(c.id) ? 'on' : ''}" data-class="${c.id}">${esc(c.label)}</span>`).join('')}</div>
                </div>
                <div class="grid2" style="margin-top:12px">
                    ${fieldSwitch('vehicles.parked', 'Only parked, empty cars', v.parked, { wide: true, hint: 'Nobody in the driver seat and not moving.' })}
                    ${fieldSwitch('vehicles.skipOwned', "Leave players' own cars alone", v.skipOwned, { wide: true, hint: 'Checked against player_vehicles by plate.' })}
                    ${fieldNumber('reach', 'Reach', cfg.reach, { min: 0.5, max: 25, unit: 'm' })}
                </div>`;
        }

        if (kind.target === 'model') {
            return `
                <div class="hint" style="margin-bottom:10px">Every prop in the world with one of these models can be hit. Nothing to place.</div>
                <div class="models" style="margin-bottom:10px">
                    ${(cfg.models || []).map((m, i) => `<span class="model-chip">${icon('model', 13)} ${esc(modelName(m))}<button data-chip-drop="models:${i}" title="Remove">×</button></span>`).join('') || '<span class="hint">No model yet.</span>'}
                </div>
                <div class="card-row" style="margin-top:0">
                    <button class="btn sm primary" data-pick-model>${icon('place', 13)} Aim at one in the world</button>
                    <button class="btn sm" data-type-model>${icon('plus', 13)} Type a model name</button>
                </div>
                <div class="grid2" style="margin-top:12px">${fieldNumber('reach', 'Reach', cfg.reach, { min: 0.5, max: 25, unit: 'm' })}</div>`;
        }

        const shop = kind.group === 'shop';
        const props = PETTY_PROPS[kind.id] || [];
        return `
            <div class="hint" style="margin-bottom:10px">${shop
                ? 'Place a spot on each shelf or till. Spots with the same shop name share one clerk; leave it empty and the spot gets its own.'
                : 'Place a spot wherever one should be. Taken ones come back when their cooldown runs out.'}</div>
            ${(cfg.spots || []).length ? `<div class="ov-list">${cfg.spots.map((s, i) => `
                <div class="ov-row pt-spot">
                    <span class="badge info">${i + 1}</span>
                    <div class="pt-spot-f">
                        <input class="inp" data-spot-label="${i}" value="${esc(s.label || '')}" placeholder="Spot ${i + 1}" spellcheck="false">
                        ${shop ? `<input class="inp" data-spot-shop="${i}" value="${esc(s.shop || '')}" placeholder="Shop name" spellcheck="false">` : `<small>${esc(fmtCoords(s))}</small>`}
                    </div>
                    <div class="acts">
                        <button class="btn xs" data-spot-move="${i}" title="Move">${icon('place', 11)}</button>
                        <button class="btn xs" data-spot-go="${i}" title="Go there">${icon('goto', 11)}</button>
                        <button class="btn xs danger" data-spot-del="${i}" title="Remove">${icon('trash', 11)}</button>
                    </div>
                </div>`).join('')}</div>` : `<div class="pt-empty">${icon('pin', 18)} No spots yet. Nothing happens until you place one.</div>`}
            <div class="card-row"><button class="btn sm primary" data-spot-add>${icon('plus', 13)} Place a spot</button></div>
            <div class="grid2" style="margin-top:14px">
                <div class="f wide"><label>Prop on each spot</label>
                    <input class="inp" data-k="prop" value="${esc(cfg.prop || '')}" placeholder="${shop ? 'None, the shop already has shelves' : 'None'}" spellcheck="false">
                    ${props.length ? `<div class="tags" style="margin-top:6px">${props.map(p => `<span class="tag ${cfg.prop === p.model ? 'on' : ''}" data-prop="${esc(p.model)}" title="${esc(p.model)}">${esc(p.label)}</span>`).join('')}</div>` : ''}
                    <div class="fh">Spawned on every spot and taken away while it is robbed. Empty for nothing.</div>
                </div>
                ${fieldNumber('reach', 'Reach', cfg.reach, { min: 0.5, max: 25, unit: 'm' })}
            </div>`;
    },

    caughtBlock(kind, cfg) {
        const v = cfg.victim;
        const street = kind.target === 'ped' || kind.target === 'aim';
        return `
            <div class="grid3">
                ${fieldNumber('alert.chance', 'Calls the police', cfg.alert.chance, { min: 0, max: 100, unit: '%' })}
                ${fieldNumber('alert.delay', 'After', cfg.alert.delay, { min: 0, max: 600, unit: 's' })}
                ${fieldText('alert.code', 'Code', cfg.alert.code)}
                ${fieldText('alert.title', 'What police see', cfg.alert.title, { wide: true })}
                ${fieldSwitch('alert.onFail', 'Getting it wrong always calls it in', cfg.alert.onFail, { wide: true })}
            </div>
            <div class="f-label" style="margin:14px 0 6px">Witnesses</div>
            <div class="grid3">
                ${fieldNumber('witness.chance', 'Each one calls', cfg.witness.chance, { min: 0, max: 100, unit: '%' })}
                ${fieldNumber('witness.radius', 'Within', cfg.witness.radius, { min: 0, max: 100, unit: 'm' })}
                <div class="f"><label>&nbsp;</label><div class="fh" style="padding-top:8px">Every NPC this close gets their own roll.</div></div>
            </div>
            ${kind.risk === 'shock' ? `
            <div class="f-label" style="margin:14px 0 6px">Shock</div>
            <div class="grid2">
                ${fieldNumber('shock', 'Chance of a shock', cfg.shock || 0, { min: 0, max: 100, unit: '%', hint: 'A shock knocks them down, hurts, and they get nothing.' })}
            </div>` : ''}
            ${kind.target === 'vehicle' ? `
            <div class="f-label" style="margin:14px 0 6px">Car alarm</div>
            <div class="grid2">
                ${fieldNumber('vehicles.alarm', 'Goes off', cfg.vehicles.alarm, { min: 0, max: 100, unit: '%' })}
                ${fieldSwitch('vehicles.alarmAlerts', 'An alarm calls the police', cfg.vehicles.alarmAlerts)}
            </div>` : ''}
            ${street ? `
            <div class="f-label" style="margin:14px 0 6px">The victim</div>
            <div class="grid3">
                ${kind.target === 'aim'
                    ? fieldNumber('victim.resist', 'Refuses', v.resist, { min: 0, max: 100, unit: '%' })
                    : fieldNumber('victim.notice', 'Notices', v.notice, { min: 0, max: 100, unit: '%', hint: kind.id === 'purse' ? 'A snatch is always noticed at 100.' : 'Even when it works.' })}
                ${fieldNumber('victim.fight', kind.target === 'aim' ? 'Of those, fight' : 'Fights back', v.fight, { min: 0, max: 100, unit: '%', hint: 'The rest run.' })}
                ${kind.target === 'aim' ? fieldSwitch('victim.flee', 'Runs off after', v.flee) : ''}
            </div>` : ''}
            ${kind.group === 'shop' ? `<div class="issue ok" style="margin-top:12px"><i>i</i><span>The clerk is the main risk here. If they look back before it is done, they saw it. Timing and clerks are under <b class="pt-link" data-go-shops>Shop clerks</b>.</span></div>` : ''}`;
    },

    kindEditor(el, id) {
        const kind = PettyView.kind(id);
        const cfg = PettyView.cfg(id);
        const group = PettyView.group(kind.group);
        const anim = cfg.anim || {};

        el.innerHTML = `
            ${PettyView.head(id, kind.label, `${group.label} · ${PETTY_TARGET_TEXT[kind.target]}`, kind.blurb, kind.icon)}
            <div class="pt-sum" id="pt-sum">${PettyView.summary(kind, cfg)}</div>
            <div class="pt-switch">${fieldSwitch('enabled', cfg.enabled ? 'Switched on' : 'Switched off', cfg.enabled, { wide: true })}</div>
            <div class="pt-cols">
                <div>
                    <div class="pt-box">
                        <div class="sec-title">${kind.target === 'vehicle' ? 'Which cars' : kind.target === 'model' ? 'Which props' : kind.target === 'spot' ? 'Where' : 'Who'}</div>
                        ${PettyView.targetBlock(kind, cfg)}
                    </div>
                    <div class="pt-box">
                        <div class="sec-title">Doing it</div>
                        <div class="grid2">
                            ${fieldText('label', 'What the prompt says', cfg.label, { wide: true })}
                            ${fieldNumber('duration', 'Takes', cfg.duration, { min: 1, max: 120, unit: 's' })}
                            ${kind.target === 'aim' ? '' : cfg.minigame && cfg.minigame !== 'none' ? fieldSeg('difficulty', 'Difficulty', String(cfg.difficulty), [{ value: '1', label: 'Easy' }, { value: '2', label: 'Normal' }, { value: '3', label: 'Hard' }]) : '<div></div>'}
                            ${kind.target === 'aim' ? '' : PettyView.minigameField('minigame', cfg.minigame)}
                            ${kind.target === 'aim' ? '' : fieldSeg('anim.mode', 'Animation', anim.mode || 'none', [{ value: 'anim', label: 'Dict and clip' }, { value: 'scenario', label: 'Scenario' }, { value: 'none', label: 'None' }], { wide: true })}
                            ${kind.target !== 'aim' && anim.mode === 'anim' ? `
                                ${fieldText('anim.dict', 'Dict', anim.dict, { wide: true })}
                                ${fieldText('anim.clip', 'Clip', anim.clip)}
                                ${fieldNumber('anim.flag', 'Flag', anim.flag, { min: 0, max: 63, hint: '1 loops, 16 plays once and holds, 48 upper body.' })}` : ''}
                            ${kind.target !== 'aim' && anim.mode === 'scenario' ? fieldText('anim.scenario', 'Scenario', anim.scenario, { wide: true }) : ''}
                            <div class="f wide"><label>Needs an item</label>${itemPicker('item.name', cfg.item.name, 'None needed')}</div>
                            ${cfg.item.name ? `
                                ${fieldSwitch('item.consume', 'Used up each time', cfg.item.consume)}
                                ${fieldNumber('item.breakChance', 'Breaks', cfg.item.breakChance, { min: 0, max: 100, unit: '%', hint: 'Each try, if it is not used up.' })}` : ''}
                        </div>
                    </div>
                </div>
                <div>
                    <div class="pt-box">
                        <div class="sec-title">What it pays</div>
                        ${PettyView.payoutBlock('payout.', cfg.payout, { owner: 'kind' })}
                    </div>
                    <div class="pt-box">
                        <div class="sec-title">Getting caught</div>
                        ${PettyView.caughtBlock(kind, cfg)}
                    </div>
                    <div class="pt-box">
                        <div class="sec-title">Limits</div>
                        <div class="grid3">
                            ${fieldNumber('cooldown.target', kind.target === 'ped' || kind.target === 'aim' ? 'Same person again' : kind.target === 'vehicle' ? 'Same car again' : 'Same spot again', cfg.cooldown.target, { min: 0, max: 1440, unit: 'min' })}
                            ${fieldNumber('cooldown.player', 'Same robber again', cfg.cooldown.player, { min: 0, max: 1440, unit: 'min' })}
                            ${fieldNumber('police', 'Police online', cfg.police, { min: 0, max: 64, hint: 'Needed before anyone can do it.' })}
                        </div>
                        <div class="hint" style="margin-top:8px">Police and EMS can never do it, and the kill switch and robbery bans in Live and Settings cover it too.</div>
                    </div>
                </div>
            </div>`;

        PettyView.wireKind(el, kind, cfg);
    },

    softKind(el, kind, cfg) {
        const sum = el.querySelector('#pt-sum');
        if (sum) sum.innerHTML = PettyView.summary(kind, cfg);
    },

    wireKind(el, kind, cfg) {
        const id = kind.id;
        bindPickers(el);

        bindForm(el, cfg, (k, value, node, type) => {
            PettyView.markDirty(id);
            if (k === 'enabled') {
                const label = el.querySelector('.pt-switch .switch .t');
                if (label) label.textContent = value ? 'Switched on' : 'Switched off';
            }
            if (['anim.mode', 'minigame'].includes(k) || (k === 'item.name' && type === 'change')) {
                PettyView.renderEditor();
                return;
            }
            PettyView.softKind(el, kind, cfg);
            if (k === 'enabled' || k === 'label' || k.startsWith('item.')) PettyView.renderList();
        });

        el.querySelectorAll('[data-chip-add]').forEach(input => input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const value = input.value.trim();
            if (!value) return;
            const list = getPath(cfg, input.dataset.chipAdd) || [];
            if (!list.some(m => String(m).toLowerCase() === value.toLowerCase())) list.push(value);
            setPath(cfg, input.dataset.chipAdd, list);
            PettyView.markDirty(id);
            PettyView.renderEditor();
            setTimeout(() => PettyView.el.querySelector(`[data-chip-add="${input.dataset.chipAdd}"]`)?.focus(), 20);
        }));

        el.querySelectorAll('[data-chip-drop]').forEach(b => b.addEventListener('click', () => {
            const [path, index] = b.dataset.chipDrop.split(':');
            (getPath(cfg, path) || []).splice(Number(index), 1);
            PettyView.markDirty(id);
            PettyView.renderEditor();
            PettyView.renderList();
        }));

        el.querySelectorAll('[data-class]').forEach(tag => tag.addEventListener('click', () => {
            const c = Number(tag.dataset.class);
            const list = cfg.vehicles.classes;
            const at = list.indexOf(c);
            if (at >= 0) list.splice(at, 1); else list.push(c);
            list.sort((a, b) => a - b);
            tag.classList.toggle('on', at < 0);
            PettyView.markDirty(id);
        }));

        el.querySelectorAll('[data-prop]').forEach(tag => tag.addEventListener('click', () => {
            cfg.prop = cfg.prop === tag.dataset.prop ? '' : tag.dataset.prop;
            PettyView.markDirty(id);
            PettyView.renderEditor();
        }));

        el.querySelector('[data-item-add]')?.addEventListener('click', () => {
            cfg.payout.items.push({ item: '', min: 1, max: 1, chance: 100 });
            PettyView.markDirty(id);
            PettyView.renderEditor();
        });

        el.querySelectorAll('[data-item-drop]').forEach(b => b.addEventListener('click', () => {
            cfg.payout.items.splice(Number(b.dataset.itemDrop.split(':')[1]), 1);
            PettyView.markDirty(id);
            PettyView.renderEditor();
        }));

        el.querySelector('[data-try-mg]')?.addEventListener('click', async () => {
            if (!cfg.minigame || cfg.minigame === 'none') { toast('Nothing to try', 'Pick a minigame first.', 'info', 2000); return; }
            const res = await nui('previewMinigame', { id: cfg.minigame, difficulty: Number(cfg.difficulty) || 2 });
            if (res && res.ok) toast(res.passed ? 'Passed' : 'Failed', 'That is how it plays for a player.', res.passed ? 'success' : 'warning');
        });

        el.querySelector('[data-go-shops]')?.addEventListener('click', () => {
            PettyView.sel = '_shops';
            PettyView.renderList();
            PettyView.renderEditor();
        });

        el.querySelector('[data-pick-model]')?.addEventListener('click', () => PettyView.pickModel(id));
        el.querySelector('[data-type-model]')?.addEventListener('click', () => {
            modal({
                title: 'Add a model',
                body: '<div class="f"><label>Model name</label><input class="inp" id="pt-model" placeholder="prop_vend_soda_01" spellcheck="false"></div>',
                confirmLabel: 'Add',
                confirm: async (root) => {
                    const name = root.querySelector('#pt-model').value.trim();
                    if (!name) return false;
                    if (!cfg.models.some(m => String(m).toLowerCase() === name.toLowerCase())) cfg.models.push(name);
                    PettyView.markDirty(id);
                    PettyView.renderEditor();
                    PettyView.renderList();
                },
            });
        });

        el.querySelector('[data-spot-add]')?.addEventListener('click', () => PettyView.placeSpot(id));
        el.querySelectorAll('[data-spot-move]').forEach(b => b.addEventListener('click', () => PettyView.placeSpot(id, Number(b.dataset.spotMove))));
        el.querySelectorAll('[data-spot-go]').forEach(b => b.addEventListener('click', () => {
            const s = cfg.spots[Number(b.dataset.spotGo)];
            if (s) nui('teleport', { coords: s, heading: s.h });
        }));
        el.querySelectorAll('[data-spot-del]').forEach(b => b.addEventListener('click', async () => {
            cfg.spots.splice(Number(b.dataset.spotDel), 1);
            await PettyView.save(id, true);
            toast('Spot removed', kind.label, 'info', 2000);
        }));
        el.querySelectorAll('[data-spot-label]').forEach(input => input.addEventListener('input', () => {
            cfg.spots[Number(input.dataset.spotLabel)].label = input.value;
            PettyView.markDirty(id);
        }));
        el.querySelectorAll('[data-spot-shop]').forEach(input => input.addEventListener('input', () => {
            cfg.spots[Number(input.dataset.spotShop)].shop = input.value;
            PettyView.markDirty(id);
        }));
    },

    nextSpotId(list, prefix) {
        let n = 1;
        while (list.some(s => s.id === `${prefix}_${n}`)) n++;
        return `${prefix}_${n}`;
    },

    async placeSpot(id, index) {
        const kind = PettyView.kind(id);
        const cfg = PettyView.cfg(id);
        const current = index === undefined ? null : cfg.spots[index];
        const shop = kind.group === 'shop';
        const res = await place({
            label: kind.label,
            colour: PettyView.colourOf(id),
            mode: 'point',
            previewModel: cfg.prop || undefined,
            origin: current ? { x: current.x, y: current.y, z: current.z, h: current.h || 0 } : undefined,
            guided: {
                step: 1, total: 1,
                title: current ? `Move ${current.label || 'this spot'}` : `Place a ${kind.id === 'package' ? 'package' : kind.id === 'tipjar' ? 'tip jar' : kind.id === 'till' ? 'till' : 'shelf'}`,
                subtitle: shop ? 'Stand at the shelf or till, facing it.' : 'Put it right where a player should reach for it.',
                skippable: true,
            },
        });
        if (!res.ok || !res.coords) return;

        const point = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        if (current) {
            Object.assign(current, point);
        } else {
            const last = cfg.spots[cfg.spots.length - 1];
            cfg.spots.push(Object.assign({
                id: PettyView.nextSpotId(cfg.spots, 'spot'),
                label: '',
                shop: shop && last ? last.shop || '' : '',
            }, point));
        }
        if (await PettyView.save(id, true)) toast(current ? 'Spot moved' : 'Spot placed', kind.label, 'success', 2200);
    },

    async pickModel(id) {
        const kind = PettyView.kind(id);
        const cfg = PettyView.cfg(id);
        const res = await place({
            label: 'the model',
            colour: PettyView.colourOf(id),
            pickEntity: true,
            guided: { step: 1, total: 1, title: 'Aim at one', subtitle: `Every prop with the same model can be used for ${kind.label.toLowerCase()}.`, skippable: true },
        });
        if (!res.ok || !res.pick) return;

        const hash = toUnsigned(res.pick.model);
        const known = KNOWN_MODELS.find(m => joaat(m) === hash);
        const exists = cfg.models.some(m => toUnsigned(/^-?\d+$/.test(String(m)) ? Number(m) : joaat(m)) === hash);
        if (!exists) cfg.models.push(known || hash);
        if (await PettyView.save(id, true)) toast(exists ? 'Already on the list' : 'Model added', modelName(known || hash), exists ? 'info' : 'success', 2600);
    },

    timeline(shops, name) {
        const now = Math.floor(Date.now() / 1000);
        const span = 90;
        const segs = [];
        let cur = null, start = 0;
        for (let s = 0; s <= span; s++) {
            const state = s === span ? null : PettyView.clerk(name, now + s, shops).state;
            if (state !== cur) {
                if (cur) segs.push({ state: cur, from: start, to: s });
                cur = state;
                start = s;
            }
        }
        return `
            <div class="pt-time">
                ${segs.map(g => `<i class="${g.state === 'away' ? 'away' : 'watch'}" style="left:${(g.from / span) * 100}%;width:${((g.to - g.from) / span) * 100}%" title="${g.state === 'away' ? 'Looking away' : 'Watching'} for ${g.to - g.from}s"></i>`).join('')}
            </div>
            <div class="pt-time-scale"><span>now</span><span>30s</span><span>60s</span><span>90s</span></div>`;
    },

    shopsEditor(el) {
        const shops = PettyView.data.shops;
        const names = new Set();
        ['shoplift', 'till'].forEach(id => (PettyView.cfg(id).spots || []).forEach(s => { if (s.shop) names.add(s.shop); }));
        shops.clerks.forEach(c => { if (c.shop) names.add(c.shop); });
        const sample = [...names][0] || 'Shop 1';

        el.innerHTML = `
            ${PettyView.head('_shops', 'Shop clerks', 'Shop crimes', 'Shoplifting and grabbing the till only work while the clerk looks away. If they look back before it is done, they saw it.', 'clerk')}
            <div class="pt-cols">
                <div>
                    <div class="pt-box">
                        <div class="sec-title">How the clerk behaves</div>
                        <div class="grid2">
                            ${fieldNumber('watch', 'Watches for', shops.watch, { min: 1, max: 120, unit: 's' })}
                            ${fieldNumber('away', 'Looks away for', shops.away, { min: 1, max: 120, unit: 's' })}
                            ${fieldNumber('jitter', 'Varies by up to', shops.jitter, { min: 0, max: 60, unit: 's', hint: 'So players cannot count it.' })}
                            ${fieldNumber('caught', 'Seen means police', shops.caught, { min: 0, max: 100, unit: '%' })}
                        </div>
                        <div class="f-label" style="margin:16px 0 8px">The next 90 seconds at ${esc(sample)}</div>
                        <div id="pt-timeline">${PettyView.timeline(shops, `shop:${sample}`)}</div>
                        <div class="pt-legend"><span><i class="watch"></i>Watching</span><span><i class="away"></i>Looking away</span></div>
                        <div class="hint" style="margin-top:10px">Players near a shelf or till see which it is on their screen. Keep "Looks away for" longer than the grab takes, or nobody can ever finish one.</div>
                    </div>
                </div>
                <div>
                    <div class="pt-box">
                        <div class="sec-title"><span>Clerks</span><button class="btn xs act primary" data-clerk-add>${icon('plus', 12)} Place a clerk</button></div>
                        <div class="hint" style="margin-bottom:10px">Optional. A clerk you place stands behind the counter and turns away to their phone when they stop watching, so players can read it. Give them the same shop name as the spots.</div>
                        ${shops.clerks.length ? `<div class="ov-list">${shops.clerks.map((c, i) => `
                            <div class="ov-row pt-spot">
                                <span class="badge info">${i + 1}</span>
                                <div class="pt-spot-f">
                                    <input class="inp" data-clerk-shop="${i}" value="${esc(c.shop || '')}" placeholder="Shop name" spellcheck="false">
                                    <small>${esc(fmtCoords(c))}</small>
                                </div>
                                <div class="acts">
                                    <button class="btn xs" data-clerk-move="${i}" title="Move">${icon('place', 11)}</button>
                                    <button class="btn xs" data-clerk-go="${i}" title="Go there">${icon('goto', 11)}</button>
                                    <button class="btn xs danger" data-clerk-del="${i}" title="Remove">${icon('trash', 11)}</button>
                                </div>
                            </div>`).join('')}</div>` : `<div class="pt-empty">${icon('clerk', 18)} No clerks placed. The timing still applies.</div>`}
                        <div class="grid2" style="margin-top:14px">${fieldText('model', 'Clerk ped', shops.model, { wide: true })}</div>
                    </div>
                </div>
            </div>`;

        bindForm(el, shops, (k) => {
            PettyView.markDirty('_shops');
            if (['watch', 'away', 'jitter'].includes(k)) el.querySelector('#pt-timeline').innerHTML = PettyView.timeline(shops, `shop:${sample}`);
        });

        el.querySelector('[data-clerk-add]').addEventListener('click', () => PettyView.placeClerk());
        el.querySelectorAll('[data-clerk-move]').forEach(b => b.addEventListener('click', () => PettyView.placeClerk(Number(b.dataset.clerkMove))));
        el.querySelectorAll('[data-clerk-go]').forEach(b => b.addEventListener('click', () => {
            const c = shops.clerks[Number(b.dataset.clerkGo)];
            if (c) nui('teleport', { coords: c, heading: c.h });
        }));
        el.querySelectorAll('[data-clerk-del]').forEach(b => b.addEventListener('click', async () => {
            shops.clerks.splice(Number(b.dataset.clerkDel), 1);
            await PettyView.save('_shops', true);
        }));
        el.querySelectorAll('[data-clerk-shop]').forEach(input => input.addEventListener('input', () => {
            shops.clerks[Number(input.dataset.clerkShop)].shop = input.value;
            PettyView.markDirty('_shops');
        }));
    },

    async placeClerk(index) {
        const shops = PettyView.data.shops;
        const current = index === undefined ? null : shops.clerks[index];
        const res = await place({
            label: 'clerk',
            colour: PettyView.colourOf('_shops'),
            mode: 'point',
            previewModel: shops.model || 'mp_m_shopkeep_01',
            origin: current ? { x: current.x, y: current.y, z: current.z, h: current.h || 0 } : undefined,
            guided: { step: 1, total: 1, title: current ? 'Move the clerk' : 'Place the clerk', subtitle: 'Behind the counter, facing the shop floor.', skippable: true },
        });
        if (!res.ok || !res.coords) return;
        const point = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        if (current) Object.assign(current, point);
        else shops.clerks.push(Object.assign({ id: PettyView.nextSpotId(shops.clerks, 'clerk'), shop: '' }, point));
        if (await PettyView.save('_shops', true)) toast(current ? 'Clerk moved' : 'Clerk placed', 'Give them a shop name so the spots can find them.', 'success', 3000);
    },

    openEditor(el) {
        const list = PettyView.data.openables.list;
        el.innerHTML = `
            ${PettyView.head('_open', 'Things to open', 'Loot', 'Stolen wallets, bags and parcels go in the pocket closed. Using one opens it and pays what is inside.', 'open')}
            <div class="pt-box">
                <div class="sec-title"><span>Items</span><button class="btn xs act primary" data-open-add>${icon('plus', 12)} Add one</button></div>
                <div class="hint" style="margin-bottom:12px">Any item can be one. On ox_inventory it needs <b>client = { export = 'XS-Robberies.openStolen' }</b> in its item entry; the README has the lines to paste.</div>
                ${list.length ? list.map((o, i) => `
                    <div class="pt-open ${o.enabled ? '' : 'off'}" data-open="${i}">
                        <div class="pt-open-head">
                            <div class="f"><label>Item</label>${itemPicker(`list.${i}.item`, o.item)}</div>
                            ${fieldText(`list.${i}.label`, 'While opening', o.label)}
                            ${fieldNumber(`list.${i}.duration`, 'Takes', o.duration, { min: 1, max: 30, unit: 's' })}
                            <div class="f"><label>&nbsp;</label><label class="switch"><span class="t">On</span><input type="checkbox" data-k="list.${i}.enabled" data-t="bool" ${o.enabled ? 'checked' : ''}><span class="sw"></span></label></div>
                            <div class="f"><label>&nbsp;</label><button class="icon-btn" data-open-drop="${i}" title="Remove">${icon('trash', 14)}</button></div>
                        </div>
                        ${PettyView.payoutBlock(`list.${i}.payout.`, o.payout, { owner: String(i) })}
                    </div>`).join('') : '<div class="pt-empty">Nothing opens. Add an item.</div>'}
            </div>`;

        bindPickers(el);
        bindForm(el, PettyView.data.openables, () => PettyView.markDirty('_open'));

        el.querySelector('[data-open-add]').addEventListener('click', () => {
            list.push({ item: '', label: 'Going through it', duration: 3, enabled: true, payout: { cash: { account: 'cash', min: 10, max: 60 }, items: [], lootTable: '' } });
            PettyView.markDirty('_open');
            PettyView.renderEditor();
        });
        el.querySelectorAll('[data-open-drop]').forEach(b => b.addEventListener('click', () => {
            list.splice(Number(b.dataset.openDrop), 1);
            PettyView.markDirty('_open');
            PettyView.renderEditor();
        }));
        el.querySelectorAll('[data-item-add]').forEach(b => b.addEventListener('click', () => {
            list[Number(b.dataset.itemAdd)].payout.items.push({ item: '', min: 1, max: 1, chance: 100 });
            PettyView.markDirty('_open');
            PettyView.renderEditor();
        }));
        el.querySelectorAll('[data-item-drop]').forEach(b => b.addEventListener('click', () => {
            const [owner, index] = b.dataset.itemDrop.split(':');
            list[Number(owner)].payout.items.splice(Number(index), 1);
            PettyView.markDirty('_open');
            PettyView.renderEditor();
        }));
    },
};

Views.petty = PettyView;
