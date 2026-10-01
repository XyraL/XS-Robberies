const MOCK_ITEMS = [
    { name: 'lockpick', label: 'Lockpick' },
    { name: 'advancedlockpick', label: 'Advanced Lockpick' },
    { name: 'drill', label: 'Drill' },
    { name: 'thermite', label: 'Thermite' },
    { name: 'trojan_usb', label: 'Trojan USB' },
    { name: 'security_card_01', label: 'Security Card A' },
    { name: 'markedbills', label: 'Marked Bills' },
    { name: 'goldbar', label: 'Gold Bar' },
    { name: 'goldchain', label: 'Gold Chain' },
    { name: 'rolex', label: 'Rolex' },
    { name: 'diamond_ring', label: 'Diamond Ring' },
    { name: 'bag', label: 'Duffel Bag' },
];

const MOCK_SETTINGS = [
    { key: 'payoutMultiplier', label: 'Payout multiplier', kind: 'number', min: 0, max: 20, step: 0.05, value: 1, fromConfig: true },
    { key: 'payoutOnEscape', label: "Hold each robber's money until the crew escapes", kind: 'toggle', value: true, fromConfig: false },
    { key: 'respectDuty', label: 'Off-duty police and EMS may rob', kind: 'toggle', value: false, fromConfig: true },
    { key: 'logRuns', label: 'Write finished runs to history', kind: 'toggle', value: true, fromConfig: true },
    { key: 'abandonAfter', label: 'Abandon a run after', kind: 'number', min: 60, max: 7200, unit: 's', value: 600, fromConfig: true },
];

const DEF_GATES = { policeRequired: 2, policeOnDuty: true, minCrew: 1, maxCrew: 6, locationCooldown: 1800, playerCooldown: 900, globalCooldown: 0, proximityMetres: 0, proximitySeconds: 0 };
const DEF_RESPONSE = { alarm: 'instant', alarmDelay: 30, camerasChangeTo: 'delayed', powerChangesTo: 'silent', code: '10-90', title: 'Robbery', repeatAlert: 120, dispatchOnFail: true };

function mockDefaults(type) {
    const t = CATALOGUE.stageTypes.find(s => s.id === type);
    const opts = {};
    (t ? t.fields : []).forEach(f => { opts[f.key] = f.default; });
    return opts;
}

function mockStage(id, type, label, coords, requires, opts = {}, pay = null) {
    return {
        id, type, label,
        coords: { x: coords[0], y: coords[1], z: coords[2], h: coords[3] || 0 },
        requires,
        payout: pay ? { cash: { account: 'job', min: pay[0], max: pay[1] }, items: pay[2] || [], lootTable: pay[3] || '' } : {},
        opts: Object.assign(mockDefaults(type), { label }, opts),
    };
}

const MOCK = {
    blacklist: { 'XYZ99887': 'Marisol Vega' },
    killSwitch: false,
    loot: [
        { id: 'vault_gold', label: 'Vault gold', entries: [{ item: 'goldbar', min: 1, max: 3, chance: 70 }, { item: 'diamond_ring', min: 1, max: 1, chance: 15 }] },
        { id: 'jewelry_case', label: 'Jewelry case', entries: [{ item: 'goldchain', min: 1, max: 4, chance: 80 }, { item: 'rolex', min: 1, max: 2, chance: 35 }] },
    ],
    jobs: {},
    locations: [],
    nextLoc: 1,
};

MOCK.jobs.fleeca_legion = {
    id: 'fleeca_legion', name: 'Fleeca Legion Square', category: 'bank', enabled: true, revision: 12, author: 'XyraL', radius: 40,
    origin: { x: 146.3, y: -1046.1, z: 29.37, h: 250 },
    anchor: { kind: 'location', models: [], pool: 'object', scanRange: 80, label: 'the door panel' },
    payout: { account: 'dirty', split: 'crew', when: 'escape' },
    blip: { sprite: 500, colour: 1, scale: 0.8, showWhen: 'during', label: 'Fleeca' },
    gates: Object.assign({}, DEF_GATES, { policeRequired: 4, minCrew: 2, maxCrew: 4, locationCooldown: 5400, playerCooldown: 3600 }),
    response: Object.assign({}, DEF_RESPONSE, { alarm: 'delayed', alarmDelay: 45, title: 'Fleeca Robbery', code: '10-90' }),
    stages: [
        mockStage('camera_1', 'camera', 'Kill the cameras', [143.6, -1041.3, 29.37, 70], [], { optional: true, duration: 12, requiredItem: 'trojan_usb' }),
        mockStage('power_1', 'power', 'Cut the power', [139.9, -1052.6, 29.37, 160], [], { optional: true, duration: 10 }),
        mockStage('hack_1', 'hack', 'Door panel', [146.3, -1046.1, 29.37, 250], [], { duration: 15, revealCode: 4, requiredItem: 'trojan_usb', consumeItem: true, notifyPolice: false }),
        mockStage('keypad_1', 'keypad', 'Vault keypad', [148.6, -1045.2, 29.4, 250], ['hack_1'], { codeFrom: 'hack_1', digits: 4, duration: 4 }),
        mockStage('tool_1', 'tool', 'Burn the gate', [149.1, -1047.8, 29.36, 160], ['keypad_1'], { toolKind: 'thermite', duration: 20, requiredItem: 'thermite', consumeItem: true, notifyPolice: true }),
        mockStage('container_1', 'container', 'Deposit boxes 1', [151.4, -1050.9, 29.36, 70], ['tool_1'], { grabs: 4, grabTime: 5 }, [800, 2000]),
        mockStage('container_2', 'container', 'Deposit boxes 2', [147.0, -1051.8, 29.36, 250], ['tool_1'], { grabs: 4, grabTime: 5 }, [800, 2000]),
        mockStage('container_3', 'container', 'Cash trolley', [149.4, -1049.8, 29.36, 160], ['tool_1'], { grabs: 6, grabTime: 4, optional: true, prop: 'hei_prop_hei_cash_trolly_01', propDone: 'swap', propSwap: 'hei_prop_hei_cash_trolly_03' }, [1000, 2500, [], 'vault_gold']),
        mockStage('escape_1', 'escape', 'Getaway', [163.5, -1024.9, 29.2, 0], ['tool_1'], { radius: 80, timeLimit: 420 }),
    ],
    npcs: [
        { id: 'npc_1', model: 'a_f_y_business_01', label: 'Teller', coords: { x: 149.4, y: -1041.3, z: 29.37, h: 160 }, scenario: 'WORLD_HUMAN_STAND_IMPATIENT', animDict: '', animClip: '', reaction: 'cower' },
        { id: 'npc_2', model: 'u_m_m_bankman', label: 'Bank manager', coords: { x: 151.6, y: -1042.8, z: 29.37, h: 70 }, scenario: 'WORLD_HUMAN_CLIPBOARD', animDict: '', animClip: '', reaction: 'cower' },
        { id: 'npc_3', model: 'a_m_m_bevhills_01', label: 'Customer', coords: { x: 145.0, y: -1039.2, z: 29.37, h: 340 }, scenario: 'WORLD_HUMAN_STAND_MOBILE', animDict: '', animClip: '', reaction: 'flee' },
    ],
    props: [
        { id: 'prop_1', model: 'h4_prop_h4_gold_stack_01a', label: 'Gold stack', coords: { x: 152.2, y: -1048.4, z: 29.36, h: 70 }, linkStage: 'container_1', onDone: 'remove', swapModel: '' },
        { id: 'prop_2', model: 'hei_prop_hst_laptop', label: 'Hacking laptop', coords: { x: 145.7, y: -1047.0, z: 30.2, h: 250 }, linkStage: '', onDone: 'keep', swapModel: '' },
    ],
};

MOCK.jobs.grove_247 = {
    id: 'grove_247', name: 'Grove Street 24/7', category: 'store', enabled: true, revision: 7, author: 'XyraL', radius: 30,
    origin: { x: 24.5, y: -1347.3, z: 29.5, h: 270 },
    anchor: { kind: 'location', models: [], pool: 'object', scanRange: 80, label: 'the first till' },
    payout: { account: 'cash' },
    blip: { sprite: 52, colour: 1, scale: 0.8, showWhen: 'during', label: '24/7' },
    gates: Object.assign({}, DEF_GATES, { policeRequired: 2 }),
    response: Object.assign({}, DEF_RESPONSE, { alarm: 'delayed', alarmDelay: 30, title: 'Store Robbery' }),
    stages: [
        mockStage('register_1', 'register', 'Till 1', [24.5, -1347.3, 29.5, 270], [], { duration: 12 }, [200, 600]),
        mockStage('register_2', 'register', 'Till 2', [24.4, -1344.9, 29.5, 270], [], { duration: 12 }, [200, 600]),
        mockStage('hostage_1', 'hostage', 'Clerk', [24.0, -1346.2, 29.5, 90], [], { optional: true }),
        mockStage('safe_1', 'safe', 'Back-room safe', [28.2, -1338.6, 29.5, 0], ['register_1'], { optional: true, requiredItem: 'drill' }, [1500, 4000]),
        mockStage('escape_1', 'escape', 'Getaway', [42.1, -1372.4, 29.3, 0], ['register_1'], { radius: 50 }),
    ],
    props: [],
};

MOCK.jobs.every_atm = {
    id: 'every_atm', name: 'Every ATM', category: 'atm', enabled: true, revision: 3, author: 'XyraL', radius: 25,
    origin: { x: 147.4, y: -1035.8, z: 29.34, h: 340 },
    anchor: { kind: 'model', models: ['prop_atm_01', 'prop_atm_02', 'prop_fleeca_atm'], pool: 'object', scanRange: 60, label: 'the ATM' },
    payout: { account: 'cash' },
    blip: { sprite: 500, colour: 1, scale: 0.8, showWhen: 'during', label: 'ATM' },
    gates: Object.assign({}, DEF_GATES, { policeRequired: 1, locationCooldown: 3600 }),
    response: Object.assign({}, DEF_RESPONSE, { title: 'ATM Tampering', code: '10-31' }),
    stages: [
        mockStage('tool_1', 'tool', 'Drill the ATM', [147.6, -1035.1, 29.34, 160], [], { toolKind: 'drill', duration: 25, requiredItem: 'drill', notifyPolice: true }),
        mockStage('container_1', 'container', 'Cash cassette', [147.6, -1035.1, 29.34, 160], ['tool_1'], { grabs: 3, grabTime: 5 }, [300, 700]),
    ],
    props: [],
};

MOCK.jobs.vangelico = {
    id: 'vangelico', name: 'Vangelico', category: 'jewelry', enabled: false, revision: 2, author: 'XyraL', radius: 30,
    anchor: { kind: 'location', models: [], pool: 'object', scanRange: 80 },
    payout: { account: 'cash' }, blip: {}, gates: Object.assign({}, DEF_GATES), response: Object.assign({}, DEF_RESPONSE),
    stages: [], props: [],
};

const PLACES = [
    ['fleeca_legion', 'Legion Square', [146.3, -1046.1, 29.37, 250], true],
    ['fleeca_legion', 'Alta', [311.2, -284.2, 54.16, 250], true],
    ['fleeca_legion', 'Burton', [-353.6, -55.4, 49.04, 251], true],
    ['fleeca_legion', 'Rockford', [-1211.0, -336.2, 37.78, 297], true],
    ['fleeca_legion', 'Great Ocean', [-2957.6, 482.8, 15.7, 357], false],
    ['fleeca_legion', 'Harmony', [1175.9, 2712.4, 38.09, 90], true],
    ['grove_247', 'Grove Street', [24.5, -1347.3, 29.5, 270], true],
    ['grove_247', 'Mirror Park', [1164.9, -322.6, 69.2, 100], true],
    ['grove_247', 'Sandy Shores', [1959.3, 3740.6, 32.3, 300], true],
];

PLACES.forEach(([job, label, c, on]) => {
    MOCK.locations.push({
        id: MOCK.nextLoc++, robberyId: job, label, enabled: on,
        origin: { x: c[0], y: c[1], z: c[2], h: c[3] }, overrides: {}, offsets: {},
    });
});

MOCK.locations[1].offsets = { container_2: { x: 0.35, y: -0.2, z: 0 } };
MOCK.locations[3].overrides = { payoutMultiplier: 1.25, disabledStages: { power_1: true } };
MOCK.locations[8].overrides = { gates: { policeRequired: 1 } };

const MOCK_RUNS = [
    { locationId: 3, robberyId: 'fleeca_legion', name: 'Fleeca Legion Square', location: 'Burton', stage: '5 of 9 stages', done: 5, total: 9, alarm: 'raised', elapsed: 232, pot: 18400,
      participants: [{ citizenid: 'VV100001', name: 'Vincent Valentine' }, { citizenid: 'IF200314', name: 'Isabel Ferreira' }] },
    { locationId: 'm:every_atm:289.1_-1256.4_29.4', robberyId: 'every_atm', name: 'Every ATM', location: 'Every ATM', stage: '1 of 2 stages', done: 1, total: 2, alarm: 'silent', elapsed: 41, pot: 0,
      participants: [{ citizenid: 'TO300221', name: 'Terrence Obi' }] },
];

const MOCK_HISTORY = [
    { id: 41, robbery_id: 'grove_247', name: 'Grove Street 24/7', started_at: '2026-09-30 22:14:08', outcome: 'completed', participants: [{ name: 'Vincent Valentine' }, { name: 'Callum Rhodes' }], payout: 5200 },
    { id: 40, robbery_id: 'fleeca_legion', name: 'Fleeca Legion Square', started_at: '2026-09-30 21:02:51', outcome: 'failed', participants: [{ name: 'Nadia Kowalski' }, { name: 'Rafael Duarte' }, { name: 'Wesley Grant' }], payout: 0 },
    { id: 39, robbery_id: 'every_atm', name: 'Every ATM', started_at: '2026-09-30 19:47:33', outcome: 'completed', participants: [{ name: 'Terrence Obi' }], payout: 1840 },
    { id: 38, robbery_id: 'fleeca_legion', name: 'Fleeca Legion Square', started_at: '2026-09-29 23:31:10', outcome: 'completed', participants: [{ name: 'Vincent Valentine' }, { name: 'Isabel Ferreira' }, { name: 'Priya Chandran' }], payout: 31650 },
    { id: 37, robbery_id: 'grove_247', name: 'Grove Street 24/7', started_at: '2026-09-29 20:05:44', outcome: 'abandoned', participants: [{ name: 'Byron Whitfield' }], payout: 450 },
    { id: 36, robbery_id: 'grove_247', name: 'Grove Street 24/7', started_at: '2026-09-28 18:40:02', outcome: 'completed', participants: [{ name: 'Hollis Barnes' }, { name: 'Junko Ito' }], payout: 3900 },
];

function mockList() {
    return Object.values(MOCK.jobs).map(def => ({
        id: def.id, name: def.name, category: def.category, enabled: def.enabled, author: def.author, revision: def.revision,
        stageCount: (def.stages || []).length, propCount: (def.props || []).length, npcCount: (def.npcs || []).length,
        locationCount: MOCK.locations.filter(l => l.robberyId === def.id).length,
        anchorKind: (def.anchor || {}).kind || 'location',
    })).sort((a, b) => a.name.localeCompare(b.name));
}

function mockValidate(def) {
    const out = [];
    const add = (level, message, stage) => out.push({ level, message, stage });
    const stages = (def.stages || []).filter(s => s.enabled !== false);
    if (!stages.length) { add('error', 'No stages placed yet.'); return out; }
    const ids = new Set(stages.map(s => s.id));
    stages.forEach(s => {
        const label = (s.opts && s.opts.label) || s.label || s.id;
        if (!s.coords) add('error', `${label} has not been placed in the world.`, s.id);
        if (s.type === 'keypad') {
            const from = stages.find(x => x.id === (s.opts || {}).codeFrom);
            if (!from) add('error', `${label} has no stage to get its code from.`, s.id);
            else if (!(Number(from.opts.revealCode) > 0)) add('error', `${label} reads a code from ${from.opts.label}, which never reveals one.`, s.id);
        }
        (s.requires || []).forEach(d => { if (!ids.has(d)) add('error', `${label} waits on a stage that no longer exists.`, s.id); });
        if (['register', 'safe', 'container'].includes(s.type)) {
            const p = s.payout || {};
            const cash = p.cash && p.cash.max > 0;
            if (!cash && !(p.items || []).length && !p.lootTable) add('warn', `${label} pays out nothing.`, s.id);
        }
    });
    if (!stages.some(s => s.type === 'escape') && def.category !== 'atm') add('warn', 'No escape zone. This finishes as soon as the last required stage is done, and pays on the spot. Right for an ATM, wrong for a bank.');
    const kind = (def.anchor || {}).kind || 'location';
    if (kind === 'model' && !((def.anchor || {}).models || []).length) add('error', 'This job finds its places by model, but no model is set. Pick one in Places.');
    if (kind === 'location' && !MOCK.locations.some(l => l.robberyId === def.id)) add('warn', 'It is not placed anywhere yet. Add a place in Places.');
    (def.props || []).forEach(p => { if (!p.model) add('error', `${p.label || 'A prop'} has no model.`); });
    return out;
}

function mockLayout(def, origin, offsets = {}, overrides = {}) {
    const base = def.origin || ((def.stages || [])[0] || {}).coords || origin;
    const turn = ((origin.h || 0) - (base.h || 0)) * Math.PI / 180;
    const cos = Math.cos(turn), sin = Math.sin(turn);
    const place = (c, n = {}) => ({
        x: origin.x + ((c.x - base.x) * cos - (c.y - base.y) * sin) + (n.x || 0),
        y: origin.y + ((c.x - base.x) * sin + (c.y - base.y) * cos) + (n.y || 0),
        z: origin.z + (c.z - base.z) + (n.z || 0),
        h: ((c.h || 0) + (origin.h - base.h) + 360) % 360,
    });
    const off = overrides.disabledStages || {};
    const offP = overrides.disabledProps || {};
    const offN = overrides.disabledNpcs || {};
    return {
        stages: (def.stages || []).filter(s => s.coords && !off[s.id] && s.enabled !== false).map(s => ({ id: s.id, type: s.type, label: s.label, coords: place(s.coords, offsets[s.id]) })),
        props: (def.props || []).filter(p => p.coords && !offP[p.id]).map(p => ({ id: p.id, model: p.model, coords: place(p.coords, offsets[p.id]) })),
        npcs: (def.npcs || []).filter(n => n.coords && !offN[n.id]).map(n => ({ id: n.id, model: n.model, coords: place(n.coords, offsets[n.id]) })),
    };
}

const PLACE_STATE = { last: null, repeats: {} };

function suspend(on) {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('suspended', on);
}

const MOCK_HANDLERS = {
    getRobbery: (id) => {
        const def = MOCK.jobs[id];
        if (!def) return { ok: false, error: 'No such robbery.' };
        return { ok: true, robbery: clone(def), locations: clone(MOCK.locations.filter(l => l.robberyId === id)) };
    },
    createRobbery: (p) => {
        let id = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'robbery';
        while (MOCK.jobs[id]) id += '_2';
        MOCK.jobs[id] = {
            id, name: p.name, category: p.category, enabled: false, revision: 1, author: 'XyraL', radius: 30,
            anchor: { kind: (p.anchor || {}).kind || 'location', pool: (p.anchor || {}).pool || 'object', models: [], scanRange: 80 },
            payout: { account: 'cash' }, blip: { sprite: 500, colour: 1, scale: 0.8, showWhen: 'during', label: p.name },
            gates: Object.assign({}, DEF_GATES), response: Object.assign({}, DEF_RESPONSE), stages: [], props: [], npcs: [],
        };
        return { ok: true, robbery: clone(MOCK.jobs[id]), robberies: mockList() };
    },
    saveRobbery: (def) => {
        def.revision = (def.revision || 0) + 1;
        MOCK.jobs[def.id] = clone(def);
        return { ok: true, robbery: clone(def), robberies: mockList(), issues: mockValidate(def) };
    },
    validateRobbery: (id) => ({ ok: true, issues: mockValidate(MOCK.jobs[id] || {}) }),
    deleteRobbery: (id) => {
        delete MOCK.jobs[id];
        MOCK.locations = MOCK.locations.filter(l => l.robberyId !== id);
        return { ok: true, robberies: mockList(), locations: clone(MOCK.locations) };
    },
    duplicateRobbery: (p) => {
        const copy = clone(MOCK.jobs[p.id]);
        copy.id = `${p.id}_copy`;
        copy.name = p.name;
        copy.enabled = false;
        MOCK.jobs[copy.id] = copy;
        return { ok: true, robbery: clone(copy), robberies: mockList() };
    },
    exportRobbery: (id) => ({ ok: true, json: JSON.stringify(Object.assign(clone(MOCK.jobs[id]), { export: { resource: 'XS-Robberies', format: 1, exportedBy: 'XyraL' } })) }),
    importRobbery: (raw) => {
        let def;
        try { def = JSON.parse(raw); } catch (e) { return { ok: false, error: 'That is not valid JSON.' }; }
        if (!def.stages) return { ok: false, error: 'That JSON has no stages, so it is not a robbery.' };
        def.id = `${(def.name || 'imported').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_import`;
        def.enabled = false;
        MOCK.jobs[def.id] = def;
        return { ok: true, robbery: clone(def), robberies: mockList(), issues: mockValidate(def) };
    },
    saveLocation: (loc) => {
        if (!loc.id) loc.id = MOCK.nextLoc++;
        const at = MOCK.locations.findIndex(l => l.id === loc.id);
        if (at >= 0) MOCK.locations[at] = clone(loc); else MOCK.locations.push(clone(loc));
        return { ok: true, location: clone(loc), locations: clone(MOCK.locations), robberies: mockList() };
    },
    deleteLocation: (id) => {
        MOCK.locations = MOCK.locations.filter(l => l.id !== id);
        return { ok: true, locations: clone(MOCK.locations), robberies: mockList() };
    },
    resolveLocation: (id) => {
        const loc = MOCK.locations.find(l => l.id === id);
        if (!loc) return { ok: false, error: 'That location no longer exists.' };
        const def = MOCK.jobs[loc.robberyId];
        const laid = mockLayout(def, loc.origin, loc.offsets, loc.overrides);
        return { ok: true, offsets: loc.offsets, overrides: loc.overrides, location: { id: loc.id, label: loc.label, origin: loc.origin, stages: laid.stages, props: laid.props, npcs: laid.npcs } };
    },
    saveLoot: (t) => {
        const at = MOCK.loot.findIndex(x => x.id === t.id);
        if (at >= 0) MOCK.loot[at] = t; else MOCK.loot.push(t);
        return { ok: true, loot: clone(MOCK.loot) };
    },
    deleteLoot: (id) => {
        MOCK.loot = MOCK.loot.filter(t => t.id !== id);
        return { ok: true, loot: clone(MOCK.loot) };
    },
    history: () => ({ ok: true, runs: clone(MOCK_HISTORY) }),
    live: () => ({ ok: true, runs: clone(MOCK_RUNS), killSwitch: MOCK.killSwitch, blacklist: clone(MOCK.blacklist) }),
    forceEnd: (id) => {
        const at = MOCK_RUNS.findIndex(r => r.locationId === id);
        if (at >= 0) MOCK_RUNS.splice(at, 1);
        return { ok: true, runs: clone(MOCK_RUNS) };
    },
    killSwitch: (on) => { MOCK.killSwitch = on === true; return { ok: true, killSwitch: MOCK.killSwitch }; },
    blacklist: (p) => {
        if (p.on === false) delete MOCK.blacklist[p.citizenid]; else MOCK.blacklist[p.citizenid] = p.name || p.citizenid;
        return { ok: true, blacklist: clone(MOCK.blacklist) };
    },
    saveTunables: (values) => {
        MOCK_SETTINGS.forEach(s => { if (values[s.key] !== undefined) { s.value = values[s.key]; s.fromConfig = false; } });
        return { ok: true, settings: clone(MOCK_SETTINGS) };
    },
    setEditorStages: () => ({ ok: true }),
    teleport: () => ({ ok: true }),
    close: () => ({ ok: true }),
    minigameResult: (p) => {
        if (PLACE_STATE.mg) { const done = PLACE_STATE.mg; PLACE_STATE.mg = null; done(p.passed); }
        return { ok: true };
    },
    previewMinigame: (p) => new Promise(resolve => {
        suspend(true);
        const kind = String(p.id || '').replace(/^xs:/, '');
        PLACE_STATE.mg = (passed) => { suspend(false); resolve({ ok: true, passed }); };
        setTimeout(() => window.postMessage({ action: 'minigame', kind, difficulty: p.difficulty || 2 }, '*'), 200);
    }),
    endPlacementSession: () => { suspend(false); return { ok: true }; },
    beginPlacement: (p) => new Promise(resolve => {
        suspend(true);
        setTimeout(() => {
            if (!p.session) suspend(false);
            const g = p.guided || {};
            if (g.repeating) {
                const key = g.title;
                PLACE_STATE.repeats[key] = (PLACE_STATE.repeats[key] || 0) + 1;
                if (PLACE_STATE.repeats[key] > 1) { resolve({ ok: false, action: 'skip' }); return; }
            }
            if (p.pickEntity) {
                resolve({ ok: true, action: 'placed', coords: { x: 147.4, y: -1035.8, z: 29.34, h: 340 }, pick: { model: joaat(p.guided && /vehicle/i.test(p.guided.title || '') ? 'stockade' : 'prop_atm_01'), vehicle: /vehicle/i.test((p.guided || {}).title || ''), name: /vehicle/i.test((p.guided || {}).title || '') ? 'stockade' : undefined } });
                return;
            }
            const from = p.origin || PLACE_STATE.last || { x: 146.3, y: -1046.1, z: 29.37, h: 250 };
            const a = Math.random() * Math.PI * 2;
            const d = p.layout ? 0 : 2 + Math.random() * 5;
            const coords = { x: +(from.x + Math.cos(a) * d).toFixed(2), y: +(from.y + Math.sin(a) * d).toFixed(2), z: from.z, h: Math.round(Math.random() * 360), radius: p.mode === 'zone' ? (p.radius || 25) : undefined };
            PLACE_STATE.last = coords;
            resolve({ ok: true, action: 'placed', coords, previewFailed: !!p.previewModel && !/^[a-z0-9_]+$/i.test(p.previewModel) });
        }, p.session ? 380 : 600);
    }),
};

window.fetch = async (url, options) => {
    const endpoint = String(url).split('/').pop();
    const payload = options && options.body ? JSON.parse(options.body) : {};
    const handler = MOCK_HANDLERS[endpoint];
    const body = handler ? await handler(payload) : { ok: false, error: `No mock for ${endpoint}` };
    return { json: async () => clone(body) };
};

const PARAMS = new URLSearchParams(location.search);

const MOCK_HUD = {
    label: 'Fleeca Legion Square',
    alarm: PARAMS.get('alarm') || 'raised',
    startedAt: Math.floor(Date.now() / 1000) - 232,
    serverTime: Math.floor(Date.now() / 1000),
    escapeDeadline: Math.floor(Date.now() / 1000) + 188,
    objectives: [
        { id: 'camera_1', label: 'Kill the cameras', state: 'done', optional: true },
        { id: 'hack_1', label: 'Door panel', state: 'done' },
        { id: 'keypad_1', label: 'Vault keypad', state: 'done' },
        { id: 'tool_1', label: 'Burn the gate', state: 'done' },
        { id: 'container_1', label: 'Deposit boxes 1', state: 'open' },
        { id: 'container_3', label: 'Cash trolley', state: 'open', optional: true },
        { id: 'escape_1', label: 'Getaway', state: 'locked' },
    ],
};

window.addEventListener('DOMContentLoaded', () => {
    if (PARAMS.has('mg')) {
        setTimeout(() => window.postMessage({ action: 'minigame', kind: PARAMS.get('mg'), difficulty: parseInt(PARAMS.get('d') || '2', 10) }, '*'), 120);
        return;
    }

    if (PARAMS.has('hud')) {
        setTimeout(() => window.postMessage({ action: 'hud', data: MOCK_HUD }, '*'), 120);
        return;
    }

    setTimeout(() => {
        window.postMessage({
            action: 'open',
            data: {
                ok: true,
                admin: true,
                framework: 'qbox',
                inventory: 'ox_inventory',
                target: 'ox_target',
                dispatch: 'ps-dispatch',
                doorlock: 'ox_doorlock',
                mdt: 'generic',
                version: '1.0.0',
                stageTypes: CATALOGUE.stageTypes,
                minigames: CATALOGUE.minigames,
                accounts: CATALOGUE.accounts,
                dirtyItem: CATALOGUE.dirtyItem,
                items: MOCK_ITEMS,
                defaults: {},
                robberies: mockList(),
                locations: clone(MOCK.locations),
                loot: clone(MOCK.loot),
                settings: clone(MOCK_SETTINGS),
            },
        }, '*');

        const job = PARAMS.get('job');
        if (job) {
            setTimeout(async () => {
                const sel = PARAMS.get('sel');
                await openJob(job, { tab: PARAMS.get('tab') || 'plan', select: sel ? { kind: PARAMS.get('kind') || 'stage', id: /^\d+$/.test(sel) ? Number(sel) : sel } : null });
            }, 120);
        } else if (PARAMS.get('view')) {
            setTimeout(() => showServer(PARAMS.get('view')), 120);
        }
    }, 60);
});
