const RECIPES = {
    store: {
        steps: [
            { key: 'till', type: 'register', title: 'The till', name: 'Till', anchor: 'the first till', subtitle: 'Aim at the till behind the counter.', repeat: true, opts: { duration: 12 }, pay: [200, 600] },
            { key: 'clerk', type: 'hostage', title: 'The clerk', name: 'Clerk', subtitle: 'Where the clerk stands. Skip it for an empty shop.', optional: true },
            { key: 'safe', type: 'safe', title: 'The safe', name: 'Back-room safe', subtitle: 'The back-room safe. Skip it if there is none.', optional: true, after: ['till'], pay: [1500, 4000] },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Where they must get to before the cash pays. Skip to pay on the spot.', zone: 50, after: ['safe', 'till'] },
        ],
    },
    atm: {
        pick: { title: 'Aim at an ATM', subtitle: 'Every ATM with the same model becomes this job.', pool: 'object', anchor: 'the ATM' },
        steps: [
            { key: 'drill', type: 'tool', title: 'Where they drill', name: 'Drill the ATM', subtitle: 'Stand in front of the ATM, facing it.', opts: { toolKind: 'drill', duration: 25, notifyPolice: true } },
            { key: 'cash', type: 'container', samePoint: 'drill', name: 'Cash cassette', after: ['drill'], opts: { grabs: 3, grabTime: 5 }, pay: [300, 700] },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Optional. Skip to pay on the spot.', zone: 60, after: ['cash'], skipOnly: true },
        ],
    },
    bank: {
        steps: [
            { key: 'cams', type: 'camera', title: 'The security room', name: 'Kill the cameras', anchor: 'the security panel', subtitle: 'Where the cameras are cut. Turning them off softens the alarm. Skip for none.', optional: true },
            { key: 'power', type: 'power', title: 'The power box', name: 'Cut the power', anchor: 'the power box', subtitle: 'Cutting it darkens the building. Skip for none.', optional: true },
            { key: 'panel', type: 'hack', title: 'The door panel', name: 'Door panel', anchor: 'the door panel', subtitle: 'The panel they hack. It shows them the vault code.', opts: { revealCode: 4, duration: 15 } },
            { key: 'keypad', type: 'keypad', title: 'The vault keypad', name: 'Vault keypad', anchor: 'the vault keypad', subtitle: 'Where the code from the panel gets typed in.', needs: ['panel'], after: ['panel'], opts: { digits: 4, duration: 4 }, codeFrom: 'panel' },
            { key: 'vault', type: 'tool', title: 'The vault door', name: 'Burn the vault door', anchor: 'the vault door', subtitle: 'Where they burn through.', after: ['keypad', 'panel'], opts: { toolKind: 'thermite', duration: 20, notifyPolice: true } },
            { key: 'boxes', type: 'container', title: 'Deposit boxes', name: 'Deposit boxes', subtitle: 'Aim at each bank of boxes.', repeat: true, after: ['vault', 'keypad', 'panel'], opts: { grabs: 4, grabTime: 5 }, pay: [800, 2000] },
            { key: 'trolley', type: 'container', title: 'Cash trolleys', name: 'Cash trolley', subtitle: 'Optional. A trolley is spawned on each one and empties when taken.', repeat: true, optional: true, after: ['vault', 'keypad', 'panel'], opts: { grabs: 6, grabTime: 4, prop: 'hei_prop_hei_cash_trolly_01', propDone: 'swap', propSwap: 'hei_prop_hei_cash_trolly_03', optional: true }, pay: [1000, 2500] },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Where the crew must get to before the cash pays.', zone: 80, after: ['vault', 'keypad', 'panel'] },
        ],
    },
    jewelry: {
        steps: [
            { key: 'alarm', type: 'hack', title: 'The alarm panel', name: 'Alarm panel', anchor: 'the alarm panel', subtitle: 'Optional. Hacking it first keeps things quiet.', optional: true, opts: { duration: 12 } },
            { key: 'cases', type: 'container', title: 'Display cases', name: 'Display case', anchor: 'the first case', subtitle: 'Aim at each case to smash.', repeat: true, opts: { grabs: 1, grabTime: 6 }, pay: [500, 1200] },
            { key: 'safe', type: 'safe', title: 'The back office safe', name: 'Office safe', subtitle: 'Skip if there is none.', optional: true, after: ['cases'], pay: [2000, 5000] },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Where they must get to before the cash pays.', zone: 60, after: ['cases'] },
        ],
    },
    house: {
        steps: [
            { key: 'door', type: 'tool', title: 'The front door', name: 'Pick the lock', anchor: 'the front door', subtitle: 'Where they pick the lock.', opts: { toolKind: 'lockpick', duration: 8 } },
            { key: 'search', type: 'container', title: 'Places to search', name: 'Search', subtitle: 'Drawers, wardrobes, cupboards. One at a time.', repeat: true, after: ['door'], opts: { grabs: 1, grabTime: 6 }, pay: [100, 400] },
            { key: 'safe', type: 'safe', title: 'The safe', name: 'Safe', subtitle: 'Skip if there is none.', optional: true, after: ['door'], pay: [1000, 3000] },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Optional. Skip to pay on the spot.', zone: 50, after: ['door'], skipOnly: true },
        ],
    },
    vehicle: {
        pick: { title: 'Aim at the vehicle', subtitle: 'Every one of this model on the road becomes this job.', pool: 'vehicle', anchor: 'the vehicle' },
        steps: [
            { key: 'doors', type: 'tool', title: 'The rear doors', name: 'Blow the doors', subtitle: 'Where they place the charge.', opts: { toolKind: 'thermite', duration: 15, notifyPolice: true } },
            { key: 'cargo', type: 'container', samePoint: 'doors', name: 'The cargo', after: ['doors'], opts: { grabs: 5, grabTime: 4 }, pay: [800, 1600] },
            { key: 'guards', type: 'guard', title: 'Guards', name: 'Guard', subtitle: 'Optional. Each one fights back.', repeat: true, optional: true },
            { key: 'escape', type: 'escape', title: 'The getaway', name: 'Getaway', subtitle: 'Optional. Skip to pay on the spot.', zone: 100, after: ['cargo'], skipOnly: true },
        ],
    },
};

const Setup = {
    running: false,

    recipeFor(category) {
        return RECIPES[category] || null;
    },

    preview(recipe) {
        if (!recipe) return '<div class="hint" style="margin-top:12px">You start blank and add exactly the steps you want from the Plan.</div>';
        const rows = [];
        if (recipe.pick) rows.push({ c: [255, 195, 90], t: recipe.pick.title, s: 'aim at it in the world' });
        recipe.steps.forEach(st => {
            const t = stageType(st.type);
            rows.push({
                c: t ? t.colour : [90, 162, 255],
                t: st.title || st.name,
                s: [t ? t.label : st.type, st.samePoint ? 'same spot' : '', st.repeat ? 'as many as you like' : '', st.optional || st.skipOnly ? 'skippable' : ''].filter(Boolean).join(' · '),
            });
        });
        return `<div class="walk">${rows.map((r, i) => `<div class="walk-row" style="${colourVars(r.c)}"><span class="no">${i + 1}</span><span>${esc(r.t)}</span><small>${esc(r.s)}</small></div>`).join('')}</div>`;
    },

    open() {
        let type = 'store';
        let walk = true;

        const back = modal({
            title: 'New job',
            sub: 'Pick what it is. Nothing ships pre-built: you place every point yourself, so it fits your map and your MLOs.',
            size: 'xwide',
            body: `
                <div class="grid2" style="grid-template-columns:1.25fr 1fr;gap:22px;align-items:start">
                    <div>
                        <div class="f" style="margin-bottom:14px"><label>Name</label><input class="inp" id="nj-name" placeholder="Grove Street 24/7" spellcheck="false"></div>
                        <div class="type-grid" id="nj-types">${JOB_TYPES.map((t, i) => `
                            <div class="type-card ${t.id === type ? 'on' : ''}" data-type="${t.id}" style="${colourVars(t.colour)};animation-delay:${i * 30}ms">
                                <div class="ti">${icon(t.icon, 18)}</div><b>${esc(t.label)}</b><small>${esc(t.blurb)}</small>
                            </div>`).join('')}</div>
                    </div>
                    <div>
                        <div class="f-label">What you will place</div>
                        <div id="nj-preview">${Setup.preview(RECIPES[type])}</div>
                        <label class="switch" style="margin-top:14px" id="nj-walk-row"><span class="t">Walk me through it in-game</span><input type="checkbox" id="nj-walk" checked><span class="sw"></span></label>
                        <div class="hint" style="margin-top:8px" id="nj-note">The builder hides and asks for each point in turn. ENTER places it, BACKSPACE skips it, DEL stops. Everything can be changed after.</div>
                    </div>
                </div>`,
            confirmLabel: 'Create',
            confirm: async (root) => {
                const name = root.querySelector('#nj-name').value.trim();
                if (!name) { toast('Name it first', 'Something staff will recognise in the list.', 'warning'); root.querySelector('#nj-name').focus(); return false; }

                const recipe = RECIPES[type];
                const pick = recipe && recipe.pick;
                const res = await nui('createRobbery', {
                    name,
                    category: type,
                    anchor: { kind: pick ? 'model' : 'location', pool: pick ? pick.pool : 'object' },
                });
                if (!report(res, 'Created', name)) return false;

                State.robberies = res.robberies || State.robberies;
                const id = res.robbery.id;
                setTimeout(async () => {
                    await openJob(id, { tab: 'plan' });
                    if (recipe && walk && State.current && State.current.id === id) Setup.run(State.current, recipe);
                }, 60);
            },
        });

        const sync = () => {
            back.querySelector('#nj-preview').innerHTML = Setup.preview(RECIPES[type]);
            const has = !!RECIPES[type];
            back.querySelector('#nj-walk-row').style.display = has ? '' : 'none';
            back.querySelector('#nj-note').style.display = has ? '' : 'none';
        };

        back.querySelectorAll('[data-type]').forEach(card => card.addEventListener('click', () => {
            type = card.dataset.type;
            back.querySelectorAll('[data-type]').forEach(c => c.classList.toggle('on', c === card));
            sync();
        }));
        back.querySelector('#nj-walk').addEventListener('change', (e) => { walk = e.target.checked; });
    },

    makeStage(job, step, coords, index, placed) {
        const after = (step.after || []).map(k => placed[k] && placed[k][0]).filter(Boolean);
        const opts = Object.assign({}, step.opts || {});
        if (step.optional && opts.optional === undefined) opts.optional = true;
        if (step.codeFrom && placed[step.codeFrom]) opts.codeFrom = placed[step.codeFrom][0];

        const name = step.repeat ? `${step.name} ${index + 1}` : step.name;
        const zone = step.zone ? Object.assign({}, coords, { radius: coords.radius || step.zone }) : coords;
        const stage = Steps.make(step.type, zone, {
            label: name,
            opts,
            requires: after.length ? [after[0]] : [],
            payout: step.pay ? { cash: { account: 'job', min: step.pay[0], max: step.pay[1] }, items: [], lootTable: '' } : undefined,
        });
        stage.opts.label = name;
        stage.label = name;
        return stage;
    },

    async run(job, recipe) {
        if (!job || !recipe || Setup.running) return;
        Setup.running = true;
        try {
            await Setup.walk(job, recipe);
        } catch (e) {
            await nui('endPlacementSession');
            toast('Setup stopped', 'Something went wrong part way. Everything placed so far is kept.', 'error');
            refresh();
        } finally {
            Setup.running = false;
        }
    },

    async walk(job, recipe) {

        const steps = recipe.steps;
        const total = steps.filter(s => !s.samePoint).length + (recipe.pick && !jobOrigin(job) ? 1 : 0);
        const placed = {};
        const skipped = [];
        let n = 0;
        let stopped = false;
        let last = Steps.lastPoint();

        if (recipe.pick && !jobOrigin(job)) {
            n++;
            const res = await place({
                label: recipe.pick.title,
                colour: [255, 195, 90],
                pickEntity: true,
                session: true,
                guided: { step: n, total, title: recipe.pick.title, subtitle: recipe.pick.subtitle, skippable: false },
            });

            if (!res.ok || !res.pick) {
                await nui('endPlacementSession');
                toast('Setup stopped', 'Nothing was picked. Aim at one from Places when you are ready.', 'info');
                return;
            }

            job.anchor.pool = recipe.pick.pool;
            PlacesView.applyPick(job, res.pick, res.coords, false);
            job.anchor.label = recipe.pick.anchor || job.anchor.label;
            last = job.origin;
        }

        for (const step of steps) {
            if (step.needs && step.needs.some(k => !placed[k])) { skipped.push(step); continue; }

            if (step.samePoint) {
                const src = placed[step.samePoint] && job.stages.find(s => s.id === placed[step.samePoint][0]);
                if (!src) { skipped.push(step); continue; }
                const stage = Setup.makeStage(job, step, clone(src.coords), 0, placed);
                job.stages.push(stage);
                placed[step.key] = [stage.id];
                continue;
            }

            n++;
            const t = stageType(step.type);
            const zone = ZONE_TYPES.includes(step.type);
            let i = 0;

            while (true) {
                const res = await place({
                    label: step.title,
                    colour: t ? t.colour : undefined,
                    mode: zone ? 'zone' : 'point',
                    radius: zone ? step.zone : undefined,
                    origin: last,
                    session: true,
                    previewModel: (step.opts && step.opts.prop) || undefined,
                    guided: {
                        step: n,
                        total,
                        title: i ? `Another ${step.title.replace(/^The /, '').toLowerCase()}?` : step.title,
                        subtitle: i ? 'ENTER for another one. BACKSPACE when that is all.' : step.subtitle,
                        repeating: i > 0,
                        skippable: true,
                    },
                });

                if (res.action === 'stop') { stopped = true; break; }
                if (!res.ok || !res.coords) {
                    if (i === 0) skipped.push(step);
                    break;
                }

                const stage = Setup.makeStage(job, step, res.coords, i, placed);
                job.stages.push(stage);
                (placed[step.key] = placed[step.key] || []).push(stage.id);
                last = stage.coords;

                if (anchorKind(job) === 'location' && !job.origin) {
                    Steps.setOrigin(stage.coords);
                    job.anchor.label = step.anchor || `the ${step.name.toLowerCase()}`;
                }

                i++;
                if (!step.repeat) break;
            }

            if (stopped) break;
        }

        await nui('endPlacementSession');

        const made = job.stages.length;
        if (!made) {
            toast('Nothing placed', 'Add steps from the Plan whenever you are ready.', 'info');
            refresh();
            return;
        }

        State.sel = null;
        await saveJob(true);
        await Steps.ensurePlace();
        State.tab = 'plan';
        refresh();
        validate();

        const note = stopped ? 'Stopped early. Everything you placed is kept.' : 'Set payouts in Loot, check Rules, then go live.';
        toast(`${made} step${made === 1 ? '' : 's'} built`, note, 'success', 5200);
    },
};
