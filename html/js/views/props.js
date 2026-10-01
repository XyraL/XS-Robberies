const PropsView = {
    el: null,

    render(el) {
        PropsView.el = el;
        el.classList.add('scroll');
        const job = State.current;
        const props = job.props || [];
        const stepProps = (job.stages || []).filter(s => s.opts && s.opts.prop);
        const sel = State.sel && State.sel.kind === 'prop' ? State.sel.id : null;

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title"><span>Scene props</span><button class="btn xs act primary" id="props-add">${icon('plus', 12)} Place a prop</button></div>
                <div class="hint" style="margin-bottom:14px">Anything you want standing in the room when the job is ready: cash trolleys, gold stacks, a laptop on the desk. Tie one to a step and it can vanish or swap when that step is done, then comes back when the place resets. Every place this job is stamped at gets them.</div>
                ${props.length ? `<div class="cards">${props.map((p, i) => PropsView.card(p, i, sel)).join('')}</div>`
                    : `<div class="empty inline">
                        <div class="mark">${icon('prop', 30, 1.5)}</div>
                        <h3>No props</h3>
                        <p>Props are optional. Most map interiors already have tills and safes, so only add what the room is missing.</p>
                        <div class="row"><button class="btn primary" id="props-add2">${icon('plus', 14)} Place a prop</button></div>
                    </div>`}
            </div>
            ${stepProps.length ? `
            <div class="sec">
                <div class="sec-title">Props that belong to a step</div>
                <div class="hint" style="margin-bottom:10px">Set on the step itself, under Look and feel. These are what the player interacts with.</div>
                <div class="ov-list">${stepProps.map(s => `
                    <div class="ov-row">
                        <div class="type-dot" style="${colourVars(stageColour(s))};width:28px;height:28px">${icon(s.type, 13)}</div>
                        <div><b>${esc(stageLabel(s))}</b><small>${esc(s.opts.prop)}${s.opts.propDone && s.opts.propDone !== 'keep' ? ` · ${s.opts.propDone === 'swap' ? `swaps to ${esc(s.opts.propSwap || '?')}` : 'removed when done'}` : ''}</small></div>
                        <div class="acts"><button class="btn xs" data-open-stage="${esc(s.id)}">Open</button></div>
                    </div>`).join('')}</div>
            </div>` : ''}`;

        el.querySelector('#props-add')?.addEventListener('click', () => PropsView.add());
        el.querySelector('#props-add2')?.addEventListener('click', () => PropsView.add());
        el.querySelectorAll('[data-prop]').forEach(card => card.addEventListener('click', (e) => {
            const prop = props.find(p => p.id === card.dataset.prop);
            const act = e.target.closest('[data-act]');
            if (act && act.dataset.act === 'move') { PropsView.move(prop); return; }
            if (act && act.dataset.act === 'copy') { PropsView.copy(prop); return; }
            if (act && act.dataset.act === 'del') { PropsView.remove(prop); return; }
            select('prop', prop.id, { view: false });
        }));
        el.querySelectorAll('[data-open-stage]').forEach(b => b.addEventListener('click', () => select('stage', b.dataset.openStage, { view: false })));
    },

    highlight() {
        const sel = State.sel && State.sel.kind === 'prop' ? State.sel.id : null;
        PropsView.el && PropsView.el.querySelectorAll('[data-prop]').forEach(c => c.classList.toggle('on', c.dataset.prop === sel));
    },

    soft() { renderView(); },

    card(p, i, sel) {
        const job = State.current;
        const link = p.linkStage && (job.stages || []).find(s => s.id === p.linkStage);
        const when = !link ? 'Always there'
            : p.onDone === 'remove' ? `Gone once ${stageLabel(link)} is done`
            : p.onDone === 'swap' ? `Becomes ${p.swapModel || '?'} after ${stageLabel(link)}`
            : `Tied to ${stageLabel(link)}`;

        return `
            <div class="card click prop-card ${sel === p.id ? 'on' : ''}" data-prop="${esc(p.id)}" style="animation-delay:${i * 30}ms">
                <div class="ic">${icon('prop', 34, 1.3)}</div>
                <div class="card-head">
                    <div style="min-width:0"><div class="card-title">${esc(propLabel(p))}</div><div class="card-sub">${esc(p.model)}</div></div>
                    ${p.coords ? '' : '<span class="badge warn">not placed</span>'}
                </div>
                <div class="hint" style="margin-top:8px">${esc(when)}</div>
                <div class="card-row">
                    <button class="btn xs" data-act="move">${icon('place', 12)} Move</button>
                    <button class="btn xs" data-act="copy">${icon('copy', 12)} Copy</button>
                    <button class="btn xs danger" data-act="del">${icon('trash', 12)}</button>
                </div>
            </div>`;
    },

    pick(onPick, current = '') {
        let chosen = current;
        const groups = [...new Set(PROP_CATALOGUE.map(p => p.group))];

        const grid = (q) => groups.map(g => {
            const list = PROP_CATALOGUE.filter(p => p.group === g && (!q || p.label.toLowerCase().includes(q) || p.model.includes(q)));
            if (!list.length) return '';
            return `<div class="group-label">${esc(g)}</div><div class="prop-grid">${list.map(p => `
                <div class="prop-pick ${chosen === p.model ? 'on' : ''}" data-model="${esc(p.model)}">
                    <div class="pv">${icon(g === 'Loot' ? 'cash' : g === 'Security' ? 'lock' : 'prop', 24, 1.4)}</div>
                    <b>${esc(p.label)}</b><small>${esc(p.model)}</small>
                </div>`).join('')}</div>`;
        }).join('') || '<div class="hint">Nothing in the list matches. Type the model name below; any GTA prop works.</div>';

        const back = modal({
            title: 'Pick a prop',
            sub: 'A short list to start from. Any GTA prop model works: type it below.',
            size: 'wide',
            body: `
                <div class="searchbar">${icon('search', 15)}<input class="inp" id="pp-search" placeholder="Search"></div>
                <div id="pp-grid">${grid('')}</div>
                <div class="f" style="margin-top:16px"><label>Or any model name</label><input class="inp" id="pp-custom" value="${esc(chosen)}" placeholder="prop_name_here" spellcheck="false"></div>`,
            confirmLabel: 'Place it',
            confirm: async () => {
                const model = back.querySelector('#pp-custom').value.trim();
                if (!model) { toast('Pick one first', '', 'warning', 2000); return false; }
                setTimeout(() => onPick(model, PROP_CATALOGUE.find(p => p.model === model)), 30);
            },
        });

        const wire = () => back.querySelectorAll('[data-model]').forEach(card => {
            card.addEventListener('click', () => {
                chosen = card.dataset.model;
                back.querySelector('#pp-custom').value = chosen;
                back.querySelectorAll('[data-model]').forEach(c => c.classList.toggle('on', c === card));
            });
            card.addEventListener('dblclick', () => back.querySelector('[data-ok]').click());
        });

        back.querySelector('#pp-search').addEventListener('input', (e) => {
            back.querySelector('#pp-grid').innerHTML = grid(e.target.value.trim().toLowerCase());
            wire();
        });
        wire();
    },

    add() {
        const job = State.current;
        if (anchorKind(job) === 'model' && !jobOrigin(job)) {
            toast('Pick the model first', 'Props are placed around the thing this job lives on.', 'warning');
            go('places');
            return;
        }

        PropsView.pick(async (model, known) => {
            const res = await place({ label: known ? known.label : model, colour: [57, 212, 155], mode: 'point', previewModel: model, origin: Steps.lastPoint() });
            if (!res.ok || !res.coords) return;
            if (res.previewFailed) toast('That model did not load', `${model} is not in this game build. It is saved, but nothing will spawn.`, 'warning', 6000);

            const prop = {
                id: nextId(job.props, 'prop'),
                model,
                label: known ? known.label : '',
                coords: { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 },
                linkStage: '',
                onDone: 'keep',
                swapModel: known && known.swap ? known.swap : '',
            };

            job.props.push(prop);
            if (!jobOrigin(job)) Steps.setOrigin(prop.coords);
            State.sel = { kind: 'prop', id: prop.id };
            await saveJob(true);
            if (State.tab !== 'props') State.tab = 'props';
            refresh({ view: true, inspector: true, tabs: true });
            toast('Prop placed', propLabel(prop), 'success', 2200);
        });
    },

    async move(prop) {
        const res = await place({ label: propLabel(prop), colour: [57, 212, 155], mode: 'point', previewModel: prop.model, origin: prop.coords });
        if (!res.ok || !res.coords) return;
        prop.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        await saveJob(true);
        refresh({ view: true, inspector: true });
    },

    async copy(prop) {
        const job = State.current;
        const res = await place({ label: `${propLabel(prop)} copy`, colour: [57, 212, 155], mode: 'point', previewModel: prop.model, origin: prop.coords });
        if (!res.ok || !res.coords) return;
        const dup = clone(prop);
        dup.id = nextId(job.props, 'prop');
        dup.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        job.props.push(dup);
        State.sel = { kind: 'prop', id: dup.id };
        await saveJob(true);
        refresh({ view: true, inspector: true, tabs: true });
    },

    remove(prop) {
        const job = State.current;
        confirmDanger('Remove this prop?', `${propLabel(prop)} will stop spawning at every place.`, async () => {
            job.props = job.props.filter(p => p.id !== prop.id);
            if (State.sel && State.sel.id === prop.id) State.sel = null;
            await saveJob(true);
            refresh({ view: true, inspector: true, tabs: true });
        }, 'Remove');
    },
};

Views.props = PropsView;
