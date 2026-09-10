window.Panels = window.Panels || {};

const OUTCOME_BADGE = {
    completed: 'on',
    failed: 'danger',
    abandoned: 'warn',
    active: 'info',
};

window.Panels.history = {
    async render(el) {
        setTopbar('History', 'Every run this server has recorded');

        el.innerHTML = '<div class="field-hint">Loading…</div>';

        const res = await nui('history', 100);
        const runs = (res && res.ok && res.runs) || [];

        if (runs.length === 0) {
            el.innerHTML = emptyState('&#9202;', 'No runs yet',
                'Once people start robbing the places you have built, every attempt lands here with who took part and what it paid.');
            return;
        }

        el.innerHTML = `
            <div class="section-title">Recent runs</div>
            <table class="table">
                <thead>
                    <tr><th>Robbery</th><th>Started</th><th>Outcome</th><th>Crew</th><th>Payout</th></tr>
                </thead>
                <tbody>
                    ${runs.map(run => `
                        <tr>
                            <td>${esc(run.name)}</td>
                            <td class="mono">${esc(run.started_at || '')}</td>
                            <td><span class="badge ${OUTCOME_BADGE[run.outcome] || 'off'}">${esc(run.outcome)}</span></td>
                            <td>${(run.participants || []).length}</td>
                            <td class="mono">$${esc(run.payout || 0)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    },
};
