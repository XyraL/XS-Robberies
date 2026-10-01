const NpcsView = {
    el: null,

    render(el) {
        NpcsView.el = el;
        el.classList.add('scroll');
        const job = State.current;
        const npcs = job.npcs || [];
        const sel = State.sel && State.sel.kind === 'npc' ? State.sel.id : null;
        const steps = (job.stages || []).filter(s => s.type === 'hostage' || s.type === 'guard');

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title"><span>People in the room</span><button class="btn xs act primary" id="npc-add">${icon('plus', 12)} Place an NPC</button></div>
                <div class="hint" style="margin-bottom:14px">Tellers behind the glass, a guard by the door, a customer at the counter. They stand where you put them doing whatever you pick, and react when the robbery starts. Every place this job is stamped at gets them.</div>
                ${npcs.length ? `<div class="cards">${npcs.map((n, i) => NpcsView.card(n, i, sel)).join('')}</div>`
                    : `<div class="empty inline">
                        <div class="mark">${icon('twoman', 30, 1.5)}</div>
                        <h3>Nobody here</h3>
                        <p>NPCs are optional. Add a few to make a place feel lived in. For someone the crew has to deal with, use a Clerk or Armed guard step instead.</p>
                        <div class="row"><button class="btn primary" id="npc-add2">${icon('plus', 14)} Place an NPC</button></div>
                    </div>`}
            </div>
            ${steps.length ? `
            <div class="sec">
                <div class="sec-title">People that are steps</div>
                <div class="hint" style="margin-bottom:10px">These are part of the job itself: a clerk to intimidate, a guard who fights back.</div>
                <div class="ov-list">${steps.map(s => `
                    <div class="ov-row">
                        <div class="type-dot" style="${colourVars(stageColour(s))};width:28px;height:28px">${icon(s.type, 13)}</div>
                        <div><b>${esc(stageLabel(s))}</b><small>${esc((stageType(s.type) || {}).label || s.type)} · ${esc(s.opts.ped || '')}</small></div>
                        <div class="acts"><button class="btn xs" data-open-stage="${esc(s.id)}">Open</button></div>
                    </div>`).join('')}</div>
            </div>` : ''}`;

        el.querySelector('#npc-add')?.addEventListener('click', () => NpcsView.add());
        el.querySelector('#npc-add2')?.addEventListener('click', () => NpcsView.add());
        el.querySelectorAll('[data-npc]').forEach(card => card.addEventListener('click', (e) => {
            const npc = npcs.find(n => n.id === card.dataset.npc);
            const act = e.target.closest('[data-act]');
            if (act && act.dataset.act === 'move') { NpcsView.move(npc); return; }
            if (act && act.dataset.act === 'copy') { NpcsView.copy(npc); return; }
            if (act && act.dataset.act === 'del') { NpcsView.remove(npc); return; }
            select('npc', npc.id, { view: false });
        }));
        el.querySelectorAll('[data-open-stage]').forEach(b => b.addEventListener('click', () => select('stage', b.dataset.openStage, { view: false })));
    },

    highlight() {
        const sel = State.sel && State.sel.kind === 'npc' ? State.sel.id : null;
        NpcsView.el && NpcsView.el.querySelectorAll('[data-npc]').forEach(c => c.classList.toggle('on', c.dataset.npc === sel));
    },

    soft() { renderView(); },

    card(n, i, sel) {
        const idle = (SCENARIOS.find(s => s.value === (n.scenario || '')) || {}).label || 'Custom animation';
        const react = (REACTIONS.find(r => r.value === (n.reaction || 'cower')) || REACTIONS[0]).label;

        return `
            <div class="card click prop-card ${sel === n.id ? 'on' : ''}" data-npc="${esc(n.id)}" style="animation-delay:${i * 30}ms">
                <div class="ic" style="color:#ff8fa0">${icon('twoman', 34, 1.3)}</div>
                <div class="card-head">
                    <div style="min-width:0"><div class="card-title">${esc(npcLabel(n))}</div><div class="card-sub">${esc(n.model)}</div></div>
                    ${n.coords ? '' : '<span class="badge warn">not placed</span>'}
                </div>
                <div class="card-row"><span class="tag static">${esc(n.animDict ? 'Custom animation' : idle)}</span><span class="tag static">${esc(react)}</span></div>
                <div class="card-row">
                    <button class="btn xs" data-act="move">${icon('place', 12)} Move</button>
                    <button class="btn xs" data-act="copy">${icon('copy', 12)} Copy</button>
                    <button class="btn xs danger" data-act="del">${icon('trash', 12)}</button>
                </div>
            </div>`;
    },

    pick(onPick, current = '') {
        let chosen = current;
        const groups = [...new Set(NPC_CATALOGUE.map(p => p.group))];

        const grid = (q) => groups.map(g => {
            const list = NPC_CATALOGUE.filter(p => p.group === g && (!q || p.label.toLowerCase().includes(q) || p.model.includes(q)));
            if (!list.length) return '';
            return `<div class="group-label">${esc(g)}</div><div class="prop-grid">${list.map(p => `
                <div class="prop-pick ${chosen === p.model ? 'on' : ''}" data-model="${esc(p.model)}">
                    <div class="pv" style="color:#ff8fa0">${icon(g === 'Security' ? 'guard' : 'twoman', 24, 1.4)}</div>
                    <b>${esc(p.label)}</b><small>${esc(p.model)}</small>
                </div>`).join('')}</div>`;
        }).join('') || '<div class="hint">Nothing in the list matches. Type the ped model below; any GTA ped works.</div>';

        const back = modal({
            title: 'Pick an NPC',
            sub: 'A short list to start from. Any GTA ped model works: type it below.',
            size: 'wide',
            body: `
                <div class="searchbar">${icon('search', 15)}<input class="inp" id="np-search" placeholder="Search"></div>
                <div id="np-grid">${grid('')}</div>
                <div class="f" style="margin-top:16px"><label>Or any ped model</label><input class="inp" id="np-custom" value="${esc(chosen)}" placeholder="a_m_y_business_01" spellcheck="false"></div>`,
            confirmLabel: 'Place them',
            confirm: async () => {
                const model = back.querySelector('#np-custom').value.trim();
                if (!model) { toast('Pick one first', '', 'warning', 2000); return false; }
                setTimeout(() => onPick(model, NPC_CATALOGUE.find(p => p.model === model)), 30);
            },
        });

        const wire = () => back.querySelectorAll('[data-model]').forEach(card => {
            card.addEventListener('click', () => {
                chosen = card.dataset.model;
                back.querySelector('#np-custom').value = chosen;
                back.querySelectorAll('[data-model]').forEach(c => c.classList.toggle('on', c === card));
            });
            card.addEventListener('dblclick', () => back.querySelector('[data-ok]').click());
        });

        back.querySelector('#np-search').addEventListener('input', (e) => {
            back.querySelector('#np-grid').innerHTML = grid(e.target.value.trim().toLowerCase());
            wire();
        });
        wire();
    },

    add() {
        const job = State.current;
        if (anchorKind(job) === 'model' && !jobOrigin(job)) {
            toast('Pick the model first', 'NPCs are placed around the thing this job lives on.', 'warning');
            go('places');
            return;
        }

        NpcsView.pick(async (model, known) => {
            const res = await place({ label: known ? known.label : model, colour: [255, 93, 115], mode: 'point', previewModel: model, origin: Steps.lastPoint() });
            if (!res.ok || !res.coords) return;
            if (res.previewFailed) toast('That model did not load', `${model} is not a ped in this game build. It is saved, but nobody will spawn.`, 'warning', 6000);

            job.npcs = job.npcs || [];
            const npc = {
                id: nextId(job.npcs, 'npc'),
                model,
                label: known ? known.label : '',
                coords: { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 },
                scenario: known && known.group === 'Security' ? 'WORLD_HUMAN_GUARD_STAND' : '',
                animDict: '',
                animClip: '',
                reaction: 'cower',
            };

            job.npcs.push(npc);
            if (!jobOrigin(job)) Steps.setOrigin(npc.coords);
            State.sel = { kind: 'npc', id: npc.id };
            State.tab = 'npcs';
            await saveJob(true);
            refresh({ view: true, inspector: true, tabs: true });
            toast('NPC placed', npcLabel(npc), 'success', 2200);
        });
    },

    async move(npc) {
        const res = await place({ label: npcLabel(npc), colour: [255, 93, 115], mode: 'point', previewModel: npc.model, origin: npc.coords });
        if (!res.ok || !res.coords) return;
        npc.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        await saveJob(true);
        refresh({ view: true, inspector: true });
    },

    async copy(npc) {
        const job = State.current;
        const res = await place({ label: `${npcLabel(npc)} copy`, colour: [255, 93, 115], mode: 'point', previewModel: npc.model, origin: npc.coords });
        if (!res.ok || !res.coords) return;
        const dup = clone(npc);
        dup.id = nextId(job.npcs, 'npc');
        dup.coords = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
        job.npcs.push(dup);
        State.sel = { kind: 'npc', id: dup.id };
        await saveJob(true);
        refresh({ view: true, inspector: true, tabs: true });
    },

    remove(npc) {
        const job = State.current;
        confirmDanger('Remove this NPC?', `${npcLabel(npc)} will stop spawning at every place.`, async () => {
            job.npcs = job.npcs.filter(n => n.id !== npc.id);
            if (State.sel && State.sel.id === npc.id) State.sel = null;
            await saveJob(true);
            refresh({ view: true, inspector: true, tabs: true });
        }, 'Remove');
    },
};

Views.npcs = NpcsView;
