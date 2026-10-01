Views.home = {
    render(el) {
        const live = State.robberies.filter(r => r.enabled).length;
        const running = State.liveRuns.length;

        el.innerHTML = `
            <div class="empty">
                <div class="mark">${LOGO.replace('width="26" height="26"', 'width="40" height="40"')}</div>
                <h3>${State.robberies.length ? 'Pick a job, or build a new one' : 'Build your first robbery'}</h3>
                <p>A job is the steps a crew works through, a till, a keypad, a vault, a way out, placed in the world. Build it once, then stamp it on every place it should work.</p>
                <div class="row">
                    <button class="btn primary" id="home-new">${icon('plus', 14)} New job</button>
                    <button class="btn" id="home-import">${icon('import', 14)} Import one</button>
                </div>
                ${State.robberies.length ? `
                <div class="stat-row" style="border:none;margin-top:22px;gap:34px">
                    <div class="stat"><small>JOBS</small><b>${State.robberies.length}</b></div>
                    <div class="stat"><small>LIVE</small><b style="color:var(--green)">${live}</b></div>
                    <div class="stat"><small>PLACES</small><b>${State.locations.length}</b></div>
                    <div class="stat"><small>RUNNING NOW</small><b style="color:${running ? 'var(--red)' : 'inherit'}">${running}</b></div>
                </div>` : ''}
            </div>`;

        el.querySelector('#home-new').addEventListener('click', () => Setup.open());
        el.querySelector('#home-import').addEventListener('click', importModal);
    },
};

const ALARM_LABEL = { quiet: 'Quiet', none: 'No alarm', silent: 'Silent alarm', pending: 'Alarm arming', raised: 'Police alerted' };

Views.live = {
    render(el) {
        el.classList.add('scroll');
        const runs = State.liveRuns || [];

        el.innerHTML = `
            <div class="kill ${State.killSwitch ? 'on' : ''}" style="margin-bottom:18px">
                <div class="ti" style="color:${State.killSwitch ? 'var(--red)' : 'var(--ink3)'}">${icon('stop', 22)}</div>
                <div class="t"><b>${State.killSwitch ? 'Robberies are switched off' : 'Stop every robbery'}</b>
                    <small>${State.killSwitch ? 'Nobody can start one until you turn this off. Runs already going carry on.' : 'Blocks anyone starting a robbery anywhere. Runs already going carry on.'}</small></div>
                <label class="switch bare"><input type="checkbox" id="kill" ${State.killSwitch ? 'checked' : ''}><span class="sw"></span></label>
            </div>
            ${runs.length ? `<div class="cards">${runs.map((run, i) => Views.live.card(run, i)).join('')}</div>`
                : `<div class="empty inline">
                    <div class="mark">${icon('live', 30, 1.5)}</div>
                    <h3>Nothing happening</h3>
                    <p>A run shows here the moment it starts, with who is inside, how far they got and what they are carrying.</p>
                </div>`}`;

        el.querySelector('#kill').addEventListener('change', async (e) => {
            const on = e.target.checked;
            const res = await nui('killSwitch', on);
            if (!report(res, on ? 'Robberies switched off' : 'Robberies back on')) { e.target.checked = !on; return; }
            State.killSwitch = res.killSwitch === true;
            refresh({ rail: true, view: true });
        });

        el.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => {
            const run = runs.find(r => String(r.locationId) === b.dataset.end);
            confirmDanger('End this run?', `Everyone inside ${run ? run.location : 'it'} is told it is over. They keep what is in their pockets; money still held for the getaway is lost.`, async () => {
                const res = await nui('forceEnd', run.locationId);
                if (report(res, 'Ended', run.location)) { State.liveRuns = res.runs || []; refresh({ rail: true, view: true }); }
            }, 'End it');
        }));

        el.querySelectorAll('[data-ban]').forEach(chip => chip.addEventListener('click', () => {
            confirmDanger('Ban them from robberies?', `${chip.dataset.name} cannot start or join a robbery until you lift it in Settings.`, async () => {
                const res = await nui('blacklist', { citizenid: chip.dataset.ban, name: chip.dataset.name, on: true });
                if (report(res, 'Banned', chip.dataset.name)) State.blacklist = res.blacklist || {};
            }, 'Ban');
        }));
    },

    card(run, i) {
        const pct = run.total ? Math.round((run.done / run.total) * 100) : 0;
        return `
            <div class="card live-card" style="animation-delay:${i * 40}ms">
                <div class="card-head">
                    <div style="min-width:0"><div class="card-title">${esc(run.name || 'Robbery')}</div><div class="card-sub">${esc(run.location || '')}</div></div>
                    <span class="alarm ${esc(run.alarm)}"><i></i>${esc(ALARM_LABEL[run.alarm] || run.alarm)}</span>
                </div>
                <div class="progress"><i style="width:${pct}%"></i></div>
                <div class="stat-row">
                    <div class="stat"><small>STEPS</small><b>${run.done ?? 0}/${run.total ?? 0}</b></div>
                    <div class="stat"><small>IN FOR</small><b>${mmss(run.elapsed || 0)}</b></div>
                    <div class="stat"><small>HELD</small><b style="color:var(--green)">${money(run.pot || 0)}</b></div>
                </div>
                ${(run.participants || []).length ? `<div class="card-row">${run.participants.map(p => `<span class="tag" data-ban="${esc(p.citizenid)}" data-name="${esc(p.name)}" title="Ban them from robberies">${esc(p.name)} ${icon('ban', 11)}</span>`).join('')}</div>` : ''}
                <div class="card-row"><button class="btn xs danger" data-end="${esc(run.locationId)}">${icon('stop', 12)} End it</button></div>
            </div>`;
    },
};

const OUTCOME = { completed: ['Got away', 'on'], failed: ['Failed', 'bad'], abandoned: ['Abandoned', 'warn'], cancelled: ['Called off', 'warn'], 'stopped by staff': ['Stopped by staff', 'warn'], active: ['Running', 'info'] };

Views.history = {
    async render(el) {
        el.classList.add('scroll');
        el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading runs</div>';

        const res = await nui('history', 120);
        const runs = (res && res.ok && res.runs) || [];
        if (!el.isConnected) return;

        if (!runs.length) {
            el.innerHTML = `<div class="empty inline"><div class="mark">${icon('history', 30, 1.5)}</div><h3>No runs yet</h3><p>Every attempt lands here: who took part, how it ended and what it paid.</p></div>`;
            return;
        }

        const total = runs.reduce((a, r) => a + (Number(r.payout) || 0), 0);
        const done = runs.filter(r => r.outcome === 'completed').length;

        el.innerHTML = `
            <div class="stat-row" style="border:none;margin:0 0 16px;padding:0;gap:34px">
                <div class="stat"><small>RUNS</small><b>${runs.length}</b></div>
                <div class="stat"><small>GOT AWAY</small><b style="color:var(--green)">${done}</b></div>
                <div class="stat"><small>PAID OUT</small><b>${money(total)}</b></div>
            </div>
            <div class="table-box">
                <table class="table">
                    <thead><tr><th>Job</th><th>Started</th><th>Outcome</th><th>Crew</th><th style="text-align:right">Paid</th></tr></thead>
                    <tbody>${runs.map(r => {
                        const [label, cls] = OUTCOME[r.outcome] || [r.outcome, ''];
                        const crew = (r.participants || []).map(p => p.name).filter(Boolean);
                        return `<tr>
                            <td>${esc(r.name)}</td>
                            <td class="mono">${esc(String(r.started_at || '').replace('T', ' ').slice(0, 16))}</td>
                            <td><span class="badge ${cls}">${esc(label)}</span></td>
                            <td class="mono" title="${esc(crew.join(', '))}">${crew.length ? esc(crew.slice(0, 3).join(', ')) + (crew.length > 3 ? ` +${crew.length - 3}` : '') : '—'}</td>
                            <td class="mono" style="text-align:right">${money(r.payout || 0)}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`;
    },
};

Views.settings = {
    render(el) {
        el.classList.add('scroll');
        const boot = State.boot || {};
        const minigames = State.minigames || [];
        const banned = Object.entries(State.blacklist || {});
        const values = {};
        (State.settings || []).forEach(s => { values[s.key] = s.value; });

        const row = (s) => {
            if (s.kind === 'toggle') {
                return `<div class="setting-row"><div class="t">${esc(s.label)}<small>${s.fromConfig ? 'From config.lua' : 'Set here'}</small></div>
                    <label class="switch bare"><input type="checkbox" data-k="${esc(s.key)}" data-t="bool" ${s.value ? 'checked' : ''}><span class="sw"></span></label></div>`;
            }
            if (s.kind === 'choice') return '';
            return `<div class="setting-row"><div class="t">${esc(s.label)}<small>${s.fromConfig ? 'From config.lua' : 'Set here'}</small></div>
                <div class="unit"><input class="inp" type="number" data-k="${esc(s.key)}" data-t="num" value="${esc(s.value)}" step="${esc(s.step || 1)}" ${s.min !== undefined ? `min="${s.min}"` : ''} ${s.max !== undefined ? `max="${s.max}"` : ''}>${s.unit ? `<em>${esc(s.unit)}</em>` : ''}</div></div>`;
        };

        const bridge = (label, value, ok, note) => `
            <div class="card"><div class="card-head"><div style="min-width:0"><div class="card-title">${esc(label)}</div><div class="card-sub">${esc(value || note || 'not found')}</div></div>
            <span class="badge ${ok ? 'on' : 'warn'}">${ok ? 'Connected' : 'None'}</span></div></div>`;

        el.innerHTML = `
            <div class="split">
                <div>
                    <div class="sec">
                        <div class="sec-title"><span>Tuning</span><button class="btn xs act primary" id="st-apply">Apply</button></div>
                        <div class="table-box" id="st-form">${(State.settings || []).map(row).join('')}</div>
                        <div class="hint" style="margin-top:8px">Applies at once and survives a restart. Once set here, this panel wins over config.lua.</div>
                    </div>
                    <div class="sec">
                        <div class="sec-title">Banned from robberies</div>
                        ${banned.length ? `<div class="ov-list">${banned.map(([cid, name]) => `
                            <div class="ov-row"><div class="type-dot" style="${colourVars([255, 93, 115])};width:28px;height:28px">${icon('ban', 13)}</div>
                            <div><b>${esc(name)}</b><small>${esc(cid)}</small></div>
                            <div class="acts"><button class="btn xs" data-unban="${esc(cid)}">Lift it</button></div></div>`).join('')}</div>`
                            : '<div class="hint">Nobody. Ban someone from Live while they are in a job.</div>'}
                    </div>
                </div>
                <div>
                    <div class="sec">
                        <div class="sec-title">Running underneath</div>
                        <div class="cards" style="grid-template-columns:1fr 1fr">
                            ${bridge('Framework', boot.framework, !!boot.framework)}
                            ${bridge('Inventory', boot.inventory, !!boot.inventory)}
                            ${bridge('Target', boot.target, !!boot.target && boot.target !== 'builtin', 'built-in prompts')}
                            ${bridge('Dispatch', boot.dispatch, !!boot.dispatch, 'police notifications')}
                            ${bridge('Door locks', boot.doorlock, !!boot.doorlock)}
                            ${bridge('MDT', boot.mdt, !!boot.mdt, 'no paperwork')}
                        </div>
                    </div>
                    <div class="sec">
                        <div class="sec-title">Minigames</div>
                        <div class="hint" style="margin-bottom:10px">${minigames.filter(m => m.available).length} of ${minigames.length} ready. Missing ones stay listed so you can see what installing them adds. Try any of them here.</div>
                        <div class="ov-list">${minigames.filter(m => m.id !== 'none').map((m, i, all) => `
                            ${i === 0 || all[i - 1].provider !== m.provider ? `<div class="group-label" style="margin:${i ? 12 : 0}px 0 4px">${esc(m.provider === 'xs' ? 'Built in' : (m.resource || m.provider))}</div>` : ''}
                            <div class="ov-row">
                                <span class="badge ${m.available ? 'on' : ''}">${m.available ? 'Ready' : 'Missing'}</span>
                                <div><b>${esc(m.label)}</b><small>${esc(m.blurb || '')}</small></div>
                                <div class="acts">${m.available ? `<button class="btn xs" data-try="${esc(m.id)}">${icon('play', 11)} Try</button>` : ''}</div>
                            </div>`).join('')}</div>
                    </div>
                </div>
            </div>`;

        bindForm(el.querySelector('#st-form'), values, () => {});

        el.querySelector('#st-apply').addEventListener('click', async () => {
            const res = await nui('saveTunables', values);
            if (!report(res, 'Applied', 'Live on the server now.')) return;
            State.settings = res.settings || State.settings;
            renderView();
        });

        el.querySelectorAll('[data-unban]').forEach(b => b.addEventListener('click', async () => {
            const res = await nui('blacklist', { citizenid: b.dataset.unban, on: false });
            if (!report(res, 'Lifted')) return;
            State.blacklist = res.blacklist || {};
            renderView();
        }));

        el.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', async () => {
            const res = await nui('previewMinigame', { id: b.dataset.try, difficulty: 2 });
            if (res && res.ok) toast(res.passed ? 'Passed' : 'Failed', 'That is how it plays for a robber.', res.passed ? 'success' : 'warning');
        }));
    },
};
