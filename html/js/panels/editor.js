window.Panels = window.Panels || {};

let editorView = 'stage';
let advancedOpen = false;

function nextStageId(type) {
    const stages = State.current.stages || [];
    let n = 1;
    while (stages.some(s => s.id === `${type}_${n}`)) n++;
    return `${type}_${n}`;
}

function selectedStage() {
    if (!State.current) return null;
    return (State.current.stages || []).find(s => s.id === State.selectedStage) || null;
}

function typePickerModal() {
    const cards = State.stageTypes.map(t => `
        <div class="type-card" data-type="${esc(t.id)}" style="--type-colour:${rgbSolid(t.colour)}">
            <div class="type-name">${esc(t.label)}</div>
            <div class="type-blurb">${esc(t.blurb || '')}</div>
        </div>`).join('');

    modal('Add a stage', `<div class="type-grid">${cards}</div>`, null);

    document.querySelectorAll('.type-card').forEach(card => {
        card.addEventListener('click', async () => {
            const type = card.dataset.type;
            closeModal();
            await addStage(type);
        });
    });
}

async function addStage(type) {
    const def = stageType(type);
    if (!def) return;

    const isZone = type === 'escape' || type === 'hold';

    const coords = await placePoint({
        label: def.label,
        colour: def.colour,
        mode: isZone ? 'zone' : 'point',
        radius: isZone ? 25 : undefined,
    });

    if (!coords) return;

    const stages = State.current.stages || (State.current.stages = []);
    const previous = stages[stages.length - 1];

    const opts = {};
    (def.fields || []).forEach(f => { opts[f.key] = f.default; });
    opts.label = `${def.label} ${stages.filter(s => s.type === type).length + 1}`;
    if (coords.radius !== undefined && opts.radius !== undefined) opts.radius = coords.radius;

    const stage = {
        id: nextStageId(type),
        type,
        label: opts.label,
        coords: { x: coords.x, y: coords.y, z: coords.z, h: coords.h },
        requires: previous ? [previous.id] : [],
        payout: { account: 'cash', min: 0, max: 0, lootTable: '' },
        opts,
    };

    stages.push(stage);
    State.selectedStage = stage.id;
    editorView = 'stage';

    await saveCurrent(true);
    switchPanel('editor');
    toast('Stage placed', stage.label, 'success', 2600);
}

async function duplicateStage(source) {
    const def = stageType(source.type);
    const isZone = source.type === 'escape' || source.type === 'hold';

    const coords = await placePoint({
        label: `${source.label} copy`,
        colour: def ? def.colour : null,
        mode: isZone ? 'zone' : 'point',
        radius: isZone ? (source.opts.radius || 25) : undefined,
        origin: source.coords,
    });

    if (!coords) return;

    const stages = State.current.stages;
    const copy = JSON.parse(JSON.stringify(source));

    copy.id = nextStageId(source.type);
    copy.coords = { x: coords.x, y: coords.y, z: coords.z, h: coords.h };
    copy.opts.label = `${source.opts.label || source.label} ${
        stages.filter(s => s.type === source.type).length + 1}`;
    copy.label = copy.opts.label;

    if (coords.radius !== undefined && copy.opts.radius !== undefined) {
        copy.opts.radius = coords.radius;
    }

    // A paired point cannot share its partner — that would make three of them.
    if (copy.opts.pairWith !== undefined) copy.opts.pairWith = '';

    stages.push(copy);
    State.selectedStage = copy.id;

    await saveCurrent(true);
    switchPanel('editor');
    toast('Copied', `${copy.label} keeps every setting from ${source.label}.`, 'success', 3200);
}

async function moveStage(stage) {
    const def = stageType(stage.type);
    const isZone = stage.type === 'escape' || stage.type === 'hold';

    const coords = await placePoint({
        label: def ? def.label : stage.type,
        colour: def ? def.colour : null,
        mode: isZone ? 'zone' : 'point',
        radius: isZone ? (stage.opts.radius || 25) : undefined,
        origin: stage.coords,
    });

    if (!coords) return;

    stage.coords = { x: coords.x, y: coords.y, z: coords.z, h: coords.h };
    if (coords.radius !== undefined && stage.opts.radius !== undefined) stage.opts.radius = coords.radius;

    await saveCurrent(true);
    switchPanel('editor');
    toast('Moved', stage.label, 'success', 2200);
}

function stageRow(stage, index) {
    const def = stageType(stage.type);
    const colour = def ? rgbSolid(def.colour) : 'var(--accent)';
    const placed = !!stage.coords;

    return `
        <div class="stage-row ${stage.id === State.selectedStage ? 'selected' : ''}"
             data-id="${esc(stage.id)}"
             style="--stage-colour:${colour}${stage.enabled === false ? ';opacity:.5' : ''}">
            <div class="stage-index">${index + 1}</div>
            <div class="stage-meta">
                <div class="stage-name">${esc(stage.label || stage.id)}</div>
                <div class="stage-type">${esc(def ? def.label : stage.type)}</div>
            </div>
            ${stage.enabled === false ? '<span class="badge off">Off</span>' : ''}
            ${placed ? '' : '<span class="stage-flag" title="Not placed">&#9888;</span>'}
            ${stage.opts && stage.opts.optional ? '<span class="badge off">Opt</span>' : ''}
        </div>`;
}

function requiresChips(stage) {
    const others = (State.current.stages || []).filter(s => s.id !== stage.id);
    if (others.length === 0) {
        return '<div class="field-hint">Nothing else to wait on yet.</div>';
    }

    return `<div style="display:flex;flex-wrap:wrap;gap:6px">${others.map(o => {
        const on = (stage.requires || []).includes(o.id);
        return `<span class="badge ${on ? 'on' : 'off'}" data-req="${esc(o.id)}"
                      style="cursor:pointer">${esc(o.label || o.id)}</span>`;
    }).join('')}</div>`;
}

// A payout is any mix of cash, named items and a shared loot table. The old
// single-account shape is read back so nothing built before this breaks.
function normalisePayout(payout) {
    payout = payout || {};

    if (payout.cash || payout.items) {
        return {
            cash: payout.cash || null,
            items: payout.items || [],
            lootTable: payout.lootTable || '',
        };
    }

    const hasCash = (payout.max || 0) > 0 || (payout.min || 0) > 0;

    return {
        cash: hasCash
            ? { account: payout.account || 'cash', min: payout.min || 0, max: payout.max || 0 }
            : null,
        items: [],
        lootTable: payout.lootTable || '',
    };
}

function payoutItemRow(entry, index) {
    return `
        <div class="input-row" style="margin-bottom:8px" data-pay-item="${index}">
            ${itemPicker(`pi-item-${index}`, entry.item, 'Any item name')}
            <div class="unit-input" style="max-width:88px">
                <input type="number" id="pi-min-${index}" value="${esc(entry.min ?? 1)}" min="1">
                <span class="unit">min</span>
            </div>
            <div class="unit-input" style="max-width:88px">
                <input type="number" id="pi-max-${index}" value="${esc(entry.max ?? 1)}" min="1">
                <span class="unit">max</span>
            </div>
            <div class="unit-input" style="max-width:96px">
                <input type="number" id="pi-chance-${index}" value="${esc(entry.chance ?? 100)}" min="1" max="100">
                <span class="unit">%</span>
            </div>
            <button class="btn btn-sm btn-ghost" data-pay-remove="${index}" style="flex:0 0 auto">&times;</button>
        </div>`;
}

function payoutSection(stage) {
    const reward = normalisePayout(stage.payout);
    const cash = reward.cash || { account: 'cash', min: 0, max: 0 };

    const accounts = State.accounts.map(a =>
        `<option value="${esc(a.id)}" ${cash.account === a.id ? 'selected' : ''}>${esc(a.label)}</option>`).join('');

    const loot = ['<option value="">None</option>'].concat(State.loot.map(t =>
        `<option value="${esc(t.id)}" ${reward.lootTable === t.id ? 'selected' : ''}>${esc(t.label)}</option>`)).join('');

    return `
        <div class="section-title">Payout</div>
        <div class="field-hint" style="margin-bottom:12px">
            Whatever this stage pays goes to whoever does it. Mix any of these: cash
            only, items only, or both. Leave the money at zero to pay purely in goods.
            Items land in their pockets straight away; the money follows whenever your
            server pays out.
        </div>

        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="p-account">Money goes to</label>
                <select id="p-account">${accounts}</select>
            </div>
            <div class="field">
                <label class="field-label" for="p-loot">Shared loot table</label>
                <select id="p-loot">${loot}</select>
            </div>
            <div class="field">
                <label class="field-label" for="p-min">Least money</label>
                <input type="number" id="p-min" value="${esc(cash.min || 0)}" min="0">
            </div>
            <div class="field">
                <label class="field-label" for="p-max">Most money</label>
                <input type="number" id="p-max" value="${esc(cash.max || 0)}" min="0">
            </div>
        </div>

        <div class="section-title" style="margin-top:6px">Items</div>
        <div id="payout-items">${reward.items.map(payoutItemRow).join('')}</div>
        <button class="btn btn-ghost btn-sm" id="p-add-item">+ Add an item</button>`;
}

function minigameSelect(field, value) {
    const opts = State.minigames.map(m => {
        const label = m.available ? m.label : `${m.label} — needs ${m.resource}`;
        return `<option value="${esc(m.id)}" ${m.id === value ? 'selected' : ''}
                        ${m.available ? '' : 'disabled'}>${esc(label)}</option>`;
    }).join('');

    return `
        <div class="field">
            <label class="field-label" for="f-${esc(field.key)}">${esc(field.label)}</label>
            <div class="input-row">
                <select id="f-${esc(field.key)}">${opts}</select>
                <button class="btn btn-ghost btn-sm" id="mg-preview" style="flex:0 0 auto">Preview</button>
            </div>
        </div>`;
}

function stageSelect(field, value) {
    const others = (State.current.stages || []).filter(s => s.id !== State.selectedStage);
    const opts = ['<option value="">None</option>'].concat(others.map(o =>
        `<option value="${esc(o.id)}" ${o.id === value ? 'selected' : ''}>${esc(o.label || o.id)}</option>`)).join('');

    return `
        <div class="field">
            <label class="field-label" for="f-${esc(field.key)}">${esc(field.label)}</label>
            <select id="f-${esc(field.key)}">${opts}</select>
        </div>`;
}

function itemSelect(field, value) {
    return `
        <div class="field">
            <label class="field-label" for="f-${esc(field.key)}">${esc(field.label)}</label>
            ${itemPicker(`f-${field.key}`, value, 'Leave empty for none')}
        </div>`;
}

function renderFields(fields, stage) {
    return fields.map(f => {
        const value = stage.opts ? stage.opts[f.key] : f.default;
        if (f.type === 'minigame') return minigameSelect(f, value);
        if (f.type === 'stage') return stageSelect(f, value);
        if (f.type === 'item') return itemSelect(f, value);
        return fieldControl(f, value);
    }).join('');
}

function stageOptions(stage) {
    const def = stageType(stage.type);
    const fields = def ? def.fields : [];
    // Animation and props get their own section rather than hiding under
    // Advanced. They are the first thing an owner wants to change.
    const LOOK = ['animDict', 'animClip', 'animFlag', 'scenario', 'prop', 'propZ',
        'handProp', 'handBone', 'handOffset', 'progressStyle'];

    const basic = fields.filter(f => !f.advanced && !LOOK.includes(f.key));
    const look = fields.filter(f => LOOK.includes(f.key));
    const advanced = fields.filter(f => f.advanced && !LOOK.includes(f.key));
    const isLoot = ['register', 'safe', 'container'].includes(stage.type);

    return `
        <div class="options-head">
            <div>
                <div class="options-title">${esc(stage.label || stage.id)}</div>
                <div class="options-blurb">${esc(def ? def.blurb : '')}</div>
            </div>
            <div style="display:flex;gap:12px;flex-shrink:0;align-items:center">
                <label class="toggle" title="Switch this stage off without deleting it">
                    <input type="checkbox" id="stage-enabled" ${stage.enabled === false ? '' : 'checked'}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">${stage.enabled === false ? 'Off' : 'On'}</span>
                </label>
                <button class="btn btn-sm btn-ghost" id="stage-move">Move</button>
                <button class="btn btn-sm btn-ghost" id="stage-copy">Duplicate</button>
                <button class="btn btn-sm btn-ghost" id="stage-tp">Go to</button>
                <button class="btn btn-sm btn-danger" id="stage-delete">Delete</button>
            </div>
        </div>

        <div class="field" style="margin-bottom:14px">
            <label class="field-label">Where it is
                <span class="mono" style="text-transform:none;letter-spacing:0">&nbsp;${esc(stage.id)}</span>
            </label>
            ${coordRow('sc', stage.coords)}
            <div class="field-hint">Type them, or paste a whole set into any box. Or use Move and place it by eye.</div>
        </div>

        ${stage.enabled === false ? `
            <div class="issue warn" style="margin-bottom:14px">
                <span class="issue-mark">?</span>
                <span>This stage is switched off. It will not appear in the world, and
                anything that was waiting on it carries on without it.</span>
            </div>` : ''}

        <div class="section-title">Options</div>
        <div class="field-grid">${renderFields(basic, stage)}</div>

        ${look.length ? `
            <div class="section-title">Look and feel</div>
            <div class="field-hint" style="margin-bottom:10px">
                Put whatever animation you like on this stage. A scenario is the easy
                route; a dict and clip give exact control. Leave it all empty and the
                stage uses whatever suits its type.
            </div>
            <div class="field-grid">${renderFields(look, stage)}</div>` : ''}

        ${advanced.length ? `
            <div class="advanced-toggle" id="adv-toggle">${advancedOpen ? '&#9662;' : '&#9656;'} Advanced</div>
            <div class="advanced-fields ${advancedOpen ? 'open' : ''}" id="adv-fields">
                <div class="field-grid">${renderFields(advanced, stage)}</div>
            </div>` : ''}

        ${isLoot ? payoutSection(stage) : ''}

        <div class="section-title">Requirements</div>
        <div class="field-hint" style="margin-bottom:8px">
            Stages that must be finished before this one unlocks. Pick more than one to make them all required, or none to make it available from the start.
        </div>
        ${requiresChips(stage)}`;
}

function collectStage(stage) {
    if (!stage || !document.getElementById('sc-x')) return;

    const def = stageType(stage.type);
    (def ? def.fields : []).forEach(f => {
        if (f.type === 'minigame' || f.type === 'stage' || f.type === 'item') {
            stage.opts[f.key] = val(`f-${f.key}`);
        } else {
            stage.opts[f.key] = readField(f);
        }
    });

    stage.label = stage.opts.label || stage.label;

    if (document.getElementById('stage-enabled')) {
        stage.enabled = checked('stage-enabled');
    }

    if (document.getElementById('sc-x')) {
        stage.coords = readCoords('sc', stage.coords);
    }

    if (document.getElementById('p-account')) {
        const items = [];

        document.querySelectorAll('#payout-items [data-pay-item]').forEach(row => {
            const i = row.dataset.payItem;
            const item = val(`pi-item-${i}`);
            if (!item) return;

            items.push({
                item,
                min: num(`pi-min-${i}`, 1),
                max: num(`pi-max-${i}`, 1),
                chance: num(`pi-chance-${i}`, 100),
            });
        });

        const max = num('p-max', 0);

        stage.payout = {
            cash: max > 0 || num('p-min', 0) > 0
                ? { account: val('p-account'), min: num('p-min', 0), max: max }
                : null,
            items,
            lootTable: val('p-loot'),
        };
    }
}

function robberySettings() {
    const def = State.current;
    const anchor = def.anchor || {};
    const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) =>
        `<option value="${value}" ${def.category === value ? 'selected' : ''}>${label}</option>`).join('');

    const alarmModes = [
        { value: 'instant', label: 'Instant' },
        { value: 'delayed', label: 'Delayed' },
        { value: 'silent',  label: 'Silent' },
        { value: 'none',    label: 'No alarm' },
    ];

    const alarmOptions = (selected) => alarmModes.map(m =>
        `<option value="${m.value}" ${selected === m.value ? 'selected' : ''}>${m.label}</option>`).join('');

    const g = def.gates || {};
    const r = def.response || {};
    const b = def.blip || {};

    return `
        <div class="options-head">
            <div>
                <div class="options-title">${esc(def.name)}</div>
                <div class="options-blurb">Applies to every location built from this robbery. Each location can override the numbers.</div>
            </div>
            <label class="toggle" style="flex-shrink:0">
                <input type="checkbox" id="r-enabled" ${def.enabled ? 'checked' : ''}>
                <span class="toggle-track"></span>
                <span class="toggle-label">Live</span>
            </label>
        </div>

        <div class="section-title">What this is anchored to</div>
        <div class="field-hint" style="margin-bottom:12px">
            Stamped locations suit a shop or a bank, where every site is placed by hand.
            Prop models suit anything the map already has hundreds of: point it at the ATM
            models and every ATM in Los Santos becomes robbable, with nothing to stamp.
        </div>
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="a-kind">Anchor</label>
                <select id="a-kind">
                    <option value="location" ${anchor.kind !== 'model' ? 'selected' : ''}>Stamped locations</option>
                    <option value="model" ${anchor.kind === 'model' ? 'selected' : ''}>Prop models</option>
                </select>
            </div>
            <div class="field">
                <label class="field-label" for="a-pool">Look for</label>
                <select id="a-pool">
                    <option value="object" ${(anchor.pool || 'object') === 'object' ? 'selected' : ''}>Props</option>
                    <option value="vehicle" ${anchor.pool === 'vehicle' ? 'selected' : ''}>Vehicles</option>
                    <option value="ped" ${anchor.pool === 'ped' ? 'selected' : ''}>Peds</option>
                </select>
            </div>
            <div class="field">
                <label class="field-label" for="a-range">Find them within</label>
                <div class="unit-input">
                    <input type="number" id="a-range" value="${esc(anchor.scanRange ?? 80)}" min="10" max="300">
                    <span class="unit">m</span>
                </div>
            </div>
            <div class="field wide">
                <label class="field-label" for="a-models">Prop models</label>
                <input type="text" id="a-models" value="${esc((anchor.models || []).join(', '))}"
                       placeholder="prop_atm_01, prop_atm_02, prop_atm_03, prop_fleeca_atm">
                <div class="field-hint">
                    Comma separated. Stage positions are read as offsets from where you built
                    them, so a stage placed on the ATM lands on every ATM.
                </div>
            </div>
        </div>

        <div class="section-title">Identity</div>
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="r-name">Name</label>
                <input type="text" id="r-name" value="${esc(def.name)}">
            </div>
            <div class="field">
                <label class="field-label" for="r-category">Category</label>
                <select id="r-category">${categories}</select>
            </div>
        </div>

        <div class="section-title">Who can start it</div>
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="g-policeRequired">Police required</label>
                <input type="number" id="g-policeRequired" value="${esc(g.policeRequired ?? 2)}" min="0">
            </div>
            <div class="field">
                <label class="toggle" style="margin-top:22px">
                    <input type="checkbox" id="g-policeOnDuty" ${g.policeOnDuty ? 'checked' : ''}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">On duty only</span>
                </label>
            </div>
            <div class="field">
                <label class="field-label" for="g-minCrew">Minimum crew</label>
                <input type="number" id="g-minCrew" value="${esc(g.minCrew ?? 1)}" min="1">
            </div>
            <div class="field">
                <label class="field-label" for="g-maxCrew">Maximum crew</label>
                <input type="number" id="g-maxCrew" value="${esc(g.maxCrew ?? 6)}" min="1">
            </div>
            <div class="field">
                <label class="field-label" for="g-locationCooldown">Location cooldown</label>
                <div class="unit-input">
                    <input type="number" id="g-locationCooldown" value="${esc(g.locationCooldown ?? 1800)}" min="0">
                    <span class="unit">s</span>
                </div>
            </div>
            <div class="field">
                <label class="field-label" for="g-playerCooldown">Player cooldown</label>
                <div class="unit-input">
                    <input type="number" id="g-playerCooldown" value="${esc(g.playerCooldown ?? 900)}" min="0">
                    <span class="unit">s</span>
                </div>
            </div>
            <div class="field">
                <label class="field-label" for="g-globalCooldown">Server-wide cooldown</label>
                <div class="unit-input">
                    <input type="number" id="g-globalCooldown" value="${esc(g.globalCooldown ?? 0)}" min="0">
                    <span class="unit">s</span>
                </div>
                <div class="field-hint">Blocks every location of this robbery, not just the one that was hit. 0 for none.</div>
            </div>
            <div class="field">
                <label class="field-label" for="g-proximityMetres">No second job within</label>
                <div class="unit-input">
                    <input type="number" id="g-proximityMetres" value="${esc(g.proximityMetres ?? 0)}" min="0">
                    <span class="unit">m</span>
                </div>
            </div>
            <div class="field">
                <label class="field-label" for="g-proximitySeconds">…for this long</label>
                <div class="unit-input">
                    <input type="number" id="g-proximitySeconds" value="${esc(g.proximitySeconds ?? 0)}" min="0">
                    <span class="unit">s</span>
                </div>
                <div class="field-hint">Stops a crew running the whole street at once. Both boxes need a number.</div>
            </div>
        </div>

        <div class="section-title">In the world</div>
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="w-radius">Radius</label>
                <div class="unit-input">
                    <input type="number" id="w-radius" value="${esc(def.radius ?? 30)}" min="5" step="any">
                    <span class="unit">m</span>
                </div>
                <div class="field-hint">How far from the origin someone still counts as being here.</div>
            </div>
            <div class="field">
                <label class="field-label" for="w-showWhen">Show the blip</label>
                <select id="w-showWhen">
                    ${['always', 'during', 'never'].map(v => `<option value="${v}"
                        ${(b.showWhen || 'during') === v ? 'selected' : ''}>${
                            v === 'always' ? 'Always' : v === 'during' ? 'Only during a run' : 'Never'
                        }</option>`).join('')}
                </select>
            </div>
            <div class="field">
                <label class="field-label" for="w-label">Blip name</label>
                <input type="text" id="w-label" value="${esc(b.label || def.name || '')}">
            </div>
            <div class="field">
                <label class="field-label" for="w-sprite">Blip sprite</label>
                <input type="number" id="w-sprite" value="${esc(b.sprite ?? 500)}" min="1">
                <div class="field-hint">Any GTA blip sprite id.</div>
            </div>
            <div class="field">
                <label class="field-label" for="w-colour">Blip colour</label>
                <input type="number" id="w-colour" value="${esc(b.colour ?? 1)}" min="0" max="85">
            </div>
            <div class="field">
                <label class="field-label" for="w-scale">Blip scale</label>
                <input type="number" id="w-scale" value="${esc(b.scale ?? 0.8)}" min="0.1" max="3" step="0.1">
            </div>
        </div>

        <div class="section-title">Police response</div>
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="p-alarm">Alarm</label>
                <select id="p-alarm">${alarmOptions(r.alarm || 'instant')}</select>
            </div>
            <div class="field">
                <label class="field-label" for="p-alarmDelay">Delay</label>
                <div class="unit-input">
                    <input type="number" id="p-alarmDelay" value="${esc(r.alarmDelay ?? 30)}" min="0">
                    <span class="unit">s</span>
                </div>
            </div>
            <div class="field">
                <label class="field-label" for="p-cameras">Cameras disabled changes it to</label>
                <select id="p-cameras">${alarmOptions(r.camerasChangeTo || 'delayed')}</select>
            </div>
            <div class="field">
                <label class="field-label" for="p-power">Power cut changes it to</label>
                <select id="p-power">${alarmOptions(r.powerChangesTo || 'silent')}</select>
            </div>
            <div class="field">
                <label class="field-label" for="p-code">Dispatch code</label>
                <input type="text" id="p-code" value="${esc(r.code || '10-90')}">
            </div>
            <div class="field">
                <label class="field-label" for="p-title">Dispatch title</label>
                <input type="text" id="p-title" value="${esc(r.title || 'Robbery')}">
            </div>
            <div class="field">
                <label class="field-label" for="p-repeat">Repeat alert every</label>
                <div class="unit-input">
                    <input type="number" id="p-repeat" value="${esc(r.repeatAlert ?? 120)}" min="0">
                    <span class="unit">s</span>
                </div>
            </div>
            <div class="field">
                <label class="toggle" style="margin-top:22px">
                    <input type="checkbox" id="p-onfail" ${r.dispatchOnFail ? 'checked' : ''}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">Call it in on a failed stage</span>
                </label>
            </div>
        </div>`;
}

function collectSettings() {
    const def = State.current;

    // Reading fields that are not on screen would write empty strings and a
    // false toggle straight over real settings.
    if (!def || !document.getElementById('r-enabled')) return;
    def.name = val('r-name') || def.name;
    def.category = val('r-category');
    def.enabled = checked('r-enabled');

    def.anchor = {
        kind: val('a-kind') || 'location',
        models: val('a-models').split(',').map(m => m.trim()).filter(Boolean),
        pool: val('a-pool') || 'object',
        scanRange: num('a-range', 80),
    };

    def.gates = Object.assign({}, def.gates, {
        policeRequired: num('g-policeRequired', 0),
        policeOnDuty: checked('g-policeOnDuty'),
        minCrew: num('g-minCrew', 1),
        maxCrew: num('g-maxCrew', 6),
        locationCooldown: num('g-locationCooldown', 0),
        playerCooldown: num('g-playerCooldown', 0),
        globalCooldown: num('g-globalCooldown', 0),
        proximityMetres: num('g-proximityMetres', 0),
        proximitySeconds: num('g-proximitySeconds', 0),
    });

    def.radius = num('w-radius', def.radius || 30);
    def.blip = Object.assign({}, def.blip, {
        showWhen: val('w-showWhen'),
        label: val('w-label'),
        sprite: num('w-sprite', 500),
        colour: num('w-colour', 1),
        scale: num('w-scale', 0.8),
    });

    def.response = Object.assign({}, def.response, {
        alarm: val('p-alarm'),
        alarmDelay: num('p-alarmDelay', 0),
        camerasChangeTo: val('p-cameras'),
        powerChangesTo: val('p-power'),
        code: val('p-code'),
        title: val('p-title'),
        repeatAlert: num('p-repeat', 0),
        dispatchOnFail: checked('p-onfail'),
    });
}

function issuesBlock() {
    const issues = State.issues || [];
    if (issues.length === 0) return '';

    return `
        <div class="section-title">Problems</div>
        ${issues.map(i => `
            <div class="issue ${i.level === 'error' ? 'error' : 'warn'}"
                 ${i.stage ? `data-issue="${esc(i.stage)}" style="cursor:pointer"` : ''}>
                <span class="issue-mark">${i.level === 'error' ? '!' : '?'}</span>
                <span>${esc(i.message)}</span>
            </div>`).join('')}`;
}

window.Panels.editor = {
    render(el) {
        if (!State.current) {
            setTopbar('Editor', 'Nothing open');
            el.innerHTML = emptyState('&#9881;', 'No robbery open',
                'Pick one from the Robberies panel, or build a new one.',
                '<button class="btn btn-primary" id="editor-back">Go to Robberies</button>');
            document.getElementById('editor-back')?.addEventListener('click', () => switchPanel('robberies'));
            return;
        }

        const def = State.current;
        const stages = def.stages || [];

        setTopbar(def.name, `${def.id} · ${stages.length} stage${stages.length === 1 ? '' : 's'}`, `
            <button class="btn ${def.enabled ? 'btn-primary' : 'btn-ghost'}" id="act-live"
                    title="${def.enabled ? 'Players can rob this' : 'Nothing appears in the world until this is live'}">
                ${def.enabled ? '&#9679; Live' : '&#9675; Draft'}
            </button>
            <button class="btn btn-ghost" id="act-settings">Robbery settings</button>
            <button class="btn btn-ghost" id="act-validate">Validate</button>
            <button class="btn btn-primary" id="act-save">Save</button>
        `);

        const stage = selectedStage();

        el.innerHTML = `
            <div id="editor-layout">
                <div class="editor-col">
                    <div class="section-title">Stages</div>
                    <div class="stage-list" id="stage-list">
                        ${stages.length ? stages.map(stageRow).join('')
                            : '<div class="field-hint">No stages yet. Add the first one.</div>'}
                    </div>
                    <button class="btn btn-primary" id="act-add" style="margin-top:11px;justify-content:center">
                        + Add stage
                    </button>
                </div>
                <div class="editor-col" style="overflow-y:auto;padding-right:4px">
                    ${editorView === 'settings' ? robberySettings()
                        : stage ? stageOptions(stage)
                        : emptyState('&#9635;', 'Nothing selected', 'Pick a stage on the left, or add one.')}
                    ${issuesBlock()}
                </div>
            </div>`;

        bindItemPickers(el);

        el.addEventListener('change', () => {
            if (editorView === 'settings') collectSettings();
            else if (stage) collectStage(stage);
        });

        document.getElementById('act-live').addEventListener('click', async () => {
            if (editorView === 'settings') collectSettings();
            else if (stage) collectStage(stage);

            def.enabled = !def.enabled;

            if (await saveCurrent(true)) {
                toast(def.enabled ? 'Live' : 'Back to draft',
                    def.enabled
                        ? 'Every location stamped from this is now robbable.'
                        : 'It has gone from the world until you set it live again.',
                    def.enabled ? 'success' : 'info');
            }
            switchPanel('editor');
        });

        document.getElementById('act-add').addEventListener('click', typePickerModal);
        document.getElementById('act-save').addEventListener('click', async () => {
            if (editorView === 'settings') collectSettings();
            else if (stage) collectStage(stage);
            await saveCurrent();
            switchPanel('editor');
        });

        document.getElementById('act-settings').addEventListener('click', () => {
            editorView = editorView === 'settings' ? 'stage' : 'settings';
            switchPanel('editor');
        });

        document.getElementById('act-validate').addEventListener('click', async () => {
            const res = await nui('validateRobbery', def.id);
            if (!res || !res.ok) return;

            State.issues = res.issues || [];
            switchPanel('editor');

            const errors = State.issues.filter(i => i.level === 'error').length;
            if (State.issues.length === 0) toast('All clear', 'Nothing to fix.', 'success');
            else if (errors > 0) toast('Not ready', `${errors} error${errors === 1 ? '' : 's'} to fix.`, 'error');
            else toast('Worth a look', 'Warnings only, nothing blocking.', 'warning');
        });

        el.querySelectorAll('[data-issue]').forEach(row => {
            row.addEventListener('click', () => {
                if (!stages.some(s => s.id === row.dataset.issue)) return;
                State.selectedStage = row.dataset.issue;
                editorView = 'stage';
                switchPanel('editor');
            });
        });

        el.querySelectorAll('.stage-row').forEach(row => {
            row.addEventListener('click', () => {
                if (editorView === 'stage' && stage) collectStage(stage);
                State.selectedStage = row.dataset.id;
                editorView = 'stage';
                switchPanel('editor');
            });
        });

        if (editorView === 'stage' && stage) {
            bindCoordPaste('sc');
            document.getElementById('stage-move')?.addEventListener('click', () => moveStage(stage));

            document.getElementById('stage-copy')?.addEventListener('click', () => {
                collectStage(stage);
                duplicateStage(stage);
            });

            document.getElementById('stage-tp')?.addEventListener('click', () => {
                if (stage.coords) nui('teleport', { coords: stage.coords });
            });

            document.getElementById('stage-delete')?.addEventListener('click', () => {
                confirmDanger('Delete this stage?',
                    `"${stage.label}" will be removed, and any stage waiting on it will lose that requirement.`,
                    async () => {
                        def.stages = stages.filter(s => s.id !== stage.id);
                        def.stages.forEach(s => {
                            s.requires = (s.requires || []).filter(id => id !== stage.id);
                        });
                        State.selectedStage = def.stages[0]?.id || null;
                        await saveCurrent(true);
                        switchPanel('editor');
                    });
            });

            document.getElementById('adv-toggle')?.addEventListener('click', () => {
                advancedOpen = !advancedOpen;
                collectStage(stage);
                switchPanel('editor');
            });

            document.getElementById('p-add-item')?.addEventListener('click', () => {
                collectStage(stage);
                const reward = normalisePayout(stage.payout);
                reward.items.push({ item: '', min: 1, max: 1, chance: 100 });
                stage.payout = reward;
                switchPanel('editor');
            });

            el.querySelectorAll('[data-pay-remove]').forEach(btn => {
                btn.addEventListener('click', () => {
                    collectStage(stage);
                    const reward = normalisePayout(stage.payout);
                    reward.items.splice(parseInt(btn.dataset.payRemove, 10), 1);
                    stage.payout = reward;
                    switchPanel('editor');
                });
            });

            document.getElementById('mg-preview')?.addEventListener('click', async () => {
                const id = val('f-minigame');
                const res = await nui('previewMinigame', { id });
                if (res && res.ok) {
                    toast(res.passed ? 'Passed' : 'Failed', 'That is how it plays for a robber.',
                        res.passed ? 'success' : 'warning');
                }
            });

            el.querySelectorAll('[data-req]').forEach(chip => {
                chip.addEventListener('click', async () => {
                    const id = chip.dataset.req;
                    const requires = stage.requires || (stage.requires = []);
                    const at = requires.indexOf(id);

                    if (at >= 0) requires.splice(at, 1);
                    else requires.push(id);

                    collectStage(stage);
                    await saveCurrent(true);
                    switchPanel('editor');
                });
            });
        }
    },
};
