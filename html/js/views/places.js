const PlacesView = {
    el: null,

    render(el) {
        PlacesView.el = el;
        el.classList.add('scroll');
        const job = State.current;

        if (anchorKind(job) === 'model') {
            PlacesView.renderModel(el);
            return;
        }

        const places = State.jobLocations;
        const sel = State.sel && State.sel.kind === 'place' ? State.sel.id : null;
        const anchor = (job.anchor && job.anchor.label) || '';

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title"><span>Where this job exists</span><button class="btn xs act primary" id="pl-add">${icon('plus', 12)} Add a place</button></div>
                <div class="hint" style="margin-bottom:14px">Build the job once, then stamp it anywhere with the same layout: every 24/7, every Fleeca. You line up the anchor and the whole job turns with it. A place that does not quite match can nudge single steps, switch some off, or change its own numbers.</div>
                ${places.length ? `<div class="cards">${places.map((l, i) => PlacesView.card(l, i, sel)).join('')}</div>`
                    : `<div class="empty inline">
                        <div class="mark">${icon('pin', 30, 1.5)}</div>
                        <h3>Not placed anywhere</h3>
                        <p>${jobOrigin(job) ? 'Place it where you built it, or line it up somewhere else.' : 'Add a step first. The first step becomes the anchor every place lines up on.'}</p>
                        ${jobOrigin(job) ? `<div class="row"><button class="btn primary" id="pl-here">${icon('pin', 14)} Where I built it</button><button class="btn" id="pl-add2">${icon('place', 14)} Somewhere else</button></div>` : ''}
                    </div>`}
            </div>
            <div class="sec">
                <div class="sec-title">The anchor</div>
                <div class="grid2">
                    <div class="f"><label>What to line up on</label><input class="inp" id="pl-anchor" value="${esc(anchor)}" placeholder="the vault door, the till, the front door"></div>
                    <div class="f"><label>Anchor position</label><div class="inp" style="color:var(--ink2)">${esc(fmtCoords(jobOrigin(job)))}</div></div>
                </div>
                <div class="hint" style="margin-top:8px">Name something every copy of this place has. When you add a place you stand on it, facing the same way, and every step lands where it should.</div>
            </div>`;

        el.querySelector('#pl-add')?.addEventListener('click', () => PlacesView.addPlace());
        el.querySelector('#pl-add2')?.addEventListener('click', () => PlacesView.addPlace());
        el.querySelector('#pl-here')?.addEventListener('click', () => Steps.ensurePlace().then(() => renderView()));
        el.querySelector('#pl-anchor').addEventListener('input', (e) => {
            job.anchor = job.anchor || {};
            job.anchor.label = e.target.value;
            markDirty();
        });

        el.querySelectorAll('[data-place]').forEach(card => card.addEventListener('click', (e) => {
            const id = Number(card.dataset.place);
            const loc = places.find(l => l.id === id);
            const act = e.target.closest('[data-act]');
            if (act && act.dataset.act === 'go') { nui('teleport', { coords: loc.origin, heading: loc.origin.h }); return; }
            select('place', id, { view: false });
        }));
    },

    highlight() {
        const sel = State.sel && State.sel.kind === 'place' ? State.sel.id : null;
        PlacesView.el && PlacesView.el.querySelectorAll('[data-place]').forEach(c => c.classList.toggle('on', Number(c.dataset.place) === sel));
    },

    soft() {},

    card(l, i, sel) {
        const nudged = Object.keys(l.offsets || {}).length;
        const o = l.overrides || {};
        const changed = ['payoutMultiplier', 'radius'].filter(k => o[k] !== undefined).length + Object.keys(o.gates || {}).length;
        const off = Object.keys(o.disabledStages || {}).length + Object.keys(o.disabledProps || {}).length + Object.keys(o.disabledNpcs || {}).length;

        return `
            <div class="card click ${sel === l.id ? 'on' : ''}" data-place="${l.id}" style="animation-delay:${i * 30}ms">
                <div class="card-head">
                    <div style="min-width:0"><div class="card-title">${esc(l.label)}</div><div class="card-sub">${esc(fmtCoords(l.origin))} · ${Math.round(l.origin.h || 0)}°</div></div>
                    <span class="badge ${l.enabled ? 'on' : ''}">${l.enabled ? 'Live' : 'Off'}</span>
                </div>
                <div class="card-row">
                    ${nudged ? `<span class="badge info">${nudged} nudged</span>` : ''}
                    ${changed ? `<span class="badge warn">${changed} own numbers</span>` : ''}
                    ${off ? `<span class="badge">${off} switched off</span>` : ''}
                    ${!nudged && !changed && !off ? '<span class="badge">as designed</span>' : ''}
                </div>
                <div class="card-row"><button class="btn xs" data-act="go">${icon('goto', 12)} Go there</button></div>
            </div>`;
    },

    layoutFor(job) {
        const base = jobOrigin(job);
        const points = (job.stages || []).filter(s => s.coords && s.enabled !== false).map(s => ({
            x: s.coords.x, y: s.coords.y, z: s.coords.z, label: stageLabel(s), colour: stageColour(s),
        }));
        (job.props || []).filter(p => p.coords).forEach(p => points.push({ x: p.coords.x, y: p.coords.y, z: p.coords.z, label: propLabel(p), colour: [57, 212, 155] }));
        (job.npcs || []).filter(n => n.coords).forEach(n => points.push({ x: n.coords.x, y: n.coords.y, z: n.coords.z, label: npcLabel(n), colour: [255, 93, 115] }));
        return { base, points };
    },

    async addPlace() {
        const job = State.current;
        const base = jobOrigin(job);
        if (!base) { toast('Nothing to line up yet', 'Place a step first.', 'info'); return; }

        const anchor = (job.anchor && job.anchor.label) || 'the anchor';
        const res = await place({
            label: `${job.name} anchor`,
            colour: [255, 195, 90],
            mode: 'point',
            layout: PlacesView.layoutFor(job),
            guided: { step: 1, total: 1, title: `Line up ${anchor}`, subtitle: 'Stand where it is at this place and face the same way. The whole job follows.', skippable: true },
        });
        if (!res.ok || !res.coords) return;

        const count = State.jobLocations.length;
        const save = await nui('saveLocation', {
            robberyId: job.id,
            label: `${job.name} ${count + 1}`,
            enabled: true,
            origin: { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 },
            overrides: {},
            offsets: {},
        });
        if (!report(save, 'Place added', `${job.name} ${count + 1}`)) return;

        State.locations = save.locations || State.locations;
        State.robberies = save.robberies || State.robberies;
        State.jobLocations = State.locations.filter(l => l.robberyId === job.id);
        State.sel = save.location ? { kind: 'place', id: save.location.id } : null;
        State.tab = 'places';
        refresh({ view: true, inspector: true, tabs: true, rail: true });
        validate();
    },

    async saveLocation(loc, quiet) {
        const res = await nui('saveLocation', loc);
        if (!report(res, quiet ? null : 'Saved', loc.label)) return false;
        State.locations = res.locations || State.locations;
        State.robberies = res.robberies || State.robberies;
        State.jobLocations = State.locations.filter(l => l.robberyId === State.current.id);
        return true;
    },

    pointList(kind, list, title, hint) {
        const one = title.replace(/s$/, '');
        return `<div class="sec-title" style="margin-top:16px"><span>${esc(title)}</span><button class="btn xs act primary" data-pt-add="${kind}">${icon('plus', 12)} Add</button></div>
            <div class="hint" style="margin-bottom:8px">${esc(hint)}</div>
            ${list.length ? `<div class="ov-list">${list.map((p, i) => `
                <div class="ov-row">
                    <span class="badge info">${i + 1}</span>
                    <div><b>${esc(p.label || `${one} ${i + 1}`)}</b><small>${esc(fmtCoords(p))}</small></div>
                    <div class="acts">
                        <button class="btn xs" data-pt-move="${kind}:${i}">${icon('place', 11)} Move</button>
                        <button class="btn xs" data-pt-go="${kind}:${i}">${icon('goto', 11)}</button>
                        <button class="btn xs danger" data-pt-del="${kind}:${i}">${icon('trash', 11)}</button>
                    </div>
                </div>`).join('')}</div>` : '<span class="tag static">None yet</span>'}`;
    },

    renderModel(el) {
        const job = State.current;
        const a = job.anchor;
        const models = a.models || [];
        const vehicle = a.pool === 'vehicle';
        const s = a.spawn || {};
        const sent = vehicle && s.mode === 'sent';

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title">Lives on a model</div>
                <div class="hint" style="margin-bottom:14px">${sent
                    ? 'Talking to the contact sends one of these out, with the steps laid out around it the way you placed them around the first one.'
                    : `Nothing to stamp. Every ${a.pool === 'vehicle' ? 'vehicle' : 'prop'} in the world with one of these models becomes this job, with the steps laid out around it the way you placed them around the first one.`}</div>
                <div class="models" style="margin-bottom:12px">
                    ${models.map((m, i) => `<span class="model-chip">${icon('model', 14)} ${esc(modelName(m))}<button data-drop-model="${i}" title="Remove">×</button></span>`).join('') || '<span class="hint">No model yet.</span>'}
                </div>
                <div class="card-row" style="margin-top:0">
                    <button class="btn primary" id="pm-pick">${icon('place', 14)} ${models.length ? 'Aim at another one' : 'Aim at one in the world'}</button>
                    <button class="btn" id="pm-type">${icon('plus', 14)} Type a model name</button>
                </div>
            </div>
            <div class="sec">
                <div class="sec-title">Finding them</div>
                <div class="grid3" id="pm-form">
                    ${fieldSeg('anchor.pool', 'Look for', a.pool || 'object', [{ value: 'object', label: 'Props' }, { value: 'vehicle', label: 'Vehicles' }, { value: 'ped', label: 'Peds' }])}
                    ${fieldNumber('anchor.scanRange', 'Within', a.scanRange ?? 80, { min: 10, max: 300, unit: 'm', hint: 'How close a player has to be before one is set up.' })}
                    <div class="f"><label>Built around</label><div class="inp" style="color:var(--ink2)">${esc(fmtCoords(jobOrigin(job)))}</div><div class="fh">The one you aimed at first. Steps are offsets from it.</div></div>
                </div>
                ${jobOrigin(job) ? `<div class="card-row"><button class="btn sm" id="pm-repick">${icon('place', 13)} Rebuild around a different one</button></div>` : ''}
            </div>
            ${vehicle ? `
            <div class="sec">
                <div class="sec-title">Where it comes from</div>
                <div class="grid2" id="pm-spawn">
                    ${fieldSeg('anchor.spawn.mode', 'The truck', sent ? 'sent' : 'road', [{ value: 'road', label: 'Already on the road' }, { value: 'sent', label: 'Sent by the contact' }], { wide: true, hint: sent ? 'Talking to the contact puts one on the road with your guard steps riding in it.' : 'Every one of this model driving around can be hit.' })}
                    ${sent ? `
                        ${fieldSeg('anchor.spawn.start', 'It starts', s.start === 'points' ? 'points' : 'near', [{ value: 'near', label: 'On a road nearby' }, { value: 'points', label: 'At my points' }], { wide: true })}
                        ${s.start === 'points' ? '' : fieldNumber('anchor.spawn.nearMin', 'At least', s.nearMin ?? 250, { min: 100, max: 1500, unit: 'm' }) + fieldNumber('anchor.spawn.nearMax', 'At most', s.nearMax ?? 650, { min: 150, max: 2000, unit: 'm', hint: 'Away from the contact.' })}
                        ${fieldSeg('anchor.spawn.heads', 'It drives', s.heads === 'points' ? 'points' : 'wander', [{ value: 'wander', label: 'Around the map' }, { value: 'points', label: 'To a drop-off' }], { wide: true, hint: s.heads === 'points' ? 'If it gets there before anyone hits it, it got away and the job fails.' : '' })}
                        ${fieldNumber('anchor.spawn.speed', 'Speed', s.speed ?? 60, { min: 20, max: 140, unit: 'km/h' })}
                        ${fieldNumber('anchor.spawn.lasts', 'Called off after', s.lasts ?? 20, { min: 5, max: 90, unit: 'min' })}
                        ${fieldSwitch('anchor.spawn.blip', "Show it on the crew's map", s.blip !== false, { wide: true })}` : ''}
                </div>
                ${sent && s.start === 'points' ? PlacesView.pointList('starts', s.starts || [], 'Start points', 'Where it starts, facing the way it should drive off. One is picked at random.') : ''}
                ${sent && s.heads === 'points' ? PlacesView.pointList('ends', s.ends || [], 'Drop-offs', 'Where it is heading. One is picked at random.') : ''}
                ${sent ? `<div class="hint" style="margin-top:12px">They stop it by shooting it, the tyres or the driver, or by blocking the road. Then the guards get out and fight. The rear doors and the cargo only work once it has stopped.</div>
                    <div class="card-row"><button class="btn sm" id="pm-contact">${icon('twoman', 13)} Set up the contact</button></div>` : ''}
            </div>` : ''}
            ${sent ? '' : `
            <div class="sec">
                <div class="sec-title"><span>Where it works</span><button class="btn xs act primary" id="pm-area">${icon('plus', 12)} Add an area</button></div>
                <div class="hint" style="margin-bottom:12px">Leave this empty and the job covers every one of these on the map. Add areas to keep it to parts of the map, then build other jobs for other areas with their own steps, items and payouts. Where areas overlap, the smaller one wins.</div>
                ${(a.areas || []).length ? `<div class="ov-list">${a.areas.map((ar, i) => `
                    <div class="ov-row">
                        <span class="badge info">${Math.round(ar.radius)} m</span>
                        <div style="display:grid;grid-template-columns:1fr 110px;gap:6px">
                            <input class="inp" data-area-label="${i}" value="${esc(ar.label || `Area ${i + 1}`)}" style="padding:6px 9px">
                            <div class="unit"><input class="inp" type="number" min="5" data-area-radius="${i}" value="${Math.round(ar.radius)}" style="padding:6px 9px"><em>m</em></div>
                        </div>
                        <div class="acts">
                            <button class="btn xs" data-area-move="${i}">${icon('place', 11)} Move</button>
                            <button class="btn xs" data-area-go="${i}">${icon('goto', 11)}</button>
                            <button class="btn xs danger" data-area-del="${i}">${icon('trash', 11)}</button>
                        </div>
                    </div>`).join('')}</div>` : '<span class="tag static">Everywhere</span>'}
            </div>`}`;

        const areas = () => (a.areas = a.areas || []);
        const placeArea = async (index) => {
            const current = index === undefined ? null : areas()[index];
            const res = await place({
                label: 'area',
                colour: [255, 195, 90],
                mode: 'zone',
                radius: current ? current.radius : 150,
                maxRadius: 2000,
                origin: current ? { x: current.x, y: current.y, z: current.z, h: 0 } : undefined,
                guided: { step: 1, total: 1, title: 'Mark the area', subtitle: 'Every one inside this circle uses this job. Scroll to size it.', skippable: true },
            });
            if (!res.ok || !res.coords) return;
            const next = { label: current ? current.label : `Area ${areas().length + 1}`, x: res.coords.x, y: res.coords.y, z: res.coords.z, radius: res.coords.radius || 150 };
            if (current) areas()[index] = next; else areas().push(next);
            await saveJob(true);
            renderView();
        };

        el.querySelector('#pm-area')?.addEventListener('click', () => placeArea());

        const spawnCfg = () => (a.spawn = a.spawn || {});
        const placePoint = async (kind, index) => {
            const list = (spawnCfg()[kind] = spawnCfg()[kind] || []);
            const current = index === undefined ? null : list[index];
            const res = await place({
                label: kind === 'starts' ? 'truck start' : 'drop-off',
                colour: [255, 93, 115],
                mode: 'point',
                previewModel: kind === 'starts' ? models[0] : undefined,
                origin: current || undefined,
            });
            if (!res.ok || !res.coords) return;
            const point = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
            if (current) list[index] = Object.assign(current, point); else list.push(point);
            await saveJob(true);
            renderView();
        };

        el.querySelectorAll('[data-pt-add]').forEach(b => b.addEventListener('click', () => placePoint(b.dataset.ptAdd)));
        el.querySelectorAll('[data-pt-move]').forEach(b => b.addEventListener('click', () => {
            const [kind, i] = b.dataset.ptMove.split(':');
            placePoint(kind, Number(i));
        }));
        el.querySelectorAll('[data-pt-go]').forEach(b => b.addEventListener('click', () => {
            const [kind, i] = b.dataset.ptGo.split(':');
            const p = (spawnCfg()[kind] || [])[Number(i)];
            if (p) nui('teleport', { coords: p, heading: p.h });
        }));
        el.querySelectorAll('[data-pt-del]').forEach(b => b.addEventListener('click', async () => {
            const [kind, i] = b.dataset.ptDel.split(':');
            (spawnCfg()[kind] || []).splice(Number(i), 1);
            await saveJob(true);
            renderView();
        }));

        const spawnForm = el.querySelector('#pm-spawn');
        if (spawnForm) {
            bindForm(spawnForm, job, (k) => {
                markDirty();
                if (['anchor.spawn.mode', 'anchor.spawn.start', 'anchor.spawn.heads'].includes(k)) {
                    renderView();
                    refresh({ tabs: true });
                }
            });
        }
        el.querySelector('#pm-contact')?.addEventListener('click', () => go('npcs'));
        el.querySelectorAll('[data-area-move]').forEach(b => b.addEventListener('click', () => placeArea(Number(b.dataset.areaMove))));
        el.querySelectorAll('[data-area-go]').forEach(b => b.addEventListener('click', () => {
            const ar = areas()[Number(b.dataset.areaGo)];
            nui('teleport', { coords: ar });
        }));
        el.querySelectorAll('[data-area-del]').forEach(b => b.addEventListener('click', async () => {
            areas().splice(Number(b.dataset.areaDel), 1);
            await saveJob(true);
            renderView();
        }));
        el.querySelectorAll('[data-area-label]').forEach(input => input.addEventListener('input', () => {
            areas()[Number(input.dataset.areaLabel)].label = input.value;
            markDirty();
        }));
        el.querySelectorAll('[data-area-radius]').forEach(input => input.addEventListener('change', () => {
            const v = parseFloat(input.value);
            if (Number.isFinite(v) && v > 0) areas()[Number(input.dataset.areaRadius)].radius = v;
            markDirty();
        }));

        bindForm(el.querySelector('#pm-form'), job, () => markDirty());
        el.querySelector('#pm-pick').addEventListener('click', () => PlacesView.pickModel());
        el.querySelector('#pm-repick')?.addEventListener('click', () => PlacesView.pickModel(true));
        el.querySelector('#pm-type').addEventListener('click', () => {
            modal({
                title: 'Add a model',
                body: `<div class="f"><label>Model name</label><input class="inp" id="pm-name" placeholder="prop_atm_01" spellcheck="false"></div>`,
                confirmLabel: 'Add',
                confirm: async (root) => {
                    const name = root.querySelector('#pm-name').value.trim();
                    if (!name) return false;
                    if (!a.models.includes(name)) a.models.push(name);
                    markDirty();
                    renderView();
                    refresh({ tabs: true });
                },
            });
        });
        el.querySelectorAll('[data-drop-model]').forEach(b => b.addEventListener('click', () => {
            a.models.splice(Number(b.dataset.dropModel), 1);
            markDirty();
            renderView();
            refresh({ tabs: true });
        }));
    },

    async pickModel(rebuild = false) {
        const job = State.current;
        const vehicle = (job.anchor && job.anchor.pool) === 'vehicle';
        const res = await place({
            label: 'the model',
            colour: [255, 195, 90],
            pickEntity: true,
            guided: { step: 1, total: 1, title: vehicle ? 'Aim at the vehicle' : 'Aim at it', subtitle: 'Every one with the same model becomes this job.', skippable: true },
        });
        if (!res.ok || !res.pick) return;

        const r = PlacesView.applyPick(job, res.pick, res.coords, rebuild);
        await saveJob(true);
        refresh({ view: true, tabs: true, inspector: true });
        toast(r.added ? 'Model added' : 'Already on the list', modelName(r.model), r.added ? 'success' : 'info', 2600);
    },

    applyPick(job, pick, coords, rebuild) {
        const a = job.anchor;
        a.kind = 'model';
        if (pick.vehicle) a.pool = 'vehicle';
        const known = pick.name || KNOWN_MODELS.find(m => joaat(m) === toUnsigned(pick.model));
        const model = known || pick.model;
        const exists = a.models.some(m => m === model || toUnsigned(typeof m === 'number' ? m : joaat(m)) === toUnsigned(pick.model));
        if (!exists) a.models.push(model);

        if (!job.origin || rebuild) {
            const shift = job.origin && rebuild ? job.origin : null;
            const next = { x: coords.x, y: coords.y, z: coords.z, h: coords.h || 0 };
            if (shift) PlacesView.rebase(job, shift, next);
            job.origin = next;
        }
        return { added: !exists, model };
    },

    rebase(job, from, to) {
        const turn = ((to.h || 0) - (from.h || 0)) * Math.PI / 180;
        const cos = Math.cos(turn), sin = Math.sin(turn);
        const move = (c) => {
            if (!c) return c;
            const vx = c.x - from.x, vy = c.y - from.y;
            return {
                x: to.x + vx * cos - vy * sin,
                y: to.y + vx * sin + vy * cos,
                z: to.z + (c.z - from.z),
                h: ((c.h || 0) + (to.h - from.h) + 360) % 360,
            };
        };
        (job.stages || []).forEach(s => { s.coords = move(s.coords); });
        (job.props || []).forEach(p => { p.coords = move(p.coords); });
    },
};

Views.places = PlacesView;
