const LOOK_KEYS = ['prop', 'propZ', 'propDone', 'propSwap', 'scenario', 'animDict', 'animClip', 'animFlag', 'handProp', 'handBone', 'handOffset', 'progressStyle'];

const Inspector = {
    moreOpen: false,
    lookOpen: false,
    typingDoor: false,
    resolved: {},

    render(el) {
        const item = selected();
        if (State.sel && !item) State.sel = null;

        if (!State.sel) return Inspector.job(el);
        if (State.sel.kind === 'stage') return Inspector.stage(el, item);
        if (State.sel.kind === 'prop') return Inspector.prop(el, item);
        if (State.sel.kind === 'npc') return Inspector.npc(el, item);
        if (State.sel.kind === 'place') return Inspector.place(el, item);
    },

    field(f, value, prefix = 'opts.') {
        const k = prefix + f.key;
        const v = value === undefined || value === null ? f.default : value;

        if (f.type === 'toggle') return fieldSwitch(k, f.label, v, { hint: f.hint, wide: true });
        if (f.type === 'number') return fieldNumber(k, f.label, v, { min: f.min, max: f.max, unit: f.unit, hint: f.hint });
        if (f.type === 'select') {
            const opts = f.options || [];
            const short = opts.length <= 3 && opts.every(o => o.label.length <= 12);
            return short ? fieldSeg(k, f.label, v, opts, { hint: f.hint, wide: true }) : fieldSelect(k, f.label, v, opts, { hint: f.hint });
        }
        if (f.type === 'minigame') {
            const groups = new Map();
            (State.minigames || []).forEach(m => {
                const g = m.id === 'none' ? '' : m.provider === 'xs' ? 'Built in' : (m.resource || m.provider);
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g).push(m);
            });
            const option = (m) => `<option value="${esc(m.id)}" ${m.id === v ? 'selected' : ''} ${m.available ? '' : 'disabled'}>${esc(m.label)}${m.available ? '' : ' (not running)'}</option>`;
            const list = [...groups.entries()].map(([g, items]) => g ? `<optgroup label="${esc(g)}">${items.map(option).join('')}</optgroup>` : items.map(option).join('')).join('');
            return `
                <div class="f wide">
                    <label>${esc(f.label)}</label>
                    <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                        <select class="sel" data-k="${esc(k)}">${list}</select>
                        <button class="btn sm" data-try-mg="${esc(k)}" title="Play it">${icon('play', 12)} Try</button>
                    </div>
                </div>`;
        }
        if (f.type === 'stage') {
            let others = (State.current.stages || []).filter(s => !State.sel || s.id !== State.sel.id);
            if (f.key === 'codeFrom') others = others.filter(s => !['escape', 'keypad'].includes(s.type));
            if (f.key === 'pairWith') others = others.filter(s => s.type === 'twoman');
            return fieldSelect(k, f.label, v, [{ value: '', label: f.none || 'None' }].concat(others.map(o => ({ value: o.id, label: stageLabel(o) }))), { hint: f.hint, wide: true });
        }
        if (f.type === 'item') {
            return `<div class="f wide"><label>${esc(f.label)}</label>${itemPicker(k, v, 'None needed')}${f.hint ? `<div class="fh">${esc(f.hint)}</div>` : ''}</div>`;
        }
        return fieldText(k, f.label, v, { hint: f.hint, wide: (f.key || '').length > 0 && ['prop', 'propSwap', 'handProp', 'scenario', 'animDict', 'animClip', 'handOffset', 'doorId', 'ped', 'weapon', 'guardScenario'].includes(f.key) });
    },

    stage(el, stage) {
        const job = State.current;
        const def = stageType(stage.type);
        const fields = def ? def.fields : [];
        const index = stageIndex(job, stage.id) + 1;
        const colour = stageColour(stage);

        const shown = (f) => !f.hidden && f.section !== 'doors' && !(stage.type === 'keypad' && f.key === 'minigame' && stage.opts.codeFrom);
        const basic = fields.filter(f => shown(f) && !f.advanced && !LOOK_KEYS.includes(f.key) && !['label', 'duration', 'requiredItem', 'consumeItem'].includes(f.key));
        const lootLook = LOOT_TYPES.includes(stage.type);
        const look = fields.filter(f => LOOK_KEYS.includes(f.key) && !(lootLook && ['propDone', 'propSwap'].includes(f.key)));
        const propBlock = `<div class="f wide"><label>Prop at this point</label>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input class="inp" data-k="opts.prop" value="${esc(stage.opts.prop || '')}" placeholder="Leave empty for none" spellcheck="false"><button class="btn sm" data-pick="opts.prop">${icon('prop', 12)} Pick</button></div>
                        <div class="fh">Spawned here and becomes the thing they interact with. A cash trolley, a gold stack.</div></div>`;
        const lootProp = lootLook ? propBlock + (stage.opts.prop ? fieldSeg('opts.propDone', 'When it is taken', stage.opts.propDone || 'keep', [{ value: 'keep', label: 'Leave it' }, { value: 'remove', label: 'Remove it' }, { value: 'swap', label: 'Swap it' }], { wide: true }) : '')
            + (stage.opts.prop && stage.opts.propDone === 'swap' ? `<div class="f wide"><label>Swap to</label>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input class="inp" data-k="opts.propSwap" value="${esc(stage.opts.propSwap || '')}" placeholder="hei_prop_hei_cash_trolly_03" spellcheck="false"><button class="btn sm" data-pick="opts.propSwap">${icon('prop', 12)} Pick</button></div></div>` : '') : '';
        const advanced = fields.filter(f => shown(f) && f.advanced && !LOOK_KEYS.includes(f.key) && !['optional', 'notifyPolice'].includes(f.key));
        const readers = (job.stages || []).filter(s => s.type === 'keypad' && s.opts && s.opts.codeFrom === stage.id);
        const doors = Array.isArray(stage.opts.doors) ? stage.opts.doors : [];
        const typing = Inspector.typingDoor || !!stage.opts.doorId;
        const timed = !['container', 'twoman', 'guard'].includes(stage.type);
        const others = (job.stages || []).filter(s => s.id !== stage.id);
        const pays = LOOT_TYPES.includes(stage.type) || stage.type === 'guard';
        if (pays) LootView.prep(stage);
        const reward = pays ? stage.payout : null;

        el.innerHTML = `
            <div class="ins-head" style="${colourVars(colour)}">
                <div class="num">${index}</div>
                <div class="grow">
                    <div class="k">${esc(def ? def.label : stage.type)}${stage.opts.optional ? ' · optional' : ''}</div>
                    <input class="title" data-k="opts.label" value="${esc(stageLabel(stage))}" spellcheck="false">
                </div>
            </div>
            <div class="ins-actions">
                <button class="btn" data-a="move">${icon('place', 13)} Move</button>
                <button class="btn" data-a="copy">${icon('copy', 13)} Copy</button>
                <button class="btn" data-a="goto">${icon('goto', 13)} Go to</button>
                <button class="btn danger" data-a="del">${icon('trash', 13)}</button>
            </div>
            ${!stage.coords ? `<div class="issue warn" style="margin-bottom:14px"><i>!</i><span>Not placed in the world yet. Use Move.</span></div>` : ''}
            ${stage.enabled === false ? `<div class="issue warn" style="margin-bottom:14px"><i>?</i><span>Switched off. It is not in the world and anything waiting on it carries on without it.</span></div>` : ''}
            <div class="hint" style="margin:-4px 0 14px">${esc(def ? def.blurb : '')}</div>
            ${readers.length ? `<div class="issue ok" style="margin-bottom:14px"><i>#</i><span>Gives the code for ${esc(readers.map(stageLabel).join(', '))}. Whoever finishes it sees the code, and so does the rest of the crew.</span></div>` : ''}

            <div class="sec">
                <div class="grid2">
                    ${timed ? Inspector.field({ key: 'duration', label: stage.type === 'hold' ? 'Hold for' : 'Takes', type: 'number', min: 1, max: 900, unit: 's', default: 10 }, stage.opts.duration) : ''}
                    ${basic.map(f => Inspector.field(f, stage.opts[f.key])).join('')}
                    ${lootProp}
                    ${Inspector.field({ key: 'requiredItem', label: 'Needs an item', type: 'item', default: '' }, stage.opts.requiredItem)}
                    ${stage.opts.requiredItem ? fieldSwitch('opts.consumeItem', 'Used up when done', stage.opts.consumeItem, { wide: true }) : ''}
                    ${fieldSwitch('opts.notifyPolice', 'Calls the police when started', stage.opts.notifyPolice, { wide: true })}
                    ${fieldSwitch('opts.optional', 'Optional', stage.opts.optional, { wide: true, hint: 'The job can finish without it.' })}
                </div>
            </div>

            <div class="sec">
                <div class="sec-title">Opens after</div>
                ${others.length ? `<div class="tags">${others.map(o => `<span class="tag ${(stage.requires || []).includes(o.id) ? 'on' : ''}" data-req="${esc(o.id)}">${stageIndex(job, o.id) + 1} · ${esc(stageLabel(o))}</span>`).join('')}</div>
                    <div class="hint" style="margin-top:8px">${(stage.requires || []).length ? 'All of these have to be done first.' : 'Nothing picked, so this step can start the job.'}</div>`
                    : '<div class="hint">Nothing else to wait on yet.</div>'}
            </div>

            <div class="sec">
                <div class="sec-title"><span>Doors</span><button class="btn xs act" id="ins-door-pick">${icon('doorlock', 12)} Pick a door</button></div>
                ${Inspector.doorList(doors, stage)}
                ${typing ? `
                <div class="grid2" style="margin-top:10px">
                    ${fieldText('opts.doorId', 'Door id', stage.opts.doorId || '', { placeholder: 'From your door lock', hint: 'For a door you cannot aim at, exactly as your door lock names it.' })}
                    ${fieldSeg('opts.doorAction', 'Does', stage.opts.doorAction === 'lock' ? 'lock' : 'unlock', [{ value: 'unlock', label: 'Unlock' }, { value: 'lock', label: 'Lock' }])}
                </div>` : `<button class="btn xs" id="ins-door-type" style="margin-top:8px">Type a door id instead</button>`}
                ${doors.length || stage.opts.doorId ? `<div style="margin-top:10px">${fieldSwitch('opts.relockOnEnd', 'Put it back when the place resets', stage.opts.relockOnEnd !== false, { wide: true })}</div>` : ''}
                <div class="hint" style="margin-top:8px">${esc(Inspector.doorNote())}</div>
            </div>

            ${pays ? `
            <div class="sec">
                <div class="sec-title">Pays out${stage.type === 'container' ? ' per grab' : ''}</div>
                <div class="grid2">
                    ${stage.type !== 'guard' ? fieldNumber('payout.cash.min', 'Least', reward.cash.min || 0, { min: 0, unit: '$' }) : ''}
                    ${stage.type !== 'guard' ? fieldNumber('payout.cash.max', 'Most', reward.cash.max || 0, { min: 0, unit: '$' }) : ''}
                    ${stage.type !== 'guard' ? fieldSelect('payout.cash.account', 'Paid as', reward.cash.account || 'job', [{ value: 'job', label: 'Same as the job' }, { value: 'cash', label: 'Cash' }, { value: 'dirty', label: 'Dirty money' }, { value: 'bank', label: 'Bank' }]) : ''}
                    ${fieldSelect('payout.lootTable', 'Loot table', reward.lootTable || '', [{ value: '', label: 'None' }].concat((State.loot || []).map(t => ({ value: t.id, label: t.label }))))}
                </div>
                <button class="btn sm" style="margin-top:10px" id="ins-items">${icon('container', 13)} ${reward.items.length ? `${reward.items.length} item${reward.items.length === 1 ? '' : 's'}` : 'Add items'} in Loot</button>
            </div>` : ''}

            <div class="more ${Inspector.lookOpen ? 'open' : ''}" data-fold="look">Look and feel <span class="car">▾</span></div>
            <div class="fold ${Inspector.lookOpen ? 'open' : ''}" data-fold-body="look"><div>
                <div class="grid2" style="padding-bottom:14px">
                    ${lootLook ? '' : propBlock}
                    ${look.filter(f => f.key !== 'prop').map(f => Inspector.field(f, stage.opts[f.key])).join('')}
                </div>
            </div></div>

            ${advanced.length ? `
            <div class="more ${Inspector.moreOpen ? 'open' : ''}" data-fold="more">Every other option · ${advanced.length} <span class="car">▾</span></div>
            <div class="fold ${Inspector.moreOpen ? 'open' : ''}" data-fold-body="more"><div>
                <div class="grid2" style="padding-bottom:14px">${advanced.map(f => Inspector.field(f, stage.opts[f.key])).join('')}</div>
            </div></div>` : ''}

            <div class="sec">
                <div class="sec-title">Where it is</div>
                <div class="grid2">${coordsField('st', stage.coords)}</div>
                <div style="margin-top:10px">${fieldSwitch('enabled', 'Step is switched on', stage.enabled !== false, { wide: true })}</div>
            </div>`;

        bindPickers(el);
        Inspector.bindFolds(el);

        bindForm(el, stage, (k, value, node, type) => {
            if (k === 'opts.label') stage.label = value;
            markDirty();
            if (k === 'opts.codeFrom') {
                if (value && !(stage.requires || []).includes(value)) stage.requires = (stage.requires || []).concat(value);
                renderInspector();
            }
            if (k === 'opts.requiredItem' && type === 'change') renderInspector();
            if (k === 'opts.propDone' || (k === 'opts.prop' && type === 'change')) renderInspector();
            if (k === 'enabled' || k === 'opts.optional' || k === 'opts.notifyPolice' || k.startsWith('payout.')) softRefresh();
            else if (k === 'opts.label' || k === 'opts.duration' || k.startsWith('opts.')) softRefresh();
        });

        bindCoords(el, 'st', () => stage, (c) => {
            stage.coords = Object.assign({}, stage.coords || {}, c);
            markDirty();
            softRefresh();
        });

        el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'move') Steps.move(stage);
            if (a === 'copy') Steps.duplicate(stage);
            if (a === 'goto') Steps.goto(stage);
            if (a === 'del') Steps.remove(stage);
        }));

        el.querySelectorAll('[data-req]').forEach(tag => tag.addEventListener('click', () => {
            const id = tag.dataset.req;
            stage.requires = stage.requires || [];
            const at = stage.requires.indexOf(id);
            if (at >= 0) stage.requires.splice(at, 1); else stage.requires.push(id);
            markDirty();
            renderInspector();
            softRefresh();
        }));

        el.querySelector('#ins-items')?.addEventListener('click', () => {
            LootView.open.add(stage.id);
            go('loot');
        });

        el.querySelector('#ins-door-pick').addEventListener('click', async () => {
            const res = await place({ label: 'Door', colour: colour, pickDoor: true, origin: stage.coords || undefined });
            if (!res.ok || !res.coords || !res.pick) return;
            const door = doorFromPick(res);
            stage.opts.doors = (Array.isArray(stage.opts.doors) ? stage.opts.doors : []).concat(door);
            markDirty();
            renderInspector();
            softRefresh();
            const note = door.label ? `${door.label}. It swings open when this step is done.`
                : door.id !== undefined ? `${res.pick.doorLock || 'Your door lock'} knows it as ${door.id}. It unlocks when this step is done.`
                : 'No door lock knows it, so it swings open. Change that on the door below.';
            toast('Door picked', note, 'success', 3600);
        });

        el.querySelector('#ins-door-type')?.addEventListener('click', () => {
            Inspector.typingDoor = true;
            renderInspector();
        });

        el.querySelectorAll('[data-door-act]').forEach(b => b.addEventListener('click', () => {
            const [i, act] = b.dataset.doorAct.split(':');
            const door = stage.opts.doors[Number(i)];
            if (!door) return;
            door.action = act;
            if (act === 'swing' && door.angle === undefined) door.angle = (knownDoor(door.model) || { angle: 90 }).angle;
            markDirty();
            renderInspector();
        }));

        el.querySelectorAll('[data-door-angle]').forEach(input => input.addEventListener('input', () => {
            const door = stage.opts.doors[Number(input.dataset.doorAngle)];
            const value = parseFloat(input.value);
            if (!door || !Number.isFinite(value)) return;
            door.angle = Math.max(-180, Math.min(180, value));
            markDirty();
        }));

        el.querySelectorAll('[data-door-del]').forEach(b => b.addEventListener('click', () => {
            stage.opts.doors.splice(Number(b.dataset.doorDel), 1);
            markDirty();
            renderInspector();
            softRefresh();
        }));

        el.querySelectorAll('[data-door-go]').forEach(b => b.addEventListener('click', () => {
            const door = stage.opts.doors[Number(b.dataset.doorGo)];
            if (door) nui('teleport', { coords: door, heading: door.h });
        }));

        el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
            const key = b.dataset.pick;
            PropsView.pick((model, known) => {
                setPath(stage, key, model);
                if (key === 'opts.prop' && known && known.swap && !stage.opts.propSwap) {
                    stage.opts.propSwap = known.swap;
                    if (!stage.opts.propDone || stage.opts.propDone === 'keep') stage.opts.propDone = 'swap';
                }
                markDirty();
                renderInspector();
                softRefresh();
            }, getPath(stage, key) || '');
        }));

        el.querySelectorAll('[data-try-mg]').forEach(b => b.addEventListener('click', async () => {
            const id = getPath(stage, b.dataset.tryMg);
            if (!id || id === 'none') { toast('Nothing to try', 'Pick a minigame first.', 'info', 2000); return; }
            const res = await nui('previewMinigame', { id, difficulty: Number(stage.opts.difficulty) || 2 });
            if (res && res.ok) toast(res.passed ? 'Passed' : 'Failed', 'That is how it plays for a robber.', res.passed ? 'success' : 'warning');
        }));
    },

    bindFolds(el) {
        el.querySelectorAll('[data-fold]').forEach(head => head.addEventListener('click', () => {
            const key = head.dataset.fold;
            const body = el.querySelector(`[data-fold-body="${key}"]`);
            const open = !body.classList.contains('open');
            body.classList.toggle('open', open);
            head.classList.toggle('open', open);
            if (key === 'more') Inspector.moreOpen = open;
            if (key === 'look') Inspector.lookOpen = open;
        }));
    },

    doorList(doors, stage) {
        if (!doors.length) return '<div class="hint">Nothing opens when this step is done. Pick a door and it can unlock, lock, or swing a vault door open.</div>';
        const lock = State.boot && State.boot.doorlock;
        const fallbackAction = stage.opts.doorAction || 'unlock';
        return `<div class="door-list">${doors.map((d, i) => {
            const action = d.action || fallbackAction;
            const angle = d.angle ?? stage.opts.swingAngle ?? 90;
            const sub = action === 'swing' ? 'The game swings it open'
                : d.id !== undefined ? `${lock || 'Door lock'} id ${d.id}`
                : lock ? `Looked up in ${lock} when it opens` : 'The game opens it itself';
            return `
            <div class="door-card">
                <div class="door-row">
                    <span class="door-ic">${icon('doorlock', 14)}</span>
                    <div class="grow"><b>${esc(d.label || (d.id !== undefined ? `Door ${d.id}` : `Door ${i + 1}`))}</b><small>${esc(sub)}</small></div>
                    <button class="icon-btn" data-door-go="${i}" title="Go to it">${icon('goto', 13)}</button>
                    <button class="icon-btn" data-door-del="${i}" title="Remove">${icon('trash', 13)}</button>
                </div>
                <div class="door-opts">
                    <div class="seg">${[['unlock', 'Unlock'], ['lock', 'Lock'], ['swing', 'Swing']].map(([v, l]) => `<button type="button" data-door-act="${i}:${v}" class="${action === v ? 'on' : ''}">${l}</button>`).join('')}</div>
                    ${action === 'swing' ? `<div class="unit door-angle"><input type="number" class="inp" data-door-angle="${i}" value="${esc(angle)}" min="-180" max="180" step="5"><em>°</em></div>` : ''}
                </div>
            </div>`;
        }).join('')}</div>`;
    },

    doorNote() {
        const lock = State.boot && State.boot.doorlock;
        return lock
            ? `Unlock and Lock go through ${lock}. Swing open turns the door itself, for vault doors. A negative angle swings it the other way.`
            : 'No door lock resource is running, so the game unlocks and locks doors itself. Swing open turns the door itself, for vault doors. A negative angle swings it the other way.';
    },

    prop(el, prop) {
        const job = State.current;
        const stages = job.stages || [];

        el.innerHTML = `
            <div class="ins-head" style="${colourVars([57, 212, 155])}">
                <div class="num">${icon('prop', 20, 1.6)}</div>
                <div class="grow">
                    <div class="k">Scene prop</div>
                    <input class="title" data-k="label" value="${esc(propLabel(prop))}" spellcheck="false">
                </div>
            </div>
            <div class="ins-actions">
                <button class="btn" data-a="move">${icon('place', 13)} Move</button>
                <button class="btn" data-a="copy">${icon('copy', 13)} Copy</button>
                <button class="btn" data-a="goto">${icon('goto', 13)} Go to</button>
                <button class="btn danger" data-a="del">${icon('trash', 13)}</button>
            </div>
            <div class="sec">
                <div class="grid2">
                    <div class="f wide"><label>Model</label>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input class="inp" data-k="model" value="${esc(prop.model)}" spellcheck="false"><button class="btn sm" data-pick="model">${icon('prop', 12)} Pick</button></div></div>
                </div>
            </div>
            <div class="sec">
                <div class="sec-title">Loot</div>
                <div class="hint" style="margin-bottom:10px">Let the crew take it. It becomes a loot step right here with this prop, and you set what it pays: cash, dirty money, bank, any items, or a loot table.</div>
                <button class="btn primary sm" id="pp-loot">${icon('container', 13)} Make it lootable</button>
            </div>
            <div class="sec">
                <div class="sec-title">Tie it to a step</div>
                <div class="grid2">
                    ${fieldSelect('linkStage', 'Step', prop.linkStage || '', [{ value: '', label: 'Not tied, always there' }].concat(stages.map(s => ({ value: s.id, label: `${stageIndex(job, s.id) + 1} · ${stageLabel(s)}` }))), { wide: true })}
                    ${prop.linkStage ? fieldSeg('onDone', 'When that step is done', prop.onDone || 'keep', [{ value: 'keep', label: 'Leave it' }, { value: 'remove', label: 'Remove it' }, { value: 'swap', label: 'Swap it' }], { wide: true }) : ''}
                    ${prop.linkStage && prop.onDone === 'swap' ? `<div class="f wide"><label>Swap to</label>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input class="inp" data-k="swapModel" value="${esc(prop.swapModel || '')}" placeholder="hei_prop_hei_cash_trolly_03" spellcheck="false"><button class="btn sm" data-pick="swapModel">${icon('prop', 12)} Pick</button></div>
                        <div class="fh">A full trolley that becomes an empty one, a closed safe that opens.</div></div>` : ''}
                </div>
                <div class="hint" style="margin-top:8px">It comes back as it was when the place resets after its cooldown.</div>
            </div>
            <div class="sec">
                <div class="sec-title">Where it is</div>
                <div class="grid2">${coordsField('pp', prop.coords)}</div>
            </div>`;

        bindForm(el, prop, (k) => {
            markDirty();
            if (k === 'linkStage' || k === 'onDone') renderInspector();
            softRefresh();
        });

        bindCoords(el, 'pp', () => prop, (c) => {
            prop.coords = Object.assign({}, prop.coords || {}, c);
            markDirty();
            softRefresh();
        });

        el.querySelector('#pp-loot').addEventListener('click', () => PropsView.makeLootable(prop));

        el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'move') PropsView.move(prop);
            if (a === 'copy') PropsView.copy(prop);
            if (a === 'goto' && prop.coords) nui('teleport', { coords: prop.coords });
            if (a === 'del') PropsView.remove(prop);
        }));

        el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
            const key = b.dataset.pick;
            PropsView.pick((model, known) => {
                prop[key] = model;
                if (key === 'model' && known && !prop.label) prop.label = known.label;
                if (key === 'model' && known && known.swap && !prop.swapModel) prop.swapModel = known.swap;
                markDirty();
                renderInspector();
                softRefresh();
            }, prop[key] || '');
        }));
    },

    npc(el, npc) {
        const custom = !!(npc.animDict || npc.animClip);

        el.innerHTML = `
            <div class="ins-head" style="${colourVars([255, 93, 115])}">
                <div class="num">${icon('twoman', 20, 1.6)}</div>
                <div class="grow">
                    <div class="k">NPC</div>
                    <input class="title" data-k="label" value="${esc(npcLabel(npc))}" spellcheck="false">
                </div>
            </div>
            <div class="ins-actions">
                <button class="btn" data-a="move">${icon('place', 13)} Move</button>
                <button class="btn" data-a="copy">${icon('copy', 13)} Copy</button>
                <button class="btn" data-a="goto">${icon('goto', 13)} Go to</button>
                <button class="btn danger" data-a="del">${icon('trash', 13)}</button>
            </div>
            <div class="sec">
                <div class="grid2">
                    <div class="f wide"><label>Ped model</label>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input class="inp" data-k="model" value="${esc(npc.model)}" spellcheck="false"><button class="btn sm" data-pick="model">${icon('twoman', 12)} Pick</button></div></div>
                    ${fieldSelect('scenario', 'Doing', npc.scenario || '', SCENARIOS, { wide: true })}
                    ${fieldSeg('reaction', 'When the robbery starts', npc.reaction || 'cower', REACTIONS, { wide: true, hint: 'They go back to normal a few seconds after it ends.' })}
                </div>
            </div>
            <div class="more ${custom ? 'open' : ''}" data-fold="anim">Custom animation <span class="car">▾</span></div>
            <div class="fold ${custom ? 'open' : ''}" data-fold-body="anim"><div>
                <div class="grid2" style="padding-bottom:14px">
                    ${fieldText('animDict', 'Animation dict', npc.animDict || '', { wide: true, placeholder: 'anim@heists@heist_corona@single_team' })}
                    ${fieldText('animClip', 'Animation clip', npc.animClip || '', { wide: true, placeholder: 'single_team_loop_boss', hint: 'Plays on a loop instead of what they are doing.' })}
                </div>
            </div></div>
            <div class="sec">
                <div class="sec-title">Where they stand</div>
                <div class="grid2">${coordsField('np', npc.coords)}</div>
            </div>`;

        Inspector.bindFolds(el);

        bindForm(el, npc, () => {
            markDirty();
            softRefresh();
        });

        bindCoords(el, 'np', () => npc, (c) => {
            npc.coords = Object.assign({}, npc.coords || {}, c);
            markDirty();
            softRefresh();
        });

        el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'move') NpcsView.move(npc);
            if (a === 'copy') NpcsView.copy(npc);
            if (a === 'goto' && npc.coords) nui('teleport', { coords: npc.coords });
            if (a === 'del') NpcsView.remove(npc);
        }));

        el.querySelector('[data-pick="model"]').addEventListener('click', () => {
            NpcsView.pick((model, known) => {
                npc.model = model;
                if (known && !npc.label) npc.label = known.label;
                markDirty();
                renderInspector();
                softRefresh();
            }, npc.model || '');
        });
    },

    async place(el, loc) {
        const job = State.current;
        const o = loc.overrides || (loc.overrides = {});
        o.gates = o.gates || {};
        loc.offsets = loc.offsets || {};
        const g = job.gates || {};

        const override = (path, label, inherit, unit) => {
            const value = getPath(o, path);
            return `<div class="f"><label>${esc(label)}</label><div class="unit"><input type="number" class="inp" data-ov="${esc(path)}" value="${value === undefined ? '' : esc(value)}" placeholder="${esc(inherit)}" step="any">${unit ? `<em>${esc(unit)}</em>` : ''}</div></div>`;
        };

        el.innerHTML = `
            <div class="ins-head" style="${colourVars([255, 195, 90])}">
                <div class="num">${icon('pin', 20, 1.6)}</div>
                <div class="grow">
                    <div class="k">Place</div>
                    <input class="title" id="pl-label" value="${esc(loc.label)}" spellcheck="false">
                </div>
            </div>
            <div class="ins-actions" style="grid-template-columns:repeat(3,1fr)">
                <button class="btn" data-a="move">${icon('place', 13)} Line up</button>
                <button class="btn" data-a="goto">${icon('goto', 13)} Go there</button>
                <button class="btn danger" data-a="del">${icon('trash', 13)} Delete</button>
            </div>
            <div class="sec">${fieldSwitch('', 'This place is live', loc.enabled, { wide: true }).replace('data-k=""', 'id="pl-live"')}</div>
            <div class="sec">
                <div class="sec-title">Its own numbers</div>
                <div class="grid2">
                    ${override('payoutMultiplier', 'Payout ×', '1', '×')}
                    ${override('radius', 'Area', String(job.radius ?? 30), 'm')}
                    ${override('gates.policeRequired', 'Police needed', String(g.policeRequired ?? 2))}
                    ${override('gates.locationCooldown', 'Resets after', String(g.locationCooldown ?? 1800), 's')}
                </div>
                <div class="hint" style="margin-top:8px">Empty follows the job. Fill one in and only this place changes.</div>
            </div>
            <div class="sec">
                <div class="sec-title">Steps here</div>
                <div id="pl-steps"><div class="loading"><div class="spinner"></div>Working out where they land</div></div>
            </div>
            <div class="sec">
                <div class="sec-title">Anchor</div>
                <div class="grid2">${coordsField('lo', loc.origin, { label: 'Lined up at' })}</div>
            </div>`;

        const save = async () => {
            if (await PlacesView.saveLocation(loc, true)) {
                delete Inspector.resolved[loc.id];
                refresh({ tabs: true });
                if (State.tab === 'places') PlacesView.highlight();
            }
        };

        el.querySelector('#pl-label').addEventListener('change', (e) => { loc.label = e.target.value || loc.label; save().then(() => renderView()); });
        el.querySelector('#pl-live').addEventListener('change', (e) => { loc.enabled = e.target.checked; save().then(() => renderView()); });

        el.querySelectorAll('[data-ov]').forEach(input => input.addEventListener('change', () => {
            const path = input.dataset.ov;
            const raw = input.value.trim();
            if (raw === '') {
                const keys = path.split('.');
                const parent = keys.length > 1 ? getPath(o, keys.slice(0, -1).join('.')) : o;
                if (parent) delete parent[keys[keys.length - 1]];
            } else {
                setPath(o, path, parseFloat(raw));
            }
            save();
        }));

        bindCoords(el, 'lo', () => loc, (c) => {
            loc.origin = Object.assign({}, loc.origin, c);
            save().then(() => Inspector.loadPlaceSteps(el, loc));
        });

        el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => {
            const a = b.dataset.a;
            if (a === 'goto') nui('teleport', { coords: loc.origin, heading: loc.origin.h });
            if (a === 'del') {
                confirmDanger('Delete this place?', `${loc.label} stops existing in the world. The job itself stays.`, async () => {
                    const res = await nui('deleteLocation', loc.id);
                    if (!report(res, 'Deleted', loc.label)) return;
                    State.locations = res.locations || [];
                    State.robberies = res.robberies || State.robberies;
                    State.jobLocations = State.locations.filter(l => l.robberyId === job.id);
                    State.sel = null;
                    refresh({ view: true, inspector: true, tabs: true, rail: true });
                    validate();
                });
            }
            if (a === 'move') {
                const res = await place({
                    label: `${loc.label} anchor`,
                    colour: [255, 195, 90],
                    mode: 'point',
                    origin: loc.origin,
                    layout: PlacesView.layoutFor(job),
                    guided: { step: 1, total: 1, title: `Line up ${(job.anchor && job.anchor.label) || 'the anchor'}`, subtitle: 'The whole job follows the anchor.', skippable: true },
                });
                if (!res.ok || !res.coords) return;
                loc.origin = { x: res.coords.x, y: res.coords.y, z: res.coords.z, h: res.coords.h || 0 };
                await save();
                renderInspector();
                renderView();
            }
        }));

        Inspector.loadPlaceSteps(el, loc);
    },

    async loadPlaceSteps(el, loc) {
        const box = el.querySelector('#pl-steps');
        if (!box) return;

        let resolved = Inspector.resolved[loc.id];
        if (!resolved) {
            const res = await nui('resolveLocation', loc.id);
            resolved = res && res.ok ? res.location : null;
            if (resolved) Inspector.resolved[loc.id] = resolved;
        }
        if (!box.isConnected) return;

        const job = State.current;
        const o = loc.overrides || {};
        const offStages = o.disabledStages || {};
        const offProps = o.disabledProps || {};
        const offNpcs = o.disabledNpcs || {};
        const where = new Map(((resolved && resolved.stages) || []).map(s => [s.id, s.coords]));
        const propWhere = new Map(((resolved && resolved.props) || []).map(p => [p.id, p.coords]));
        const npcWhere = new Map(((resolved && resolved.npcs) || []).map(n => [n.id, n.coords]));

        const row = (kind, item, label, coords, gone) => `
            <div class="ov-row ${gone ? 'gone' : ''}">
                <label class="switch bare"><input type="checkbox" data-here="${kind}:${esc(item.id)}" ${gone ? '' : 'checked'}><span class="sw"></span></label>
                <div><b>${esc(label)}</b><small>${loc.offsets[item.id] ? 'nudged · ' : ''}${esc(coords ? fmtCoords(coords) : gone ? 'not at this place' : 'not placed')}</small></div>
                <div class="acts">
                    ${!gone && coords ? `<button class="btn xs" data-nudge="${kind}:${esc(item.id)}">Nudge</button>` : ''}
                    ${loc.offsets[item.id] ? `<button class="btn xs" data-reset="${esc(item.id)}">Reset</button>` : ''}
                </div>
            </div>`;

        box.innerHTML = `
            <div class="ov-list">
                ${(job.stages || []).map(s => row('stage', s, `${stageIndex(job, s.id) + 1} · ${stageLabel(s)}`, where.get(s.id), !!offStages[s.id] || s.enabled === false)).join('')}
                ${(job.props || []).map(p => row('prop', p, propLabel(p), propWhere.get(p.id), !!offProps[p.id])).join('')}
                ${(job.npcs || []).map(n => row('npc', n, npcLabel(n), npcWhere.get(n.id), !!offNpcs[n.id])).join('')}
            </div>
            <div class="hint" style="margin-top:8px">Switch off anything this building does not have. A nudge moves it here only.</div>`;

        const save = async () => {
            if (await PlacesView.saveLocation(loc, true)) {
                delete Inspector.resolved[loc.id];
                Inspector.loadPlaceSteps(el, loc);
            }
        };

        box.querySelectorAll('[data-here]').forEach(input => input.addEventListener('change', () => {
            const [kind, id] = input.dataset.here.split(':');
            const key = kind === 'stage' ? 'disabledStages' : kind === 'npc' ? 'disabledNpcs' : 'disabledProps';
            loc.overrides[key] = loc.overrides[key] || {};
            if (input.checked) delete loc.overrides[key][id]; else loc.overrides[key][id] = true;
            if (!Object.keys(loc.overrides[key]).length) delete loc.overrides[key];
            save();
        }));

        box.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => {
            delete loc.offsets[b.dataset.reset];
            save();
        }));

        box.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', async () => {
            const [kind, id] = b.dataset.nudge.split(':');
            const at = kind === 'stage' ? where.get(id) : kind === 'npc' ? npcWhere.get(id) : propWhere.get(id);
            const item = kind === 'stage' ? job.stages.find(s => s.id === id) : kind === 'npc' ? job.npcs.find(n => n.id === id) : job.props.find(p => p.id === id);
            if (!at || !item) return;

            const res = await place({
                label: kind === 'stage' ? stageLabel(item) : kind === 'npc' ? npcLabel(item) : propLabel(item),
                colour: kind === 'stage' ? stageColour(item) : kind === 'npc' ? [255, 93, 115] : [57, 212, 155],
                mode: 'point',
                origin: at,
                previewModel: kind === 'stage' ? (item.opts && item.opts.prop) || undefined : item.model,
            });
            if (!res.ok || !res.coords) return;

            const cur = loc.offsets[id] || { x: 0, y: 0, z: 0 };
            loc.offsets[id] = {
                x: Number((cur.x + (res.coords.x - at.x)).toFixed(3)),
                y: Number((cur.y + (res.coords.y - at.y)).toFixed(3)),
                z: Number((cur.z + (res.coords.z - at.z)).toFixed(3)),
            };
            await save();
            toast('Nudged', 'Only this place moved.', 'success', 2000);
        }));
    },

    job(el) {
        const job = State.current;
        const checks = jobChecklist(job, State.jobLocations);
        const issues = State.issues || [];
        const est = runEstimate(job);
        const recipe = Setup.recipeFor(job.category);
        const errors = issues.filter(i => i.level === 'error');

        el.innerHTML = `
            <div class="ins-head" style="${colourVars(jobType(job.category).colour)}">
                <div class="num">${icon(jobType(job.category).icon, 20, 1.6)}</div>
                <div class="grow"><div class="k">${esc(jobType(job.category).label)} job</div><div style="font:700 22px var(--font-head);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(job.name)}</div></div>
            </div>

            <div class="sec">
                <div class="sec-title">Getting it ready</div>
                <div class="checklist">${checks.map(c => `
                    <div class="check ${c.done ? 'done' : ''}"><i>${c.done ? '✓' : ''}</i>${esc(c.label)}
                        ${c.done ? '' : `<button class="btn xs go" data-go="${c.go}">${c.go === 'live' ? 'Go live' : 'Open'}</button>`}</div>`).join('')}</div>
            </div>

            <div class="sec">
                <div class="sec-title">Problems</div>
                ${issues.length ? `<div class="issues">${issues.map(i => `
                    <div class="issue ${i.level === 'error' ? 'error' : 'warn'}" ${i.stage ? `data-stage="${esc(i.stage)}"` : ''}><i>${i.level === 'error' ? '!' : '?'}</i><span>${esc(i.message)}</span></div>`).join('')}</div>`
                    : '<div class="issue ok"><i>✓</i><span>Nothing to fix.</span></div>'}
            </div>

            <div class="sec">
                <div class="sec-title">How it runs</div>
                <div class="hint" style="color:var(--ink2)">${esc(alarmText(job))}</div>
                <div class="stat-row">
                    <div class="stat"><small>RUN</small><b>~${mmss(est.total)}</b></div>
                    <div class="stat"><small>ALARM</small><b style="color:${est.alarm === null ? 'inherit' : 'var(--red)'}">${est.alarm === null ? 'none' : mmss(est.alarm)}</b></div>
                    <div class="stat"><small>PROPS</small><b>${(job.props || []).length}</b></div>
                    <div class="stat"><small>NPCS</small><b>${(job.npcs || []).length}</b></div>
                </div>
            </div>

            <div class="sec" style="display:grid;gap:8px">
                <button class="btn primary wide" id="ov-add">${icon('plus', 14)} Add a step</button>
                ${recipe && !(job.stages || []).length ? `<button class="btn wide" id="ov-walk">${icon('walk', 14)} Walk me through it</button>` : ''}
            </div>
            ${errors.length && job.enabled ? '<div class="issue error"><i>!</i><span>It is live but broken. Players may find steps that never open.</span></div>' : ''}`;

        el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.go === 'live') toggleLive();
            else go(b.dataset.go);
        }));
        el.querySelectorAll('.issue[data-stage]').forEach(row => row.addEventListener('click', () => {
            if ((job.stages || []).some(s => s.id === row.dataset.stage)) select('stage', row.dataset.stage, { view: false });
        }));
        el.querySelector('#ov-add').addEventListener('click', () => Steps.pickType());
        el.querySelector('#ov-walk')?.addEventListener('click', () => Setup.run(job, recipe));
    },
};
