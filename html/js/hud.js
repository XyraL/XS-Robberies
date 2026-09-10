const Hud = {
    el: null,
    startedAt: 0,
    offset: 0,
    ticker: null,
};

const ALARM_TEXT = {
    quiet:   ['Quiet', 'quiet'],
    none:    ['No alarm', 'quiet'],
    silent:  ['Silent alarm', 'silent'],
    pending: ['Alarm arming', 'pending'],
    raised:  ['Police alerted', 'raised'],
};

function hudElapsed() {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Hud.startedAt + Hud.offset);
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function hudTick() {
    const clock = document.getElementById('hud-clock');
    if (clock) clock.textContent = hudElapsed();

    const escape = document.getElementById('hud-escape');
    if (!escape) return;

    const left = Hud.escapeDeadline - (Math.floor(Date.now() / 1000) + Hud.offset);
    if (left <= 0) {
        escape.textContent = 'Out of time';
        return;
    }

    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    escape.textContent = `Get clear ${m}:${s}`;
}

function hudShow(data) {
    const root = document.getElementById('hud');
    root.classList.remove('hidden');

    const [alarmLabel, alarmClass] = ALARM_TEXT[data.alarm] || ALARM_TEXT.quiet;

    Hud.startedAt = data.startedAt || 0;
    Hud.escapeDeadline = data.escapeDeadline || 0;
    Hud.offset = Math.floor(Date.now() / 1000) - (data.serverTime || Math.floor(Date.now() / 1000));
    Hud.offset = -Hud.offset;

    root.innerHTML = `
        <div class="hud-head">
            <div class="hud-title">${esc(data.label || 'Job')}</div>
            <div class="hud-clock" id="hud-clock">00:00</div>
        </div>
        <div class="hud-alarm ${alarmClass}">
            <span class="hud-alarm-dot"></span>${esc(alarmLabel)}
        </div>
        ${data.escapeDeadline ? '<div class="hud-escape" id="hud-escape"></div>' : ''}
        <div class="hud-objectives">
            ${(data.objectives || []).map(o => `
                <div class="hud-objective ${o.state}">
                    <span class="hud-mark"></span>
                    <span class="hud-label">${esc(o.label)}</span>
                    ${o.optional ? '<span class="hud-opt">optional</span>' : ''}
                </div>`).join('')}
        </div>`;

    hudTick();
    if (Hud.ticker) clearInterval(Hud.ticker);
    Hud.ticker = setInterval(hudTick, 1000);
}

function hudHide() {
    const root = document.getElementById('hud');
    root.classList.add('hidden');
    root.innerHTML = '';
    if (Hud.ticker) { clearInterval(Hud.ticker); Hud.ticker = null; }
}

window.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.action === 'hud') hudShow(msg.data || {});
    else if (msg.action === 'hudHide') hudHide();
});
