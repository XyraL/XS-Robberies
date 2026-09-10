window.Panels = window.Panels || {};

const CATEGORY_LABELS = {
    store: 'Store', bank: 'Bank', jewelry: 'Jewelry',
    atm: 'ATM', house: 'House', custom: 'Custom',
};

function createRobberyModal() {
    const categories = Object.entries(CATEGORY_LABELS)
        .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

    modal('New robbery', `
        <div class="field">
            <label class="field-label" for="new-name">Name</label>
            <input type="text" id="new-name" placeholder="24-7 Store">
            <div class="field-hint">What staff will see in this list. Players never read it.</div>
        </div>
        <div class="field">
            <label class="field-label" for="new-category">Category</label>
            <select id="new-category">${categories}</select>
        </div>
    `, async () => {
        const name = val('new-name');
        if (!name) {
            toast('Name it first', 'A robbery needs a name before it can be saved.', 'warning');
            return false;
        }

        const res = await nui('createRobbery', { name, category: val('new-category') });
        if (!reportResult(res, 'Created', name)) return false;

        State.robberies = res.robberies || State.robberies;
        State.current = res.robbery;
        State.selectedStage = null;
        switchPanel('editor');
    }, 'Create');
}

function importRobberyModal() {
    modal('Import robbery', `
        <div class="field">
            <label class="field-label" for="import-json">Paste the JSON</label>
            <textarea id="import-json" placeholder='{"name":"Fleeca", "stages":[ ... ]}'></textarea>
            <div class="field-hint">Imported robberies arrive disabled so nothing goes live before you have looked at it.</div>
        </div>
    `, async () => {
        const raw = val('import-json');
        if (!raw) return false;

        const res = await nui('importRobbery', raw);
        if (!reportResult(res, 'Imported', res && res.robbery ? res.robbery.name : '')) return false;

        State.robberies = res.robberies || State.robberies;
        State.current = res.robbery;
        switchPanel('editor');
    }, 'Import');
}

async function exportRobbery(id, name) {
    const res = await nui('exportRobbery', id);
    if (!res || !res.ok) {
        toast('Could not export', (res && res.error) || 'The server did not answer.', 'error');
        return;
    }

    modal(`Export — ${name}`, `
        <div class="field">
            <label class="field-label">Copy this and share it</label>
            <textarea id="export-json" readonly style="min-height:220px">${esc(res.json)}</textarea>
        </div>
    `, null);

    const box = document.getElementById('export-json');
    if (box) { box.focus(); box.select(); }
}

function robberyCard(r) {
    const locations = State.locations.filter(l => l.robberyId === r.id).length;

    return `
        <div class="card" data-id="${esc(r.id)}" data-cat="${esc(r.category || 'custom')}">
            <div class="card-head">
                <div>
                    <div class="card-title">${esc(r.name)}</div>
                    <div class="cat-chip" style="--cat:var(--cat-${esc(r.category || 'custom')})">${esc(CATEGORY_LABELS[r.category] || r.category)}</div>
                    <div class="card-sub">${esc(r.id)}</div>
                </div>
                <span class="badge ${r.enabled ? 'on' : 'off'}">${r.enabled ? 'Live' : 'Draft'}</span>
            </div>
            <div class="card-stats">
                <div>
                    <div class="stat-label">Stages</div>
                    <div class="stat-value">${r.stageCount || 0}</div>
                </div>
                <div>
                    <div class="stat-label">Locations</div>
                    <div class="stat-value">${locations}</div>
                </div>
                <div>
                    <div class="stat-label">Revision</div>
                    <div class="stat-value">${r.revision || 1}</div>
                </div>
            </div>
            <div class="card-stats" style="border-top:none;padding-top:9px;gap:7px">
                <button class="btn btn-sm btn-ghost" data-act="duplicate">Duplicate</button>
                <button class="btn btn-sm btn-ghost" data-act="export">Export</button>
                <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
            </div>
        </div>`;
}

async function presetsModal() {
    const res = await nui('presets');
    const presets = (res && res.ok && res.presets) || [];

    if (presets.length === 0) {
        toast('No presets found', 'The presets folder is missing from the resource.', 'warning');
        return;
    }

    const cards = presets.map(p => {
        const missing = (p.missingItems || []).join(', ');
        const anchored = p.anchorKind === 'model';

        return [
            '<div class="card" data-preset="' + esc(p.id) + '" style="cursor:default">',
            '  <div class="card-head">',
            '    <div>',
            '      <div class="card-title">' + esc(p.name) + '</div>',
            '      <div class="card-sub">' + p.stageCount + ' stages' +
                     (anchored ? ' &middot; finds its own spots' : ' &middot; ' + p.locationCount + ' locations') + '</div>',
            '    </div>',
            p.installed ? '<span class="badge on">Installed</span>' : '',
            '  </div>',
            '  <div class="field-hint" style="margin:10px 0 0">' + esc(p.description || '') + '</div>',
            p.alignedTo ? '<div class="field-hint" style="margin-top:6px;opacity:.75">Built against: ' + esc(p.alignedTo) + '</div>' : '',
            missing ? '<div class="issue warn" style="margin-top:10px"><span class="issue-mark">?</span><span>Your server has no ' + esc(missing) + '. Add ' + ((p.missingItems || []).length === 1 ? 'it' : 'them') + ' or swap the stage over to something you do have.</span></div>' : '',
            '  <div class="card-stats" style="border-top:none;padding-top:11px;gap:7px">',
            '    <button class="btn btn-sm btn-primary" data-install="' + esc(p.id) + '">Install</button>',
            (!anchored && p.locationCount > 0) ? '<button class="btn btn-sm btn-ghost" data-stamp="' + esc(p.id) + '">Install and stamp ' + p.locationCount + '</button>' : '',
            '  </div>',
            '</div>',
        ].join('');
    }).join('');

    modal('Presets', '<div class="field-hint" style="margin-bottom:14px">Everything arrives switched off with its loot tables, so you can read it before anyone can rob it. Nothing here is verified in game &mdash; treat the coordinates as a starting grid.</div><div class="card-grid">' + cards + '</div>', null, 'Save', 'wide');

    const install = async (id, stampAll) => {
        const result = await nui('installPreset', { id, stampAll });
        if (!reportResult(result, 'Installed', stampAll ? `${result.stamped} locations stamped` : 'Now stamp it somewhere')) return;

        State.robberies = result.robberies || State.robberies;
        State.locations = result.locations || State.locations;
        State.loot = result.loot || State.loot;
        State.current = result.robbery;
        State.issues = result.issues || [];
        closeModal();
        switchPanel('editor');
    };

    document.querySelectorAll('[data-install]').forEach(b =>
        b.addEventListener('click', () => install(b.dataset.install, false)));
    document.querySelectorAll('[data-stamp]').forEach(b =>
        b.addEventListener('click', () => install(b.dataset.stamp, true)));
}
window.Panels.robberies = {
    render(el) {
        setTopbar('Robberies', 'Every robbery defined on this server', `
            <button class="btn btn-ghost" id="act-presets">Presets</button>
            <button class="btn btn-ghost" id="act-import">Import</button>
            <button class="btn btn-primary" id="act-new">New robbery</button>
        `);

        if (State.robberies.length === 0) {
            el.innerHTML = emptyState('&#9635;', 'Nothing built yet',
                'A robbery is a set of stages you place in the world — a till, a safe, a camera, a way out. Build one, then stamp it onto as many places as you like.',
                '<button class="btn btn-primary" id="empty-presets">Start from a preset</button>' +
                '<button class="btn btn-ghost" id="empty-new" style="margin-left:8px">Build from scratch</button>');
        } else {
            el.innerHTML = `
                <div class="section-title">Definitions</div>
                <div class="card-grid">${State.robberies.map(robberyCard).join('')}</div>`;
        }

        document.getElementById('act-new')?.addEventListener('click', createRobberyModal);
        document.getElementById('act-import')?.addEventListener('click', importRobberyModal);
        document.getElementById('act-presets')?.addEventListener('click', presetsModal);
        document.getElementById('empty-new')?.addEventListener('click', createRobberyModal);
        document.getElementById('empty-presets')?.addEventListener('click', presetsModal);

        el.querySelectorAll('.card').forEach(card => {
            const id = card.dataset.id;
            const entry = State.robberies.find(r => r.id === id);

            card.addEventListener('click', (e) => {
                const act = e.target.dataset.act;
                if (!act) { openRobbery(id); return; }

                e.stopPropagation();

                if (act === 'export') {
                    exportRobbery(id, entry.name);
                } else if (act === 'duplicate') {
                    duplicateRobbery(id, entry.name);
                } else if (act === 'delete') {
                    confirmDanger('Delete this robbery?',
                        `"${entry.name}" and every location using it will be removed. This cannot be undone.`,
                        async () => {
                            const res = await nui('deleteRobbery', id);
                            if (!reportResult(res, 'Deleted', entry.name)) return;
                            State.robberies = res.robberies || [];
                            State.locations = res.locations || [];
                            if (State.current && State.current.id === id) State.current = null;
                            switchPanel('robberies');
                        });
                }
            });
        });
    },
};

async function duplicateRobbery(id, name) {
    const res = await nui('duplicateRobbery', { id, name: `${name} copy` });
    if (!reportResult(res, 'Duplicated', res && res.robbery ? res.robbery.name : '')) return;

    State.robberies = res.robberies || State.robberies;
    switchPanel('robberies');
}
