window.Panels = window.Panels || {};

// The stage graph, laid out in columns by how deep a stage sits in the chain.
// Everything with nothing to wait on goes in column one, whatever waits only on
// those goes in column two, and so on — so the picture reads left to right in
// the order a crew actually does it.
function graphColumns(stages) {
    const depth = new Map();
    const byId = new Map(stages.map(s => [s.id, s]));

    let changed = true;
    let guard = 0;

    while (changed && guard < 40) {
        changed = false;
        guard++;

        for (const stage of stages) {
            const requires = (stage.requires || []).filter(id => byId.has(id));
            const known = requires.every(id => depth.has(id));
            if (!known) continue;

            const value = requires.length === 0
                ? 0
                : Math.max(...requires.map(id => depth.get(id))) + 1;

            if (depth.get(stage.id) !== value) {
                depth.set(stage.id, value);
                changed = true;
            }
        }
    }

    // Anything still unplaced is caught in a loop; park it at the end so it is
    // visible rather than silently missing.
    const orphans = stages.filter(s => !depth.has(s.id));
    const deepest = depth.size ? Math.max(...depth.values()) : 0;
    orphans.forEach(s => depth.set(s.id, deepest + 1));

    const columns = [];
    for (const stage of stages) {
        const d = depth.get(stage.id);
        columns[d] = columns[d] || [];
        columns[d].push({ stage, orphan: orphans.includes(stage) });
    }

    return columns.filter(Boolean);
}

function graphNode(entry) {
    const { stage, orphan } = entry;
    const type = stageType(stage.type);
    const colour = type ? rgbSolid(type.colour) : 'var(--accent)';
    const off = stage.enabled === false;

    const flags = [];
    if (stage.opts && stage.opts.optional) flags.push('optional');
    if (off) flags.push('off');
    if (orphan) flags.push('looped');
    if (!stage.coords) flags.push('not placed');

    return `
        <div class="gnode ${stage.id === State.selectedStage ? 'selected' : ''} ${off ? 'is-off' : ''}"
             data-node="${esc(stage.id)}" style="--node-colour:${colour}">
            <div class="gnode-type">${esc(type ? type.label : stage.type)}</div>
            <div class="gnode-name">${esc(stage.label || stage.id)}</div>
            ${flags.length ? `<div class="gnode-flags">${esc(flags.join(' · '))}</div>` : ''}
        </div>`;
}

window.Panels.graph = {
    render(el) {
        const def = State.current;

        if (!def) {
            setTopbar('Flow', 'Nothing open');
            el.innerHTML = emptyState('&#9783;', 'No robbery open',
                'Open one from the Robberies panel and its shape shows up here.',
                '<button class="btn btn-primary" id="graph-back">Go to Robberies</button>');
            document.getElementById('graph-back')?.addEventListener('click', () => switchPanel('robberies'));
            return;
        }

        const stages = def.stages || [];

        setTopbar(def.name, `${def.id} · how this one unlocks`, `
            <button class="btn btn-ghost" id="graph-edit">Open in Editor</button>
        `);

        if (stages.length === 0) {
            el.innerHTML = emptyState('&#9783;', 'Nothing placed yet',
                'Add a few stages in the Editor and the shape of the robbery appears here.');
            document.getElementById('graph-edit')?.addEventListener('click', () => switchPanel('editor'));
            return;
        }

        const columns = graphColumns(stages);

        el.innerHTML = `
            <div class="field-hint" style="margin-bottom:16px">
                Each column can only start once everything it points back to is done.
                The first column is where a run begins — if it is empty, nobody can start this.
            </div>
            <div class="graph">
                ${columns.map((column, i) => `
                    <div class="gcol">
                        <div class="gcol-head">${i === 0 ? 'Opens the run' : `After step ${i}`}</div>
                        ${column.map(graphNode).join('')}
                    </div>
                    ${i < columns.length - 1 ? '<div class="garrow">&#8594;</div>' : ''}
                `).join('')}
            </div>`;

        document.getElementById('graph-edit')?.addEventListener('click', () => switchPanel('editor'));

        el.querySelectorAll('[data-node]').forEach(node => {
            node.addEventListener('click', () => {
                State.selectedStage = node.dataset.node;
                switchPanel('editor');
            });
        });
    },
};
