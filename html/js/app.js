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
    current: null,
    selectedStage: null,
    panel: 'robberies',
    placementResolve: null,
};

const Panels = window.Panels || {};
window.Panels = Panels;

function stageType(id) {
    return State.stageTypes.find(t => t.id === id) || null;
}

function setBadges() {
    document.getElementById('badge-robberies').textContent = State.robberies.length || '';
    document.getElementById('badge-locations').textContent = State.locations.length || '';
    document.getElementById('badge-loot').textContent = State.loot.length || '';
    document.getElementById('badge-editor').textContent =
        State.current ? (State.current.stages || []).length : '';
}

function setTopbar(title, subtitle, actionsHtml = '') {
    document.getElementById('topbar-title').textContent = title;
    document.getElementById('topbar-subtitle').textContent = subtitle;
    document.getElementById('topbar-actions').innerHTML = actionsHtml;
}

function switchPanel(name) {
    if (!Panels[name]) return;

    State.panel = name;

    document.querySelectorAll('.nav-item').forEach(el =>
        el.classList.toggle('active', el.dataset.panel === name));

    document.querySelectorAll('.panel').forEach(el =>
        el.classList.remove('active'));

    const panel = document.getElementById(`panel-${name}`);
    panel.classList.add('active');

    Panels[name].render(panel);
    setBadges();
}

function refreshEditorMarkers() {
    const stages = State.current ? (State.current.stages || []) : [];
    nui('setEditorStages', { stages: stages.filter(s => s.coords) });
}

async function openRobbery(id) {
    const res = await nui('getRobbery', id);
    if (!res || !res.ok) {
        toast('Could not open it', (res && res.error) || 'The server did not answer.', 'error');
        return;
    }

    State.current = res.robbery;
    State.selectedStage = (res.robbery.stages || [])[0]?.id || null;
    refreshEditorMarkers();
    switchPanel('editor');
}

async function saveCurrent(quiet = false) {
    if (!State.current) return false;

    const res = await nui('saveRobbery', State.current);
    if (!res || !res.ok) {
        toast('Not saved', (res && res.error) || 'The server refused it.', 'error');
        return false;
    }

    State.robberies = res.robberies || State.robberies;
    State.current = res.robbery || State.current;
    State.issues = res.issues || [];

    if (!quiet) {
        const errors = State.issues.filter(i => i.level === 'error').length;
        if (errors > 0) {
            toast('Saved with problems', `${errors} thing${errors === 1 ? '' : 's'} still need fixing.`, 'warning');
        } else {
            toast('Saved', State.current.name, 'success');
        }
    }

    setBadges();
    refreshEditorMarkers();
    return true;
}

async function placePoint(opts) {
    const res = await nui('beginPlacement', opts);
    return res && res.ok ? res.coords : null;
}

function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name || 'emerald');
}

function themeFromSettings() {
    const entry = (State.settings || []).find(s => s.key === 'theme');
    return entry ? entry.value : 'emerald';
}

function boot(data) {
    State.boot = data;
    State.robberies = data.robberies || [];
    State.locations = data.locations || [];
    State.loot = data.loot || [];
    State.settings = data.settings || [];
    applyTheme(themeFromSettings());
    State.items = data.items || [];
    State.minigames = data.minigames || [];
    State.stageTypes = data.stageTypes || [];
    State.accounts = data.accounts || [];
    State.defaults = data.defaults || {};

    document.getElementById('foot-framework').textContent = data.framework || 'auto';
    document.getElementById('foot-inventory').textContent = data.inventory || 'auto';

    document.getElementById('app').classList.remove('hidden');
    switchPanel('robberies');
}

function shutdown() {
    document.getElementById('app').classList.add('hidden');
    closeModal();
    State.current = null;
    State.selectedStage = null;
}

window.addEventListener('message', (event) => {
    const msg = event.data || {};

    if (msg.action === 'open') {
        boot(msg.data || {});
    } else if (msg.action === 'close') {
        shutdown();
    } else if (msg.action === 'suspend') {
        document.getElementById('app').classList.add('suspended');
    } else if (msg.action === 'resume') {
        document.getElementById('app').classList.remove('suspended');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => switchPanel(el.dataset.panel));
    });

    document.getElementById('btn-close').addEventListener('click', () => {
        nui('close');
        shutdown();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        if (document.getElementById('modal-root').innerHTML !== '') {
            closeModal();
            return;
        }
        nui('close');
        shutdown();
    });
});
