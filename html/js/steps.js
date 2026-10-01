const Steps = {
    pickType() {
        const job = State.current;
        if (!job) return;

        if (anchorKind(job) === 'model' && !jobOrigin(job)) {
            toast('Pick the model first', 'Steps are placed around the thing it lives on. Do that in Places.', 'warning', 4600);
            go('places');
            return;
        }

        const order = ['puzzle', 'tool', 'loot', 'people', 'control', 'entry'];
        const body = `<div class="type-flow">${order.map(g => {
            const types = (State.stageTypes || []).filter(t => t.group === g);
            if (!types.length) return '';
            return `<div class="type-set"><div class="group-label">${esc(GROUPS[g].label)}</div>${types.map((t, i) => `
                <div class="type-row" data-type="${esc(t.id)}" style="${colourVars(t.colour)};animation-delay:${i * 25}ms">
                    <div class="ti">${icon(t.id, 16)}</div>
                    <div><b>${esc(t.label)}</b><small>${esc(t.blurb || '')}</small></div>
                </div>`).join('')}</div>`;
        }).join('')}</div>`;

        modal({
            title: 'Add a step',
            sub: 'Pick what it is, then place it in the world.',
            body,
            size: 'wide',
            foot: false,
            onOpen: (root) => root.querySelectorAll('[data-type]').forEach(card => card.addEventListener('click', () => {
                closeModal();
                Steps.add(card.dataset.type);
            })),
        });
    },

    defaults(type) {
        const def = stageType(type);
        const opts = {};
        (def ? def.fields : []).forEach(f => { opts[f.key] = clone(f.default); });
        return opts;
    },

    make(type, coords, extra = {}) {
        const job = State.current;
        const def = stageType(type);
        const opts = Object.assign(Steps.defaults(type), extra.opts || {});
        const count = job.stages.filter(s => s.type === type).length;

        opts.label = extra.label || opts.label || `${def ? def.label : type}${count ? ` ${count + 1}` : ''}`;
        if (coords && coords.radius !== undefined && opts.radius !== undefined) opts.radius = coords.radius;

        return {
            id: nextId(job.stages, type),
            type,
            label: opts.label,
            coords: coords ? { x: coords.x, y: coords.y, z: coords.z, h: coords.h || 0 } : null,
            requires: extra.requires || [],
            payout: extra.payout || (LOOT_TYPES.includes(type) ? { cash: { account: 'job', min: 0, max: 0 }, items: [], lootTable: '' } : {}),
            opts,
        };
    },

    async add(type) {
        const job = State.current;
        const def = stageType(type);
        if (!job || !def) return;

        const zone = ZONE_TYPES.includes(type);
        const res = await place({
            label: def.label,
            colour: def.colour,
            mode: zone ? 'zone' : 'point',
            radius: zone ? 25 : undefined,
            origin: Steps.lastPoint(),
        });
        if (!res.ok || !res.coords) return;

        const last = job.stages[job.stages.length - 1];
        const stage = Steps.make(type, res.coords, { requires: last && type !== 'escape' ? [last.id] : [] });
        if (type === 'escape') stage.requires = Steps.escapeRequires();

        job.stages.push(stage);
        if (!jobOrigin(job) || !job.origin) Steps.setOrigin(stage.coords);

        State.sel = { kind: 'stage', id: stage.id };
        await saveJob(true);
        await Steps.ensurePlace();
        refresh({ view: true, inspector: true, tabs: true });
        toast('Step placed', stageLabel(stage), 'success', 2400);
    },

    escapeRequires() {
        const job = State.current;
        const loot = job.stages.filter(s => LOOT_TYPES.includes(s.type));
        if (loot.length) return [loot[0].id];
        const last = job.stages[job.stages.length - 1];
        return last ? [last.id] : [];
    },

    lastPoint() {
        const job = State.current;
        const sel = selected();
        if (sel && sel.coords) return sel.coords;
        const placed = (job.stages || []).filter(s => s.coords);
        return placed.length ? placed[placed.length - 1].coords : undefined;
    },

    setOrigin(coords) {
        const job = State.current;
        if (job.origin && job.origin.x !== undefined) return;
        if (anchorKind(job) === 'model') return;
        const base = jobOrigin(job) || coords;
        job.origin = { x: base.x, y: base.y, z: base.z, h: base.h || 0 };
    },

    async ensurePlace() {
        const job = State.current;
        if (anchorKind(job) !== 'location' || State.jobLocations.length > 0 || !job.origin) return;

        const res = await nui('saveLocation', {
            robberyId: job.id,
            label: job.name,
            enabled: true,
            origin: job.origin,
            overrides: {},
            offsets: {},
        });

        if (res && res.ok) {
            State.locations = res.locations || State.locations;
            State.robberies = res.robberies || State.robberies;
            State.jobLocations = State.locations.filter(l => l.robberyId === job.id);
            refresh({ rail: true, tabs: true });
        }
    },

    async move(stage) {
        const def = stageType(stage.type);
        const zone = ZONE_TYPES.includes(stage.type);
        const res = await place({
            label: stageLabel(stage),
            colour: def ? def.colour : undefined,
            mode: zone ? 'zone' : 'point',
            radius: zone ? (stage.opts.radius || 25) : undefined,
            origin: stage.coords || Steps.lastPoint(),
            previewModel: stage.opts.prop || undefined,
        });
        if (!res.ok || !res.coords) return;

        stage.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        if (res.coords.radius !== undefined && stage.opts.radius !== undefined) stage.opts.radius = res.coords.radius;
        if (!jobOrigin(State.current)) Steps.setOrigin(stage.coords);

        await saveJob(true);
        await Steps.ensurePlace();
        refresh({ view: true, inspector: true });
        toast('Moved', stageLabel(stage), 'success', 2000);
    },

    async duplicate(stage) {
        const job = State.current;
        const def = stageType(stage.type);
        const zone = ZONE_TYPES.includes(stage.type);
        const res = await place({
            label: `${stageLabel(stage)} copy`,
            colour: def ? def.colour : undefined,
            mode: zone ? 'zone' : 'point',
            radius: zone ? (stage.opts.radius || 25) : undefined,
            origin: stage.coords,
            previewModel: stage.opts.prop || undefined,
        });
        if (!res.ok || !res.coords) return;

        const copy = clone(stage);
        copy.id = nextId(job.stages, stage.type);
        copy.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        const count = job.stages.filter(s => s.type === stage.type).length;
        copy.opts.label = `${stageLabel(stage).replace(/\s\d+$/, '')} ${count + 1}`;
        copy.label = copy.opts.label;
        if (copy.opts.pairWith !== undefined) copy.opts.pairWith = '';

        job.stages.push(copy);
        State.sel = { kind: 'stage', id: copy.id };
        await saveJob(true);
        refresh({ view: true, inspector: true, tabs: true });
        toast('Copied', `${copy.opts.label} has every setting from ${stageLabel(stage)}.`, 'success', 3000);
    },

    remove(stage) {
        const job = State.current;
        confirmDanger('Delete this step?',
            `"${stageLabel(stage)}" goes, and anything waiting on it stops waiting.`,
            async () => {
                job.stages = job.stages.filter(s => s.id !== stage.id);
                job.stages.forEach(s => {
                    s.requires = (s.requires || []).filter(id => id !== stage.id);
                    if (s.opts.codeFrom === stage.id) s.opts.codeFrom = '';
                    if (s.opts.pairWith === stage.id) s.opts.pairWith = '';
                });
                job.props.forEach(p => { if (p.linkStage === stage.id) p.linkStage = ''; });
                State.sel = null;
                await saveJob(true);
                refresh({ view: true, inspector: true, tabs: true, head: true });
            });
    },

    goto(stage) {
        if (stage.coords) nui('teleport', { coords: stage.coords, heading: stage.coords.h });
    },
};
