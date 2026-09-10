local function admin(src)
    return Framework.IsAdmin and Framework.IsAdmin(src)
end

function SyncTunables(target)
    TriggerClientEvent('XS-Robberies:client:tunables', target or -1, Settings.Tunables())
end

function SyncLocations(target)
    TriggerClientEvent('XS-Robberies:client:locations', target or -1, Store.ResolveAll())
    TriggerClientEvent('XS-Robberies:client:modelRobberies', target or -1, Store.ModelRobberies())
end

local READ_ONLY = {
    ['XS-Robberies:bootstrap'] = true,
    ['XS-Robberies:getRobbery'] = true,
    ['XS-Robberies:validateRobbery'] = true,
    ['XS-Robberies:exportRobbery'] = true,
    ['XS-Robberies:history'] = true,
    ['XS-Robberies:presets'] = true,
    ['XS-Robberies:live'] = true,
    ['XS-Robberies:resolveLocation'] = true,
    ['XS-Robberies:diagnose'] = true,
    ['XS-Robberies:saveTunables'] = true,
    ['XS-Robberies:forceEnd'] = true,
    ['XS-Robberies:killSwitch'] = true,
    ['XS-Robberies:blacklist'] = true,
}

local function guard(name, handler)
    lib.callback.register(name, function(src, ...)
        if not admin(src) then
            return { ok = false, error = 'You are not allowed to do that.' }
        end

        local result = handler(src, ...)
        if not READ_ONLY[name] and result and result.ok then SyncLocations() end
        return result
    end)
end

CreateThread(function()
    Wait(500)
    Store.Load()
    Settings.Load()
    Runs.LoadState()
    SyncLocations()

    Wait(2500)

    local definitions, live = 0, 0
    for _, def in pairs(Store.robberies) do
        definitions = definitions + 1
        if def.enabled then live = live + 1 end
    end

    local sites = 0
    for _ in pairs(Store.locations) do sites = sites + 1 end

    print(("^2[XS-Robberies]^0 v%s loaded | framework=%s | inventory=%s | dispatch=%s | mdt=%s")
        :format(GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '?',
            Framework.name or 'NONE', Inv.name or 'NONE',
            Dispatch.name or 'notifications', Mdt.name or 'none'))

    -- Which folder is actually running. If a server has a second, older copy
    -- somewhere, this is the only thing that shows it.
    print(("^2[XS-Robberies]^0 running from: %s")
        :format(GetResourcePath(GetCurrentResourceName()) or 'unknown'))

    print(("^2[XS-Robberies]^0 %d robberies (%d live) across %d locations%s")
        :format(definitions, live, sites,
            Settings.KillSwitch() and ' · KILL SWITCH IS ON' or ''))
end)

AddEventHandler('playerJoining', function()
    SyncLocations(source)
end)

RegisterNetEvent('XS-Robberies:server:ready', function()
    SyncLocations(source)
    SyncTunables(source)

    for _, entry in ipairs(Runs.PublicSnapshot()) do
        TriggerClientEvent('XS-Robberies:client:runPublic', source, entry)
    end
end)

guard('XS-Robberies:saveTunables', function(src, values)
    if type(values) ~= 'table' then return { ok = false, error = 'Nothing to save.' } end

    for _, entry in ipairs(Settings.tunables) do
        local value = values[entry.key]

        if value ~= nil then
            if entry.kind == 'toggle' then
                Settings.Set(entry.key, value == true)
            elseif entry.kind == 'choice' then
                for _, allowed in ipairs(entry.options or {}) do
                    if value == allowed then
                        Settings.Set(entry.key, value)
                        break
                    end
                end
            else
                local number = tonumber(value)
                if number then
                    if entry.min then number = math.max(entry.min, number) end
                    if entry.max then number = math.min(entry.max, number) end
                    Settings.Set(entry.key, number)
                end
            end
        end
    end

    SyncTunables()
    return { ok = true, settings = Settings.Schema() }
end)

guard('XS-Robberies:diagnose', function()
    local robberies, live = 0, 0
    for _, def in pairs(Store.robberies) do
        robberies = robberies + 1
        if def.enabled then live = live + 1 end
    end

    local locations, sent, blocked = 0, 0, {}

    for id, loc in pairs(Store.locations) do
        locations = locations + 1

        local def = Store.robberies[loc.robberyId]
        local resolved = Store.Resolve(id)

        if resolved and resolved.enabled then
            sent = sent + 1

            if #(resolved.stages or {}) == 0 then
                blocked[#blocked + 1] = {
                    label = loc.label,
                    reason = 'sent, but the robbery has no stages placed',
                }
            end
        elseif not def then
            blocked[#blocked + 1] = {
                label = loc.label,
                reason = 'the robbery it points at no longer exists',
            }
        elseif not def.enabled and not loc.enabled then
            blocked[#blocked + 1] = {
                label = loc.label,
                reason = ('both switches are off — "%s" is a draft AND this location is off')
                    :format(def.name),
            }
        elseif not def.enabled then
            blocked[#blocked + 1] = {
                label = loc.label,
                reason = ('the robbery "%s" is still a draft. Editor, Robbery settings, flip Live, Save')
                    :format(def.name),
            }
        elseif not loc.enabled then
            blocked[#blocked + 1] = {
                label = loc.label,
                reason = 'this location is switched off. Locations, open it, flip Live, Save',
            }
        end
    end

    local rows = MySQL.query.await('SELECT id, name, enabled, revision FROM cipher_robberies') or {}
    local stored = {}

    for _, row in ipairs(rows) do
        local def = Store.robberies[row.id]
        stored[#stored + 1] = {
            id = row.id,
            name = row.name,
            db = row.enabled,
            memory = def and def.enabled or false,
            revision = row.revision,
            agrees = ((row.enabled == true or row.enabled == 1) == (def and def.enabled == true)),
        }
    end

    local locationRows = MySQL.query.await(
        'SELECT id, robbery_id, label, enabled FROM cipher_robbery_locations') or {}

    return {
        ok = true,
        robberies = robberies,
        live = live,
        locations = locations,
        sent = sent,
        blocked = blocked,
        stored = stored,
        storedLocations = locationRows,
    }
end)

lib.callback.register('XS-Robberies:isAdmin', function(src)
    return admin(src)
end)

guard('XS-Robberies:bootstrap', function(src)
    return {
        ok = true,
        admin = true,
        framework = Framework.name,
        inventory = Inv.name,
        dispatch = Dispatch.name,
        mdt = Mdt.name,
        doorlock = Doors.name,
        stageTypes = Stages.Catalogue(),
        minigames = Minigames.Catalogue(),
        items = Inv.Items(),
        accounts = Config.Payout.Accounts,
        defaults = Config.Defaults,
        robberies = Store.List(),
        locations = Store.AllLocations(),
        loot = Store.LootList(),
        settings = Settings.Schema(),
        placement = {
            range = Config.Builder.PlacementRange,
            nudge = Config.Builder.NudgeStep,
            speed = Config.Builder.CameraSpeed,
        },
    }
end)

guard('XS-Robberies:getRobbery', function(src, id)
    local def = Store.Get(id)
    if not def then return { ok = false, error = 'No such robbery.' } end
    return { ok = true, robbery = def, locations = Store.LocationsFor(id) }
end)

guard('XS-Robberies:createRobbery', function(src, payload)
    payload = payload or {}
    local name = payload.name
    if not name or name == '' then return { ok = false, error = 'Give it a name first.' } end

    local D = Config.Defaults
    local def = {
        id = Store.NewId(name),
        name = name,
        category = payload.category or D.category,
        enabled = false,
        author = Framework.GetName(src),
        radius = D.radius,
        blip = json.decode(json.encode(D.blip)),
        gates = json.decode(json.encode(D.gates)),
        response = json.decode(json.encode(D.response)),
        stages = {},
    }

    local ok, result = Store.Save(def, def.author)
    if not ok then return { ok = false, error = result } end
    return { ok = true, robbery = result, robberies = Store.List() }
end)

guard('XS-Robberies:saveRobbery', function(src, def)
    if type(def) ~= 'table' then return { ok = false, error = 'Nothing to save.' } end

    local ok, result = Store.Save(def, Framework.GetName(src))
    if not ok then return { ok = false, error = result } end

    return {
        ok = true,
        robbery = result,
        robberies = Store.List(),
        issues = Validate.Robbery(result),
    }
end)

guard('XS-Robberies:deleteRobbery', function(src, id)
    local ok, err = Store.Delete(id)
    if not ok then return { ok = false, error = err } end
    return { ok = true, robberies = Store.List(), locations = Store.AllLocations() }
end)

guard('XS-Robberies:duplicateRobbery', function(src, payload)
    local ok, result = Store.Duplicate(payload.id, payload.name)
    if not ok then return { ok = false, error = result } end
    return { ok = true, robbery = result, robberies = Store.List() }
end)

guard('XS-Robberies:validateRobbery', function(src, id)
    local def = Store.Get(id)
    if not def then return { ok = false, error = 'No such robbery.' } end
    return { ok = true, issues = Validate.Robbery(def) }
end)

guard('XS-Robberies:exportRobbery', function(src, id)
    local def = Store.Get(id)
    if not def then return { ok = false, error = 'No such robbery.' } end

    local payload = json.decode(json.encode(def))
    payload.export = { resource = 'XS-Robberies', format = 1, exportedBy = Framework.GetName(src) }
    return { ok = true, json = json.encode(payload) }
end)

guard('XS-Robberies:importRobbery', function(src, raw)
    if type(raw) ~= 'string' or raw == '' then
        return { ok = false, error = 'Nothing pasted.' }
    end

    local decoded = nil
    local parsed, err = pcall(function() decoded = json.decode(raw) end)
    if not parsed or type(decoded) ~= 'table' then
        return { ok = false, error = 'That is not valid JSON.' }
    end
    if not decoded.stages then
        return { ok = false, error = 'That JSON has no stages, so it is not a robbery.' }
    end

    decoded.id = Store.NewId(decoded.name or 'imported')
    decoded.enabled = false
    decoded.revision = 0

    local ok, result = Store.Save(decoded, Framework.GetName(src))
    if not ok then return { ok = false, error = result } end

    return { ok = true, robbery = result, robberies = Store.List(), issues = Validate.Robbery(result) }
end)

guard('XS-Robberies:saveLocation', function(src, loc)
    local ok, result = Store.SaveLocation(loc)
    if not ok then return { ok = false, error = result } end
    return { ok = true, location = result, locations = Store.AllLocations(), robberies = Store.List() }
end)

guard('XS-Robberies:deleteLocation', function(src, id)
    Store.DeleteLocation(id)
    return { ok = true, locations = Store.AllLocations(), robberies = Store.List() }
end)

guard('XS-Robberies:saveLoot', function(src, table_)
    local ok, result = Store.SaveLoot(table_)
    if not ok then return { ok = false, error = result } end
    return { ok = true, loot = Store.LootList() }
end)

guard('XS-Robberies:deleteLoot', function(src, id)
    Store.DeleteLoot(id)
    return { ok = true, loot = Store.LootList() }
end)

guard('XS-Robberies:history', function(src, limit)
    local rows = MySQL.query.await([[
        SELECT id, robbery_id, location_id, started_at, ended_at, outcome, participants, payout
        FROM cipher_robbery_runs ORDER BY started_at DESC LIMIT ?
    ]], { math.min(tonumber(limit) or 50, 200) }) or {}

    for _, row in ipairs(rows) do
        row.participants = row.participants and json.decode(row.participants) or {}
        local def = Store.Get(row.robbery_id)
        row.name = def and def.name or row.robbery_id
    end
    return { ok = true, runs = rows }
end)

guard('XS-Robberies:resolveLocation', function(src, id)
    local resolved = Store.Resolve(tonumber(id))
    if not resolved then return { ok = false, error = 'That location no longer exists.' } end

    local raw = Store.locations[tonumber(id)]
    return { ok = true, location = resolved, offsets = raw and raw.offsets or {}, overrides = raw and raw.overrides or {} }
end)

guard('XS-Robberies:live', function()
    return {
        ok = true,
        runs = Runs.Live(),
        killSwitch = Settings.KillSwitch(),
        blacklist = Settings.Blacklist(),
    }
end)

guard('XS-Robberies:forceEnd', function(src, locationId)
    local run = Runs.Get(tonumber(locationId))
    if not run then return { ok = false, error = 'That run already ended.' } end

    for _, entry in pairs(run.participants) do
        if entry.src then Framework.Notify(entry.src, T('forcedEnd'), 'inform') end
    end

    Runs.Finish(run, 'stopped by staff')
    return { ok = true, runs = Runs.Live() }
end)

guard('XS-Robberies:killSwitch', function(src, on)
    Settings.Set('killSwitch', on == true)
    return { ok = true, killSwitch = Settings.KillSwitch() }
end)

guard('XS-Robberies:blacklist', function(src, payload)
    payload = payload or {}
    if not payload.citizenid then return { ok = false, error = 'Nobody named.' } end

    local list = Settings.SetBlacklisted(payload.citizenid, payload.name, payload.on ~= false)
    return { ok = true, blacklist = list }
end)

guard('XS-Robberies:presets', function()
    return { ok = true, presets = Presets.List() }
end)

guard('XS-Robberies:installPreset', function(src, payload)
    payload = type(payload) == 'table' and payload or { id = payload }

    local ok, result, stamped = Presets.Install(payload.id, Framework.GetName(src), payload.stampAll)
    if not ok then return { ok = false, error = result } end

    return {
        ok = true,
        robbery = result,
        stamped = stamped or 0,
        robberies = Store.List(),
        locations = Store.AllLocations(),
        loot = Store.LootList(),
        issues = Validate.Robbery(result),
    }
end)

lib.callback.register('XS-Robberies:beginStage', function(src, payload)
    payload = payload or {}

    if payload.robberyId and payload.anchor then
        return Runs.Begin(src, { robberyId = payload.robberyId, anchor = payload.anchor }, payload.stageId)
    end

    return Runs.Begin(src, tonumber(payload.locationId), payload.stageId)
end)

RegisterNetEvent('XS-Robberies:server:guardDown', function(payload)
    payload = payload or {}
    local ref = payload.robberyId and { robberyId = payload.robberyId, anchor = payload.anchor }
        or tonumber(payload.locationId)
    Runs.GuardDown(source, ref, payload.stageId)
end)

RegisterNetEvent('XS-Robberies:server:laserTripped', function(payload)
    payload = payload or {}
    local ref = payload.robberyId and { robberyId = payload.robberyId, anchor = payload.anchor }
        or tonumber(payload.locationId)
    Runs.LaserTripped(source, ref)
end)

lib.callback.register('XS-Robberies:finishStage', function(src, payload)
    payload = payload or {}
    return Runs.FinishStage(src, payload.token, payload.success == true)
end)

lib.callback.register('XS-Robberies:runState', function(src, locationId)
    local run = Runs.Get(tonumber(locationId))
    if not run then return { ok = true, active = false } end

    local unlocked, done = {}, {}
    for _, stage in ipairs(run.location.stages or {}) do
        if (run.stages[stage.id] or {}).done then
            done[#done + 1] = stage.id
        elseif Runs.Unlocked(run, stage) then
            unlocked[#unlocked + 1] = stage.id
        end
    end

    return { ok = true, active = true, alarm = run.alarm, startedAt = run.startedAt,
             unlocked = unlocked, done = done }
end)

exports('RegisterDoorProvider', function(name, provider)
    Doors.RegisterProvider(name, provider)
end)

exports('GetActiveRuns', function()
    return Runs.Live()
end)

exports('IsRunActive', function(locationId)
    return Runs.active[locationId] ~= nil
end)

exports('IsBlacklisted', function(citizenid)
    return Settings.Blacklisted(citizenid)
end)

exports('GetRobberies', function()
    return Store.List()
end)
