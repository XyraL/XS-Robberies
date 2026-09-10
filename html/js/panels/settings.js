window.Panels = window.Panels || {};

function bridgeRow(label, value, ok) {
    return `
        <div class="card" style="cursor:default">
            <div class="card-head">
                <div>
                    <div class="card-title">${esc(label)}</div>
                    <div class="card-sub">${esc(value || 'not detected')}</div>
                </div>
                <span class="badge ${ok ? 'on' : 'warn'}">${ok ? 'Connected' : 'Missing'}</span>
            </div>
        </div>`;
}

function tunablesBlock() {
    const settings = State.settings || [];
    if (settings.length === 0) return '';

    const row = (s) => {
        const id = `t-${s.key}`;

        if (s.kind === 'choice') {
            const colours = {
                emerald: '#19e08c', amber: '#f5a524', violet: '#a882ff',
                rose: '#ff4d9d', ice: '#4fd2ff', gold: '#e8c37a',
            };

            const swatch = (name) => `
                <div class="swatch ${name === s.value ? 'active' : ''}"
                     data-theme-pick="${esc(name)}" title="${esc(name)}"
                     style="color:${colours[name] || '#19e08c'}"></div>`;

            return `
                <div class="tunable">
                    <span class="toggle-label" style="flex:1">${esc(s.label)}</span>
                    <div class="swatches">${(s.options || []).map(swatch).join('')}</div>
                </div>`;
        }

        if (s.kind === 'toggle') {
            return `
                <div class="tunable">
                    <label class="toggle">
                        <input type="checkbox" id="${esc(id)}" data-tunable="${esc(s.key)}" ${s.value ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">${esc(s.label)}</span>
                    </label>
                    ${s.fromConfig ? '<span class="badge off">from config.lua</span>' : '<span class="badge on">set here</span>'}
                </div>`;
        }

        return `
            <div class="tunable">
                <label class="toggle-label" for="${esc(id)}" style="flex:1">${esc(s.label)}</label>
                <div class="unit-input" style="max-width:130px">
                    <input type="number" id="${esc(id)}" data-tunable="${esc(s.key)}"
                           value="${esc(s.value)}" step="${esc(s.step || 1)}"
                           ${s.min !== undefined ? `min="${s.min}"` : ''}
                           ${s.max !== undefined ? `max="${s.max}"` : ''}>
                    ${s.unit ? `<span class="unit">${esc(s.unit)}</span>` : ''}
                </div>
                ${s.fromConfig ? '<span class="badge off">from config.lua</span>' : '<span class="badge on">set here</span>'}
            </div>`;
    };

    return `
        <div class="section-title">Tuning</div>
        <div class="field-hint" style="margin-bottom:12px">
            These take effect immediately and survive a restart. Anything marked
            <b>from config.lua</b> is still using the value in the file; change it here and this panel wins from then on.
        </div>
        <div class="card" style="cursor:default;padding:6px 16px 14px">
            ${settings.map(row).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:11px">
            <button class="btn btn-primary" id="s-save-tunables">Apply</button>
        </div>`;
}

function controlsBlock() {
    const banned = Object.entries(State.blacklist || {});

    return `
        <div class="section-title">Controls</div>
        <div class="card" style="cursor:default">
            <div class="card-head">
                <div>
                    <div class="card-title">Stop everything</div>
                    <div class="card-sub">No robbery can be started while this is on. Runs already going are left alone.</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="s-killswitch" ${State.killSwitch ? 'checked' : ''}>
                    <span class="toggle-track"></span>
                    <span class="toggle-label">${State.killSwitch ? 'On' : 'Off'}</span>
                </label>
            </div>
        </div>

        <div class="section-title" style="margin-top:26px">Banned from robberies</div>
        ${banned.length === 0
            ? '<div class="field-hint">Nobody. Ban someone from the Live panel while they are inside a job.</div>'
            : `<table class="table">
                <thead><tr><th>Name</th><th>Citizen id</th><th></th></tr></thead>
                <tbody>
                    ${banned.map(([citizenid, name]) => `
                        <tr>
                            <td>${esc(name)}</td>
                            <td class="mono">${esc(citizenid)}</td>
                            <td style="text-align:right">
                                <button class="btn btn-sm btn-ghost" data-unban="${esc(citizenid)}">Lift it</button>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`}`;
}

async function loadControls(el) {
    const res = await nui('live');
    if (res && res.ok) {
        State.killSwitch = res.killSwitch === true;
        State.blacklist = res.blacklist || {};
    }
    if (State.panel === 'settings') switchPanel('settings');
}

window.Panels.settings = {
    render(el) {
        setTopbar('Settings', 'What this server is running underneath');

        if (State.killSwitch === undefined) {
            State.killSwitch = false;
            State.blacklist = {};
            loadControls(el);
        }

        const boot = State.boot || {};
        const minigames = State.minigames || [];
        const available = minigames.filter(m => m.available);

        el.innerHTML = `
            ${tunablesBlock()}

            ${controlsBlock()}

            <div class="section-title" style="margin-top:26px">Bridges</div>
            <div class="card-grid">
                ${bridgeRow('Framework', boot.framework, !!boot.framework)}
                ${bridgeRow('Inventory', boot.inventory, !!boot.inventory)}
                ${bridgeRow('Target', boot.target, !!boot.target)}
                ${bridgeRow('Dispatch', boot.dispatch || 'notifications only', true)}
                ${bridgeRow('Door locks', boot.doorlock || 'none found', !!boot.doorlock)}
                ${bridgeRow('MDT', boot.mdt || 'no paperwork filed', !!boot.mdt)}
            </div>

            <div class="section-title" style="margin-top:26px">Minigames</div>
            <div class="field-hint" style="margin-bottom:12px">
                ${available.length} of ${minigames.length} available on this server. Missing ones stay listed so you can see what installing them would give you.
            </div>
            <table class="table">
                <thead><tr><th>Minigame</th><th>From</th><th>What it is</th><th>State</th></tr></thead>
                <tbody>
                    ${minigames.map(m => `
                        <tr>
                            <td>${esc(m.label)}</td>
                            <td class="mono">${esc(m.resource || 'built in')}</td>
                            <td style="color:var(--text-muted)">${esc(m.blurb || '')}</td>
                            <td><span class="badge ${m.available ? 'on' : 'off'}">${m.available ? 'Ready' : 'Missing'}</span></td>
                        </tr>`).join('')}
                </tbody>
            </table>

            <div class="section-title" style="margin-top:26px">Stage types</div>
            <div class="card-grid">
                ${(State.stageTypes || []).map(t => `
                    <div class="card" style="cursor:default;--type-colour:${rgbSolid(t.colour)}">
                        <div class="card-head">
                            <div>
                                <div class="card-title" style="color:${rgbSolid(t.colour)}">${esc(t.label)}</div>
                                <div class="card-sub">${esc(t.blurb || '')}</div>
                            </div>
                        </div>
                    </div>`).join('')}
            </div>`;

        let pickedTheme = null;

        document.querySelectorAll('[data-theme-pick]').forEach(sw => {
            sw.addEventListener('click', () => {
                pickedTheme = sw.dataset.themePick;
                applyTheme(pickedTheme);
                document.querySelectorAll('[data-theme-pick]').forEach(o =>
                    o.classList.toggle('active', o === sw));
            });
        });

        document.getElementById('s-save-tunables')?.addEventListener('click', async () => {
            const values = {};

            document.querySelectorAll('[data-tunable]').forEach(field => {
                values[field.dataset.tunable] = field.type === 'checkbox'
                    ? field.checked
                    : parseFloat(field.value);
            });

            if (pickedTheme) values.theme = pickedTheme;

            const res = await nui('saveTunables', values);
            if (!reportResult(res, 'Applied', 'Live on the server now.')) return;

            State.settings = res.settings || State.settings;
            switchPanel('settings');
        });

        document.getElementById('s-killswitch')?.addEventListener('change', async (e) => {
            const on = e.target.checked;
            const res = await nui('killSwitch', on);
            if (!reportResult(res, on ? 'Everything is off' : 'Back on',
                on ? 'Nobody can start a robbery.' : 'Robberies can be started again.')) {
                e.target.checked = !on;
                return;
            }
            State.killSwitch = res.killSwitch === true;
            switchPanel('settings');
        });

        el.querySelectorAll('[data-unban]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const res = await nui('blacklist', { citizenid: btn.dataset.unban, on: false });
                if (!reportResult(res, 'Lifted', '')) return;
                State.blacklist = res.blacklist || {};
                switchPanel('settings');
            });
        });
    },
};
