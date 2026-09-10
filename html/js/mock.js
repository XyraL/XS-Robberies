// Browser-only preview harness. Not shipped in fxmanifest.
// Mirrors shared/stages.lua and shared/minigames.lua closely enough to lay the
// panels out with realistic data.

const COMMON = [
    { key: 'label',        label: 'Name',           type: 'text',   default: '' },
    { key: 'duration',     label: 'Duration',       type: 'number', default: 10, min: 1, max: 900, unit: 's' },
    { key: 'requiredItem', label: 'Required item',  type: 'item',   default: '' },
    { key: 'consumeItem',  label: 'Consume it',     type: 'toggle', default: false },
    { key: 'itemDamage',   label: 'Item wear',      type: 'number', default: 0, min: 0, max: 100, unit: '%', advanced: true },
    { key: 'optional',     label: 'Optional stage', type: 'toggle', default: false, advanced: true },
    { key: 'notifyPolice', label: 'Alert police',   type: 'toggle', default: false, advanced: true },
    { key: 'prop',         label: 'Prop model',     type: 'text',   default: '', advanced: true, hint: 'Spawned at the point and used as the thing you target. Leave empty for an invisible marker.' },
    { key: 'propZ',        label: 'Prop height',    type: 'number', default: 0, min: -5, max: 5, unit: 'm', advanced: true },
    { key: 'handProp',     label: 'Held prop',      type: 'text',   default: '', advanced: true, hint: 'Put in their right hand while they work. A drill, a crowbar, a laptop.' },
    { key: 'animDict',     label: 'Animation dict', type: 'text',   default: '', advanced: true, hint: 'Leave both empty to use the one that fits the stage type.' },
    { key: 'animClip',     label: 'Animation clip', type: 'text',   default: '', advanced: true },
    { key: 'difficulty',   label: 'Difficulty',     type: 'select', default: '2', advanced: true, options: [
        { value: '1', label: 'Easy' },
        { value: '2', label: 'Normal' },
        { value: '3', label: 'Hard' },
    ] },
    { key: 'animFlag', label: 'Animation flag', type: 'number', default: 16, min: 0, max: 63, advanced: true, hint: '16 plays it once and holds. 1 loops. 49 loops on the upper body only.' },
    { key: 'scenario', label: 'Scenario', type: 'text', default: '', advanced: true, hint: 'Used instead of a dict and clip. WORLD_HUMAN_WELDING, WORLD_HUMAN_HAMMERING.' },
    { key: 'handBone', label: 'Held prop bone', type: 'number', default: 57005, min: 0, max: 65535, advanced: true },
    { key: 'handOffset', label: 'Held prop offset', type: 'text', default: '', advanced: true },
    { key: 'progressStyle', label: 'Progress style', type: 'select', default: 'circle', advanced: true, options: [{ value: 'circle', label: 'Circle' }, { value: 'bar', label: 'Bar' }] },
    { key: 'freezePlayer', label: 'Hold them still', type: 'toggle', default: true, advanced: true },
    { key: 'canCancel', label: 'Can be cancelled', type: 'toggle', default: true, advanced: true },
    { key: 'loudness', label: 'Heard from', type: 'number', default: 0, min: 0, max: 300, unit: 'm', advanced: true },
    { key: 'penalty', label: 'Punish a failure with', type: 'select', default: 'none', advanced: true, options: [
        { value: 'none', label: 'Nothing' }, { value: 'shock', label: 'Electric shock' },
        { value: 'fire', label: 'Set them alight' }, { value: 'gas', label: 'Gas cloud' },
        { value: 'explosion', label: 'Explosion' },
    ] },
    { key: 'loseItemChance', label: 'Chance to lose the item', type: 'number', default: 0, min: 0, max: 100, unit: '%', advanced: true },
    { key: 'onFail',       label: 'On failure',     type: 'select', default: 'retry', advanced: true, options: [
        { value: 'retry', label: 'Let them retry' },
        { value: 'escalate', label: 'Escalate response' },
        { value: 'fail', label: 'Fail the run' },
    ] },
];

const TYPES = [
    ['hack', 'Hack', [76,154,255], 'A minigame point. Terminals, alarm panels, security consoles.', [
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:signal_lock' },
        { key: 'attempts', label: 'Attempts', type: 'number', default: 3, min: 1, max: 10 },
        { key: 'revealCode', label: 'Reveals a code', type: 'number', default: 0, min: 0, max: 8, advanced: true, hint: 'How many digits. 0 for none. A keypad elsewhere can ask for it.' },
    ]],
    ['tool', 'Tool action', [245,165,36], 'A timed action gated on an item. Lockpick, drill, thermite, grinder, torch.', [
        { key: 'toolKind', label: 'Tool', type: 'select', default: 'drill', options: [
            { value: 'lockpick', label: 'Lockpick' }, { value: 'drill', label: 'Drill' },
            { value: 'thermite', label: 'Thermite' }, { value: 'grinder', label: 'Angle grinder' },
            { value: 'torch', label: 'Cutting torch' }, { value: 'crowbar', label: 'Crowbar' },
        ] },
        { key: 'minigame', label: 'Skill check', type: 'minigame', default: 'none' },
        { key: 'loudness', label: 'Heard from', type: 'number', default: 0, min: 0, max: 200, unit: 'm', advanced: true },
    ]],
    ['keypad', 'Keypad', [76,154,255], 'A code entry. The code comes from another stage, so the crew has to split up.', [
        { key: 'digits', label: 'Code length', type: 'number', default: 4, min: 3, max: 8 },
        { key: 'codeFrom', label: 'Code found at', type: 'stage', default: '' },
        { key: 'attempts', label: 'Attempts', type: 'number', default: 3, min: 1, max: 10 },
    ]],
    ['camera', 'Camera / security', [168,130,255], 'Disable to change what the alarm does.', [
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:wire_trace' },
    ]],
    ['power', 'Power box', [168,130,255], 'Cuts power. Kills interior lights and can soften the alarm.', [
        { key: 'killLights', label: 'Darken interior', type: 'toggle', default: true },
        { key: 'shockRisk', label: 'Shock on failure', type: 'toggle', default: true, advanced: true },
    ]],
    ['register', 'Register', [48,209,88], 'A fast grab for a small payout.', [
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:tumbler' },
        { key: 'restock', label: 'Restocks after', type: 'number', default: 1800, min: 0, max: 86400, unit: 's' },
    ]],
    ['safe', 'Safe / vault', [48,209,88], 'Long, loud, and worth it.', [
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:circuit' },
        { key: 'restock', label: 'Restocks after', type: 'number', default: 7200, min: 0, max: 86400, unit: 's' },
        { key: 'revealCode', label: 'Reveals a code', type: 'number', default: 0, min: 0, max: 8, advanced: true, hint: 'How many digits. 0 for none. A keypad elsewhere can ask for it.' },
    ]],
    ['container', 'Loot container', [48,209,88], 'Grab into a bag, one handful at a time, up to a weight limit.', [
        { key: 'grabs', label: 'Grabs available', type: 'number', default: 6, min: 1, max: 40 },
        { key: 'grabTime', label: 'Per grab', type: 'number', default: 4, min: 1, max: 60, unit: 's' },
        { key: 'needsBag', label: 'Requires a bag', type: 'toggle', default: false, advanced: true },
    ]],
    ['twoman', 'Two-man point', [168,130,255], 'Two players must hold it at the same time.', [
        { key: 'pairWith', label: 'Paired with', type: 'stage', default: '' },
        { key: 'holdTime', label: 'Hold for', type: 'number', default: 6, min: 1, max: 120, unit: 's' },
    ]],
    ['hostage', 'Hostage / clerk', [255,90,95], 'Intimidate whoever is behind the counter.', [
        { key: 'ped', label: 'Ped model', type: 'text', default: 'mp_m_shopkeep_01' },
        { key: 'needsAim', label: 'Requires aiming', type: 'toggle', default: true },
        { key: 'stallFor', label: 'Stalls alert', type: 'number', default: 60, min: 0, max: 600, unit: 's' },
        { key: 'panicChance', label: 'Panic chance', type: 'number', default: 15, min: 0, max: 100, unit: '%', advanced: true },
    ]],
    ['hold', 'Hold point', [168,130,255], 'Stand here while a timer runs.', [
        { key: 'radius', label: 'Radius', type: 'number', default: 3.0, min: 1, max: 30, unit: 'm' },
        { key: 'breakOnLeave', label: 'Resets if you leave', type: 'toggle', default: true },
    ]],
    ['doorlock', 'Door', [168,130,255], 'Unlocks a door in your door lock resource.', [
        { key: 'doorId', label: 'Door id', type: 'text', default: '' },
        { key: 'doorAction', label: 'Do what', type: 'select', default: 'unlock', options: [
            { value: 'unlock', label: 'Unlock it' }, { value: 'lock', label: 'Lock it' },
        ] },
        { key: 'relockOnEnd', label: 'Put it back when the run ends', type: 'toggle', default: true },
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:signal_lock' },
        { key: 'attempts', label: 'Attempts', type: 'number', default: 3, min: 1, max: 10 },
    ]],
    ['guard', 'Armed guard', [255,90,95], 'A guard who fights back. Done when they are down.', [
        { key: 'ped', label: 'Ped model', type: 'text', default: 's_m_m_security_01' },
        { key: 'weapon', label: 'Weapon', type: 'text', default: 'WEAPON_PISTOL' },
        { key: 'accuracy', label: 'Accuracy', type: 'number', default: 40, min: 1, max: 100, unit: '%' },
        { key: 'guardHealth', label: 'Health', type: 'number', default: 200, min: 100, max: 1000 },
        { key: 'armour', label: 'Armour', type: 'number', default: 0, min: 0, max: 100 },
        { key: 'hostile', label: 'Starts hostile', type: 'toggle', default: false },
        { key: 'alertOnDeath', label: 'Killing them calls it in', type: 'toggle', default: true },
        { key: 'guardScenario', label: 'Idle scenario', type: 'text', default: 'WORLD_HUMAN_GUARD_STAND', advanced: true },
    ]],
    ['laser', 'Laser grid', [168,130,255], 'Beams across a doorway. Cross them and the alarm goes.', [
        { key: 'span', label: 'Width', type: 'number', default: 2.0, min: 0.5, max: 12, unit: 'm' },
        { key: 'beams', label: 'Beams', type: 'number', default: 4, min: 1, max: 12 },
        { key: 'tripAlarm', label: 'Crossing it trips the alarm', type: 'toggle', default: true },
        { key: 'minigame', label: 'Minigame', type: 'minigame', default: 'cipher:frequency' },
        { key: 'attempts', label: 'Attempts', type: 'number', default: 2, min: 1, max: 10 },
    ]],
    ['escape', 'Escape zone', [25,229,140], 'Where the run resolves and everything pays out.', [
        { key: 'radius', label: 'Radius', type: 'number', default: 25.0, min: 5, max: 300, unit: 'm' },
        { key: 'inVehicle', label: 'Must be in a vehicle', type: 'toggle', default: false },
        { key: 'timeLimit', label: 'Time limit', type: 'number', default: 0, min: 0, max: 3600, unit: 's', advanced: true },
    ]],
];

const stageTypes = TYPES.map(([id, label, colour, blurb, fields]) => ({
    id, label, colour, blurb, fields: COMMON.concat(fields),
}));

const minigames = [
    { id: 'none', label: 'None', provider: 'cipher', blurb: 'Just the timer. No skill check.', available: true },
    { id: 'cipher:signal_lock', label: 'Signal Lock', provider: 'cipher', blurb: 'Hold a drifting carrier inside the band until it locks.', available: true },
    { id: 'cipher:circuit', label: 'Circuit Routing', provider: 'cipher', blurb: 'Route power across a grid before the breaker trips.', available: true },
    { id: 'cipher:tumbler', label: 'Tumbler', provider: 'cipher', blurb: 'Feel out each pin and set it.', available: true },
    { id: 'cipher:sequence', label: 'Sequence Recall', provider: 'cipher', blurb: 'Watch a pattern, repeat it back.', available: true },
    { id: 'cipher:frequency', label: 'Frequency Match', provider: 'cipher', blurb: 'Tune two waves until they overlap.', available: true },
    { id: 'cipher:wire_trace', label: 'Wire Trace', provider: 'cipher', blurb: 'Follow one wire through a tangle.', available: true },
    { id: 'cipher:thermite', label: 'Thermite', provider: 'cipher', blurb: 'A pattern lights up on the grid. Watch it, then put it back.', available: true },
    { id: 'cipher:fingerprint', label: 'Fingerprint', provider: 'cipher', blurb: 'One print matches the one on file. The rest are close.', available: true },
    { id: 'cipher:drill', label: 'Drill', provider: 'cipher', blurb: 'Lean on it and ease off. Push too hard and the bit burns out.', available: true },
    { id: 'cipher:pinpad', label: 'Pin Pad', provider: 'cipher', blurb: 'Crack a combination with hot and cold feedback.', available: true },
    { id: 'cipher:bypass', label: 'Bypass', provider: 'cipher', blurb: 'Stop a running cursor inside each gate, in order.', available: true },
    { id: 'cipher:sweep', label: 'Sweep', provider: 'cipher', blurb: 'Hit the sweep as it crosses the contact.', available: true },
    { id: 'ox_lib:skillcheck', label: 'ox_lib Skill Check', provider: 'ox_lib', resource: 'ox_lib', blurb: 'The standard ox_lib timed key press.', available: true },
    { id: 'ps-ui:circle', label: 'ps-ui Circle', provider: 'ps-ui', resource: 'ps-ui', blurb: 'Timed circle click.', available: false },
    { id: 'ps-ui:thermite', label: 'ps-ui Thermite', provider: 'ps-ui', resource: 'ps-ui', blurb: 'Memorise a grid and reproduce it.', available: false },
    { id: 'memorygame:start', label: 'Memory Game', provider: 'memorygame', resource: 'memorygame', blurb: 'Match pairs against a clock.', available: false },
];

const bulk = Array.from({length:1400},(_,n)=>({name:'filler_item_'+n,label:'Filler Item '+n}));
const items = [
    { name: 'lockpick', label: 'Lockpick' },
    { name: 'advancedlockpick', label: 'Advanced Lockpick' },
    { name: 'drill', label: 'Drill' },
    { name: 'thermite', label: 'Thermite' },
    { name: 'trojan_usb', label: 'Trojan USB' },
    { name: 'security_card_01', label: 'Security Card A' },
    { name: 'markedbills', label: 'Marked Bills' },
    { name: 'goldchain', label: 'Gold Chain' },
    { name: 'rolex', label: 'Rolex' },
].concat(bulk);

const SETTINGS = [
        { key: 'payoutMultiplier', label: 'Payout multiplier', kind: 'number', min: 0, max: 20, step: 0.05, value: 1, fromConfig: true },
        { key: 'payoutOnEscape', label: "Hold each robber's money until the crew escapes", kind: 'toggle', value: true, fromConfig: false },
        { key: 'respectDuty', label: 'Off-duty police and EMS may rob', kind: 'toggle', value: false, fromConfig: true },
        { key: 'logRuns', label: 'Write finished runs to history', kind: 'toggle', value: true, fromConfig: true },
        { key: 'abandonAfter', label: 'Abandon a run after', kind: 'number', min: 60, max: 7200, unit: 's', value: 600, fromConfig: true },
        { key: 'theme', label: 'Panel theme', kind: 'choice', options: ['emerald','amber','violet','rose','ice','gold'], value: 'emerald', fromConfig: true },
    ];

const DB = {
    settings: SETTINGS,
    robberies: [
        { id: 'store_247', name: '24-7 Store', category: 'store', enabled: true, revision: 7, stageCount: 5, author: 'Alex' },
        { id: 'fleeca', name: 'Fleeca Bank', category: 'bank', enabled: true, revision: 3, stageCount: 8, author: 'Alex' },
        { id: 'vangelico', name: 'Vangelico Jewelry', category: 'jewelry', enabled: false, revision: 1, stageCount: 6, author: 'Alex' },
    ],
    locations: [
        { id: 1, robberyId: 'store_247', label: '24-7 Grove Street', enabled: true, origin: { x: 25.7, y: -1346.9, z: 29.5, h: 180.0 },
          offsets: { safe_1: { x: 0.4, y: -0.25, z: 0 } }, overrides: { payoutMultiplier: 1.4 } },
        { id: 2, robberyId: 'store_247', label: '24-7 Sandy Shores', enabled: true, origin: { x: 1961.4, y: 3740.6, z: 32.3, h: 300.0 } },
        { id: 3, robberyId: 'fleeca', label: 'Fleeca Legion Square', enabled: false, origin: { x: 147.0, y: -1044.0, z: 29.3, h: 340.0 } },
    ],
    loot: [
        { id: 'store_register', label: 'Store register', entries: [{ item: 'markedbills', min: 1, max: 3, chance: 60 }] },
        { id: 'jewelry_case', label: 'Jewelry case', entries: [
            { item: 'goldchain', min: 1, max: 4, chance: 80 },
            { item: 'rolex', min: 1, max: 2, chance: 35 },
        ] },
    ],
    full: {
        store_247: {
            id: 'store_247', name: '24-7 Store', category: 'store', enabled: true, revision: 7, radius: 30,
            gates: { policeRequired: 2, policeOnDuty: true, minCrew: 1, maxCrew: 4, locationCooldown: 1800, playerCooldown: 900 },
            response: { alarm: 'delayed', alarmDelay: 45, camerasChangeTo: 'silent', powerChangesTo: 'none', code: '10-90', title: 'Store Robbery', repeatAlert: 120, dispatchOnFail: true },
            stages: [
                { id: 'camera_1', type: 'camera', label: 'Back office cameras', coords: { x: 28.1, y: -1339.2, z: 29.5, h: 0 }, requires: [], payout: {}, opts: { label: 'Back office cameras', duration: 12, minigame: 'cipher:wire_trace', requiredItem: 'trojan_usb', consumeItem: true, optional: true, onFail: 'escalate' } },
                { id: 'hostage_1', type: 'hostage', label: 'Clerk', coords: { x: 24.9, y: -1346.1, z: 29.5, h: 90 }, requires: [], payout: {}, opts: { label: 'Clerk', duration: 6, ped: 'mp_m_shopkeep_01', needsAim: true, stallFor: 60, panicChance: 15, onFail: 'retry' } },
                { id: 'register_1', type: 'register', label: 'Front register', coords: { x: 25.4, y: -1347.3, z: 29.5, h: 90 }, requires: ['hostage_1'], payout: { account: 'cash', min: 400, max: 900, lootTable: 'store_register' }, opts: { label: 'Front register', duration: 14, minigame: 'cipher:tumbler', requiredItem: 'lockpick', consumeItem: false, restock: 1800, onFail: 'retry' } },
                { id: 'safe_1', type: 'safe', label: 'Back room safe', coords: { x: 28.6, y: -1341.0, z: 29.5, h: 180 }, requires: ['camera_1', 'register_1'], payout: { account: 'dirty', min: 1800, max: 4200, lootTable: '' }, opts: { label: 'Back room safe', duration: 55, minigame: 'cipher:circuit', requiredItem: 'drill', consumeItem: true, itemDamage: 40, restock: 7200, onFail: 'escalate' } },
                { id: 'escape_1', type: 'escape', label: 'Get clear', coords: { x: 60.2, y: -1390.4, z: 29.3, h: 0 }, requires: ['safe_1'], payout: {}, opts: { label: 'Get clear', duration: 1, radius: 60, inVehicle: false, timeLimit: 0, onFail: 'retry' } },
            ],
        },
    },
    runs: [
        { id: 9, robbery_id: 'store_247', name: '24-7 Store', started_at: '2026-09-06 21:04:11', outcome: 'completed', participants: ['ABC12345', 'DEF67890'], payout: 5400 },
        { id: 8, robbery_id: 'fleeca', name: 'Fleeca Bank', started_at: '2026-09-06 19:47:02', outcome: 'failed', participants: ['GHI11223'], payout: 0 },
        { id: 7, robbery_id: 'store_247', name: '24-7 Store', started_at: '2026-09-06 18:12:55', outcome: 'abandoned', participants: ['JKL44556'], payout: 900 },
    ],
};

const HANDLERS = {
    getRobbery: (id) => {
        const full = DB.full[id];
        if (!full) {
            const stub = DB.robberies.find(r => r.id === id);
            return { ok: true, robbery: Object.assign({ stages: [], gates: {}, response: {} }, stub), locations: [] };
        }
        return { ok: true, robbery: JSON.parse(JSON.stringify(full)), locations: DB.locations.filter(l => l.robberyId === id) };
    },
    saveRobbery: (def) => {
        DB.full[def.id] = def;
        const entry = DB.robberies.find(r => r.id === def.id);
        if (entry) { entry.stageCount = (def.stages || []).length; entry.name = def.name; entry.enabled = def.enabled; }
        return { ok: true, robbery: def, robberies: DB.robberies, issues: [] };
    },
    createRobbery: (p) => {
        const def = {
            id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: p.name, category: p.category,
            enabled: false, revision: 1, stages: [],
            gates: { policeRequired: 2, policeOnDuty: true, minCrew: 1, maxCrew: 6, locationCooldown: 1800, playerCooldown: 900 },
            response: { alarm: 'instant', alarmDelay: 30, camerasChangeTo: 'delayed', powerChangesTo: 'silent', code: '10-90', title: 'Robbery', repeatAlert: 120, dispatchOnFail: true },
        };
        DB.full[def.id] = def;
        DB.robberies.push({ id: def.id, name: def.name, category: def.category, enabled: false, revision: 1, stageCount: 0 });
        return { ok: true, robbery: def, robberies: DB.robberies };
    },
    deleteRobbery: (id) => {
        DB.robberies = DB.robberies.filter(r => r.id !== id);
        DB.locations = DB.locations.filter(l => l.robberyId !== id);
        return { ok: true, robberies: DB.robberies, locations: DB.locations };
    },
    duplicateRobbery: (p) => {
        const copy = Object.assign({}, DB.robberies.find(r => r.id === p.id), { id: `${p.id}_copy`, name: p.name });
        DB.robberies.push(copy);
        return { ok: true, robbery: copy, robberies: DB.robberies };
    },
    validateRobbery: () => ({ ok: true, issues: [
        { level: 'warn', message: 'Back office cameras pays out nothing.', stage: 'camera_1' },
    ] }),
    exportRobbery: (id) => ({ ok: true, json: JSON.stringify(DB.full[id] || {}, null, 2) }),
    importRobbery: () => ({ ok: false, error: 'Import is disabled in the preview.' }),
    saveLocation: (loc) => {
        if (loc.id) {
            const at = DB.locations.findIndex(l => l.id === loc.id);
            if (at >= 0) DB.locations[at] = Object.assign({}, DB.locations[at], loc);
        } else {
            loc.id = DB.locations.length + 1;
            DB.locations.push(loc);
        }
        return { ok: true, location: loc, locations: DB.locations, robberies: DB.robberies };
    },
    deleteLocation: (id) => {
        DB.locations = DB.locations.filter(l => l.id !== id);
        return { ok: true, locations: DB.locations, robberies: DB.robberies };
    },
    saveLoot: (t) => {
        const at = DB.loot.findIndex(x => x.id === t.id);
        if (at >= 0) DB.loot[at] = t; else DB.loot.push(t);
        return { ok: true, loot: DB.loot };
    },
    deleteLoot: (id) => {
        DB.loot = DB.loot.filter(t => t.id !== id);
        return { ok: true, loot: DB.loot };
    },
    presets: () => ({ ok: true, presets: [
            {
                    "id": "atm",
                    "name": "ATM",
                    "description": "Every cash machine in the state, from one design. Grind the face off with an angle grinder and empty the cassette. Loud, quick, and worth very little on its own.",
                    "alignedTo": "Nothing. It is anchored to the ATM prop models, so it finds all of them by itself. Nothing to stamp, nothing to place.",
                    "stageCount": 1,
                    "locationCount": 0,
                    "anchorKind": "model",
                    "models": [
                            "prop_atm_01",
                            "prop_atm_02",
                            "prop_atm_03",
                            "prop_fleeca_atm"
                    ],
                    "installed": false,
                    "missingItems": []
            },
            {
                    "id": "banktruck",
                    "name": "Bank Truck",
                    "description": "Every Stockade on the road. Torch the rear doors, take a guard with you if one is riding, then work the cash boxes out one at a time. Anchored to the vehicle, so it works wherever you find one.",
                    "alignedTo": "Nothing. It is anchored to the Stockade model, so it follows the van.",
                    "stageCount": 2,
                    "locationCount": 0,
                    "anchorKind": "model",
                    "models": [
                            "stockade"
                    ],
                    "installed": false,
                    "missingItems": []
            },
            {
                    "id": "fleeca",
                    "name": "Fleeca Bank",
                    "description": "Eleven stages and a crew of at least two. Cut the power or kill the cameras to buy quiet, hack the counter door, find the vault code on the manager's terminal, hold both release switches at once, then drill. Teller drawers are quick, the deposit boxes take six trips, and you leave by car on a clock.",
                    "alignedTo": "The Fleeca on Legion Square.",
                    "stageCount": 11,
                    "locationCount": 6,
                    "anchorKind": "location",
                    "models": [],
                    "installed": false,
                    "missingItems": []
            },
            {
                    "id": "jewelry",
                    "name": "Vangelico Jewelry",
                    "description": "A smash and grab. Gas the shop or cut the cameras, put the staff on the floor, then work the display cases one at a time while the clock runs. No cash at all — everything you take is goods you still have to sell.",
                    "alignedTo": "Vangelico on Portola Drive.",
                    "stageCount": 6,
                    "locationCount": 1,
                    "anchorKind": "location",
                    "models": [],
                    "installed": false,
                    "missingItems": [
                            "diamond_ring"
                    ]
            },
            {
                    "id": "pacific",
                    "name": "Pacific Standard",
                    "description": "The big one. Twelve stages, a crew of four, and every mechanic in the script: split objectives, a code hunt, paired release switches, thermite, a long carry and a hard clock on the way out. Build a night around it.",
                    "alignedTo": "The Pacific Standard on Vinewood Boulevard.",
                    "stageCount": 12,
                    "locationCount": 1,
                    "anchorKind": "location",
                    "models": [],
                    "installed": false,
                    "missingItems": []
            },
            {
                    "id": "paleto",
                    "name": "Blaine County Savings",
                    "description": "The one out of town. Nobody is coming quickly, so it is built long rather than tense: cut the power, torch the shutter, burn the vault open with thermite, then two of you carry the bags out while a third holds the door.",
                    "alignedTo": "Blaine County Savings in Paleto Bay.",
                    "stageCount": 9,
                    "locationCount": 1,
                    "anchorKind": "location",
                    "models": [],
                    "installed": false,
                    "missingItems": []
            },
            {
                    "id": "store_247",
                    "name": "24-7 Store",
                    "description": "Five stages. Silence the recorder to keep the alarm quiet, lean on the clerk to stall the response, empty the register for quick money, then take your time on the back room safe.",
                    "alignedTo": "The 24-7 on Grove Street.",
                    "stageCount": 6,
                    "locationCount": 20,
                    "anchorKind": "location",
                    "models": [],
                    "installed": false,
                    "missingItems": []
            }
    ] }),
    installPreset: (payload) => ({
        ok: true,
        stamped: payload.stampAll ? 20 : 0,
        robbery: { id: payload.id, name: payload.id, category: 'store', enabled: false, revision: 1, stages: [], gates: {}, response: {}, anchor: {} },
        robberies: DB.robberies,
        locations: DB.locations,
        loot: DB.loot,
        issues: [],
    }),
    history: () => ({ ok: true, runs: DB.runs }),
    saveTunables: (values) => ({ ok: true, settings: DB.settings.map(s => (values[s.key] === undefined ? s : Object.assign({}, s, { value: values[s.key], fromConfig: false }))) }),
    resolveLocation: (id) => {
        const loc = DB.locations.find(l => l.id === id) || DB.locations[0];
        const def = DB.full[loc.robberyId] || DB.full.store_247;
        return {
            ok: true,
            offsets: loc.offsets || {},
            overrides: loc.overrides || {},
            location: {
                id: loc.id,
                robberyId: loc.robberyId,
                name: def.name,
                label: loc.label,
                enabled: loc.enabled,
                origin: loc.origin,
                radius: def.radius,
                stages: (def.stages || []).map(s => ({
                    id: s.id, type: s.type, label: s.label, coords: s.coords,
                })),
            },
        };
    },
    live: () => ({ ok: true, killSwitch: false,
      blacklist: (DB.blacklist = DB.blacklist || { 'XYZ99887': 'Marisol Vega' }),
      runs: [
        { locationId: 1, name: '24-7 Store', location: '24-7 Grove Street', stage: '3 of 5 stages',
          alarm: 'raised', elapsed: 214, pot: 3400,
          participants: [{ citizenid: 'ABC12345', name: 'Isabel Ferreira' }, { citizenid: 'DEF67890', name: 'Callum Rhodes' }] },
      ] }),
    setEditorStages: () => ({ ok: true }),
    teleport: () => ({ ok: true }),
    close: () => ({ ok: true }),
    minigameResult: () => ({ ok: true }),
    beginPlacement: () => {
        const app = document.getElementById('app');
        app.classList.add('suspended');
        return new Promise(resolve => {
            setTimeout(() => {
                app.classList.remove('suspended');
                resolve({ ok: true, coords: {
                    x: Math.round((Math.random() * 200 - 100) * 10) / 10,
                    y: Math.round((Math.random() * 200 - 100) * 10) / 10,
                    z: 29.5, h: 0.0,
                } });
            }, 700);
        });
    },
    previewMinigame: () => {
        const app = document.getElementById('app');
        app.classList.add('suspended');
        return new Promise(resolve => {
            setTimeout(() => {
                app.classList.remove('suspended');
                resolve({ ok: true, passed: Math.random() > 0.35 });
            }, 600);
        });
    },
};

window.fetch = async (url, options) => {
    const endpoint = String(url).split('/').pop();
    const payload = options && options.body ? JSON.parse(options.body) : {};
    const handler = HANDLERS[endpoint];
    const body = handler ? await handler(payload) : { ok: false, error: `No mock for ${endpoint}` };
    return { json: async () => body };
};

const PARAMS = new URLSearchParams(location.search);

const MOCK_HUD = {
    label: '24-7 Grove Street',
    alarm: PARAMS.get('alarm') || 'pending',
    startedAt: Math.floor(Date.now() / 1000) - 96,
    serverTime: Math.floor(Date.now() / 1000),
    objectives: [
        { id: 'camera_1', label: 'Back office cameras', state: 'done', optional: true },
        { id: 'hostage_1', label: 'Clerk', state: 'done' },
        { id: 'register_1', label: 'Front register', state: 'open' },
        { id: 'safe_1', label: 'Back room safe', state: 'locked' },
        { id: 'escape_1', label: 'Get clear', state: 'locked' },
    ],
};

window.addEventListener('DOMContentLoaded', () => {
    if (PARAMS.has('mg')) {
        setTimeout(() => window.postMessage({
            action: 'minigame',
            kind: PARAMS.get('mg'),
            difficulty: parseInt(PARAMS.get('d') || '2', 10),
        }, '*'), 120);
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
                framework: 'qbox',
                inventory: 'ox_inventory',
                target: 'ox_target',
                dispatch: 'ps-dispatch',
                mdt: 'generic',
                stageTypes,
                minigames,
                items,
                accounts: [
                    { id: 'cash', label: 'Cash on hand' },
                    { id: 'bank', label: 'Bank' },
                    { id: 'dirty', label: 'Dirty cash (item)' },
                ],
                defaults: {},
                robberies: DB.robberies,
                locations: DB.locations,
                loot: DB.loot,
                settings: DB.settings,

            },
        }, '*');
    }, 60);
});
