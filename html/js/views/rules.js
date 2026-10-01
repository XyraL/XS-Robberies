const RulesView = {
    el: null,

    render(el) {
        RulesView.el = el;
        el.classList.add('scroll');
        const job = State.current;
        const g = job.gates || {};
        const r = job.response || {};
        const b = job.blip || {};
        const alarm = [
            { value: 'instant', label: 'Instant' },
            { value: 'delayed', label: 'Delayed' },
            { value: 'silent', label: 'Silent' },
            { value: 'none', label: 'None' },
        ];

        el.innerHTML = `
            <div class="split">
                <div>
                    <div class="sec">
                        <div class="sec-title">The job</div>
                        <div class="grid2">
                            ${fieldText('name', 'Name', job.name)}
                            ${fieldSelect('category', 'Type', job.category, JOB_TYPES.map(t => ({ value: t.id, label: t.label })))}
                        </div>
                    </div>

                    <div class="sec">
                        <div class="sec-title">Who can start it</div>
                        <div class="grid2">
                            ${fieldNumber('gates.policeRequired', 'Police needed', g.policeRequired ?? 2, { min: 0 })}
                            ${fieldSwitch('gates.policeOnDuty', 'Only count on-duty police', g.policeOnDuty !== false)}
                            ${fieldNumber('gates.minCrew', 'Smallest crew', g.minCrew ?? 1, { min: 1, hint: 'Counted in the area when it starts.' })}
                            ${fieldNumber('gates.maxCrew', 'Biggest crew', g.maxCrew ?? 6, { min: 1 })}
                        </div>
                    </div>

                    <div class="sec">
                        <div class="sec-title">Cooldowns</div>
                        <div class="grid2">
                            ${fieldNumber('gates.locationCooldown', 'Place resets after', g.locationCooldown ?? 1800, { min: 0, unit: 's', hint: 'Robbed props come back when this runs out.' })}
                            ${fieldNumber('gates.playerCooldown', 'Each robber waits', g.playerCooldown ?? 900, { min: 0, unit: 's' })}
                            ${fieldNumber('gates.globalCooldown', 'Every place of this job waits', g.globalCooldown ?? 0, { min: 0, unit: 's', hint: '0 for none.' })}
                            <div></div>
                            ${fieldNumber('gates.proximityMetres', 'No other job within', g.proximityMetres ?? 0, { min: 0, unit: 'm' })}
                            ${fieldNumber('gates.proximitySeconds', 'For', g.proximitySeconds ?? 0, { min: 0, unit: 's', hint: 'Stops a crew hitting the whole street at once. Both need a number.' })}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="sec">
                        <div class="sec-title">Alarm and police</div>
                        <div class="grid2">
                            ${fieldSeg('response.alarm', 'Alarm', r.alarm || 'instant', alarm, { wide: true })}
                            ${fieldNumber('response.alarmDelay', 'Delay', r.alarmDelay ?? 30, { min: 0, unit: 's' })}
                            ${fieldNumber('response.repeatAlert', 'Call it in again every', r.repeatAlert ?? 120, { min: 0, unit: 's', hint: '0 to call once.' })}
                            ${fieldSelect('response.camerasChangeTo', 'Cameras off turns it', r.camerasChangeTo || 'delayed', alarm)}
                            ${fieldSelect('response.powerChangesTo', 'Power cut turns it', r.powerChangesTo || 'silent', alarm)}
                            ${fieldText('response.code', 'Dispatch code', r.code || '10-90')}
                            ${fieldText('response.title', 'Dispatch title', r.title || 'Robbery')}
                            ${fieldSwitch('response.dispatchOnFail', 'Failed steps call it in', r.dispatchOnFail !== false, { wide: true })}
                        </div>
                        <div class="hint" style="margin-top:8px">One call goes to your dispatch script: ps, qs, cd, core, rcore, linden, or any export you name in config.lua. With none of those, police get a plain notification and a blip.</div>
                    </div>

                    <div class="sec">
                        <div class="sec-title">Map blip</div>
                        <div class="grid2">
                            ${fieldSeg('blip.showWhen', 'Show it', b.showWhen || 'during', [{ value: 'always', label: 'Always' }, { value: 'during', label: 'During a run' }, { value: 'never', label: 'Never' }], { wide: true })}
                            ${fieldText('blip.label', 'Name on the map', b.label || job.name)}
                            ${fieldNumber('blip.sprite', 'Sprite', b.sprite ?? 500, { min: 1 })}
                            ${fieldNumber('blip.colour', 'Colour', b.colour ?? 1, { min: 0, max: 85 })}
                            ${fieldNumber('blip.scale', 'Size', b.scale ?? 0.8, { min: .1, max: 3, step: .1 })}
                        </div>
                    </div>

                    <div class="sec">
                        <div class="sec-title">Area</div>
                        <div class="grid2">
                            ${fieldNumber('radius', 'Counts as here within', job.radius ?? 30, { min: 5, unit: 'm', hint: 'How far from the anchor someone still counts as in the job.' })}
                        </div>
                    </div>

                    <div class="sec">
                        <div class="sec-title">Share or remove</div>
                        <div class="card-row" style="margin-top:0">
                            <button class="btn" id="rl-dup">${icon('copy', 14)} Duplicate</button>
                            <button class="btn" id="rl-export">${icon('export', 14)} Export</button>
                            <button class="btn danger" id="rl-del">${icon('trash', 14)} Delete job</button>
                        </div>
                    </div>
                </div>
            </div>`;

        bindForm(el, job, (k) => {
            markDirty();
            if (k === 'name' || k === 'category' || k.startsWith('gates.')) softRefresh();
        });

        el.querySelector('#rl-dup').addEventListener('click', RulesView.duplicate);
        el.querySelector('#rl-export').addEventListener('click', RulesView.exportJob);
        el.querySelector('#rl-del').addEventListener('click', RulesView.remove);
    },

    soft() {},

    async duplicate() {
        const job = State.current;
        if (State.dirty && !(await saveJob(true))) return;
        const res = await nui('duplicateRobbery', { id: job.id, name: `${job.name} copy` });
        if (!report(res, 'Duplicated', res && res.robbery ? res.robbery.name : '')) return;
        State.robberies = res.robberies || State.robberies;
        openJob(res.robbery.id, { tab: 'rules' });
    },

    async exportJob() {
        const job = State.current;
        if (State.dirty && !(await saveJob(true))) return;
        const res = await nui('exportRobbery', job.id);
        if (!res || !res.ok) { toast('Could not export', (res && res.error) || 'The server did not answer.', 'error'); return; }

        modal({
            title: `Export ${job.name}`,
            sub: 'Copy this and send it to another server. They paste it into Import.',
            body: `<div class="f"><label>Job</label><textarea id="ex-json" readonly style="min-height:240px">${esc(res.json)}</textarea></div>`,
            onOpen: (root) => {
                const box = root.querySelector('#ex-json');
                box.focus();
                box.select();
            },
        });
    },

    remove() {
        const job = State.current;
        confirmDanger('Delete this job?', `"${job.name}" and every place it is stamped at will be removed. This cannot be undone.`, async () => {
            const res = await nui('deleteRobbery', job.id);
            if (!report(res, 'Deleted', job.name)) return;
            State.robberies = res.robberies || [];
            State.locations = res.locations || [];
            State.current = null;
            State.dirty = false;
            State.sel = null;
            State.view = 'home';
            refresh();
            refreshMarkers();
        });
    },
};

Views.rules = RulesView;
