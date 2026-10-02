const JOB_TYPES = [
    { id: 'store',   label: 'Store',   icon: 'store',   colour: [57, 212, 155],  blurb: 'Tills, a back-room safe, a clerk behind the counter.' },
    { id: 'atm',     label: 'ATM',     icon: 'atm',     colour: [90, 162, 255],  blurb: 'Every ATM of a model becomes robbable. Nothing to stamp.' },
    { id: 'bank',    label: 'Bank',    icon: 'bank',    colour: [255, 195, 90],  blurb: 'Security, a vault door, a code, the vault, the getaway.' },
    { id: 'jewelry', label: 'Jewelry', icon: 'jewelry', colour: [169, 139, 255], blurb: 'Display cases to smash, an alarm panel, a back safe.' },
    { id: 'house',   label: 'House',   icon: 'house',   colour: [124, 196, 255], blurb: 'Break in, search the rooms, find the safe.' },
    { id: 'vehicle', label: 'Vehicle', icon: 'vehicle', colour: [255, 93, 115],  blurb: 'An armoured truck or any vehicle model. Every one on the road.' },
    { id: 'custom',  label: 'Other',   icon: 'custom',  colour: [143, 161, 198], blurb: 'Start blank and add exactly the steps you want.' },
];

const GROUPS = {
    entry:   { label: 'Getaway',  colour: [169, 139, 255] },
    tool:    { label: 'Tools',    colour: [255, 195, 90] },
    puzzle:  { label: 'Puzzles',  colour: [90, 162, 255] },
    loot:    { label: 'Loot',     colour: [57, 212, 155] },
    people:  { label: 'People',   colour: [255, 93, 115] },
    control: { label: 'Security', colour: [124, 196, 255] },
};

const VAULT_DOORS = [
    { model: 'v_ilev_gb_vauldr', label: 'Fleeca vault door', angle: -90 },
    { model: 'v_ilev_bk_vaultdoor', label: 'Pacific Standard vault door', angle: -90 },
    { model: 'v_ilev_cbankvauldoor01', label: 'Paleto vault door', angle: 85 },
];

function knownDoor(model) {
    if (model === undefined || model === null || model === '') return null;
    const hash = /^-?\d+$/.test(String(model)) ? Number(model) >>> 0 : joaat(model);
    return VAULT_DOORS.find(d => joaat(d.model) === hash) || null;
}

function doorFromPick(res) {
    const door = { model: res.pick.model, x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h };
    const id = res.pick.doorId;
    if (id !== undefined && id !== null && id !== '') door.id = id;

    const known = knownDoor(door.model);
    if (known) {
        door.label = known.label;
        door.action = 'swing';
        door.angle = known.angle;
    } else if (door.id !== undefined) {
        door.action = 'unlock';
    } else {
        door.action = 'swing';
        door.angle = 90;
    }
    return door;
}

const LOOT_TYPES = ['register', 'safe', 'container'];
const ZONE_TYPES = ['escape', 'hold'];

function jobType(id) {
    return JOB_TYPES.find(t => t.id === id) || JOB_TYPES[JOB_TYPES.length - 1];
}

function stageType(id) {
    return (State.stageTypes || []).find(t => t.id === id) || null;
}

function stageColour(stage) {
    const t = stageType(stage && stage.type);
    return t && t.colour ? t.colour : [90, 162, 255];
}

function stageLabel(stage) {
    if (!stage) return '';
    return (stage.opts && stage.opts.label) || stage.label || stage.id;
}

function stageIndex(job, id) {
    return (job.stages || []).findIndex(s => s.id === id);
}

function jobOrigin(job) {
    if (job.origin && job.origin.x !== undefined) return job.origin;
    const first = (job.stages || [])[0];
    return first && first.coords ? first.coords : null;
}

function anchorKind(job) {
    return (job.anchor && job.anchor.kind) || 'location';
}

function nextId(list, prefix) {
    let n = 1;
    while (list.some(s => s.id === `${prefix}_${n}`)) n++;
    return `${prefix}_${n}`;
}

function normalisePayout(payout) {
    payout = payout || {};
    if (payout.cash || payout.items) {
        return { cash: payout.cash || null, items: payout.items || [], lootTable: payout.lootTable || '' };
    }
    const hasCash = (payout.max || 0) > 0 || (payout.min || 0) > 0;
    return {
        cash: hasCash ? { account: payout.account || 'job', min: payout.min || 0, max: payout.max || 0 } : null,
        items: [],
        lootTable: payout.lootTable || '',
    };
}

function grabsOf(stage) {
    return stage.type === 'container' ? Math.max(1, Number(stage.opts && stage.opts.grabs) || 1) : 1;
}

function stageTake(stage) {
    const reward = normalisePayout(stage.payout);
    if (!reward.cash) return { min: 0, max: 0 };
    const n = grabsOf(stage);
    return { min: (Number(reward.cash.min) || 0) * n, max: (Number(reward.cash.max) || 0) * n };
}

function jobTake(job) {
    let min = 0, max = 0;
    (job.stages || []).forEach(s => {
        if (s.enabled === false) return;
        const t = stageTake(s);
        if (s.opts && s.opts.optional) { max += t.max; return; }
        min += t.min;
        max += t.max;
    });
    return { min, max };
}

function stageSeconds(stage) {
    const o = stage.opts || {};
    if (stage.type === 'container') return (Number(o.grabTime) || 4) * grabsOf(stage);
    if (stage.type === 'twoman') return Number(o.holdTime) || 6;
    if (stage.type === 'escape') return 0;
    if (stage.type === 'guard') return 15;
    return Number(o.duration) || 10;
}

function depthColumns(stages) {
    const byId = new Map(stages.map(s => [s.id, s]));
    const depth = new Map();
    let changed = true;
    let guard = 0;

    while (changed && guard < 60) {
        changed = false;
        guard++;
        for (const stage of stages) {
            const req = (stage.requires || []).filter(id => byId.has(id));
            if (!req.every(id => depth.has(id))) continue;
            const value = req.length === 0 ? 0 : Math.max(...req.map(id => depth.get(id))) + 1;
            if (depth.get(stage.id) !== value) { depth.set(stage.id, value); changed = true; }
        }
    }

    const looped = stages.filter(s => !depth.has(s.id));
    const deepest = depth.size ? Math.max(...depth.values()) : -1;
    looped.forEach(s => depth.set(s.id, deepest + 1));

    const columns = [];
    for (const stage of stages) {
        const d = depth.get(stage.id);
        (columns[d] = columns[d] || []).push(stage);
    }
    return { columns: columns.filter(Boolean), looped: new Set(looped.map(s => s.id)), depth };
}

function runEstimate(job) {
    const stages = (job.stages || []).filter(s => s.enabled !== false);
    const byId = new Map(stages.map(s => [s.id, s]));
    const finish = new Map();
    const start = new Map();

    const visit = (s, trail = new Set()) => {
        if (finish.has(s.id)) return finish.get(s.id);
        if (trail.has(s.id)) return 0;
        trail.add(s.id);
        const deps = (s.requires || []).map(id => byId.get(id)).filter(Boolean);
        const begin = deps.length ? Math.max(...deps.map(d => visit(d, trail))) : 0;
        start.set(s.id, begin);
        const end = begin + stageSeconds(s);
        finish.set(s.id, end);
        return end;
    };

    stages.forEach(s => visit(s));

    const required = stages.filter(s => !(s.opts && s.opts.optional));
    const total = required.length ? Math.max(...required.map(s => finish.get(s.id) || 0)) : 0;

    const response = job.response || {};
    const mode = response.alarm || 'instant';
    let alarm = null;
    if (mode === 'instant' || mode === 'silent') alarm = 0;
    else if (mode === 'delayed') alarm = Number(response.alarmDelay) || 30;

    stages.forEach(s => {
        if (s.opts && s.opts.notifyPolice) {
            const at = start.get(s.id) || 0;
            if (alarm === null || at < alarm) alarm = at;
        }
    });

    return { total, alarm, silent: mode === 'silent', start, finish };
}

function alarmText(job) {
    const r = job.response || {};
    const mode = r.alarm || 'instant';
    if (mode === 'instant') return 'The alarm goes the moment they start.';
    if (mode === 'delayed') return `The alarm goes ${r.alarmDelay || 30}s after they start.`;
    if (mode === 'silent') return 'Silent alarm: police are told, nobody hears it.';
    return 'No alarm. Only steps set to alert police call it in.';
}

function jobChecklist(job, locations) {
    const stages = job.stages || [];
    const placed = stages.filter(s => s.coords).length;
    const paying = stages.some(s => {
        const r = normalisePayout(s.payout);
        return (r.cash && r.cash.max > 0) || r.items.length > 0 || r.lootTable;
    });
    const kind = anchorKind(job);
    const anchored = kind === 'model' ? ((job.anchor && job.anchor.models) || []).length > 0 : (locations || []).length > 0;

    return [
        { done: stages.length > 0 && placed === stages.length, label: stages.length ? `Every step placed (${placed} of ${stages.length})` : 'Add the first step', go: 'plan' },
        { done: anchored, label: kind === 'model' ? 'Pick the model it lives on' : 'Placed somewhere in the world', go: 'places' },
        { done: paying, label: 'Something worth taking', go: 'loot' },
        { done: !!job.enabled, label: 'Switched live', go: 'live' },
    ];
}

const PROP_CATALOGUE = [
    { group: 'Loot', model: 'hei_prop_hei_cash_trolly_01', label: 'Cash trolley', swap: 'hei_prop_hei_cash_trolly_03' },
    { group: 'Loot', model: 'ch_prop_gold_trolly_01a', label: 'Gold trolley', swap: 'hei_prop_hei_cash_trolly_03' },
    { group: 'Loot', model: 'hei_prop_hei_cash_trolly_03', label: 'Empty trolley' },
    { group: 'Loot', model: 'h4_prop_h4_cash_stack_01a', label: 'Cash stack' },
    { group: 'Loot', model: 'h4_prop_h4_gold_stack_01a', label: 'Gold stack' },
    { group: 'Loot', model: 'prop_cash_pile_01', label: 'Cash pile' },
    { group: 'Loot', model: 'ex_prop_exec_cashpile', label: 'Cash pile, large' },
    { group: 'Loot', model: 'prop_money_bag_01', label: 'Money bag' },
    { group: 'Loot', model: 'prop_cash_case_02', label: 'Cash case' },
    { group: 'Security', model: 'prop_ld_keypad_01', label: 'Keypad' },
    { group: 'Security', model: 'hei_prop_hst_laptop', label: 'Hacking laptop' },
    { group: 'Security', model: 'prop_laptop_01a', label: 'Laptop' },
    { group: 'Security', model: 'prop_cctv_cam_01a', label: 'CCTV camera' },
    { group: 'Security', model: 'prop_ld_int_safe_01', label: 'Small safe' },
    { group: 'Security', model: 'p_v_43_safe_s', label: 'Floor safe' },
    { group: 'Gear', model: 'hei_prop_heist_drill', label: 'Drill' },
    { group: 'Gear', model: 'hei_prop_heist_thermite', label: 'Thermite charge' },
    { group: 'Gear', model: 'hei_p_m_bag_var22_arm_s', label: 'Duffel bag' },
    { group: 'Gear', model: 'prop_tool_box_04', label: 'Toolbox' },
    { group: 'Gear', model: 'prop_box_wood02a', label: 'Wooden crate' },
    { group: 'Gear', model: 'prop_mil_crate_01', label: 'Military crate' },
];

const KNOWN_MODELS = [
    'prop_atm_01', 'prop_atm_02', 'prop_atm_03', 'prop_fleeca_atm',
    'stockade', 'stockade3', 'gburrito', 'gburrito2', 'pounder', 'mule', 'boxville',
].concat(PROP_CATALOGUE.map(p => p.model));

function modelName(model) {
    if (model === undefined || model === null || model === '') return '';
    if (typeof model === 'string' && !/^-?\d+$/.test(model)) return model;
    const hash = toUnsigned(model);
    const found = KNOWN_MODELS.find(m => joaat(m) === hash);
    return found || `0x${hash.toString(16).toUpperCase().padStart(8, '0')}`;
}

function propLabel(prop) {
    if (prop.label) return prop.label;
    const known = PROP_CATALOGUE.find(p => p.model === prop.model);
    return known ? known.label : (prop.model || 'Prop');
}

const NPC_CATALOGUE = [
    { group: 'Staff', model: 'mp_m_shopkeep_01', label: 'Shopkeeper' },
    { group: 'Staff', model: 's_f_y_shop_mid', label: 'Shop assistant' },
    { group: 'Staff', model: 'u_m_m_bankman', label: 'Bank manager' },
    { group: 'Staff', model: 'a_f_y_business_01', label: 'Teller' },
    { group: 'Staff', model: 'a_m_y_business_01', label: 'Clerk' },
    { group: 'Staff', model: 's_f_m_shop_high', label: 'Jeweller' },
    { group: 'Security', model: 's_m_m_security_01', label: 'Security guard' },
    { group: 'Security', model: 's_m_m_armoured_01', label: 'Armoured guard' },
    { group: 'Security', model: 's_m_m_highsec_01', label: 'Bodyguard' },
    { group: 'Customers', model: 'a_m_m_bevhills_01', label: 'Customer, man' },
    { group: 'Customers', model: 'a_f_m_bevhills_01', label: 'Customer, woman' },
    { group: 'Customers', model: 'a_f_y_hipster_01', label: 'Young woman' },
    { group: 'Customers', model: 'a_m_y_hipster_01', label: 'Young man' },
    { group: 'Customers', model: 'a_f_y_tourist_01', label: 'Tourist' },
];

const SCENARIOS = [
    { value: '', label: 'Just standing' },
    { value: 'WORLD_HUMAN_STAND_IMPATIENT', label: 'Waiting' },
    { value: 'WORLD_HUMAN_STAND_MOBILE', label: 'On the phone' },
    { value: 'WORLD_HUMAN_CLIPBOARD', label: 'Clipboard' },
    { value: 'WORLD_HUMAN_GUARD_STAND', label: 'Guard stance' },
    { value: 'WORLD_HUMAN_AA_COFFEE', label: 'Coffee' },
    { value: 'WORLD_HUMAN_SMOKING', label: 'Smoking' },
    { value: 'WORLD_HUMAN_LEANING', label: 'Leaning' },
    { value: 'WORLD_HUMAN_HANG_OUT_STREET', label: 'Hanging out' },
    { value: 'WORLD_HUMAN_TOURIST_MAP', label: 'Reading a map' },
];

const REACTIONS = [
    { value: 'cower', label: 'Hands up' },
    { value: 'flee', label: 'Run off' },
    { value: 'none', label: 'Ignore it' },
];

function npcLabel(npc) {
    if (npc.label) return npc.label;
    const known = NPC_CATALOGUE.find(p => p.model === npc.model);
    return known ? known.label : (npc.model || 'NPC');
}

KNOWN_MODELS.push(...NPC_CATALOGUE.map(n => n.model));
