const FlowView = {
    el: null,
    NODE_W: 172,
    NODE_H: 74,
    COL_GAP: 64,
    ROW_GAP: 20,

    render(el) {
        const job = State.current;
        FlowView.el = el;
        const stages = job.stages || [];

        if (!stages.length) {
            el.innerHTML = `
                <div class="empty">
                    <div class="mark">${icon('history', 34, 1.5)}</div>
                    <h3>No steps yet</h3>
                    <p>The flow shows the order a crew has to work through: what opens the job, what each step unlocks, and when the alarm goes.</p>
                    <div class="row"><button class="btn primary" id="flow-add">${icon('plus', 14)} Add a step</button></div>
                </div>`;
            el.querySelector('#flow-add').addEventListener('click', () => Steps.pickType());
            return;
        }

        el.innerHTML = `
            <div class="canvas-wrap" style="bottom:66px">
                <div class="canvas">
                    <div class="flow-scroll"><div class="flow-board" id="flow-board"></div></div>
                </div>
            </div>
            <div class="clock" id="flow-clock"></div>`;

        FlowView.draw();
        FlowView.drawClock();
    },

    highlight() { FlowView.draw(); },
    soft() { FlowView.draw(); FlowView.drawClock(); },

    layout() {
        const job = State.current;
        const { columns, looped } = depthColumns(job.stages || []);
        const scroller = FlowView.el && FlowView.el.querySelector('.flow-scroll');
        const avail = scroller ? scroller.clientWidth - 30 : 900;
        FlowView.COL_GAP = 48;
        FlowView.NODE_W = Math.max(148, Math.min(180, Math.floor(avail / Math.max(1, columns.length)) - FlowView.COL_GAP));
        const pos = new Map();
        let height = 0;

        columns.forEach((col, c) => {
            col.forEach((s, r) => {
                const x = 22 + c * (FlowView.NODE_W + FlowView.COL_GAP);
                const y = 40 + r * (FlowView.NODE_H + FlowView.ROW_GAP);
                pos.set(s.id, { x, y, c });
                height = Math.max(height, y + FlowView.NODE_H);
            });
        });

        const width = 22 + columns.length * (FlowView.NODE_W + FlowView.COL_GAP);
        return { columns, looped, pos, width, height: height + 30 };
    },

    columnTitle(col, c) {
        if (c === 0) return 'OPENS THE JOB';
        const counts = {};
        col.forEach(s => {
            const g = (stageType(s.type) || {}).group || 'control';
            counts[g] = (counts[g] || 0) + 1;
        });
        const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        return `THEN · ${(GROUPS[top] || { label: 'NEXT' }).label.toUpperCase()}`;
    },

    nodeMeta(s) {
        const o = s.opts || {};
        const bits = [mmss(stageSeconds(s))];
        if (s.type === 'container') bits.push(`${o.grabs || 1} grabs`);
        if (o.requiredItem) bits.push(o.requiredItem);
        else if (o.minigame && o.minigame !== 'none' && !(s.type === 'keypad' && o.codeFrom)) {
            const mg = (State.minigames || []).find(m => m.id === o.minigame);
            bits.push(mg ? mg.label.toLowerCase() : 'minigame');
        }
        if (s.type === 'keypad' && o.codeFrom) {
            const from = (State.current.stages || []).find(x => x.id === o.codeFrom);
            bits.push(`code from ${from ? stageLabel(from) : '?'}`);
        }
        const take = stageTake(s);
        if (take.max > 0) bits.push(moneyRange(take.min, take.max));
        return bits.join(' · ');
    },

    draw() {
        const job = State.current;
        const board = FlowView.el && FlowView.el.querySelector('#flow-board');
        if (!board || !job) return;

        const { columns, looped, pos, width, height } = FlowView.layout();
        const sel = State.sel && State.sel.kind === 'stage' ? State.sel.id : null;

        const links = [];
        (job.stages || []).forEach(s => {
            (s.requires || []).forEach(dep => {
                const a = pos.get(dep), b = pos.get(s.id);
                if (!a || !b) return;
                const x1 = a.x + FlowView.NODE_W, y1 = a.y + FlowView.NODE_H / 2;
                const x2 = b.x, y2 = b.y + FlowView.NODE_H / 2;
                const hi = sel && (sel === s.id || sel === dep);
                const back = x2 <= x1;
                const d = back
                    ? `M${x1} ${y1}C${x1 + 60} ${y1}, ${x2 - 60} ${y2 + 90}, ${x2} ${y2}`
                    : `M${x1} ${y1}C${x1 + 34} ${y1}, ${x2 - 34} ${y2}, ${x2 - 6} ${y2}`;
                links.push(`<path class="${hi ? 'route' : ''}" d="${d}" fill="none" stroke="${hi ? '#7cc4ff' : '#24406f'}" stroke-width="${hi ? 2.2 : 1.8}" ${hi ? 'stroke-dasharray="6 7"' : ''}/>`);
                links.push(`<circle cx="${x2 - 4}" cy="${y2}" r="3" fill="${hi ? '#7cc4ff' : '#2d4774'}"/>`);
            });
        });

        const heads = columns.map((col, c) => `<div class="colh" style="left:${24 + c * (FlowView.NODE_W + FlowView.COL_GAP)}px;top:14px">${esc(FlowView.columnTitle(col, c))}</div>`).join('');

        let i = 0;
        const nodes = (job.stages || []).map(s => {
            const p = pos.get(s.id);
            if (!p) return '';
            const t = stageType(s.type);
            const o = s.opts || {};
            const flags = [];
            if (!s.coords) flags.push('<span class="warn">not placed</span>');
            if (looped.has(s.id)) flags.push('<span class="warn">loops back</span>');
            return `
                <div class="node ${sel === s.id ? 'sel' : ''} ${o.optional ? 'opt' : ''} ${s.enabled === false ? 'off' : ''}" data-id="${esc(s.id)}"
                     style="left:${p.x}px;top:${p.y}px;width:${FlowView.NODE_W}px;${colourVars(stageColour(s))};animation-delay:${(i++) * 25}ms">
                    ${o.notifyPolice ? '<span class="pd" title="Calls the police"></span>' : ''}
                    <div class="k">${esc(t ? t.label : s.type)}${o.optional ? ' · optional' : ''}</div>
                    <div class="n">${esc(stageLabel(s))}</div>
                    <div class="m">${flags.length ? flags.join(' · ') : esc(FlowView.nodeMeta(s))}</div>
                </div>`;
        }).join('');

        board.style.width = `${width}px`;
        board.style.height = `${height}px`;
        board.innerHTML = `<svg width="${width}" height="${height}">${links.join('')}</svg>${heads}${nodes}`;

        board.querySelectorAll('.node').forEach(n => n.addEventListener('click', () => select('stage', n.dataset.id, { view: false })));
    },

    drawClock() {
        const job = State.current;
        const el = FlowView.el && FlowView.el.querySelector('#flow-clock');
        if (!el) return;

        const est = runEstimate(job);
        const total = Math.max(est.total, 1);
        const { columns } = depthColumns((job.stages || []).filter(s => s.enabled !== false));

        let acc = 0;
        const segs = columns.map(col => {
            const required = col.filter(s => !(s.opts && s.opts.optional));
            const span = Math.max(0, ...(required.length ? required : col).map(stageSeconds));
            const g = (stageType(col[0].type) || {}).group || 'control';
            acc += span;
            return { span, colour: rgbOf((GROUPS[g] || GROUPS.control).colour) };
        });
        const sum = Math.max(acc, 1);

        const markers = [];
        if (est.alarm !== null && est.alarm <= total) {
            markers.push({ at: est.alarm / total, label: est.silent ? `SILENT ALARM ${mmss(est.alarm)}` : `ALARM ${mmss(est.alarm)}`, colour: est.silent ? '#7cc4ff' : '#ff4d61' });
        }

        const escape = (job.stages || []).find(s => s.type === 'escape' && s.enabled !== false);
        const limit = escape && Number(escape.opts.timeLimit) > 0 ? Number(escape.opts.timeLimit) : 0;

        el.innerHTML = `
            <label>RUN <b>~${mmss(est.total)}</b></label>
            <div class="track">${segs.map(s => `<i style="width:${(s.span / sum) * 100}%;background:${s.colour}"></i>`).join('')}</div>
            ${markers.map(m => `<div class="mk" style="left:calc(112px + (100% - 112px) * ${Math.min(.995, m.at)});background:${m.colour}"><b style="color:${m.colour}">${esc(m.label)}</b></div>`).join('')}
            ${limit ? `<div class="mk" style="left:calc(100% - 2px);background:#a98bff"><b style="color:#a98bff;left:auto;right:6px">${mmss(limit)} TO GET OUT</b></div>` : ''}
            ${est.alarm === null ? `<div class="mk" style="left:calc(100% - 2px);background:transparent"><b style="color:var(--ink3);left:auto;right:6px">NO ALARM ON THE CLOCK</b></div>` : ''}`;
    },
};

Views.flow = FlowView;
