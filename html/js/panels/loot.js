window.Panels = window.Panels || {};

function lootEntryRow(entry, index) {
    return `
        <div class="input-row" style="margin-bottom:8px" data-entry="${index}">
            ${itemPicker(`le-item-${index}`, entry.item, 'Any item name')}
            <div class="unit-input" style="max-width:96px">
                <input type="number" id="le-min-${index}" value="${esc(entry.min ?? 1)}" min="1">
                <span class="unit">min</span>
            </div>
            <div class="unit-input" style="max-width:96px">
                <input type="number" id="le-max-${index}" value="${esc(entry.max ?? 1)}" min="1">
                <span class="unit">max</span>
            </div>
            <div class="unit-input" style="max-width:110px">
                <input type="number" id="le-chance-${index}" value="${esc(entry.chance ?? 100)}" min="1" max="100">
                <span class="unit">%</span>
            </div>
        </div>`;
}

function lootModal(existing) {
    const table = existing || { id: '', label: '', entries: [{ item: '', min: 1, max: 1, chance: 100 }] };
    const entries = table.entries.length ? table.entries : [{ item: '', min: 1, max: 1, chance: 100 }];

    modal(existing ? `Edit — ${existing.label}` : 'New loot table', `
        <div class="field-grid">
            <div class="field">
                <label class="field-label" for="lt-id">Id</label>
                <input type="text" id="lt-id" value="${esc(table.id)}" ${existing ? 'readonly' : ''}
                       placeholder="store_register">
            </div>
            <div class="field">
                <label class="field-label" for="lt-label">Name</label>
                <input type="text" id="lt-label" value="${esc(table.label)}" placeholder="Store register">
            </div>
        </div>
        <div class="section-title">Items</div>
        <div id="loot-entries">${entries.map(lootEntryRow).join('')}</div>
        <button class="btn btn-ghost btn-sm" id="lt-add-entry">+ Add item</button>
    `, async () => {
        const id = val('lt-id');
        if (!id) {
            toast('Needs an id', 'Stages reference loot tables by id.', 'warning');
            return false;
        }

        const collected = [];
        document.querySelectorAll('#loot-entries [data-entry]').forEach(row => {
            const i = row.dataset.entry;
            const item = val(`le-item-${i}`);
            if (!item) return;
            collected.push({
                item,
                min: num(`le-min-${i}`, 1),
                max: num(`le-max-${i}`, 1),
                chance: num(`le-chance-${i}`, 100),
            });
        });

        const res = await nui('saveLoot', { id, label: val('lt-label') || id, entries: collected });
        if (!reportResult(res, 'Saved', val('lt-label') || id)) return false;

        State.loot = res.loot || State.loot;
        switchPanel('loot');
    });

    bindItemPickers(document.getElementById('modal-root'));

    document.getElementById('lt-add-entry')?.addEventListener('click', () => {
        const list = document.getElementById('loot-entries');
        const index = list.querySelectorAll('[data-entry]').length;
        list.insertAdjacentHTML('beforeend', lootEntryRow({ min: 1, max: 1, chance: 100 }, index));
        bindItemPickers(list);
        list.querySelector(`#le-item-${index}`)?.focus();
    });
}

window.Panels.loot = {
    render(el) {
        setTopbar('Loot Tables', 'Reusable item drops that stages point at', `
            <button class="btn btn-primary" id="act-new-loot">New table</button>
        `);

        if (State.loot.length === 0) {
            el.innerHTML = emptyState('&#9636;', 'No loot tables',
                'Build one here, then any number of stages can pay out from it. Change it once and every stage follows.',
                '<button class="btn btn-primary" id="empty-loot">Create one</button>');
        } else {
            el.innerHTML = `
                <div class="section-title">Tables</div>
                <div class="card-grid">
                    ${State.loot.map(t => `
                        <div class="card" data-id="${esc(t.id)}">
                            <div class="card-head">
                                <div>
                                    <div class="card-title">${esc(t.label)}</div>
                                    <div class="card-sub">${esc(t.id)}</div>
                                </div>
                                <span class="badge info">${(t.entries || []).length} items</span>
                            </div>
                            <div class="card-stats" style="border-top:none;padding-top:11px;gap:7px">
                                <button class="btn btn-sm btn-ghost" data-act="edit">Edit</button>
                                <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
                            </div>
                        </div>`).join('')}
                </div>`;
        }

        document.getElementById('act-new-loot')?.addEventListener('click', () => lootModal(null));
        document.getElementById('empty-loot')?.addEventListener('click', () => lootModal(null));

        el.querySelectorAll('.card').forEach(card => {
            const table = State.loot.find(t => t.id === card.dataset.id);
            card.addEventListener('click', (e) => {
                const act = e.target.dataset.act;
                if (act === 'delete') {
                    confirmDanger('Delete this loot table?',
                        `Stages using "${table.label}" will pay out nothing until you point them somewhere else.`,
                        async () => {
                            const res = await nui('deleteLoot', table.id);
                            if (!reportResult(res, 'Deleted', table.label)) return;
                            State.loot = res.loot || [];
                            switchPanel('loot');
                        });
                } else {
                    lootModal(table);
                }
            });
        });
    },
};
