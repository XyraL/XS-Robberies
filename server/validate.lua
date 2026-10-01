Validate = {}

local function issue(list, level, message, stageId)
    list[#list + 1] = { level = level, message = message, stage = stageId }
end

local function depsOf(stage, ids)
    local out = {}
    for _, dep in ipairs(Stages.Needs(stage)) do
        if ids[dep] then out[#out + 1] = dep end
    end
    return out
end

local function hasCycle(stages, ids)
    local byId, state = {}, {}
    for _, s in ipairs(stages) do byId[s.id] = s end

    local function visit(id)
        if state[id] == 'done' then return false end
        if state[id] == 'open' then return true end

        state[id] = 'open'
        for _, dep in ipairs(byId[id] and depsOf(byId[id], ids) or {}) do
            if visit(dep) then return true end
        end
        state[id] = 'done'
        return false
    end

    for _, s in ipairs(stages) do
        if visit(s.id) then return true, s.id end
    end
    return false
end

local LOOT_STAGES = { register = true, safe = true, container = true }

function Validate.Robbery(def)
    local issues = {}

    if not def.name or def.name == '' then
        issue(issues, 'error', 'This robbery has no name.')
    end

    local all = def.stages or {}
    if #all == 0 then
        issue(issues, 'error', 'No steps yet. Add one from the Plan.')
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
        issue(issues, 'error', 'Every step is switched off, so there is nothing to rob.')
        return issues
    end

    if switchedOff > 0 then
        issue(issues, 'warn', ('%d step%s switched off and will not appear in the world.')
            :format(switchedOff, switchedOff == 1 and ' is' or 's are'))
    end

    local ids, seen, placed = {}, {}, 0
    for _, s in ipairs(stages) do
        if seen[s.id] then
            issue(issues, 'error', ('Two steps share the id "%s".'):format(s.id), s.id)
        end
        seen[s.id] = true

        if not Stages.Get(s.type) then
            issue(issues, 'error', ('Unknown step type "%s".'):format(tostring(s.type)), s.id)
        end

        if s.coords then
            ids[s.id] = true
            placed = placed + 1
        else
            issue(issues, 'warn', ('%s is not placed yet, so it is left out.'):format(s.label or s.id), s.id)
        end
    end

    if placed == 0 then
        issue(issues, 'error', 'Nothing is placed in the world yet.')
        return issues
    end

    for _, s in ipairs(stages) do
        local name = s.label or s.id
        local opts = s.opts or {}

        for _, dep in ipairs(s.requires or {}) do
            if not ids[dep] then
                issue(issues, 'warn', ('%s waits on a step that is gone or not placed. It is skipped.'):format(name), s.id)
                break
            end
        end

        if s.type == 'keypad' and opts.codeFrom and opts.codeFrom ~= '' and not ids[opts.codeFrom] then
            issue(issues, 'warn', ('%s gets its code from a step that is gone, so it has to be cracked instead.'):format(name), s.id)
        end

        if s.type == 'doorlock' and not Stages.HasDoors(s) then
            issue(issues, 'warn', ('%s has no door picked, so it opens nothing.'):format(name), s.id)
        end

        if opts.doorId and opts.doorId ~= '' and not Doors.Available() then
            issue(issues, 'warn', ('%s names door "%s", but no door lock resource is running.'):format(name, opts.doorId), s.id)
        end

        if s.type == 'guard' and (not opts.weapon or opts.weapon == '') then
            issue(issues, 'warn', ('%s is an armed guard with no weapon.'):format(name), s.id)
        end

        if s.type == 'twoman' and (not opts.pairWith or opts.pairWith == '' or not ids[opts.pairWith]) then
            issue(issues, opts.optional and 'warn' or 'error',
                ('%s needs a second point to pair with. Nobody can finish it alone.'):format(name), s.id)
        end

        if opts.requiredItem and opts.requiredItem ~= '' and not Inv.Exists(opts.requiredItem) then
            issue(issues, 'warn', ('%s needs "%s", which no inventory item matches.'):format(name, opts.requiredItem), s.id)
        end

        if LOOT_STAGES[s.type] then
            local reward = Runs.NormalisePayout(s.payout)
            local emptyCash = not reward.cash or (reward.cash.max or 0) <= 0
            local emptyItems = #(reward.items or {}) == 0
            local emptyLoot = not reward.lootTable or reward.lootTable == ''

            if emptyCash and emptyItems and emptyLoot then
                issue(issues, 'warn', ('%s pays out nothing.'):format(name), s.id)
            end

            if reward.lootTable and reward.lootTable ~= '' and not Store.loot[reward.lootTable] then
                issue(issues, 'warn', ('%s uses a loot table that no longer exists.'):format(name), s.id)
            end

            for _, entry in ipairs(reward.items or {}) do
                if entry.item and entry.item ~= '' and not Inv.Exists(entry.item) then
                    issue(issues, 'warn', ('%s pays out "%s", which no inventory item matches.')
                        :format(name, entry.item), s.id)
                end
            end
        end
    end

    local cycle, at = hasCycle(stages, ids)
    if cycle then
        issue(issues, 'error', 'Some steps wait on each other in a loop, so none of them can ever open.', at)
    end

    local anchor = Store.Anchor(def)
    if anchor.kind == 'model' then
        if #anchor.models == 0 then
            issue(issues, 'error', 'This job finds its places by model, but no model is set. Pick one in Places.')
        end
    elseif #Store.LocationsFor(def.id) == 0 then
        issue(issues, 'warn', 'It is not placed anywhere yet. Add a place in Places.')
    end

    local account = (def.payout or {}).account or 'cash'
    if account ~= 'cash' and account ~= 'bank' and account ~= 'dirty' then
        issue(issues, 'warn', ('Unknown payout type "%s". It pays as cash.'):format(tostring(account)))
    end

    local everyStage = {}
    for _, st in ipairs(all) do everyStage[st.id] = true end

    local propIds = {}
    for index, prop in ipairs(def.props or {}) do
        local name = prop.label or prop.model or ('Prop %d'):format(index)

        if propIds[prop.id or ''] then
            issue(issues, 'warn', ('Two props share the id "%s".'):format(tostring(prop.id)))
        end
        propIds[prop.id or ''] = true

        if not prop.model or prop.model == '' then
            issue(issues, 'warn', ('%s has no model, so it is left out.'):format(name))
        end
        if not prop.coords then
            issue(issues, 'warn', ('%s is not placed yet, so it is left out.'):format(name))
        end
        if prop.linkStage and prop.linkStage ~= '' and not everyStage[prop.linkStage] then
            issue(issues, 'warn', ('%s follows a step that no longer exists.'):format(name))
        end
        if prop.onDone == 'swap' and (not prop.swapModel or prop.swapModel == '') then
            issue(issues, 'warn', ('%s swaps when its step is done, but has nothing to swap to.'):format(name))
        end
    end

    local contact = def.contact
    if contact and contact.enabled then
        if not contact.coords then
            issue(issues, 'warn', 'The contact is switched on but not placed, so for now nobody has to talk to them.')
        elseif not contact.model or contact.model == '' then
            issue(issues, 'warn', 'The contact has no ped model, so for now nobody has to talk to them.')
        end
    end

    if anchor.kind == 'model' and #(anchor.areas or {}) == 0 then
        for _, other in pairs(Store.robberies) do
            local them = Store.Anchor(other)
            if other.id ~= def.id and other.enabled and them.kind == 'model' and #(them.areas or {}) == 0 then
                local shared = false
                for _, a in ipairs(anchor.models) do
                    for _, b in ipairs(them.models) do
                        if tostring(a) == tostring(b) then shared = true end
                    end
                end
                if shared then
                    issue(issues, 'warn', ('%s also covers every one of these models with no area. Give one of them an area in Places so each knows which ones are theirs.'):format(other.name))
                end
            end
        end
    end

    for index, npc in ipairs(def.npcs or {}) do
        local name = npc.label or npc.model or ('NPC %d'):format(index)
        if not npc.model or npc.model == '' then
            issue(issues, 'warn', ('%s has no model, so it is left out.'):format(name))
        end
        if not npc.coords then
            issue(issues, 'warn', ('%s is not placed yet, so it is left out.'):format(name))
        end
    end

    local gates = def.gates or {}
    local slots = GetConvarInt('sv_maxclients', 48)
    if (gates.policeRequired or 0) > slots then
        issue(issues, 'warn', ('Police required (%d) is higher than the server holds (%d).')
            :format(gates.policeRequired, slots))
    end
    if (gates.minCrew or 1) > (gates.maxCrew or 1) then
        issue(issues, 'warn', 'Smallest crew is larger than the biggest crew.')
    end

    return issues
end

function Validate.Blocking(issues)
    for _, i in ipairs(issues) do
        if i.level == 'error' then return true end
    end
    return false
end
