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

    renderModel(el) {
        const job = State.current;
        const a = job.anchor;
        const models = a.models || [];

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title">Lives on a model</div>
                <div class="hint" style="margin-bottom:14px">Nothing to stamp. Every ${a.pool === 'vehicle' ? 'vehicle' : 'prop'} in the world with one of these models becomes this job, with the steps laid out around it the way you placed them around the first one.</div>
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
            </div>`;

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
