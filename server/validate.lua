Validate = {}

local function issue(list, level, message, stageId)
    list[#list + 1] = { level = level, message = message, stage = stageId }
end

local function hasCycle(stages)
    local byId, state = {}, {}
    for _, s in ipairs(stages) do byId[s.id] = s end

    local function visit(id)
        if state[id] == 'done' then return false end
        if state[id] == 'open' then return true end

        state[id] = 'open'
        for _, dep in ipairs(byId[id] and byId[id].requires or {}) do
            if byId[dep] and visit(dep) then return true end
        end
        state[id] = 'done'
        return false
    end

    for _, s in ipairs(stages) do
        if visit(s.id) then return true, s.id end
    end
    return false
end

local function reachable(stages)
    local byId, seen = {}, {}
    for _, s in ipairs(stages) do byId[s.id] = s end

    local changed = true
    while changed do
        changed = false
        for _, s in ipairs(stages) do
            if not seen[s.id] then
                local ok = true
                for _, dep in ipairs(s.requires or {}) do
                    if not seen[dep] then ok = false break end
                end
                if ok then seen[s.id] = true changed = true end
            end
        end
    end
    return seen
end

local LOOT_STAGES = { register = true, safe = true, container = true }

function Validate.Robbery(def)
    local issues = {}

    if not def.name or def.name == '' then
        issue(issues, 'error', 'This robbery has no name.')
    end

    local all = def.stages or {}
    if #all == 0 then
        issue(issues, 'error', 'No stages placed yet.')
        return issues
    end

    local stages, switchedOff = {}, 0
    for _, s in ipairs(all) do
        if s.enabled == false then
            switchedOff = switchedOff + 1
        else
            stages[#stages + 1] = s
        end
    end

    if #stages == 0 then
        issue(issues, 'error', 'Every stage is switched off, so there is nothing to rob.')
        return issues
    end

    if switchedOff > 0 then
        issue(issues, 'warn', ('%d stage%s switched off and will not appear in the world.')
            :format(switchedOff, switchedOff == 1 and ' is' or 's are'))
    end

    local ids, escapes = {}, 0
    for _, s in ipairs(stages) do
        if ids[s.id] then
            issue(issues, 'error', ('Two stages share the id "%s".'):format(s.id), s.id)
        end
        ids[s.id] = true

        if not Stages.Get(s.type) then
            issue(issues, 'error', ('Unknown stage type "%s".'):format(tostring(s.type)), s.id)
        end

        if s.type == 'escape' then escapes = escapes + 1 end

        if not s.coords then
            issue(issues, 'error', ('%s has not been placed in the world.'):format(s.label or s.id), s.id)
        end
    end

    if escapes == 0 then
        issue(issues, 'warn',
            'No escape zone. This finishes as soon as the last required stage is done, and pays on the spot. Right for an ATM, wrong for a bank.')
    end

    for _, s in ipairs(stages) do
        for _, dep in ipairs(s.requires or {}) do
            if not ids[dep] then
                issue(issues, 'error',
                    ('%s waits on a stage that no longer exists.'):format(s.label or s.id), s.id)
            end
        end

        local opts = s.opts or {}
        if opts.codeFrom and opts.codeFrom ~= '' and not ids[opts.codeFrom] then
            issue(issues, 'error', ('%s reads a code from a stage that no longer exists.')
                :format(s.label or s.id), s.id)
        end
        if s.type == 'keypad' then
            if not opts.codeFrom or opts.codeFrom == '' then
                issue(issues, 'error', ('%s has no stage to get its code from.')
                    :format(s.label or s.id), s.id)
            else
                local source
                for _, other in ipairs(stages) do
                    if other.id == opts.codeFrom then source = other break end
                end
                if source and (tonumber((source.opts or {}).revealCode) or 0) <= 0 then
                    issue(issues, 'error', ('%s reads a code from %s, which never reveals one.')
                        :format(s.label or s.id, source.label or source.id), s.id)
                end
            end
        end

        if s.type == 'doorlock' then
            if not opts.doorId or opts.doorId == '' then
                issue(issues, 'error', ('%s has no door id, so it will never open anything.')
                    :format(s.label or s.id), s.id)
            elseif not Doors.Available() then
                issue(issues, 'warn', ('%s needs a door lock resource, and none is running.')
                    :format(s.label or s.id), s.id)
            end
        end

        if s.type == 'guard' then
            if not opts.weapon or opts.weapon == '' then
                issue(issues, 'warn', ('%s is an armed guard with no weapon.')
                    :format(s.label or s.id), s.id)
            end
        end

        if s.type == 'twoman' and (not opts.pairWith or opts.pairWith == '') then
            issue(issues, 'error', ('%s needs a second point to pair with.')
                :format(s.label or s.id), s.id)
        end

        if opts.pairWith and opts.pairWith ~= '' and not ids[opts.pairWith] then
            issue(issues, 'error', ('%s is paired with a stage that no longer exists.')
                :format(s.label or s.id), s.id)
        end

        if opts.requiredItem and opts.requiredItem ~= '' and not Inv.Exists(opts.requiredItem) then
            issue(issues, 'warn', ('%s needs "%s", which no inventory item matches.')
                :format(s.label or s.id, opts.requiredItem), s.id)
        end

        if LOOT_STAGES[s.type] then
            local reward = Runs.NormalisePayout(s.payout)
            local emptyCash = not reward.cash or (reward.cash.max or 0) <= 0
            local emptyItems = #(reward.items or {}) == 0
            local emptyLoot = not reward.lootTable or reward.lootTable == ''

            if emptyCash and emptyItems and emptyLoot then
                issue(issues, 'warn', ('%s pays out nothing.'):format(s.label or s.id), s.id)
            end

            if reward.lootTable and reward.lootTable ~= '' and not Store.loot[reward.lootTable] then
                issue(issues, 'error', ('%s uses a loot table that no longer exists.')
                    :format(s.label or s.id), s.id)
            end

            for _, entry in ipairs(reward.items or {}) do
                if entry.item and entry.item ~= '' and not Inv.Exists(entry.item) then
                    issue(issues, 'warn', ('%s pays out "%s", which no inventory item matches.')
                        :format(s.label or s.id, entry.item), s.id)
                end
            end
        end
    end

    local cycle, at = hasCycle(stages)
    if cycle then
        issue(issues, 'error', 'Stage requirements loop back on themselves.', at)
    else
        local seen = reachable(stages)
        for _, s in ipairs(stages) do
            if not seen[s.id] then
                issue(issues, 'error', ('%s can never be reached.'):format(s.label or s.id), s.id)
            end
        end
    end

    local gates = def.gates or {}
    local slots = GetConvarInt('sv_maxclients', 48)
    if (gates.policeRequired or 0) > slots then
        issue(issues, 'warn', ('Police required (%d) is higher than the server holds (%d).')
            :format(gates.policeRequired, slots))
    end
    if (gates.minCrew or 1) > (gates.maxCrew or 1) then
        issue(issues, 'error', 'Minimum crew is larger than maximum crew.')
    end

    return issues
end

function Validate.Blocking(issues)
    for _, i in ipairs(issues) do
        if i.level == 'error' then return true end
    end
    return false
end
