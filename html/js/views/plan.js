const PlanView = {
    zoom: 1,
    panX: 0,
    panY: 0,
    labels: true,
    jobId: null,
    el: null,

    render(el) {
        const job = State.current;
        PlanView.el = el;

        if (PlanView.jobId !== job.id) {
            PlanView.zoom = 1;
            PlanView.panX = 0;
            PlanView.panY = 0;
            PlanView.jobId = job.id;
        }

        const origin = jobOrigin(job);
        const placed = (job.stages || []).filter(s => s.coords);

        if (!origin || placed.length === 0) {
            PlanView.renderEmpty(el);
            return;
        }

        el.innerHTML = `
            <div class="canvas-wrap">
                <div class="canvas" id="plan-canvas">
                    <svg class="stage" id="plan-svg"></svg>
                    <div class="overlay-tools">
                        <button class="icon-btn" data-tool="in" title="Zoom in">${icon('zoomIn', 15)}</button>
                        <button class="icon-btn" data-tool="out" title="Zoom out">${icon('zoomOut', 15)}</button>
                        <button class="icon-btn" data-tool="fit" title="Fit everything">${icon('fit', 15)}</button>
                        <button class="icon-btn ${PlanView.labels ? 'on' : ''}" data-tool="labels" title="Names">${icon('labels', 15)}</button>
                    </div>
                    <div class="legend">
                        <span><i></i>Opens the next step</span>
                        <span><i class="dot"></i>Calls the police</span>
                        <span><i class="sq"></i>Prop</span>
                        <span><i class="ped"></i>NPC</span>
                        <span><i class="ring"></i>Optional</span>
                        <span><i class="anchor"></i>Anchor · ${esc((job.anchor && job.anchor.label) || (anchorKind(job) === 'model' ? 'the model' : 'first step'))}</span>
                    </div>
                    <div class="tip hidden" id="plan-tip"></div>
                </div>
            </div>
            <div class="strip" id="plan-strip"></div>`;

        el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
            const t = b.dataset.tool;
            if (t === 'in') PlanView.zoom = Math.min(8, PlanView.zoom * 1.3);
            if (t === 'out') PlanView.zoom = Math.max(.3, PlanView.zoom / 1.3);
            if (t === 'fit') { PlanView.zoom = 1; PlanView.panX = 0; PlanView.panY = 0; }
            if (t === 'labels') { PlanView.labels = !PlanView.labels; b.classList.toggle('on', PlanView.labels); }
            PlanView.draw();
        }));

        PlanView.bindCanvas();
        PlanView.renderStrip();
        requestAnimationFrame(() => PlanView.draw());
    },

    renderEmpty(el) {
        const job = State.current;
        const model = anchorKind(job) === 'model';
        const recipe = Setup.recipeFor(job.category);

        el.innerHTML = `
            <div class="empty">
                <div class="mark">${icon('place', 34, 1.5)}</div>
                <h3>Nothing placed yet</h3>
                <p>${model && !jobOrigin(job)
                    ? 'This job lives on a model. Aim at one in the world first, then place the steps around it.'
                    : 'Every step is a point in the world: a till, a keypad, a vault, a way out. Place the first one and the plan draws itself.'}</p>
                <div class="row">
                    ${model && !jobOrigin(job)
                        ? `<button class="btn primary" id="empty-pick">${icon('place', 14)} Aim at the model</button>`
                        : `<button class="btn primary" id="empty-add">${icon('plus', 14)} Add a step</button>`}
                    ${recipe ? `<button class="btn" id="empty-walk">${icon('walk', 14)} Walk me through it</button>` : ''}
                </div>
            </div>`;

        el.querySelector('#empty-add')?.addEventListener('click', () => Steps.pickType());
        el.querySelector('#empty-pick')?.addEventListener('click', () => PlacesView.pickModel());
        el.querySelector('#empty-walk')?.addEventListener('click', () => Setup.run(job, recipe));
    },

    renderStrip() {
        const job = State.current;
        const strip = PlanView.el.querySelector('#plan-strip');
        if (!strip) return;

        const unplaced = (job.stages || []).filter(s => !s.coords);
        const tail = unplaced.length
            ? `<button class="btn sm push" id="strip-unplaced">${icon('warn', 13)} ${unplaced.length} not placed · place now</button>`
            : `<span class="push">${esc((job.stages || []).length)} steps · ${esc((job.props || []).length)} props · ${esc((job.npcs || []).length)} NPCs</span>`;

        if (anchorKind(job) === 'model') {
            const models = (job.anchor.models || []).map(modelName);
            strip.innerHTML = `
                <span>Lives on</span>
                ${models.length ? models.map(m => `<span class="pill on">${esc(m)}</span>`).join('') : '<span class="pill">no model yet</span>'}
                <span>within ${esc(job.anchor.scanRange || 80)} m of a player</span>
                ${tail}`;
        } else {
            const places = State.jobLocations;
            strip.innerHTML = `
                <span>Placed at</span>
                ${places.map(l => `<span class="pill ${l.enabled ? '' : 'off'}" data-place="${l.id}">${esc(l.label)}</span>`).join('')}
                <span class="pill" id="strip-add">+ Add a place</span>
                ${tail}`;
        }

        strip.querySelectorAll('[data-place]').forEach(p => p.addEventListener('click', () => select('place', Number(p.dataset.place), { tab: 'places' })));
        strip.querySelector('#strip-add')?.addEventListener('click', () => PlacesView.addPlace());
        strip.querySelector('#strip-unplaced')?.addEventListener('click', () => Steps.move(unplaced[0]));
    },

    bindCanvas() {
        const canvas = PlanView.el.querySelector('#plan-canvas');
        const svgEl = PlanView.el.querySelector('#plan-svg');
        let drag = null;

        if (PlanView.onMove) window.removeEventListener('mousemove', PlanView.onMove);
        if (PlanView.onUp) window.removeEventListener('mouseup', PlanView.onUp);

        svgEl.addEventListener('mousedown', (e) => {
            if (e.target.closest('.marker, .propmark, .npcmark')) return;
            drag = { x: e.clientX, y: e.clientY, px: PlanView.panX, py: PlanView.panY, moved: false };
            svgEl.classList.add('drag');
        });

        window.addEventListener('mousemove', PlanView.onMove = (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
            PlanView.panX = drag.px + dx;
            PlanView.panY = drag.py + dy;
            PlanView.draw();
        });

        window.addEventListener('mouseup', PlanView.onUp = () => {
            if (drag && !drag.moved && State.sel) select(null);
            drag = null;
            svgEl.classList.remove('drag');
        });

        svgEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = svgEl.getBoundingClientRect();
            const mx = e.clientX - rect.left - rect.width / 2 - PlanView.panX;
            const my = e.clientY - rect.top - rect.height / 2 - PlanView.panY;
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const next = Math.max(.3, Math.min(8, PlanView.zoom * factor));
            const k = next / PlanView.zoom;
            PlanView.panX -= mx * (k - 1);
            PlanView.panY -= my * (k - 1);
            PlanView.zoom = next;
            PlanView.draw();
        }, { passive: false });

        svgEl.addEventListener('dblclick', (e) => {
            if (e.target.closest('.marker, .propmark, .npcmark')) return;
            PlanView.zoom = 1; PlanView.panX = 0; PlanView.panY = 0;
            PlanView.draw();
        });

        svgEl.addEventListener('mouseover', (e) => {
            const m = e.target.closest('[data-tip]');
            const tip = canvas.querySelector('#plan-tip');
            if (!m) { tip.classList.add('hidden'); return; }
            const rect = canvas.getBoundingClientRect();
            const box = m.getBoundingClientRect();
            tip.innerHTML = m.dataset.tip;
            tip.style.left = `${box.left - rect.left + box.width / 2}px`;
            tip.style.top = `${box.top - rect.top}px`;
            tip.classList.remove('hidden');
        });

        svgEl.addEventListener('mouseleave', () => canvas.querySelector('#plan-tip').classList.add('hidden'));

        svgEl.addEventListener('click', (e) => {
            const m = e.target.closest('.marker');
            if (m) { select('stage', m.dataset.id, { view: false }); return; }
            const p = e.target.closest('.propmark');
            if (p) { select('prop', p.dataset.id, { view: false }); return; }
            const n = e.target.closest('.npcmark');
            if (n) select('npc', n.dataset.id, { view: false });
        });
    },

    highlight() {
        PlanView.draw();
    },

    soft() {
        PlanView.draw();
        PlanView.renderStrip();
    },

    resize() {
        PlanView.draw();
    },

    draw() {
        const job = State.current;
        const svgEl = PlanView.el && PlanView.el.querySelector('#plan-svg');
        if (!job || !svgEl || !svgEl.isConnected) return;

        const W = svgEl.clientWidth || 800;
        const H = svgEl.clientHeight || 600;
        const origin = jobOrigin(job);
        if (!origin) return;

        const stages = (job.stages || []).filter(s => s.coords);
        const props = (job.props || []).filter(p => p.coords);
        const npcs = (job.npcs || []).filter(n => n.coords);
        const dist = (c) => Math.hypot(c.x - origin.x, c.y - origin.y);

        let fit = stages.filter(s => !ZONE_TYPES.includes(s.type)).map(s => s.coords).concat(props.map(p => p.coords)).concat(npcs.map(n => n.coords));
        if (!fit.length) fit = stages.map(s => s.coords);

        let R = 4;
        fit.forEach(c => { R = Math.max(R, dist(c)); });
        R *= 1.28;

        const base = (Math.min(W, H) / 2 - 46) / R;
        const scale = base * PlanView.zoom;
        const cx = W / 2 + PlanView.panX;
        const cy = H / 2 + PlanView.panY;
        const S = (c) => [cx + (c.x - origin.x) * scale, cy - (c.y - origin.y) * scale];
        const inside = (x, y, m = 24) => x >= m && x <= W - m && y >= m && y <= H - m;

        const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
        const visibleR = (Math.hypot(W, H) / 2 + Math.hypot(PlanView.panX, PlanView.panY)) / scale;
        const step = steps.find(s => (R / PlanView.zoom) / s <= 4.5) || 500;
        const rings = [];
        for (let k = 1; k * step <= visibleR && k < 80; k++) rings.push(k * step);

        const sel = State.sel;
        const selStage = sel && sel.kind === 'stage' ? sel.id : null;
        const selProp = sel && sel.kind === 'prop' ? sel.id : null;
        const selNpc = sel && sel.kind === 'npc' ? sel.id : null;
        const byId = new Map(stages.map(s => [s.id, s]));
        const indexOf = (id) => (job.stages || []).findIndex(s => s.id === id);
        const clampEdge = ([x, y]) => {
            if (inside(x, y, 18)) return [x, y, false];
            const dx = x - W / 2, dy = y - H / 2;
            const k = Math.min((W / 2 - 40) / Math.abs(dx || 1e-6), (H / 2 - 40) / Math.abs(dy || 1e-6));
            return [W / 2 + dx * k, H / 2 + dy * k, true];
        };
        const pos = new Map(stages.map(s => [s.id, clampEdge(S(s.coords))]));

        const parts = [];
        parts.push(`<defs>
            <marker id="arr" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#3b82ff" stroke-width="1.8" stroke-linecap="round"/></marker>
            <marker id="arr-hi" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#7cc4ff" stroke-width="1.8" stroke-linecap="round"/></marker>
            <radialGradient id="glow"><stop offset="0" stop-color="#3b82ff" stop-opacity=".45"/><stop offset="1" stop-color="#3b82ff" stop-opacity="0"/></radialGradient>
        </defs>`);

        parts.push('<g fill="none" stroke="#7cc4ff">');
        rings.forEach((r, i) => parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * scale}" stroke-opacity="${Math.max(.06, .24 - i * .03)}"/>`));
        const L = Math.hypot(W, H) * 2;
        parts.push(`<path d="M${cx} ${cy - L}V${cy + L}M${cx - L} ${cy}H${cx + L}M${cx - L} ${cy - L}L${cx + L} ${cy + L}M${cx + L} ${cy - L}L${cx - L} ${cy + L}" stroke-opacity=".07"/>`);
        parts.push('</g>');

        parts.push('<g font-family="JetBrains Mono" font-size="10" fill="#3f5580" paint-order="stroke" stroke="#060c1a" stroke-width="3">');
        rings.forEach(r => {
            const x = cx - r * scale + 5;
            if (x > 4 && x < W - 40) parts.push(`<text x="${x}" y="${cy - 6}">${r} m</text>`);
        });
        if (cx > 0 && cx < W) parts.push(`<text x="${cx + 6}" y="18" fill="#566a92">N</text>`);
        parts.push('</g>');

        stages.forEach(s => {
            if (!ZONE_TYPES.includes(s.type) || !s.opts.radius) return;
            const [x, y, edge] = pos.get(s.id);
            const r = s.opts.radius * scale;
            if (edge) return;
            parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${rgbOf(stageColour(s), .04)}" stroke="${rgbOf(stageColour(s))}" stroke-opacity=".35" stroke-dasharray="4 7" pointer-events="none"/>`);
        });

        props.forEach(p => {
            if (!p.linkStage || !byId.has(p.linkStage)) return;
            const [x1, y1] = S(p.coords);
            const [x2, y2] = pos.get(p.linkStage);
            parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#39d49b" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="2 4" fill="none"/>`);
        });

        const tags = [];

        stages.forEach(s => {
            (s.requires || []).forEach(dep => {
                const from = byId.get(dep);
                if (!from) return;
                const [x1, y1] = pos.get(dep);
                const [x2, y2] = pos.get(s.id);
                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                if (len < 36) return;
                const ux = dx / len, uy = dy / len;
                const ax = x1 + ux * 19, ay = y1 + uy * 19;
                const bx = x2 - ux * 21, by = y2 - uy * 21;
                const bend = Math.min(60, len * .16);
                const mx = (ax + bx) / 2 - uy * bend, my = (ay + by) / 2 + ux * bend;
                const hi = selStage && (selStage === s.id || selStage === dep);
                parts.push(`<path class="route ${hi ? '' : 'slow'}" d="M${ax} ${ay}Q${mx} ${my} ${bx} ${by}" fill="none" stroke="${hi ? '#7cc4ff' : '#3b82ff'}" stroke-opacity="${hi ? 1 : .7}" stroke-width="${hi ? 2.4 : 1.8}" stroke-dasharray="8 7" marker-end="url(#${hi ? 'arr-hi' : 'arr'})"/>`);

                if (len > 140) {
                    const metres = Math.hypot(s.coords.x - from.coords.x, s.coords.y - from.coords.y);
                    const lx = (ax + 2 * mx + bx) / 4, ly = (ay + 2 * my + by) / 4;
                    if (inside(lx, ly, 10)) {
                        const text = `${metres < 10 ? metres.toFixed(1) : Math.round(metres)} m`;
                        tags.push({ x: lx, y: ly, text });
                    }
                }
            });
        });

        parts.push(`<g transform="translate(${cx} ${cy})" pointer-events="none"><circle r="7" fill="none" stroke="#ffc35a" stroke-width="1.6"/><path d="M-17 0H-10M10 0H17M0 -17V-10M0 10V17" stroke="#ffc35a" stroke-width="1.6"/></g>`);

        const labels = [];
        const boxes = [];
        const free = (b) => !boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
        const claim = (b) => { boxes.push(b); return b; };

        stages.forEach(s => {
            const [x, y] = pos.get(s.id);
            if (inside(x, y, -10)) claim({ x: x - 17, y: y - 17, w: 34, h: 34 });
        });

        tags.forEach(t => {
            const w = t.text.length * 6.6 + 12;
            const b = { x: t.x - w / 2, y: t.y - 10, w, h: 20 };
            if (!free(b)) return;
            claim(b);
            parts.push(`<g transform="translate(${b.x} ${b.y})" pointer-events="none"><rect width="${w}" height="20" rx="6" fill="#060b17" stroke="#213558"/><text x="${w / 2}" y="14" fill="#8fa1c6" font-family="JetBrains Mono" font-size="11" font-weight="600" text-anchor="middle">${t.text}</text></g>`);
        });

        props.forEach(p => {
            const [x, y] = S(p.coords);
            if (!inside(x, y, -10)) return;
            const on = selProp === p.id;
            const tip = `${esc(propLabel(p))}<small>${esc(p.model)}${p.linkStage && byId.get(p.linkStage) ? ` · follows ${esc(stageLabel(byId.get(p.linkStage)))}` : ''}</small>`;
            parts.push(`<g class="propmark" data-id="${esc(p.id)}" data-tip="${esc(tip)}" transform="translate(${x} ${y}) rotate(${-(p.coords.h || 0)})" style="cursor:pointer">
                <rect x="-9" y="-9" width="18" height="18" rx="3" fill="${on ? '#39d49b' : 'rgba(57,212,155,.14)'}" stroke="#39d49b" stroke-width="${on ? 2.4 : 1.5}"/>
                <path d="M0 -9V-15" stroke="#39d49b" stroke-width="1.5"/></g>`);
            claim({ x: x - 10, y: y - 10, w: 20, h: 20 });
            labels.push({ x, y, text: propLabel(p), colour: '#7fe3bd', pri: on ? 0 : 3, gap: 22 });
        });

        npcs.forEach(n => {
            const [x, y] = S(n.coords);
            if (!inside(x, y, -10)) return;
            const on = selNpc === n.id;
            const h = (n.coords.h || 0) * Math.PI / 180;
            const ang = Math.atan2(-Math.cos(h), -Math.sin(h)) * 180 / Math.PI;
            const tip = `${esc(npcLabel(n))}<small>${esc(n.model)} · ${esc((REACTIONS.find(r => r.value === (n.reaction || 'cower')) || REACTIONS[0]).label.toLowerCase())}</small>`;
            parts.push(`<g class="npcmark" data-id="${esc(n.id)}" data-tip="${esc(tip)}" transform="translate(${x} ${y})" style="cursor:pointer">
                <g transform="rotate(${ang})"><path d="M14 -4 L19 0 L14 4" fill="none" stroke="#ff5d73" stroke-width="1.8" stroke-linecap="round"/></g>
                <circle r="${on ? 12 : 10}" fill="${on ? '#ff5d73' : 'rgba(255,93,115,.14)'}" stroke="#ff5d73" stroke-width="${on ? 2.4 : 1.6}"/>
                <circle cy="-3" r="2.6" fill="${on ? '#2a0610' : '#ff8fa0'}"/>
                <path d="M-4.5 5.5a4.5 4.5 0 0 1 9 0" fill="none" stroke="${on ? '#2a0610' : '#ff8fa0'}" stroke-width="1.8" stroke-linecap="round"/>
            </g>`);
            claim({ x: x - 12, y: y - 12, w: 24, h: 24 });
            labels.push({ x, y, text: npcLabel(n), colour: '#ff9fae', pri: on ? 0 : 3, gap: 24 });
        });

        const edges = [];

        stages.slice().sort((a, b) => (a.id === selStage ? 1 : 0) - (b.id === selStage ? 1 : 0)).forEach(s => {
            const [x, y, edge] = pos.get(s.id);
            const colour = rgbOf(stageColour(s));
            const on = selStage === s.id;
            const n = indexOf(s.id) + 1;

            if (edge) {
                edges.push({ s, x, y, colour, on, n });
                return;
            }

            const h = (s.coords.h || 0) * Math.PI / 180;
            const ang = Math.atan2(-Math.cos(h), -Math.sin(h)) * 180 / Math.PI;
            const optional = s.opts && s.opts.optional;
            const off = s.enabled === false;
            const tip = `${esc(stageLabel(s))}<small>${esc((stageType(s.type) || {}).label || s.type)} · ${Math.round(dist(s.coords))} m from the anchor</small>`;

            parts.push(`<g class="marker ${on ? 'sel' : ''}" data-id="${esc(s.id)}" data-tip="${esc(tip)}" transform="translate(${x} ${y})" opacity="${off ? .35 : 1}">
                ${on ? `<circle r="44" fill="url(#glow)" pointer-events="none"/><circle class="pulse" r="18" fill="none" stroke="${colour}" stroke-width="2" pointer-events="none"/>` : ''}
                <g transform="rotate(${ang})"><path d="M${on ? 23 : 20} -5 L${on ? 30 : 27} 0 L${on ? 23 : 20} 5" fill="none" stroke="${on ? '#7cc4ff' : colour}" stroke-width="2" stroke-linecap="round"/></g>
                <circle class="face" r="${on ? 17 : 15}" fill="${on ? colour : '#0a1324'}" stroke="${colour}" stroke-width="2" ${optional ? 'stroke-dasharray="4 3"' : ''}/>
                <text y="5" fill="${on ? '#04101f' : '#e6eeff'}" font-family="JetBrains Mono" font-weight="700" font-size="${n > 9 ? 12 : 14}" text-anchor="middle" pointer-events="none">${n}</text>
                ${s.opts && s.opts.notifyPolice ? `<circle cx="12" cy="-12" r="5" fill="#ff4d61" stroke="#060b17" stroke-width="2" pointer-events="none"/>` : ''}
            </g>`);

            labels.push({ x, y, text: stageLabel(s), colour: on ? '#e6eeff' : '#8fa1c6', pri: on ? 0 : 1 + n / 100, gap: on ? 34 : 31 });
        });

        edges.forEach(({ s, x, y, colour, on, n }) => {
            const ex = x, ey = y;
            const ang = Math.atan2(y - H / 2, x - W / 2) * 180 / Math.PI;
            const metres = Math.round(dist(s.coords));
            const tip = `${esc(stageLabel(s))}<small>${metres} m from the anchor, off the edge</small>`;
            parts.push(`<g class="marker ${on ? 'sel' : ''}" data-id="${esc(s.id)}" data-tip="${esc(tip)}" transform="translate(${ex} ${ey})">
                <g transform="rotate(${ang})"><path d="M18 -7 L28 0 L18 7" fill="${colour}" stroke="none"/></g>
                <circle class="face" r="14" fill="${on ? colour : '#0a1324'}" stroke="${colour}" stroke-width="2" stroke-dasharray="3 3"/>
                <text y="5" fill="${on ? '#04101f' : '#e6eeff'}" font-family="JetBrains Mono" font-weight="700" font-size="13" text-anchor="middle" pointer-events="none">${n}</text>
            </g>`);
            claim({ x: ex - 16, y: ey - 16, w: 32, h: 32 });
            labels.push({ x: ex, y: ey, text: `${stageLabel(s)} · ${metres} m`, colour: '#8fa1c6', pri: 2, gap: 28 });
        });

        if (PlanView.labels) {
            labels.sort((a, b) => a.pri - b.pri).forEach(l => {
                const w = l.text.length * 6.1 + 8;
                for (const dy of [l.gap, -l.gap + 8]) {
                    const b = { x: l.x - w / 2, y: l.y + dy - 11, w, h: 14 };
                    if (b.x < 2 || b.x + b.w > W - 2 || b.y < 2 || b.y + b.h > H - 2) continue;
                    if (!free(b)) continue;
                    claim(b);
                    parts.push(`<text x="${l.x}" y="${l.y + dy}" fill="${l.colour}" font-family="Manrope" font-size="11" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="#060b17" stroke-width="3.5" pointer-events="none">${esc(l.text)}</text>`);
                    break;
                }
            });
        }

        svgEl.innerHTML = parts.join('');
    },
};

Views.plan = PlanView;
