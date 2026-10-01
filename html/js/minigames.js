const MG = {
    root: null,
    resolve: null,
    timer: null,
    raf: null,
    keydown: null,
    keyup: null,
    deadline: 0,
};

function mgShell(title, hint, body) {
    MG.root.innerHTML = `
        <div class="mg-shell">
            <div class="mg-head">
                <div class="mg-title">${esc(title)}</div>
                <div class="mg-timer" id="mg-timer">0.0</div>
            </div>
            <div class="mg-hint">${esc(hint)}</div>
            <div class="mg-bar"><div class="mg-bar-fill" id="mg-bar" style="width:100%"></div></div>
            <div class="mg-stage" id="mg-stage">${body}</div>
        </div>`;
}

function mgStop() {
    if (MG.timer) { clearInterval(MG.timer); MG.timer = null; }
    if (MG.raf) { cancelAnimationFrame(MG.raf); MG.raf = null; }
    if (MG.keydown) { window.removeEventListener('keydown', MG.keydown); MG.keydown = null; }
    if (MG.keyup) { window.removeEventListener('keyup', MG.keyup); MG.keyup = null; }
}

function mgEnd(passed) {
    if (!MG.resolve) return;

    mgStop();

    const stage = document.getElementById('mg-stage');
    if (stage) {
        stage.insertAdjacentHTML('beforeend',
            `<div class="mg-result ${passed ? 'pass' : 'fail'}">${passed ? 'Open' : 'Failed'}</div>`);
    }

    const done = MG.resolve;
    MG.resolve = null;

    setTimeout(() => {
        MG.root.classList.add('hidden');
        MG.root.innerHTML = '';
        done(passed);
    }, 520);
}

function mgClock(seconds) {
    MG.deadline = performance.now() + seconds * 1000;

    MG.timer = setInterval(() => {
        const left = Math.max(0, MG.deadline - performance.now());
        const label = document.getElementById('mg-timer');
        const bar = document.getElementById('mg-bar');

        if (label) label.textContent = (left / 1000).toFixed(1);
        if (bar) bar.style.width = `${(left / (seconds * 1000)) * 100}%`;

        if (left <= 0) mgEnd(false);
    }, 60);
}

function mgKeys(handler) {
    MG.keydown = (e) => {
        if (e.repeat && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
        handler(e);
    };
    window.addEventListener('keydown', MG.keydown);
}

function mgHeld(codes) {
    const held = {};
    MG.keydown = (e) => {
        if (!codes.includes(e.code)) return;
        held[e.code] = true;
        e.preventDefault();
    };
    MG.keyup = (e) => {
        if (codes.includes(e.code)) held[e.code] = false;
    };
    window.addEventListener('keydown', MG.keydown);
    window.addEventListener('keyup', MG.keyup);
    return held;
}

function mgLoop(step) {
    let last = performance.now();
    const frame = (now) => {
        if (!MG.resolve) return;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        if (step(dt) === false) return;
        MG.raf = requestAnimationFrame(frame);
    };
    MG.raf = requestAnimationFrame(frame);
}

function mgLives(count) {
    return count > 1 ? `<div class="mg-radar-count" style="text-align:center">Mistakes left <b id="mg-lives">${count - 1}</b></div>` : '';
}

function mgSpendLife(state) {
    state.lives -= 1;
    const el = document.getElementById('mg-lives');
    if (el) el.textContent = Math.max(0, state.lives - 1);
    return state.lives > 0;
}

function mgSignalLock(d) {
    const rounds = d;
    const width = 24 - d * 3;
    const speed = 22 + d * 6;
    const fill = 70 + d * 5;
    let locked = 0, round = 1, pos = 50;
    let dir = Math.random() > .5 ? 1 : -1;
    let band = 15 + Math.random() * (70 - width);

    mgShell('Signal Lock', 'Hold SPACE while the carrier is inside the band. Holding it outside drains the lock.', `
        <div class="mg-track" id="mg-track">
            <div class="mg-band" id="mg-band"></div>
            <div class="mg-carrier" id="mg-carrier"></div>
        </div>
        <div class="mg-bar"><div class="mg-bar-fill" id="mg-lock" style="width:0%"></div></div>
        ${rounds > 1 ? `<div class="mg-radar-count" style="text-align:center">Lock <b id="mg-round">1</b> / ${rounds}</div>` : ''}`);

    mgClock(10 + rounds * 12);

    const held = mgHeld(['Space']);
    const bandEl = document.getElementById('mg-band');
    const carrierEl = document.getElementById('mg-carrier');
    const lockEl = document.getElementById('mg-lock');
    bandEl.style.width = `${width}%`;

    mgLoop((dt) => {
        pos += dir * speed * dt;
        if (pos <= 0 || pos >= 100) { dir = -dir; pos = Math.max(0, Math.min(100, pos)); }

        const inside = pos >= band && pos <= band + width;
        if (held.Space) locked += inside ? fill * dt : -45 * dt;
        locked = Math.max(0, Math.min(100, locked));

        carrierEl.style.left = `${pos}%`;
        bandEl.style.left = `${band}%`;
        lockEl.style.width = `${locked}%`;

        if (locked >= 100) {
            if (round >= rounds) { mgEnd(true); return false; }
            round += 1;
            locked = 0;
            band = 10 + Math.random() * (80 - width);
            const label = document.getElementById('mg-round');
            if (label) label.textContent = round;
        }
    });
}

function mgCircuit(d) {
    const size = d >= 3 ? 4 : 3;
    const cells = new Array(size * size).fill(false);

    const flip = (i) => {
        const r = Math.floor(i / size), c = i % size;
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                cells[nr * size + nc] = !cells[nr * size + nc];
            }
        });
    };

    const picks = new Set();
    while (picks.size < d + 1) picks.add(Math.floor(Math.random() * cells.length));
    picks.forEach(flip);
    if (cells.every(v => !v)) flip(Math.floor(Math.random() * cells.length));

    mgShell('Circuit Routing', 'Switch every live node off. Each one you press flips its neighbours too.',
        `<div class="mg-grid" id="mg-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${cells.map((_, i) => `<div class="mg-cell" data-i="${i}"></div>`).join('')}
        </div>`);

    mgClock(20 + d * 8);

    const grid = document.getElementById('mg-grid');
    const paint = () => {
        grid.querySelectorAll('.mg-cell').forEach((el, i) => el.classList.toggle('lit', cells[i]));
    };

    grid.addEventListener('click', (e) => {
        const i = e.target.dataset.i;
        if (i === undefined || !MG.resolve) return;
        flip(parseInt(i, 10));
        paint();
        if (cells.every(v => !v)) mgEnd(true);
    });

    paint();
}

function mgTumbler(d) {
    const pins = 2 + d;
    const tolerance = 14 - d * 2;
    const speed = 55 + d * 15;
    const resetAll = d >= 3;
    let active = 0, height = 0, rising = true;
    const notches = Array.from({ length: pins }, () => 30 + Math.random() * 55);

    mgShell('Tumbler', resetAll ? 'SPACE when each pin reaches its notch. A miss drops every pin.' : 'SPACE when each pin reaches its notch.',
        `<div class="mg-pins" id="mg-pins">
            ${notches.map((n, i) => `
                <div class="mg-pin" data-i="${i}">
                    <i class="mg-notch" style="bottom:${n - tolerance}%;height:${tolerance * 2}%"></i>
                    <div class="mg-pin-fill" style="height:0%"></div>
                </div>`).join('')}
        </div>`);

    mgClock(12 + pins * 4);

    const pinEls = [...document.querySelectorAll('.mg-pins > .mg-pin')];

    mgKeys((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();

        if (Math.abs(height - notches[active]) <= tolerance) {
            pinEls[active].classList.add('set');
            active += 1;
            height = 0;
            rising = true;
            if (active >= pins) mgEnd(true);
            return;
        }

        if (resetAll) {
            pinEls.forEach(el => el.classList.remove('set'));
            active = 0;
        }
        height = 0;
        rising = true;
    });

    mgLoop((dt) => {
        height += (rising ? 1 : -1) * speed * dt;
        if (height >= 100) { height = 100; rising = false; }
        if (height <= 0) { height = 0; rising = true; }

        pinEls.forEach((el, i) => {
            el.classList.toggle('active', i === active);
            el.querySelector('.mg-pin-fill').style.height = `${i < active ? 100 : (i === active ? height : 0)}%`;
        });
    });
}

function mgSequence(d) {
    const size = 3;
    const length = 2 + d;
    const order = Array.from({ length }, () => Math.floor(Math.random() * size * size));
    let index = 0;
    let accepting = false;

    mgShell('Sequence Recall', 'Watch the order, then repeat it.',
        `<div class="mg-grid" id="mg-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${Array.from({ length: size * size }, (_, i) => `<div class="mg-cell" data-i="${i}"></div>`).join('')}
        </div>`);

    const grid = document.getElementById('mg-grid');
    const cells = [...grid.querySelectorAll('.mg-cell')];

    const play = (step) => {
        if (!MG.resolve) return;
        if (step >= order.length) {
            accepting = true;
            mgClock(6 + length * 1.6);
            return;
        }

        const el = cells[order[step]];
        el.classList.add('lit');
        setTimeout(() => {
            el.classList.remove('lit');
            setTimeout(() => play(step + 1), 200);
        }, 560 - d * 50);
    };

    grid.addEventListener('click', (e) => {
        if (!accepting || !MG.resolve) return;
        const i = e.target.dataset.i;
        if (i === undefined) return;

        const picked = parseInt(i, 10);
        if (picked !== order[index]) {
            e.target.classList.add('bad');
            mgEnd(false);
            return;
        }

        e.target.classList.add('on');
        setTimeout(() => e.target.classList.remove('on'), 180);
        index += 1;
        if (index >= order.length) mgEnd(true);
    });

    setTimeout(() => play(0), 500);
}

function mgFrequency(d) {
    const target = 15 + Math.random() * 70;
    const tolerance = 9 - d * 1.5;
    const speed = 34;
    let value = Math.random() > .5 ? 5 : 95;
    let lock = 0;

    mgShell('Frequency Match', 'A and D to tune. Hold it on the signal until it locks.', `
        <div class="mg-track" id="mg-track">
            <div class="mg-band" id="mg-band"></div>
            <div class="mg-carrier" id="mg-carrier"></div>
        </div>
        <div class="mg-bar"><div class="mg-bar-fill" id="mg-lock" style="width:0%"></div></div>`);

    mgClock(12 + d * 3);

    const band = document.getElementById('mg-band');
    const carrier = document.getElementById('mg-carrier');
    const lockEl = document.getElementById('mg-lock');
    band.style.width = `${tolerance * 2}%`;
    band.style.left = `${target - tolerance}%`;

    const held = mgHeld(['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']);
    const floor = d === 1 ? 0.35 : d === 2 ? 0.15 : 0;

    mgLoop((dt) => {
        if (held.KeyA || held.ArrowLeft) value = Math.max(0, value - speed * dt);
        if (held.KeyD || held.ArrowRight) value = Math.min(100, value + speed * dt);

        const off = Math.abs(value - target);
        lock += off <= tolerance ? 75 * dt : -30 * dt;
        lock = Math.max(0, Math.min(100, lock));

        carrier.style.left = `${value}%`;
        lockEl.style.width = `${lock}%`;
        band.style.opacity = String(Math.max(floor, 1 - off / 40));

        if (lock >= 100) { mgEnd(true); return false; }
    });
}

function mgWireTrace(d) {
    const WIRES = [
        { label: 'Red',    colour: '#ff5a5f' },
        { label: 'Blue',   colour: '#4c9aff' },
        { label: 'Green',  colour: '#30d158' },
        { label: 'Amber',  colour: '#f5a524' },
        { label: 'Violet', colour: '#a882ff' },
        { label: 'White',  colour: '#eef2f4' },
    ];

    const count = 2 + d;
    const pool = WIRES.slice().sort(() => Math.random() - .5).slice(0, count);
    const answer = pool[Math.floor(Math.random() * pool.length)];

    mgShell('Wire Trace', 'Read the tag, then cut the wire it names.',
        `<div style="text-align:center;font-family:var(--font-head);font-size:22px;letter-spacing:.14em;padding:14px 0"
              id="mg-tag">${esc(answer.label.toUpperCase())}</div>
         <div class="mg-wires hidden" id="mg-wires">
            ${pool.map((w, i) => `
                <div class="mg-wire" data-i="${i}">
                    <span class="mg-wire-swatch" style="background:${w.colour}"></span>
                    <span class="mg-wire-label">Line ${i + 1}</span>
                </div>`).join('')}
         </div>`);

    setTimeout(() => {
        const tag = document.getElementById('mg-tag');
        if (!tag || !MG.resolve) return;
        tag.textContent = '— — —';
        document.getElementById('mg-wires').classList.remove('hidden');
        mgClock(6 + d);
    }, 2200 - d * 300);

    document.getElementById('mg-wires').addEventListener('click', (e) => {
        const row = e.target.closest('.mg-wire');
        if (!row || !MG.resolve) return;
        row.classList.add('cut');
        mgEnd(pool[parseInt(row.dataset.i, 10)].label === answer.label);
    });
}

function mgThermite(d) {
    const size = d >= 2 ? 4 : 3;
    const lit = 2 + d;
    const showFor = 3200 - d * 500;
    const state = { lives: d === 1 ? 2 : 1 };

    const cells = size * size;
    const pattern = new Set();
    while (pattern.size < Math.min(lit, cells - 1)) pattern.add(Math.floor(Math.random() * cells));

    const picked = new Set();
    let armed = false;

    mgShell('Thermite', 'Remember the lit cells, then click them.', `
        <div class="mg-grid" id="mg-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${Array.from({ length: cells }, (_, i) => `<div class="mg-cell" data-i="${i}"></div>`).join('')}
        </div>
        ${mgLives(state.lives)}`);

    const grid = document.getElementById('mg-grid');
    const cellAt = (i) => grid.querySelector(`[data-i="${i}"]`);

    pattern.forEach(i => cellAt(i).classList.add('on'));

    setTimeout(() => {
        if (!MG.resolve) return;
        pattern.forEach(i => cellAt(i).classList.remove('on'));
        armed = true;
        mgClock(4 + pattern.size * 1.6);
    }, showFor);

    grid.addEventListener('click', (e) => {
        if (!armed || !MG.resolve) return;
        const cell = e.target.closest('.mg-cell');
        if (!cell) return;

        const i = Number(cell.dataset.i);
        if (picked.has(i)) return;
        picked.add(i);

        if (!pattern.has(i)) {
            cell.classList.add('bad');
            if (!mgSpendLife(state)) mgEnd(false);
            return;
        }

        cell.classList.add('on');
        if ([...pattern].every(p => picked.has(p))) mgEnd(true);
    });
}

function mgFingerprint(d) {
    const options = 3 + d * 2;
    const spread = d === 1 ? 6 : 4;
    const answer = Math.floor(Math.random() * options);

    const signature = () => Array.from({ length: 7 }, () => Math.floor(Math.random() * (spread * 2 + 1)) - spread);
    const signatures = [];
    const seen = new Set();

    while (signatures.length < options) {
        const candidate = signature();
        const key = candidate.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        signatures.push(candidate);
    }

    const print = (offsets) => {
        const arcs = offsets.map((off, i) => {
            const r = 6 + i * 4.5;
            return `<ellipse cx="${30 + off}" cy="32" rx="${r}" ry="${r * 1.25}"
                fill="none" stroke="currentColor" stroke-width="1.6" opacity="${0.35 + i * 0.09}"/>`;
        });
        return `<svg viewBox="0 0 60 64" class="mg-print">${arcs.join('')}</svg>`;
    };

    mgShell('Fingerprint', 'Find the one that matches the print on file.', `
        <div class="mg-print-row">
            <div class="mg-print-file">
                <div class="mg-print-label">On file</div>
                ${print(signatures[answer])}
            </div>
            <div class="mg-print-grid" id="mg-prints">
                ${Array.from({ length: options }, (_, i) => `
                    <div class="mg-print-card" data-i="${i}">${print(signatures[i])}</div>`).join('')}
            </div>
        </div>`);

    mgClock(16 - d * 2);

    document.getElementById('mg-prints').addEventListener('click', (e) => {
        const card = e.target.closest('.mg-print-card');
        if (!card || !MG.resolve) return;
        const picked = Number(card.dataset.i);
        card.classList.add(picked === answer ? 'good' : 'bad');
        mgEnd(picked === answer);
    });
}

function mgDrill(d) {
    let depth = 0, heat = 0, pressure = 0;
    const safe = 72 - d * 6;
    const rate = 18 + d * 2;

    mgShell('Drill', 'Hold W to lean in, S to ease off. Keep the pressure under the line or it overheats.', `
        <div class="mg-drill">
            <div class="mg-gauge press"><div class="mg-gauge-fill" id="mg-press"></div><i class="mg-gauge-line" style="bottom:${safe}%"></i><span>Pressure</span></div>
            <div class="mg-gauge"><div class="mg-gauge-fill" id="mg-depth"></div><span>Depth</span></div>
            <div class="mg-gauge heat"><div class="mg-gauge-fill" id="mg-heat"></div><span>Heat</span></div>
        </div>`);

    mgClock(18 + d * 3);

    const held = mgHeld(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown']);
    const p = document.getElementById('mg-press');
    const dEl = document.getElementById('mg-depth');
    const h = document.getElementById('mg-heat');

    mgLoop((dt) => {
        if (held.KeyW || held.ArrowUp) pressure = Math.min(100, pressure + 80 * dt);
        else if (held.KeyS || held.ArrowDown) pressure = Math.max(0, pressure - 110 * dt);
        else pressure = Math.max(0, pressure - 35 * dt);

        depth = Math.min(100, depth + (pressure / 100) * rate * dt);
        heat = pressure > safe
            ? Math.min(100, heat + (pressure - safe) * 1.6 * dt)
            : Math.max(0, heat - 28 * dt);

        p.style.height = `${pressure}%`;
        dEl.style.height = `${depth}%`;
        h.style.height = `${heat}%`;

        if (heat >= 100) { mgEnd(false); return false; }
        if (depth >= 100) { mgEnd(true); return false; }
    });
}

function mgPinPad(d) {
    const length = d >= 3 ? 4 : 3;
    const guesses = 8 - d;
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - .5);
    const code = d >= 3
        ? Array.from({ length }, () => Math.floor(Math.random() * 10))
        : digits.slice(0, length);

    let entry = [];
    let left = guesses;

    mgShell('Pin Pad', `Type ${length} digits. Each guess says how many are in the right place and how many are in the code but somewhere else.`, `
        <div class="mg-pin">
            <div class="mg-pin-entry" id="mg-entry"></div>
            <div class="mg-pin-history" id="mg-history"></div>
            <div class="mg-pin-left">Guesses left: <b id="mg-left">${left}</b></div>
        </div>`);

    mgClock(30 + d * 10);

    const paint = () => {
        document.getElementById('mg-entry').innerHTML =
            Array.from({ length }, (_, i) =>
                `<span class="mg-digit${entry[i] !== undefined ? ' set' : ''}">${entry[i] ?? '-'}</span>`).join('');
    };

    paint();

    mgKeys((e) => {
        if (e.code === 'Backspace') { entry.pop(); paint(); return; }

        const digit = e.key >= '0' && e.key <= '9' ? Number(e.key) : null;
        if (digit === null || entry.length >= length) return;

        entry.push(digit);
        paint();
        if (entry.length < length) return;

        const exact = entry.filter((v, i) => v === code[i]).length;
        if (exact === length) { mgEnd(true); return; }

        const pool = code.filter((v, i) => entry[i] !== v);
        let near = 0;
        entry.forEach((v, i) => {
            if (v === code[i]) return;
            const at = pool.indexOf(v);
            if (at >= 0) { near += 1; pool.splice(at, 1); }
        });

        left -= 1;
        document.getElementById('mg-history').insertAdjacentHTML('afterbegin',
            `<div class="mg-pin-row"><span>${entry.join(' ')}</span>
             <b class="good">${exact} right place</b><b class="near">${near} wrong place</b></div>`);
        document.getElementById('mg-left').textContent = left;

        entry = [];
        paint();
        if (left <= 0) mgEnd(false);
    });
}

function mgBypass(d) {
    const gates = 2 + d;
    const width = 16 - d * 2;
    const speed = 30 + d * 12;
    const state = { lives: d >= 3 ? 1 : 2 };

    const targets = [];
    for (let i = 0; i < gates; i++) {
        targets.push(10 + (i * (80 / gates)) + Math.random() * (80 / gates - width));
    }

    let cursor = 0, dir = 1, index = 0;

    mgShell('Bypass', 'SPACE stops the cursor. Land inside each gate, left to right.', `
        <div class="mg-bypass">
            <div class="mg-track" id="mg-track">
                ${targets.map((t, i) => `<div class="mg-gate" data-g="${i}" style="left:${t}%;width:${width}%"></div>`).join('')}
                <div class="mg-cursor" id="mg-cursor"></div>
            </div>
        </div>
        ${mgLives(state.lives)}`);

    mgClock(8 + gates * 3);

    const cursorEl = document.getElementById('mg-cursor');
    mgLoop((dt) => {
        cursor += dir * speed * dt;
        if (cursor >= 100) { cursor = 100; dir = -1; }
        if (cursor <= 0) { cursor = 0; dir = 1; }
        cursorEl.style.left = `${cursor}%`;
    });

    mgKeys((e) => {
        if (e.code !== 'Space' || !MG.resolve) return;
        e.preventDefault();

        const t = targets[index];
        const gate = document.querySelector(`[data-g="${index}"]`);

        if (cursor >= t && cursor <= t + width) {
            if (gate) gate.classList.add('hit');
            index += 1;
            if (index >= gates) mgEnd(true);
            return;
        }

        if (gate) {
            gate.classList.add('miss');
            setTimeout(() => gate.classList.remove('miss'), 300);
        }
        if (!mgSpendLife(state)) mgEnd(false);
    });
}

function mgSweep(d) {
    const hits = 2 + d;
    const tolerance = 26 - d * 4;
    const speed = 90 + d * 30;
    const state = { lives: d >= 3 ? 1 : 2 };

    let angle = 0;
    let contact = Math.random() * 360;
    let done = 0;

    mgShell('Sweep', 'SPACE when the sweep crosses the contact.', `
        <div class="mg-radar">
            <div class="mg-radar-face">
                <div class="mg-contact" id="mg-contact"></div>
                <div class="mg-sweep" id="mg-sweep"></div>
            </div>
            <div class="mg-radar-count"><b id="mg-hits">0</b> / ${hits}</div>
        </div>
        ${mgLives(state.lives)}`);

    mgClock(8 + hits * 3.5);

    const place = () => {
        const el = document.getElementById('mg-contact');
        if (el) el.style.transform = `rotate(${contact}deg) translateY(-64px)`;
    };
    place();

    const sweepEl = document.getElementById('mg-sweep');
    mgLoop((dt) => {
        angle = (angle + speed * dt) % 360;
        sweepEl.style.transform = `rotate(${angle}deg)`;
    });

    mgKeys((e) => {
        if (e.code !== 'Space' || !MG.resolve) return;
        e.preventDefault();

        let diff = Math.abs(((angle - contact + 540) % 360) - 180);
        diff = 180 - diff;

        if (diff > tolerance) {
            if (!mgSpendLife(state)) mgEnd(false);
            return;
        }

        done += 1;
        const label = document.getElementById('mg-hits');
        if (label) label.textContent = done;
        if (done >= hits) { mgEnd(true); return; }

        contact = (contact + 90 + Math.random() * 180) % 360;
        place();
    });
}

const XS_MINIGAMES = {
    signal_lock: mgSignalLock,
    circuit: mgCircuit,
    tumbler: mgTumbler,
    sequence: mgSequence,
    frequency: mgFrequency,
    wire_trace: mgWireTrace,
    thermite: mgThermite,
    fingerprint: mgFingerprint,
    drill: mgDrill,
    pinpad: mgPinPad,
    bypass: mgBypass,
    sweep: mgSweep,
};

function startMinigame(kind, difficulty) {
    return new Promise((resolve) => {
        const game = XS_MINIGAMES[kind];
        if (!game) { resolve(true); return; }

        MG.root = document.getElementById('minigame');
        MG.root.classList.remove('hidden');
        MG.resolve = resolve;

        game(Math.max(1, Math.min(3, Number(difficulty) || 2)));
    });
}

window.addEventListener('message', async (event) => {
    const msg = event.data || {};
    if (msg.action !== 'minigame') return;

    const passed = await startMinigame(msg.kind, msg.difficulty);
    nui('minigameResult', { passed });
});
