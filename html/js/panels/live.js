window.Panels = window.Panels || {};

const ALARM_BADGE = {
    quiet: 'off',
    none: 'off',
    silent: 'info',
    pending: 'warn',
    raised: 'danger',
};

const ALARM_LABEL = {
    quiet: 'quiet',
    none: 'no alarm',
    silent: 'silent',
    pending: 'arming',
    raised: 'police alerted',
};

function liveCard(run) {
    const crew = (run.participants || []).filter(p => p.name);

    return `
        <div class="card" style="cursor:default" data-run="${esc(run.locationId)}">
            <div class="card-head">
                <div>
                    <div class="card-title">${esc(run.name || 'Robbery')}</div>
                    <div class="card-sub">${esc(run.location || '')}</div>
                </div>
                <span class="badge ${ALARM_BADGE[run.alarm] || 'off'}">${esc(ALARM_LABEL[run.alarm] || run.alarm)}</span>
            </div>
            <div class="card-stats">
                <div>
                    <div class="stat-label">Progress</div>
                    <div class="stat-value" style="font-size:12px">${esc(run.stage || '')}</div>
                </div>
                <div>
                    <div class="stat-label">Elapsed</div>
                    <div class="stat-value">${esc(fmtDuration(run.elapsed || 0))}</div>
                </div>
                <div>
                    <div class="stat-label">Pot</div>
                    <div class="stat-value">$${esc(run.pot || 0)}</div>
                </div>
            </div>
            ${crew.length ? `
                <div class="section-title" style="margin:14px 0 8px">Inside</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${crew.map(p => `
                        <span class="badge off" data-ban="${esc(p.citizenid)}" data-name="${esc(p.name)}"
                              title="Ban them from robberies" style="cursor:pointer">${esc(p.name)} &times;</span>`).join('')}
                </div>` : ''}
            <div class="card-stats" style="border-top:none;padding-top:12px;gap:7px">
                <button class="btn btn-sm btn-danger" data-end="${esc(run.locationId)}">End it</button>
            </div>
        </div>`;
}

async function refreshLive(el) {
    const res = await nui('live');
    const runs = (res && res.ok && res.runs) || [];

    State.liveRuns = runs;
    if (res && res.ok) {
        State.killSwitch = res.killSwitch === true;
        State.blacklist = res.blacklist || {};
    }

    document.getElementById('badge-live').textContent = runs.length || '';
    document.querySelector('.live-dot')?.classList.toggle('on', runs.length > 0);

    if (State.panel !== 'live') return;

    if (runs.length === 0) {
        el.innerHTML = emptyState('&#9679;', 'Nothing in progress',
            'Active robberies appear here the moment they start, with who is inside and how far they have got.');
    } else {
        el.innerHTML = `
            <div class="section-title">In progress</div>
            <div class="card-grid">${runs.map(liveCard).join('')}</div>`;

        el.querySelectorAll('[data-end]').forEach(btn => {
            btn.addEventListener('click', () => {
                const run = runs.find(r => String(r.locationId) === btn.dataset.end);
                confirmDanger('End this run?',
                    `Everyone inside "${run ? run.location : 'it'}" is told it is over. They keep whatever is already in their pockets; the pot is lost.`,
                    async () => {
                        const result = await nui('forceEnd', parseInt(btn.dataset.end, 10));
                        if (reportResult(result, 'Ended', run ? run.location : '')) refreshLive(el);
                    }, 'End it');
            });
        });

        el.querySelectorAll('[data-ban]').forEach(chip => {
            chip.addEventListener('click', () => {
                confirmDanger('Ban them from robberies?',
                    `${chip.dataset.name} will not be able to start or join one until you lift it in Settings.`,
                    async () => {
                        const result = await nui('blacklist', {
                            citizenid: chip.dataset.ban,
                            name: chip.dataset.name,
                            on: true,
                        });
                        if (reportResult(result, 'Banned', chip.dataset.name)) {
                            State.blacklist = result.blacklist || {};
                        }
                    }, 'Ban them');
            });
        });
    }

    setTimeout(() => {
        if (State.panel === 'live') refreshLive(el);
    }, 4000);
}

window.Panels.live = {
    render(el) {
        setTopbar('Live', 'Runs happening right now');
        el.innerHTML = '<div class="field-hint">Checking…</div>';
        refreshLive(el);
    },
};
