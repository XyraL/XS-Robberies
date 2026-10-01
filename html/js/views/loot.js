const LootView = {
    el: null,
    open: new Set(),

    lootStages() {
        return (State.current.stages || []).filter(s => LOOT_TYPES.includes(s.type) || s.type === 'guard');
    },

    prep(stage) {
        stage.payout = normalisePayout(stage.payout);
        if (!stage.payout.cash) stage.payout.cash = { account: 'job', min: 0, max: 0 };
        if (!stage.payout.cash.account) stage.payout.cash.account = 'job';
        stage.payout.items = stage.payout.items || [];
    },

    render(el) {
        LootView.el = el;
        el.classList.add('scroll');
        const job = State.current;
        const account = (job.payout && job.payout.account) || 'cash';
        const stages = LootView.lootStages();
        stages.forEach(LootView.prep);

        const hasEscape = (job.stages || []).some(s => s.type === 'escape' && s.enabled !== false && !(s.opts && s.opts.optional));
        const serverHolds = (State.settings.find(s => s.key === 'payoutOnEscape') || {}).value === true;
        let when = (job.payout && job.payout.when) || 'default';
        if (when === 'default') when = serverHolds ? 'escape' : 'instant';
        const held = hasEscape && when === 'escape';

        const opts = [
            { id: 'cash', icon: 'cash', title: 'Cash', text: 'Straight into their pockets as cash.' },
            { id: 'dirty', icon: 'dirty', title: 'Dirty money', text: `Paid as ${State.dirtyItem || 'markedbills'}. It has to be washed before it spends.` },
            { id: 'bank', icon: 'card', title: 'Bank', text: 'Paid into their bank account.' },
        ];

        el.innerHTML = `
            <div class="sec">
                <div class="sec-title">How this job pays</div>
                <div class="pay-type">${opts.map(o => `
                    <div class="pay-opt ${account === o.id ? 'on' : ''}" data-pay="${o.id}">
                        ${icon(o.icon, 22, 1.6)}<b>${esc(o.title)}</b><small>${esc(o.text)}</small>
                    </div>`).join('')}</div>
                <div class="grid2" style="margin-top:12px" id="pay-rules">
                    ${fieldSeg('payout.split', 'Who gets the cash', job.payout.split || 'earner', [{ value: 'earner', label: 'Whoever did the step' }, { value: 'crew', label: 'Split across the crew' }])}
                    ${fieldSeg('payout.when', 'When it pays', when, [{ value: 'instant', label: 'On the spot' }, { value: 'escape', label: 'At the getaway' }])}
                </div>
                <div class="hint" style="margin-top:8px">${hasEscape
                    ? 'Items always go to whoever took them, on the spot.'
                    : 'There is no getaway step, so everything pays on the spot. Add an escape zone if they should have to get away first.'}</div>
            </div>

            <div class="sum-bar" id="loot-sum"></div>

            <div class="sec">
                <div class="sec-title">The take, step by step</div>
                ${stages.length ? `
                    <div class="table-box">
                        <div class="take head"><span></span><span>Step</span><span>Least</span><span>Most</span><span>Loot table</span><span>Paid as</span><span></span></div>
                        ${stages.map(LootView.row).join('')}
                    </div>
                    <div class="hint" style="margin-top:10px">${held
                        ? 'Cash is held until the crew reaches the getaway. Items go straight into their pockets, so anyone caught on the way out is holding the goods.'
                        : 'Cash is paid the moment each step is done. Items always go straight into their pockets.'}
                        Containers pay per grab, so the amounts are multiplied by the grabs.</div>`
                    : `<div class="empty inline"><p>No step here pays out yet. Tills, safes, containers and guards carry loot. Add one from Plan.</p></div>`}
            </div>

            <div class="sec">
                <div class="sec-title"><span>Shared loot tables</span><button class="btn xs act" id="loot-new">${icon('plus', 12)} New table</button></div>
                <div class="hint" style="margin-bottom:12px">A loot table is a list of items with odds. Any step on any job can pay from one, so change it once and every step that uses it follows.</div>
                <div class="cards">${(State.loot || []).length ? State.loot.map(LootView.tableCard).join('') : '<div class="hint">No tables yet.</div>'}</div>
            </div>`;

        LootView.sum();
        bindPickers(el);

        el.querySelectorAll('[data-pay]').forEach(card => card.addEventListener('click', () => {
            job.payout = job.payout || {};
            job.payout.account = card.dataset.pay;
            el.querySelectorAll('[data-pay]').forEach(c => c.classList.toggle('on', c === card));
            markDirty();
            LootView.sum();
        }));

        bindForm(el.querySelector('#pay-rules'), job, (k) => {
            markDirty();
            if (k === 'payout.when') LootView.render(el);
            else LootView.sum();
        });

        bindForm(el, (node) => {
            const row = node.closest('[data-stage]');
            return row ? (job.stages || []).find(s => s.id === row.dataset.stage) : null;
        }, () => {
            LootView.sum();
            markDirty();
            refresh({ head: true });
        });

        el.querySelectorAll('[data-items]').forEach(b => b.addEventListener('click', () => {
            const id = b.dataset.items;
            if (LootView.open.has(id)) LootView.open.delete(id); else LootView.open.add(id);
            LootView.render(el);
        }));

        el.querySelectorAll('[data-add-item]').forEach(b => b.addEventListener('click', () => {
            const stage = job.stages.find(s => s.id === b.dataset.addItem);
            stage.payout.items.push({ item: '', min: 1, max: 1, chance: 100 });
            markDirty();
            LootView.render(el);
        }));

        el.querySelectorAll('[data-del-item]').forEach(b => b.addEventListener('click', () => {
            const [id, index] = b.dataset.delItem.split(':');
            const stage = job.stages.find(s => s.id === id);
            stage.payout.items.splice(Number(index), 1);
            markDirty();
            LootView.render(el);
        }));

        el.querySelectorAll('[data-open-stage]').forEach(b => b.addEventListener('click', () => select('stage', b.dataset.openStage, { view: false })));
        el.querySelector('#loot-new').addEventListener('click', () => LootView.tableModal(null));
        el.querySelectorAll('[data-table]').forEach(card => card.addEventListener('click', (e) => {
            const table = State.loot.find(t => t.id === card.dataset.table);
            if (e.target.closest('[data-del-table]')) { LootView.deleteTable(table); return; }
            LootView.tableModal(table);
        }));
    },

    soft() {},

    row(s) {
        const t = stageType(s.type);
        const cash = s.payout.cash;
        const n = grabsOf(s);
        const items = s.payout.items.length;
        const open = LootView.open.has(s.id);
        const accountOpts = [{ value: 'job', label: 'Same as job' }, { value: 'cash', label: 'Cash' }, { value: 'dirty', label: 'Dirty money' }, { value: 'bank', label: 'Bank' }];
        const tables = [{ value: '', label: 'None' }].concat((State.loot || []).map(x => ({ value: x.id, label: x.label })));

        return `
            <div class="take" data-stage="${esc(s.id)}">
                <div class="type-dot" style="${colourVars(stageColour(s))}">${icon(s.type, 15)}</div>
                <div class="tn"><b data-open-stage="${esc(s.id)}" style="cursor:pointer">${esc(stageLabel(s))}</b><small>${esc(t ? t.label : s.type)}${n > 1 ? ` · ${n} grabs` : ''}${s.opts && s.opts.optional ? ' · optional' : ''}</small></div>
                <div class="unit"><input class="inp" type="number" min="0" data-k="payout.cash.min" data-t="num" value="${esc(cash.min || 0)}"><em>$</em></div>
                <div class="unit"><input class="inp" type="number" min="0" data-k="payout.cash.max" data-t="num" value="${esc(cash.max || 0)}"><em>$</em></div>
                <select class="sel" data-k="payout.lootTable">${tables.map(o => `<option value="${esc(o.value)}" ${o.value === (s.payout.lootTable || '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
                <select class="sel" data-k="payout.cash.account">${accountOpts.map(o => `<option value="${o.value}" ${o.value === (cash.account || 'job') ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
                <button class="icon-btn ${open ? 'on' : ''}" data-items="${esc(s.id)}" title="Items this step pays">${items ? `<span style="font:700 11px var(--font-mono)">${items}</span>` : icon('plus', 14)}</button>
            </div>
            ${open ? `<div class="take-items" data-stage="${esc(s.id)}">
                ${s.payout.items.map((it, i) => `
                    <div class="item-row">
                        ${itemPicker(`payout.items.${i}.item`, it.item)}
                        <div class="unit"><input class="inp" type="number" min="1" data-k="payout.items.${i}.min" data-t="num" value="${esc(it.min ?? 1)}"><em>min</em></div>
                        <div class="unit"><input class="inp" type="number" min="1" data-k="payout.items.${i}.max" data-t="num" value="${esc(it.max ?? 1)}"><em>max</em></div>
                        <div class="unit"><input class="inp" type="number" min="1" max="100" data-k="payout.items.${i}.chance" data-t="num" value="${esc(it.chance ?? 100)}"><em>%</em></div>
                        <button class="icon-btn" data-del-item="${esc(s.id)}:${i}" title="Remove">${icon('close', 13)}</button>
                    </div>`).join('')}
                <button class="btn xs" style="margin-top:10px" data-add-item="${esc(s.id)}">${icon('plus', 12)} Add an item</button>
            </div>` : ''}`;
    },

    sum() {
        const el = LootView.el && LootView.el.querySelector('#loot-sum');
        if (!el) return;
        const job = State.current;
        const take = jobTake(job);
        const account = (job.payout && job.payout.account) || 'cash';
        const label = { cash: 'cash', dirty: State.dirtyItem || 'dirty money', bank: 'bank' }[account] || 'cash';
        const mult = (State.settings.find(s => s.key === 'payoutMultiplier') || {}).value;

        el.innerHTML = `
            <div><div class="f-label">Total take</div><div class="big">${esc(moneyRange(take.min, take.max))}</div></div>
            <div><div class="f-label">Paid as</div><b style="font:700 15px var(--font-ui)">${esc(label)}</b></div>
            <div><div class="f-label">Goes to</div><b style="font:700 15px var(--font-ui)">${(job.payout && job.payout.split) === 'crew' ? 'the whole crew' : 'whoever did it'}</b></div>
            ${mult && mult !== 1 ? `<div><div class="f-label">Server multiplier</div><b style="font:700 15px var(--font-mono)">×${esc(mult)}</b></div>` : ''}
            <div class="hint" style="margin-left:auto;max-width:300px;text-align:right">Optional steps only count toward the most. Places can scale it with their own multiplier.</div>`;
    },

    tableCard(t) {
        return `
            <div class="card click" data-table="${esc(t.id)}">
                <div class="card-head">
                    <div style="min-width:0"><div class="card-title">${esc(t.label)}</div><div class="card-sub">${esc(t.id)}</div></div>
                    <span class="badge info">${(t.entries || []).length} items</span>
                </div>
                <div class="card-row">${(t.entries || []).slice(0, 4).map(e => `<span class="tag static">${esc(itemLabel(e.item) || e.item)} · ${e.chance ?? 100}%</span>`).join('')}</div>
                <div class="card-row"><button class="btn xs danger" data-del-table="1">${icon('trash', 12)} Delete</button></div>
            </div>`;
    },

    tableModal(existing) {
        const table = existing ? clone(existing) : { id: '', label: '', entries: [{ item: '', min: 1, max: 1, chance: 100 }] };
        if (!table.entries.length) table.entries.push({ item: '', min: 1, max: 1, chance: 100 });

        const rows = () => table.entries.map((e, i) => `
            <div class="item-row" data-i="${i}">
                ${itemPicker(`entries.${i}.item`, e.item)}
                <div class="unit"><input class="inp" type="number" min="1" data-k="entries.${i}.min" data-t="num" value="${esc(e.min ?? 1)}"><em>min</em></div>
                <div class="unit"><input class="inp" type="number" min="1" data-k="entries.${i}.max" data-t="num" value="${esc(e.max ?? 1)}"><em>max</em></div>
                <div class="unit"><input class="inp" type="number" min="1" max="100" data-k="entries.${i}.chance" data-t="num" value="${esc(e.chance ?? 100)}"><em>%</em></div>
                <button class="icon-btn" data-drop="${i}">${icon('close', 13)}</button>
            </div>`).join('');

        const back = modal({
            title: existing ? `Edit ${existing.label}` : 'New loot table',
            sub: 'Every row rolls on its own. 100% always drops.',
            size: 'wide',
            body: `
                <div class="grid2" style="margin-bottom:14px">
                    ${fieldText('id', 'Id', table.id, { placeholder: 'vault_gold' })}
                    ${fieldText('label', 'Name', table.label, { placeholder: 'Vault gold' })}
                </div>
                <div class="f-label" style="margin-bottom:2px">Items</div>
                <div id="lt-rows">${rows()}</div>
                <button class="btn xs" id="lt-add" style="margin-top:10px">${icon('plus', 12)} Add an item</button>`,
            confirmLabel: 'Save table',
            confirm: async () => {
                table.id = (table.id || '').trim();
                if (!table.id) { toast('Give it an id', 'Steps point at loot tables by id.', 'warning'); return false; }
                if (existing) table.id = existing.id;
                const entries = table.entries.filter(e => e.item && e.item.trim());
                const res = await nui('saveLoot', { id: table.id, label: table.label || table.id, entries });
                if (!report(res, 'Saved', table.label || table.id)) return false;
                State.loot = res.loot || State.loot;
                if (State.view === 'job' && State.tab === 'loot') renderView();
            },
        });

        if (existing) back.querySelector('[data-k="id"]').disabled = true;

        const wire = () => {
            bindPickers(back);
            back.querySelectorAll('[data-drop]').forEach(b => b.addEventListener('click', () => {
                table.entries.splice(Number(b.dataset.drop), 1);
                back.querySelector('#lt-rows').innerHTML = rows();
                wire();
            }));
        };

        bindForm(back.querySelector('.modal-body'), table, () => {});
        wire();
        back.querySelector('#lt-add').addEventListener('click', () => {
            table.entries.push({ item: '', min: 1, max: 1, chance: 100 });
            back.querySelector('#lt-rows').innerHTML = rows();
            wire();
        });
    },

    deleteTable(table) {
        confirmDanger('Delete this loot table?', `Steps paying from "${table.label}" pay nothing from it until you pick another.`, async () => {
            const res = await nui('deleteLoot', table.id);
            if (!report(res, 'Deleted', table.label)) return;
            State.loot = res.loot || [];
            renderView();
        });
    },
};

Views.loot = LootView;
