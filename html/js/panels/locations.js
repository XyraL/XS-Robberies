window.Panels = window.Panels || {};

let openLocation = null;
let resolved = null;

async function stampLocation(robberyId) {
    const def = State.robberies.find(r => r.id === robberyId);
    if (!def) return;

    const coords = await placePoint({
        label: `${def.name} origin`,
        colour: [25, 224, 140],
        mode: 'point',
    });

    if (!coords) return;

    const existing = State.locations.filter(l => l.robberyId === robberyId).length;

    const res = await nui('saveLocation', {
        robberyId,
        label: `${def.name} ${existing + 1}`,
        enabled: true,
        origin: coords,
        overrides: {},
        offsets: {},
    });

    if (!reportResult(res, 'Location stamped', `${def.name} ${existing + 1}`)) return;

    State.locations = res.locations || State.locations;
    State.robberies = res.robberies || State.robberies;
    openLocation = res.location ? res.location.id : null;
    switchPanel('locations');
}

function stampModal() {
    if (State.robberies.length === 0) {
        toast('Nothing to stamp', 'Build a robbery first.', 'warning');
        return;
    }

    const options = State.robberies.map(r =>
        `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');

    modal('Stamp a location', `
        <div class="field">
            <label class="field-label" for="stamp-robbery">Robbery</label>
            <select id="stamp-robbery">${options}</select>
            <div class="field-hint">Every stage is placed relative to the origin you pick next. Nudge individual stages afterwards if the interior does not line up.</div>
        </div>
    `, async () => {
        const id = val('stamp-robbery');
        closeModal();
        await stampLocation(id);
        return false;
    }, 'Place origin');
}

async function saveLocation(loc, quiet) {
    const res = await nui('saveLocation', loc);
    if (!reportResult(res, quiet ? null : 'Saved', loc.label)) return false;

    State.locations = res.locations || State.locations;
    State.robberies = res.robberies || State.robberies;
    return true;
}

function overrideField(key, label, placeholder, overrides, unit) {
    const value = overrides[key];

    return `
        <div class="field">
            <label class="field-label" for="o-${key}">${esc(label)}</label>
            <div class="unit-input">
                <input type="number" id="o-${key}" value="${value === undefined ? '' : esc(value)}"
                       placeholder="${esc(placeholder)}" step="any">
                ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
            </div>
        </div>`;
}

function collectOverrides(inherited) {
    const overrides = {};

    const put = (key, target) => {
        const raw = val(`o-${key}`);
        if (raw === '') return;

        const value = parseFloat(raw);
        if (!Number.isFinite(value)) return;

        if (target) {
            overrides[target] = overrides[target] || {};
            overrides[target][key] = value;
        } else {
            overrides[key] = value;
        }
    };

    put('payoutMultiplier');
    put('radius');
    put('policeRequired', 'gates');
    put('locationCooldown', 'gates');

    const disabled = {};
    document.querySelectorAll('[data-stage-on]').forEach(box => {
        if (!box.checked) disabled[box.dataset.stageOn] = true;
    });
    if (Object.keys(disabled).length > 0) overrides.disabledStages = disabled;

    return overrides;
}

function offsetLabel(offset) {
    if (!offset) return 'as designed';
    const parts = [offset.x || 0, offset.y || 0, offset.z || 0];
    if (parts.every(v => Math.abs(v) < 0.005)) return 'as designed';
    return parts.map(v => (v >= 0 ? '+' : '') + v.toFixed(2)).join(' ');
}

async function nudgeStage(loc, stage) {
    const def = stageType(stage.type);

    const coords = await placePoint({
        label: `${stage.label} here`,
        colour: def ? def.colour : null,
        mode: 'point',
        origin: stage.coords,
    });

    if (!coords) return;

    const current = loc.offsets[stage.id] || { x: 0, y: 0, z: 0 };
    loc.offsets[stage.id] = {
        x: Number((current.x + (coords.x - stage.coords.x)).toFixed(3)),
        y: Number((current.y + (coords.y - stage.coords.y)).toFixed(3)),
        z: Number((current.z + (coords.z - stage.coords.z)).toFixed(3)),
    };

    if (await saveLocation(loc, true)) {
        toast('Nudged', stage.label, 'success', 2400);
        switchPanel('locations');
    }
}

async function openLocationDetail(id) {
    const res = await nui('resolveLocation', id);
    if (!res || !res.ok) {
        toast('Could not open it', (res && res.error) || 'The server did not answer.', 'error');
        openLocation = null;
        switchPanel('locations');
        return;
    }

    resolved = res;
    openLocation = id;
    switchPanel('locations');
}

function detailView(el) {
    const raw = State.locations.find(l => l.id === openLocation);
    const location = resolved.location;
    const overrides = resolved.overrides || {};
    const offsets = resolved.offsets || {};
    const def = State.robberies.find(r => r.id === location.robberyId);

    setTopbar(location.label, `${def ? def.name : location.robberyId} · ${location.stages.length} stages`, `
        <button class="btn btn-ghost" id="act-back">All locations</button>
        <button class="btn btn-primary" id="act-save-loc">Save</button>
    `);

    el.innerHTML = `
        <div class="options-head">
            <div style="flex:1">
                <div class="field" style="max-width:340px;margin:0">
                    <label class="field-label" for="loc-label">Label</label>
                    <input type="text" id="loc-label" value="${esc(location.label)}">
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-shrink:0">
                <label class="toggle">
                    <input type="checkbox" id="loc-enabled" ${raw && raw.enabled ? 'checked' : ''}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">Live</span>
                </label>
                <button class="btn btn-sm btn-ghost" id="act-move">Move origin</button>
                <button class="btn btn-sm btn-ghost" id="act-goto">Go to</button>
                <button class="btn btn-sm btn-danger" id="act-delete-loc">Delete</button>
            </div>
        </div>

        <div class="section-title">Where it is</div>
        <div class="field" style="margin-bottom:16px">
            ${coordRow('lo', location.origin)}
            <div class="field-hint">
                The anchor everything else is placed around. Type or paste coordinates for a
                custom interior, or use Move origin and place it by eye. The heading is which
                way the place faces — get that right and every stage rotates with it.
            </div>
        </div>

        <div class="section-title">Overrides</div>
        <div class="field-hint" style="margin-bottom:12px">
            Leave a box empty and this location follows the robbery. Fill one in and only this location changes.
        </div>
        <div class="field-grid">
            ${overrideField('payoutMultiplier', 'Payout multiplier', '1.0', overrides, '×')}
            ${overrideField('radius', 'Radius', String(def && def.radius || 30), overrides, 'm')}
            ${overrideField('policeRequired', 'Police required',
                String((def && def.gates && def.gates.policeRequired) ?? 2), overrides.gates || {})}
            ${overrideField('locationCooldown', 'Cooldown',
                String((def && def.gates && def.gates.locationCooldown) ?? 1800), overrides.gates || {}, 's')}
        </div>

        <div class="section-title">Stages here</div>
        <div class="field-hint" style="margin-bottom:12px">
            The real world positions at this location. Nudge any that do not sit right in this
            interior, or switch one off entirely if this building does not have it — a custom
            store with no back room can drop the safe and keep everything else. Either way,
            only this location changes.
        </div>
        ${location.stages.map(stage => {
            const type = stageType(stage.type);
            const colour = type ? rgbSolid(type.colour) : 'var(--accent)';
            const moved = offsetLabel(offsets[stage.id]);

            const gone = (overrides.disabledStages || {})[stage.id] === true;

            return `
                <div class="stage-row" data-stage="${esc(stage.id)}"
                     style="--stage-colour:${colour};cursor:default${gone ? ';opacity:.5' : ''}">
                    <label class="toggle" title="Switch this stage off at this location only">
                        <input type="checkbox" data-stage-on="${esc(stage.id)}" ${gone ? '' : 'checked'}>
                        <span class="toggle-track"></span>
                    </label>
                    <div class="stage-meta">
                        <div class="stage-name">${esc(stage.label || stage.id)}</div>
                        <div class="stage-type">${esc(fmtCoords(stage.coords))} · ${esc(moved)}</div>
                    </div>
                    ${gone ? '<span class="badge off">Not here</span>' : `
                        <button class="btn btn-sm btn-ghost" data-nudge="${esc(stage.id)}">Nudge</button>
                        <button class="btn btn-sm btn-ghost" data-goto="${esc(stage.id)}">Go to</button>`}
                    ${offsets[stage.id] ? `<button class="btn btn-sm btn-ghost" data-reset="${esc(stage.id)}">Reset</button>` : ''}
                </div>`;
        }).join('')}`;

    const model = () => ({
        id: location.id,
        robberyId: location.robberyId,
        label: val('loc-label') || location.label,
        enabled: checked('loc-enabled'),
        origin: document.getElementById('lo-x')
            ? readCoords('lo', location.origin)
            : (raw ? raw.origin : location.origin),
        overrides: collectOverrides(),
        offsets: resolved.offsets || {},
    });

    bindCoordPaste('lo');

    document.getElementById('act-back').addEventListener('click', () => {
        openLocation = null;
        switchPanel('locations');
    });

    document.getElementById('act-save-loc').addEventListener('click', async () => {
        if (await saveLocation(model())) openLocationDetail(location.id);
    });

    document.getElementById('act-move').addEventListener('click', async () => {
        const coords = await placePoint({
            label: `${location.label} origin`,
            colour: [25, 224, 140],
            mode: 'point',
            origin: location.origin,
        });

        if (!coords) return;

        const next = model();
        next.origin = coords;

        if (await saveLocation(next, true)) {
            toast('Origin moved', 'Every stage here moved with it.', 'success', 3000);
            openLocationDetail(location.id);
        }
    });

    document.getElementById('act-goto').addEventListener('click', () => {
        nui('teleport', { coords: location.origin });
    });

    document.getElementById('act-delete-loc').addEventListener('click', () => {
        confirmDanger('Delete this location?', `"${location.label}" will stop existing in the world.`,
            async () => {
                const res = await nui('deleteLocation', location.id);
                if (!reportResult(res, 'Deleted', location.label)) return;
                State.locations = res.locations || [];
                State.robberies = res.robberies || State.robberies;
                openLocation = null;
                switchPanel('locations');
            });
    });

    el.querySelectorAll('[data-stage-on]').forEach(box => {
        box.addEventListener('change', async () => {
            if (await saveLocation(model(), true)) {
                toast(box.checked ? 'Back on here' : 'Off at this one',
                    'Only this location changed.', 'success', 2600);
                openLocationDetail(location.id);
            }
        });
    });

    el.querySelectorAll('[data-nudge]').forEach(btn => {
        btn.addEventListener('click', () => {
            const stage = location.stages.find(s => s.id === btn.dataset.nudge);
            if (stage) nudgeStage(model(), stage);
        });
    });

    el.querySelectorAll('[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => {
            const stage = location.stages.find(s => s.id === btn.dataset.goto);
            if (stage) nui('teleport', { coords: stage.coords });
        });
    });

    el.querySelectorAll('[data-reset]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const next = model();
            delete next.offsets[btn.dataset.reset];
            if (await saveLocation(next, true)) {
                toast('Back to the design', '', 'success', 2200);
                openLocationDetail(location.id);
            }
        });
    });
}

window.Panels.locations = {
    render(el) {
        if (openLocation && resolved && resolved.location && resolved.location.id === openLocation) {
            detailView(el);
            return;
        }

        setTopbar('Locations', 'Where each robbery actually exists in the world', `
            <button class="btn btn-primary" id="act-stamp">Stamp a location</button>
        `);

        if (State.locations.length === 0) {
            el.innerHTML = emptyState('&#9678;', 'No locations yet',
                'A robbery is a template until you stamp it somewhere. Stamp the same one onto every store and they all work the same way.',
                '<button class="btn btn-primary" id="empty-stamp">Stamp the first one</button>');
        } else {
            const rows = State.locations.map(loc => {
                const def = State.robberies.find(r => r.id === loc.robberyId);
                const tweaks = Object.keys(loc.offsets || {}).length;
                const overrides = Object.keys(loc.overrides || {}).length;

                return `
                    <tr data-id="${loc.id}">
                        <td>${esc(loc.label)}</td>
                        <td>${esc(def ? def.name : loc.robberyId)}</td>
                        <td class="mono">${esc(fmtCoords(loc.origin))}</td>
                        <td>${tweaks ? `<span class="badge info">${tweaks} nudged</span>` : ''}
                            ${overrides ? '<span class="badge warn">overridden</span>' : ''}</td>
                        <td><span class="badge ${loc.enabled ? 'on' : 'off'}">${loc.enabled ? 'Live' : 'Off'}</span></td>
                        <td style="text-align:right">
                            <button class="btn btn-sm btn-ghost" data-act="open">Open</button>
                            <button class="btn btn-sm btn-ghost" data-act="go">Go to</button>
                        </td>
                    </tr>`;
            }).join('');

            el.innerHTML = `
                <div class="section-title">Stamped locations</div>
                <table class="table">
                    <thead>
                        <tr><th>Label</th><th>Robbery</th><th>Origin</th><th>Changes</th><th>State</th><th></th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }

        document.getElementById('act-stamp')?.addEventListener('click', stampModal);
        document.getElementById('empty-stamp')?.addEventListener('click', stampModal);

        el.querySelectorAll('tbody tr').forEach(row => {
            const id = parseInt(row.dataset.id, 10);
            const loc = State.locations.find(l => l.id === id);

            row.addEventListener('click', (e) => {
                if (e.target.dataset.act === 'go') {
                    nui('teleport', { coords: loc.origin });
                    return;
                }
                openLocationDetail(id);
            });
        });
    },
};
