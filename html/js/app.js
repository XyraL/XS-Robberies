const State = {
    boot: null,
    robberies: [],
    locations: [],
    loot: [],
    items: [],
    minigames: [],
    stageTypes: [],
    accounts: [],
    defaults: {},
    settings: [],
    dirtyItem: 'markedbills',
    version: '',
    current: null,
    jobLocations: [],
    dirty: false,
    issues: [],
    sel: null,
    tab: 'plan',
    view: 'home',
    liveRuns: [],
    killSwitch: false,
    blacklist: {},
    open: false,
};

const TABS = [
    { id: 'plan', label: 'Plan' },
    { id: 'flow', label: 'Flow' },
    { id: 'loot', label: 'Loot' },
    { id: 'props', label: 'Props' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'places', label: 'Places' },
    { id: 'rules', label: 'Rules' },
];

const $ = (sel, root = document) => root.querySelector(sel);

function shell() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="window">
            <header class="top">
                <div class="logo">${LOGO}XS <b>ROBBERIES</b></div>
                <div class="tabs" id="tabs"></div>
                <div class="top-actions" id="top-actions"></div>
                <button class="icon-btn" id="btn-close" title="Close">${icon('close', 15)}</button>
            </header>
            <div class="body" id="body">
                <aside class="rail" id="rail"></aside>
                <main class="main">
                    <div class="main-head" id="head"></div>
                    <div class="view" id="view"></div>
                </main>
                <aside class="inspector" id="inspector"></aside>
            </div>
        </div>`;

    $('#btn-close').addEventListener('click', closeBuilder);
}

function jobOpen() {
    return State.view === 'job' && State.current;
}

function renderTabs() {
    const el = $('#tabs');
    const job = State.current;
    const counts = {
        plan: job ? (job.stages || []).length : 0,
        props: job ? (job.props || []).length : 0,
        npcs: job ? (job.npcs || []).length : 0,
        places: job ? (anchorKind(job) === 'model' ? ((job.anchor || {}).models || []).length : State.jobLocations.length) : 0,
    };

    el.classList.toggle('off', !jobOpen());
    el.innerHTML = `<div class="tab-glider" id="glider"></div>` + TABS.map(t => `
        <div class="tab ${jobOpen() && State.tab === t.id ? 'on' : ''}" data-tab="${t.id}">
            ${t.label}${counts[t.id] ? `<span class="n">${counts[t.id]}</span>` : ''}
        </div>`).join('');

    el.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
        if (!State.current) { toast('Open a job first', 'Pick one on the left or start a new one.', 'info', 2600); return; }
        go(tab.dataset.tab);
    }));

    requestAnimationFrame(moveGlider);
}

function moveGlider() {
    const glider = $('#glider');
    const on = $('#tabs .tab.on');
    if (!glider) return;
    if (!on) { glider.style.opacity = '0'; return; }
    glider.style.opacity = '1';
    glider.style.left = `${on.offsetLeft}px`;
    glider.style.width = `${on.offsetWidth}px`;
}

function renderActions() {
    const el = $('#top-actions');
    if (!jobOpen()) { el.innerHTML = ''; return; }

    const job = State.current;
    el.innerHTML = `
        <button class="btn" id="act-step">${icon('plus', 14)} Step</button>
        <button class="btn" id="act-go" title="Teleport to it">${icon('goto', 14)} Go there</button>
        <button class="btn ${job.enabled ? 'live' : ''}" id="act-live">${job.enabled ? '● Live' : '○ Draft'}</button>
        <button class="btn primary ${State.dirty ? 'pulse' : ''}" id="act-save">Save</button>`;

    $('#act-step').addEventListener('click', () => Steps.pickType());
    $('#act-save').addEventListener('click', () => saveJob());
    $('#act-live').addEventListener('click', toggleLive);
    $('#act-go').addEventListener('click', goThere);
}

function railJobCard(r, i) {
    const running = State.liveRuns.some(run => run.robberyId === r.id);
    const type = jobType(r.category);
    const sub = r.anchorKind === 'model'
        ? `${type.label} · by model`
        : `${type.label} · ${r.stageCount || 0} step${r.stageCount === 1 ? '' : 's'}`;

    return `
        <div class="job ${State.current && State.current.id === r.id && State.view === 'job' ? 'on' : ''}" data-job="${esc(r.id)}" style="animation-delay:${i * 30}ms">
            <div class="ic">${icon(type.icon, 16)}</div>
            <div class="nm">${esc(r.name)}</div>
            <div class="d ${running ? 'running' : r.enabled ? 'live' : ''}" title="${running ? 'Being robbed right now' : r.enabled ? 'Live' : 'Draft'}"></div>
            <div class="k">${esc(sub.toUpperCase())}</div>
        </div>`;
}

function renderRail() {
    const el = $('#rail');
    const running = State.liveRuns.length;

    el.innerHTML = `
        <div class="rail-head"><span>JOBS</span><span>${State.robberies.length}</span></div>
        <div class="jobs">
            ${State.robberies.length ? State.robberies.map(railJobCard).join('')
                : '<div class="hint" style="padding:6px 4px">Nothing built yet. Start with a new job.</div>'}
        </div>
        <div class="rail-new">
            <button class="new-job" id="rail-new">+ New job</button>
            <button class="icon-btn" id="rail-import" title="Import a job">${icon('import', 15)}</button>
        </div>
        <div class="server-nav">
            <div class="rail-head"><span>SERVER</span></div>
            <div class="nav-row ${State.view === 'live' ? 'on' : ''}" data-nav="live">${icon('live', 15)} Live
                <span class="cnt ${running ? 'hot' : ''}">${running || ''}</span></div>
            <div class="nav-row ${State.view === 'history' ? 'on' : ''}" data-nav="history">${icon('history', 15)} History</div>
            <div class="nav-row ${State.view === 'settings' ? 'on' : ''}" data-nav="settings">${icon('settings', 15)} Settings
                ${State.killSwitch ? '<span class="cnt hot">OFF</span>' : ''}</div>
        </div>
        <div class="rail-foot">
            <div>${esc(State.boot && State.boot.framework || 'framework ?')} · ${esc(State.boot && State.boot.inventory || 'inventory ?')}</div>
            <div>target <b>${esc(State.boot && State.boot.target || 'built-in')}</b> · v${esc(State.version || '1.0.0')}</div>
        </div>`;

    el.querySelectorAll('[data-job]').forEach(card => card.addEventListener('click', () => openJob(card.dataset.job)));
    el.querySelectorAll('[data-nav]').forEach(row => row.addEventListener('click', () => showServer(row.dataset.nav)));
    $('#rail-new').addEventListener('click', () => Setup.open());
    $('#rail-import').addEventListener('click', importModal);
}

function renderHead() {
    const el = $('#head');

    if (!jobOpen()) {
        const titles = {
            home: ['Robberies', 'Build any robbery, then place it anywhere.'],
            live: ['Live', 'Every robbery happening right now.'],
            history: ['History', 'Every run this server has recorded.'],
            settings: ['Settings', 'What applies to the whole server.'],
        };
        const [title, sub] = titles[State.view] || titles.home;
        el.innerHTML = `<h2>${esc(title)}</h2><span class="sub">${esc(sub)}</span>`;
        return;
    }

    const job = State.current;
    const g = job.gates || {};
    const take = jobTake(job);
    const type = jobType(job.category);

    el.innerHTML = `
        <h2 title="${esc(job.name)}">${esc(job.name)}</h2>
        <span class="chip">${esc(type.label.toUpperCase())}</span>
        <span class="chip ${job.enabled ? 'live' : 'draft'}">${job.enabled ? '● LIVE' : 'DRAFT'}</span>
        <span class="chip dirty ${State.dirty ? '' : 'hidden'}" id="dirty-chip">UNSAVED</span>
        <div class="kpis">
            <div class="kpi"><small>STEPS</small><b>${(job.stages || []).length}</b></div>
            <div class="kpi"><small>MIN COPS</small><b>${g.policeRequired ?? 0}</b></div>
            <div class="kpi"><small>CREW</small><b>${g.minCrew ?? 1}–${g.maxCrew ?? 6}</b></div>
            <div class="kpi"><small>TAKE</small><b style="color:var(--green)">${esc(moneyRange(take.min, take.max))}</b></div>
            <div class="kpi"><small>COOLDOWN</small><b>${esc(duration(g.locationCooldown ?? 0))}</b></div>
        </div>`;
}

function renderView() {
    const old = $('#view');
    const fresh = old.cloneNode(false);
    fresh.className = 'view';
    old.replaceWith(fresh);

    const name = jobOpen() ? State.tab : State.view;
    const view = Views[name] || Views.home;
    view.render(fresh);
}

function renderInspector() {
    const el = $('#inspector');
    const wide = !jobOpen();
    $('#body').classList.toggle('wide', wide);
    if (wide) { el.innerHTML = ''; return; }
    Inspector.render(el);
}

function refresh(parts = {}) {
    const all = Object.keys(parts).length === 0;
    if (all || parts.tabs) renderTabs();
    if (all || parts.actions) renderActions();
    if (all || parts.rail) renderRail();
    if (all || parts.head) renderHead();
    if (all || parts.view) renderView();
    if (all || parts.inspector) renderInspector();
}

function go(tab) {
    State.tab = tab;
    State.view = 'job';
    refresh({ tabs: true, view: true, actions: true, head: true, rail: true });
}

function select(kind, id, opts = {}) {
    State.sel = kind ? { kind, id } : null;
    if (opts.tab && opts.tab !== State.tab) {
        State.tab = opts.tab;
        refresh({ tabs: true, view: true, inspector: true });
        return;
    }
    if (opts.view === false) {
        refresh({ inspector: true });
        Views[State.tab] && Views[State.tab].highlight && Views[State.tab].highlight();
        return;
    }
    refresh({ view: true, inspector: true });
}

function selected() {
    const job = State.current;
    if (!job || !State.sel) return null;
    if (State.sel.kind === 'stage') return (job.stages || []).find(s => s.id === State.sel.id) || null;
    if (State.sel.kind === 'prop') return (job.props || []).find(p => p.id === State.sel.id) || null;
    if (State.sel.kind === 'npc') return (job.npcs || []).find(n => n.id === State.sel.id) || null;
    if (State.sel.kind === 'place') return State.jobLocations.find(l => l.id === State.sel.id) || null;
    return null;
}

function markDirty(light = true) {
    State.dirty = true;
    const chip = $('#dirty-chip');
    if (chip) chip.classList.remove('hidden');
    const save = $('#act-save');
    if (save) save.classList.add('pulse');
    if (!light) refresh({ head: true, actions: true });
}

let softTimer = null;

function softRefresh() {
    clearTimeout(softTimer);
    softTimer = setTimeout(() => {
        refresh({ head: true });
        const v = Views[State.tab];
        if (jobOpen() && v && v.soft) v.soft();
        else if (jobOpen()) renderView();
        markDirty();
    }, 260);
}

async function openJob(id, opts = {}) {
    if (State.dirty && State.current && State.current.id !== id) {
        modal({
            title: 'Save first?',
            body: `<div class="hint" style="font-size:13px;color:var(--ink2)">${esc(State.current.name)} has changes that are not saved yet.</div>`,
            confirm: async () => {
                if (await saveJob(true)) { setTimeout(() => openJob(id, opts), 50); }
            },
            confirmLabel: 'Save and switch',
            cancelLabel: 'Stay here',
        });
        return;
    }

    const res = await nui('getRobbery', id);
    if (!res || !res.ok) {
        toast('Could not open it', (res && res.error) || 'The server did not answer.', 'error');
        return;
    }

    State.current = res.robbery;
    normaliseJob(State.current);
    State.jobLocations = res.locations || [];
    State.dirty = false;
    State.sel = opts.select || null;
    State.view = 'job';
    State.tab = opts.tab || 'plan';
    State.issues = [];
    refresh();
    refreshMarkers();
    validate();
}

function normaliseJob(job) {
    job.stages = job.stages || [];
    job.props = job.props || [];
    job.npcs = job.npcs || [];
    job.gates = job.gates || {};
    job.response = job.response || {};
    job.blip = job.blip || {};
    job.anchor = job.anchor || { kind: 'location', models: [], pool: 'object', scanRange: 80 };
    job.anchor.models = job.anchor.models || [];
    job.payout = job.payout || { account: 'cash' };
    job.stages.forEach(s => {
        s.opts = s.opts || {};
        s.requires = s.requires || [];
        if (!s.opts.label) s.opts.label = s.label || s.id;
        const def = stageType(s.type);
        (def ? def.fields : []).forEach(f => {
            if (f.type !== 'number' || s.opts[f.key] === undefined || s.opts[f.key] === null) return;
            let n = Number(s.opts[f.key]);
            if (!Number.isFinite(n)) n = f.default;
            if (f.min !== undefined && n < f.min) n = f.min;
            if (f.max !== undefined && n > f.max) n = f.max;
            s.opts[f.key] = n;
        });
    });
}

async function validate() {
    if (!State.current) return;
    const res = await nui('validateRobbery', State.current.id);
    if (res && res.ok) {
        State.issues = res.issues || [];
        if (jobOpen() && !State.sel) renderInspector();
    }
}

async function saveJob(quiet = false) {
    const job = State.current;
    if (!job) return false;

    job.stages.forEach(s => { s.label = stageLabel(s); });

    const res = await nui('saveRobbery', job);
    if (!res || !res.ok) {
        toast('Not saved', (res && res.error) || 'The server refused it.', 'error');
        return false;
    }

    State.robberies = res.robberies || State.robberies;
    State.issues = res.issues || [];
    State.dirty = false;

    const keepSel = State.sel;
    State.current = res.robbery || job;
    normaliseJob(State.current);
    State.sel = keepSel;

    if (!quiet) {
        const errors = State.issues.filter(i => i.level === 'error').length;
        if (errors) toast('Saved, with problems', `${errors} thing${errors === 1 ? '' : 's'} to fix before it works.`, 'warning');
        else toast('Saved', job.name, 'success', 2400);
    }

    refresh({ rail: true, head: true, actions: true, tabs: true, inspector: true });
    refreshMarkers();
    return true;
}

async function toggleLive() {
    const job = State.current;
    if (!job) return;

    if (!job.enabled) {
        const errors = State.issues.filter(i => i.level === 'error');
        if (errors.length) {
            toast('Fix these first', errors[0].message, 'error', 5200);
            State.sel = null;
            refresh({ inspector: true });
            return;
        }
    }

    job.enabled = !job.enabled;
    if (await saveJob(true)) {
        toast(job.enabled ? 'Live' : 'Back to draft',
            job.enabled ? 'Players can rob it now.' : 'It is gone from the world until you set it live again.',
            job.enabled ? 'success' : 'info');
        validate();
    } else {
        job.enabled = !job.enabled;
    }
}

function goThere() {
    const job = State.current;
    const loc = State.jobLocations[0];
    const at = (loc && loc.origin) || jobOrigin(job);
    if (!at) { toast('Nowhere to go yet', 'Place a step first.', 'info'); return; }
    nui('teleport', { coords: at, heading: at.h });
}

function refreshMarkers() {
    const job = State.current;
    if (!job || !State.open) { nui('setEditorStages', { stages: [] }); return; }

    const points = (job.stages || []).filter(s => s.coords).map(s => ({
        id: s.id, type: s.type, label: stageLabel(s), coords: s.coords, requires: s.requires,
    }));

    (job.props || []).filter(p => p.coords).forEach(p => points.push({
        id: p.id, type: 'prop', label: propLabel(p), coords: p.coords, requires: [],
    }));

    (job.npcs || []).filter(n => n.coords).forEach(n => points.push({
        id: n.id, type: 'npc', label: npcLabel(n), coords: n.coords, requires: [],
    }));

    nui('setEditorStages', { stages: points });
}

async function place(opts) {
    const res = await nui('beginPlacement', opts);
    return res || { ok: false, action: 'cancel' };
}

function showServer(view) {
    State.view = view;
    refresh();
}

function closeBuilder() {
    nui('close');
    hideApp();
}

function hideApp() {
    State.open = false;
    closeModal();
    document.getElementById('app').classList.add('hidden');
    stopPolling();
}

async function boot(data) {
    State.boot = data;
    State.robberies = data.robberies || [];
    State.locations = data.locations || [];
    State.loot = data.loot || [];
    State.items = data.items || [];
    State.minigames = data.minigames || [];
    State.stageTypes = data.stageTypes || [];
    State.accounts = data.accounts || [];
    State.defaults = data.defaults || {};
    State.settings = data.settings || [];
    State.dirtyItem = data.dirtyItem || 'markedbills';
    State.version = data.version || '';
    State.open = true;

    if (!document.querySelector('.window')) shell();
    document.getElementById('app').classList.remove('hidden', 'suspended');

    if (State.current && !State.robberies.some(r => r.id === State.current.id)) {
        State.current = null;
        State.dirty = false;
    }

    if (State.current && State.dirty) {
        State.view = 'job';
        refresh();
        refreshMarkers();
        toast('Still here', 'Your unsaved changes to this job were kept.', 'info', 3200);
    } else if (State.current) {
        const keep = { tab: State.tab, select: State.sel };
        await openJob(State.current.id, keep);
    } else {
        State.view = State.view === 'job' ? 'home' : State.view;
        refresh();
    }

    startPolling();
}

let pollTimer = null;

async function pollLive() {
    const res = await nui('live');
    if (res && res.ok) {
        const before = JSON.stringify(State.liveRuns.map(r => [r.locationId, r.done, r.alarm]));
        State.liveRuns = res.runs || [];
        State.killSwitch = res.killSwitch === true;
        State.blacklist = res.blacklist || {};
        const after = JSON.stringify(State.liveRuns.map(r => [r.locationId, r.done, r.alarm]));
        if (before !== after) {
            renderRail();
            if (State.view === 'live') renderView();
        }
    }
}

function startPolling() {
    stopPolling();
    pollLive();
    pollTimer = setInterval(pollLive, 4000);
}

function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
}

function importModal() {
    modal({
        title: 'Import a job',
        sub: 'Paste a job someone exported. It arrives as a draft so nothing goes live before you look at it.',
        body: `<div class="f"><label>Exported job</label><textarea id="import-json" placeholder='{"name":"Fleeca", "stages":[ ... ]}'></textarea></div>`,
        confirmLabel: 'Import',
        confirm: async (root) => {
            const raw = root.querySelector('#import-json').value.trim();
            if (!raw) return false;
            const res = await nui('importRobbery', raw);
            if (!report(res, 'Imported', res && res.robbery ? res.robbery.name : '')) return false;
            State.robberies = res.robberies || State.robberies;
            setTimeout(() => openJob(res.robbery.id, { tab: 'places' }), 50);
        },
    });
}

window.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.action === 'open') boot(msg.data || {});
    else if (msg.action === 'close') hideApp();
    else if (msg.action === 'suspend') document.getElementById('app').classList.add('suspended');
    else if (msg.action === 'resume') document.getElementById('app').classList.remove('suspended');
});

document.addEventListener('keydown', (e) => {
    if (!State.open) return;
    if (e.key === 'Escape') {
        if (document.querySelector('.picker-list:not([hidden])')) return;
        if (modalOpen) { closeModal(); return; }
        closeBuilder();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (State.current) saveJob();
    }
});

window.addEventListener('resize', () => {
    moveGlider();
    if (jobOpen() && Views[State.tab] && Views[State.tab].resize) Views[State.tab].resize();
});
