const MG = {
    root: null,
    resolve: null,
    timer: null,
    raf: null,
    keydown: null,
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

// ── Signal Lock ──────────────────────────────────────────────────────────────
// A carrier drifts along the track. Hold it inside the band until the lock
// fills. Leaving the band drains it.

function mgSignalLock(difficulty) {
    const rounds = 1 + difficulty;
    const bandWidth = 26 - difficulty * 5;
    let locked = 0, target = 100, round = 1;
    let pos = 50, dir = (Math.random() > .5 ? 1 : -1) * (0.35 + difficulty * 0.18);
    let band = 20 + Math.random() * 55;
    let holding = false;

    mgShell('Signal Lock', 'Hold SPACE while the carrier sits inside the band.', `
        <div class="mg-track" id="mg-track">
            <div class="mg-band" id="mg-band"></div>
            <div class="mg-carrier" id="mg-carrier"></div>
        </div>
        <div class="mg-bar"><div class="mg-bar-fill" id="mg-lock" style="width:0%"></div></div>`);

    mgClock(9 + difficulty * 2);

    const bandEl = document.getElementById('mg-band');
    const carrierEl = document.getElementById('mg-carrier');
    const lockEl = document.getElementById('mg-lock');
    bandEl.style.width = `${bandWidth}%`;

    const down = (e) => { if (e.code === 'Space') { holding = true; e.preventDefault(); } };
    const up = (e) => { if (e.code === 'Space') holding = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    MG.keydown = down;

    const cleanup = () => window.removeEventListener('keyup', up);

    const frame = () => {
        pos += dir;
        if (pos <= 0 || pos >= 100) { dir = -dir; pos = Math.max(0, Math.min(100, pos)); }

        const inside = pos >= band && pos <= band + bandWidth;
        locked += (holding && inside) ? 1.6 + difficulty * 0.3 : -1.1;
        locked = Math.max(0, Math.min(target, locked));

        carrierEl.style.left = `${pos}%`;
        bandEl.style.left = `${band}%`;
        lockEl.style.width = `${locked}%`;

        if (locked >= target) {
            if (round >= rounds) { cleanup(); mgEnd(true); return; }
            round++;
            locked = 0;
            band = 8 + Math.random() * (84 - bandWidth);
            dir = (dir > 0 ? 1 : -1) * (0.35 + difficulty * 0.2 + round * 0.1);
        }

        if (MG.resolve) MG.raf = requestAnimationFrame(frame);
        else cleanup();
    };

    MG.raf = requestAnimationFrame(frame);
}

// ── Circuit Routing ──────────────────────────────────────────────────────────
// Lights-out. Every cell you flip flips its neighbours. Kill every light.

function mgCircuit(difficulty) {
    const size = 3 + Math.min(2, difficulty - 1);
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

    const scrambles = 2 + difficulty * 2;
    for (let n = 0; n < scrambles; n++) flip(Math.floor(Math.random() * cells.length));
    if (cells.every(v => !v)) flip(Math.floor(Math.random() * cells.length));

    mgShell('Circuit Routing', 'Cut every live node. Each one you touch flips its neighbours.',
        `<div class="mg-grid" id="mg-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${cells.map((_, i) => `<div class="mg-cell" data-i="${i}"></div>`).join('')}
        </div>`);

    mgClock(14 + difficulty * 4);

    const grid = document.getElementById('mg-grid');
    const paint = () => {
        grid.querySelectorAll('.mg-cell').forEach((el, i) => {
            el.classList.toggle('lit', cells[i]);
        });
    };

    grid.addEventListener('click', (e) => {
        const i = e.target.dataset.i;
        if (i === undefined) return;

        flip(parseInt(i, 10));
        paint();

        if (cells.every(v => !v)) mgEnd(true);
    });

    paint();
}

// ── Tumbler ──────────────────────────────────────────────────────────────────
// Set each pin as the driver passes its notch. Miss and the set drops.

function mgTumbler(difficulty) {
    const pins = 3 + difficulty;
    const tolerance = 16 - difficulty * 3;
    let active = 0, height = 0, rising = true;
    const speed = 1.4 + difficulty * 0.55;
    const notches = Array.from({ length: pins }, () => 30 + Math.random() * 55);

    mgShell('Tumbler', 'SPACE to set each pin when it reaches its notch.',
        `<div class="mg-pins" id="mg-pins">
            ${notches.map((_, i) => `
                <div class="mg-pin" data-i="${i}">
                    <div class="mg-pin-fill" style="height:0%"></div>
                </div>`).join('')}
        </div>`);

    mgClock(11 + difficulty * 3);

    const pinEls = [...document.querySelectorAll('.mg-pin')];

    mgKeys((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();

        if (Math.abs(height - notches[active]) <= tolerance) {
            pinEls[active].classList.add('set');
            pinEls[active].classList.remove('active');
            active++;
            height = 0;

            if (active >= pins) { mgEnd(true); return; }
        } else {
            pinEls.forEach(el => el.classList.remove('set'));
            active = 0;
            height = 0;
        }
    });

    const frame = () => {
        height += rising ? speed : -speed;
        if (height >= 100) { height = 100; rising = false; }
        if (height <= 0) { height = 0; rising = true; }

        pinEls.forEach((el, i) => {
            el.classList.toggle('active', i === active);
            el.querySelector('.mg-pin-fill').style.height = `${i < active ? 100 : (i === active ? height : 0)}%`;
        });

        if (MG.resolve) MG.raf = requestAnimationFrame(frame);
    };

    MG.raf = requestAnimationFrame(frame);
}

// ── Sequence Recall ──────────────────────────────────────────────────────────

function mgSequence(difficulty) {
    const size = 3;
    const length = 3 + difficulty;
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
        if (step >= order.length) {
            accepting = true;
            mgClock(4 + length * 1.4);
            return;
        }

        const el = cells[order[step]];
        el.classList.add('lit');
        setTimeout(() => {
            el.classList.remove('lit');
            setTimeout(() => play(step + 1), 160);
        }, 480 - difficulty * 60);
    };

    grid.addEventListener('click', (e) => {
        if (!accepting) return;
        const i = e.target.dataset.i;
        if (i === undefined) return;

        const picked = parseInt(i, 10);
        if (picked !== order[index]) {
            e.target.classList.add('bad');
            mgEnd(false);
            return;
        }

        e.target.classList.add('on');
        index++;
        if (index >= order.length) mgEnd(true);
    });

    setTimeout(() => play(0), 400);
}

// ── Frequency Match ──────────────────────────────────────────────────────────

function mgFrequency(difficulty) {
    const target = 15 + Math.random() * 70;
    const tolerance = 7 - difficulty * 1.5;
    const step = 0.9;
    let value = Math.random() > .5 ? 5 : 95;
    let held = 0;

    mgShell('Frequency Match', 'A and D to tune. Hold it on the carrier until it locks.', `
        <div class="mg-track" id="mg-track">
            <div class="mg-band" id="mg-band"></div>
            <div class="mg-carrier" id="mg-carrier"></div>
        </div>
        <div class="mg-bar"><div class="mg-bar-fill" id="mg-lock" style="width:0%"></div></div>`);

    mgClock(11 + difficulty * 2);

    const band = document.getElementById('mg-band');
    const carrier = document.getElementById('mg-carrier');
    const lock = document.getElementById('mg-lock');

    band.style.width = `${tolerance * 2}%`;
    band.style.left = `${target - tolerance}%`;
    band.style.opacity = '0';

    const keys = {};
    const down = (e) => { keys[e.code] = true; };
    const up = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    MG.keydown = down;

    const frame = () => {
        if (keys.KeyA) value = Math.max(0, value - step);
        if (keys.KeyD) value = Math.min(100, value + step);

        const off = Math.abs(value - target);
        held += off <= tolerance ? 1.7 : -1.4;
        held = Math.max(0, Math.min(100, held));

        carrier.style.left = `${value}%`;
        lock.style.width = `${held}%`;
        band.style.opacity = String(Math.max(0, 1 - off / 40));

        if (held >= 100) {
            window.removeEventListener('keyup', up);
            mgEnd(true);
            return;
        }

        if (MG.resolve) MG.raf = requestAnimationFrame(frame);
        else window.removeEventListener('keyup', up);
    };

    MG.raf = requestAnimationFrame(frame);
}

// ── Wire Trace ───────────────────────────────────────────────────────────────

function mgWireTrace(difficulty) {
    const WIRES = [
        { label: 'Red',    colour: '#ff5a5f' },
        { label: 'Blue',   colour: '#4c9aff' },
        { label: 'Green',  colour: '#30d158' },
        { label: 'Amber',  colour: '#f5a524' },
        { label: 'Violet', colour: '#a882ff' },
        { label: 'White',  colour: '#eef2f4' },
    ];

    const count = 3 + difficulty;
    const pool = WIRES.slice().sort(() => Math.random() - .5).slice(0, count);
    const answer = pool[Math.floor(Math.random() * pool.length)];

    mgShell('Wire Trace', 'Read the tag, then cut the one it names.',
        `<div style="text-align:center;font-family:var(--font-display);font-size:19px;letter-spacing:.1em;padding:14px 0"
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
        if (!tag) return;

        tag.textContent = '— — —';
        document.getElementById('mg-wires').classList.remove('hidden');
        mgClock(4 + difficulty);
    }, 1500 - difficulty * 250);

    document.getElementById('mg-wires').addEventListener('click', (e) => {
        const row = e.target.closest('.mg-wire');
        if (!row) return;

        row.classList.add('cut');
        mgEnd(pool[parseInt(row.dataset.i, 10)].label === answer.label);
    });
}


// ── Thermite ─────────────────────────────────────────────────────────────────
// A pattern lights up on the grid. Watch it, then put it back.

function mgThermite(difficulty) {
    const size = 3 + Math.min(2, difficulty - 1);
    const lit = 3 + difficulty;
    const showFor = 2600 - difficulty * 500;

    const cells = size * size;
    const pattern = new Set();
    while (pattern.size < Math.min(lit, cells - 1)) {
        pattern.add(Math.floor(Math.random() * cells));
    }

    const picked = new Set();
    let armed = false;

    mgShell('Thermite', 'Remember the pattern, then repeat it.', `
        <div class="mg-grid" id="mg-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${Array.from({ length: cells }, (_, i) =>
                `<div class="mg-cell" data-i="${i}"></div>`).join('')}
        </div>`);

    const grid = document.getElementById('mg-grid');
    const cellAt = (i) => grid.querySelector(`[data-i="${i}"]`);

    pattern.forEach(i => cellAt(i).classList.add('on'));

    setTimeout(() => {
        pattern.forEach(i => cellAt(i).classList.remove('on'));
        armed = true;
        mgClock(3 + pattern.size * 1.2);
    }, showFor);

    grid.addEventListener('click', (e) => {
        if (!armed) return;

        const cell = e.target.closest('.mg-cell');
        if (!cell) return;

        const i = Number(cell.dataset.i);
        if (picked.has(i)) return;

        picked.add(i);

        if (!pattern.has(i)) {
            cell.classList.add('bad');
            mgEnd(false);
            return;
        }

        cell.classList.add('on');
        if ([...pattern].every(p => picked.has(p))) mgEnd(true);
    });
}

// ── Fingerprint ──────────────────────────────────────────────────────────────
// One of these matches the print on file. The others are close.

function mgFingerprint(difficulty) {
    const options = 4 + difficulty * 2;
    const answer = Math.floor(Math.random() * options);

    // Every print has to look different from every other one, or the puzzle is
    // unfair. Build guaranteed-distinct ridge offsets rather than hashing a seed.
    const signature = () => Array.from({ length: 7 }, () => Math.floor(Math.random() * 9) - 4);
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
                    <div class="mg-print-card" data-i="${i}">
                        ${print(signatures[i])}
                    </div>`).join('')}
            </div>
        </div>`);

    mgClock(9 - difficulty);

    document.getElementById('mg-prints').addEventListener('click', (e) => {
        const card = e.target.closest('.mg-print-card');
        if (!card) return;

        const picked = Number(card.dataset.i);
        card.classList.add(picked === answer ? 'good' : 'bad');
        mgEnd(picked === answer);
    });
}

// ── Drill ────────────────────────────────────────────────────────────────────
// Lean on it with W and ease off with S. Too much heat and the bit goes.

function mgDrill(difficulty) {
    let depth = 0, heat = 0, pressure = 0;
    const speed = 0.16 + difficulty * 0.05;
    const cool = 0.55;

    mgShell('Drill', 'W leans in, S eases off. Watch the heat.', `
        <div class="mg-drill">
            <div class="mg-gauge"><div class="mg-gauge-fill" id="mg-depth"></div><span>Depth</span></div>
            <div class="mg-gauge heat"><div class="mg-gauge-fill" id="mg-heat"></div><span>Heat</span></div>
        </div>`);

    mgClock(16 + difficulty * 2);

    const held = { w: false, s: false };
    MG.keydown = (e) => {
        if (e.code === 'KeyW') held.w = true;
        if (e.code === 'KeyS') held.s = true;
    };
    const up = (e) => {
        if (e.code === 'KeyW') held.w = false;
        if (e.code === 'KeyS') held.s = false;
    };
    window.addEventListener('keydown', MG.keydown);
    window.addEventListener('keyup', up);

    const cleanup = () => window.removeEventListener('keyup', up);

    const tick = () => {
        if (!MG.resolve) { cleanup(); return; }

        if (held.w) pressure = Math.min(100, pressure + 2.2);
        else if (held.s) pressure = Math.max(0, pressure - 3.0);
        else pressure = Math.max(0, pressure - 1.0);

        depth = Math.min(100, depth + (pressure / 100) * speed * 2.4);
        heat = Math.max(0, heat + (pressure > 55 ? (pressure - 55) * 0.06 : -cool));

        const d = document.getElementById('mg-depth');
        const h = document.getElementById('mg-heat');
        if (d) d.style.height = `${depth}%`;
        if (h) h.style.height = `${heat}%`;

        if (heat >= 100) { cleanup(); mgEnd(false); return; }
        if (depth >= 100) { cleanup(); mgEnd(true); return; }

        MG.raf = requestAnimationFrame(tick);
    };

    MG.raf = requestAnimationFrame(tick);
}

// ── Pin Pad ──────────────────────────────────────────────────────────────────
// Guess the combination. Each guess tells you how close every digit is.

function mgPinPad(difficulty) {
    const length = 3 + Math.min(2, difficulty - 1);
    const guesses = 6 - difficulty;
    const code = Array.from({ length }, () => Math.floor(Math.random() * 10));

    let entry = [];
    let left = guesses;

    mgShell('Pin Pad', 'Every guess tells you which digits are right, and which are close.', `
        <div class="mg-pin">
            <div class="mg-pin-entry" id="mg-entry"></div>
            <div class="mg-pin-history" id="mg-history"></div>
            <div class="mg-pin-left">Guesses left: <b id="mg-left">${left}</b></div>
        </div>`);

    mgClock(16 + difficulty * 4);

    const paint = () => {
        document.getElementById('mg-entry').innerHTML =
            Array.from({ length }, (_, i) =>
                `<span class="mg-digit${entry[i] !== undefined ? ' set' : ''}">${entry[i] ?? '-'}</span>`).join('');
    };

    paint();

    mgKeys((e) => {
        if (e.code === 'Backspace') { entry.pop(); paint(); return; }

        const digit = e.key >= '0' && e.key <= '9' ? Number(e.key) : null;
        if (digit === null) return;
        if (entry.length >= length) return;

        entry.push(digit);
        paint();

        if (entry.length < length) return;

        const exact = entry.filter((d, i) => d === code[i]).length;
        if (exact === length) { mgEnd(true); return; }

        const near = entry.filter((d, i) => d !== code[i] && code.includes(d)).length;
        left -= 1;

        document.getElementById('mg-history').insertAdjacentHTML('afterbegin',
            `<div class="mg-pin-row"><span>${entry.join(' ')}</span>
             <b class="good">${exact} exact</b><b class="near">${near} close</b></div>`);
        document.getElementById('mg-left').textContent = left;

        entry = [];
        paint();

        if (left <= 0) mgEnd(false);
    });
}

// ── Bypass ───────────────────────────────────────────────────────────────────
// A cursor runs the track. Stop it inside each gate, in order.

function mgBypass(difficulty) {
    const gates = 2 + difficulty;
    const width = 15 - difficulty * 2.5;
    const speed = 0.55 + difficulty * 0.28;

    const targets = [];
    for (let i = 0; i < gates; i++) {
        targets.push(12 + (i * (76 / gates)) + Math.random() * (76 / gates - width));
    }

    let cursor = 0, dir = 1, index = 0;

    mgShell('Bypass', 'SPACE stops the cursor. Land inside each gate in order.', `
        <div class="mg-bypass">
            <div class="mg-track" id="mg-track">
                ${targets.map((t, i) =>
                    `<div class="mg-gate" data-g="${i}" style="left:${t}%;width:${width}%"></div>`).join('')}
                <div class="mg-cursor" id="mg-cursor"></div>
            </div>
        </div>`);

    mgClock(6 + gates * 2.5);

    const tick = () => {
        if (!MG.resolve) return;

        cursor += dir * speed;
        if (cursor >= 100) { cursor = 100; dir = -1; }
        if (cursor <= 0) { cursor = 0; dir = 1; }

        const el = document.getElementById('mg-cursor');
        if (el) el.style.left = `${cursor}%`;

        MG.raf = requestAnimationFrame(tick);
    };

    MG.raf = requestAnimationFrame(tick);

    mgKeys((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();

        const t = targets[index];
        if (cursor >= t && cursor <= t + width) {
            const gate = document.querySelector(`[data-g="${index}"]`);
            if (gate) gate.classList.add('hit');

            index += 1;
            if (index >= gates) { mgEnd(true); return; }
        } else {
            mgEnd(false);
        }
    });
}

// ── Sweep ────────────────────────────────────────────────────────────────────
// A radar sweep goes round. Hit it as it crosses the contact.

function mgSweep(difficulty) {
    const hits = 2 + difficulty;
    const tolerance = 22 - difficulty * 5;
    const speed = 1.4 + difficulty * 0.55;

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
        </div>`);

    mgClock(8 + hits * 3);

    const place = () => {
        const el = document.getElementById('mg-contact');
        if (el) el.style.transform = `rotate(${contact}deg) translateY(-64px)`;
    };
    place();

    const tick = () => {
        if (!MG.resolve) return;

        angle = (angle + speed) % 360;
        const el = document.getElementById('mg-sweep');
        if (el) el.style.transform = `rotate(${angle}deg)`;

        MG.raf = requestAnimationFrame(tick);
    };

    MG.raf = requestAnimationFrame(tick);

    mgKeys((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();

        let diff = Math.abs(((angle - contact + 540) % 360) - 180);
        diff = 180 - diff;

        if (diff > tolerance) { mgEnd(false); return; }

        done += 1;
        const label = document.getElementById('mg-hits');
        if (label) label.textContent = done;

        if (done >= hits) { mgEnd(true); return; }

        contact = Math.random() * 360;
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

        game(Math.max(1, Math.min(3, difficulty || 2)));
    });
}

window.addEventListener('message', async (event) => {
    const msg = event.data || {};
    if (msg.action !== 'minigame') return;

    const passed = await startMinigame(msg.kind, msg.difficulty);
    nui('minigameResult', { passed });
});
