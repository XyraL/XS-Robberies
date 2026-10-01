Runs = { active = {}, tokens = {}, state = {}, recent = {}, looted = {}, doorResets = {} }

local function now()
    return os.time()
end

local function decodeState(raw)
    if not raw or raw == '' then return {} end
    local ok, out = pcall(json.decode, raw)
    return (ok and type(out) == 'table') and out or {}
end

function Runs.LoadState()
    local rows = MySQL.query.await('SELECT location_id, state FROM xs_robbery_state') or {}
    for _, row in ipairs(rows) do
        Runs.state[row.location_id] = decodeState(row.state)
    end
end

local function saveState(locationId)
    if type(locationId) ~= 'number' then return end
    MySQL.prepare.await([[
        INSERT INTO xs_robbery_state (location_id, state, last_run_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE state = VALUES(state), last_run_at = VALUES(last_run_at)
    ]], { locationId, json.encode(Runs.state[locationId] or {}) })
end

function Runs.Cooldown(scope, key, seconds)
    if not seconds or seconds <= 0 then return end
    MySQL.prepare.await([[
        INSERT INTO xs_robbery_cooldowns (scope, scope_key, expires_at)
        VALUES (?, ?, FROM_UNIXTIME(?))
        ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
    ]], { scope, tostring(key), now() + seconds })
end

function Runs.CooldownLeft(scope, key)
    local row = MySQL.single.await([[
        SELECT UNIX_TIMESTAMP(expires_at) AS expires FROM xs_robbery_cooldowns
        WHERE scope = ? AND scope_key = ?
    ]], { scope, tostring(key) })

    if not row or not row.expires then return 0 end
    return math.max(0, row.expires - now())
end

function Runs.CooldownLeftAny(scope, keys)
    if #keys == 0 then return 0 end

    local marks, params = {}, { scope }
    for i, key in ipairs(keys) do
        marks[i] = '?'
        params[#params + 1] = tostring(key)
    end

    local row = MySQL.single.await(([[
        SELECT MAX(UNIX_TIMESTAMP(expires_at)) AS expires FROM xs_robbery_cooldowns
        WHERE scope = ? AND scope_key IN (%s)
    ]]):format(table.concat(marks, ', ')), params)

    if not row or not row.expires then return 0 end
    return math.max(0, row.expires - now())
end

function Runs.PlayerCooldownKey(citizenid, job)
    local scope = (job.gates or {}).playerCooldownScope or 'type'
    if scope == 'all' then return tostring(citizenid) end
    if scope == 'job' then return ('%s:job:%s'):format(citizenid, job.robberyId) end
    return ('%s:type:%s'):format(citizenid, job.category or 'custom')
end

function Runs.PlayerCooldownLeft(citizenid, job)
    return Runs.CooldownLeftAny('player', {
        tostring(citizenid),
        ('%s:type:%s'):format(citizenid, job.category or 'custom'),
        ('%s:job:%s'):format(citizenid, job.robberyId),
    })
end

local function distance(a, b)
    if not a or not b then return 9999.0 end
    local dx, dy, dz = a.x - b.x, a.y - b.y, a.z - b.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function stageById(location, stageId)
    for _, s in ipairs(location.stages or {}) do
        if s.id == stageId then return s end
    end
end

local function alarmModeFor(run)
    local response = run.location.response or {}
    local mode = response.alarm or 'instant'

    if run.camerasDown and response.camerasChangeTo then mode = response.camerasChangeTo end
    if run.powerCut and response.powerChangesTo then mode = response.powerChangesTo end

    return mode
end

function Runs.Dispatch(run, reason)
    local response = run.location.response or {}
    local blip = run.location.blip or {}

    Dispatch.Alert({
        coords = run.location.origin,
        code = response.code or '10-90',
        title = response.title or run.location.label,
        description = reason or ('Alarm at ' .. (run.location.label or 'a business')),
        sprite = blip.sprite or 500,
        colour = blip.colour or 1,
        radius = 0,
        blipTime = 300,
    })

    run.alarm = 'raised'
    run.lastAlert = now()
    Mdt.OpenIncident(run)

    if not run.alarmSounding and alarmModeFor(run) ~= 'silent' then
        run.alarmSounding = true
        TriggerClientEvent('XS-Robberies:client:alarmSound', -1, {
            locationId = run.locationId,
            coords = run.location.origin,
            on = true,
        })
    end

    Runs.Push(run)
end

function Runs.RaiseAlarm(run, reason)
    local mode = alarmModeFor(run)

    if mode == 'none' then
        run.alarm = 'none'
        return
    end

    if mode == 'silent' then
        run.alarm = 'silent'
        Runs.Dispatch(run, reason or 'Silent alarm.')
        return
    end

    if mode == 'delayed' then
        if run.alarm == 'pending' or run.alarm == 'raised' then return end
        run.alarm = 'pending'
        run.alarmAt = now() + (run.location.response.alarmDelay or 30)
        Runs.Push(run)
        return
    end

    Runs.Dispatch(run, reason)
end

local function broadcastStages(run)
    local unlocked, done = {}, {}
    for id, entry in pairs(run.stages) do
        if entry.done then done[#done + 1] = id end
    end

    for _, stage in ipairs(run.location.stages or {}) do
        if not (run.stages[stage.id] or {}).done and Runs.Unlocked(run, stage) then
            unlocked[#unlocked + 1] = stage.id
        end
    end

    return unlocked, done
end

function Runs.PublicSnapshot()
    local out = {}
    for locationId, run in pairs(Runs.active) do
        local unlocked, done = broadcastStages(run)
        out[#out + 1] = { locationId = locationId, unlocked = unlocked, done = done }
    end

    local at = now()
    for locationId, entry in pairs(Runs.looted) do
        if entry.untilAt > at and not Runs.active[locationId] then
            out[#out + 1] = { locationId = locationId, ended = true, looted = entry.done, resetIn = entry.untilAt - at }
        elseif entry.untilAt <= at then
            Runs.looted[locationId] = nil
        end
    end
    return out
end

function Runs.Push(run)
    local unlocked, done = broadcastStages(run)

    TriggerClientEvent('XS-Robberies:client:runPublic', -1, {
        locationId = run.locationId,
        unlocked = unlocked,
        done = done,
        alarm = run.alarm,
    })

    local codes = {}
    for stageId, code in pairs(run.codes) do
        local stage = stageById(run.location, stageId)
        codes[#codes + 1] = { label = stage and stage.label or stageId, code = code }
    end

    for citizenid, entry in pairs(run.participants) do
        if entry.src then
            TriggerClientEvent('XS-Robberies:client:runState', entry.src, {
                locationId = run.locationId,
                label = run.location.label,
                alarm = run.alarm,
                alarmAt = run.alarmAt,
                startedAt = run.startedAt,
                unlocked = unlocked,
                done = done,
                pot = run.pot[citizenid] or {},
                codes = codes,
                escapeDeadline = run.escapeDeadline,
                now = now(),
            })
        end
    end
end

function Runs.Unlocked(run, stage)
    for _, dep in ipairs(Stages.Needs(stage)) do
        if stageById(run.location, dep) and not (run.stages[dep] or {}).done then return false end
    end
    return true
end

local function isOptional(stage)
    return (stage.opts or {}).optional == true
end

function Runs.RequiredDone(run)
    for _, stage in ipairs(run.location.stages or {}) do
        if not isOptional(stage) and not (run.stages[stage.id] or {}).done then return false end
    end
    return true
end

function Runs.EverythingDone(run)
    for _, stage in ipairs(run.location.stages or {}) do
        local skip = stage.type == 'escape' and isOptional(stage)
        if not skip and not (run.stages[stage.id] or {}).done then return false end
    end
    return true
end

function Runs.AnythingDone(run)
    return next(run.stages) ~= nil or next(run.grabs or {}) ~= nil
end

function Runs.Escaping(run)
    for _, stage in ipairs(run.location.stages or {}) do
        if stage.type == 'escape' and not (run.stages[stage.id] or {}).done and Runs.Unlocked(run, stage) then
            return true
        end
    end
    return false
end

function Runs.Get(locationId)
    return Runs.active[locationId]
end

local function participantList(run)
    local out = {}
    for citizenid, entry in pairs(run.participants) do
        out[#out + 1] = { citizenid = citizenid, name = entry.name }
    end
    return out
end

function Runs.Start(src, location)
    local gates = location.gates or {}
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return nil, 'Who are you?' end

    if Settings.KillSwitch() then
        return nil, T('killSwitch')
    end

    if Settings.Blacklisted(citizenid) then
        return nil, T('blacklisted')
    end

    if Framework.IsBlockedJob(src) then
        return nil, T('blockedJob')
    end

    if not Contacts.Allowed(citizenid, location) then
        return nil, T('needContact')
    end

    local police = Framework.CountPolice(gates.policeOnDuty ~= false)
    if police < (gates.policeRequired or 0) then
        return nil, T('noPolice', police, gates.policeRequired or 0)
    end

    local left = Runs.CooldownLeft('location', location.id)
    if left > 0 then
        return nil, T('locationCooling', math.ceil(left / 60))
    end

    left = Runs.PlayerCooldownLeft(citizenid, location)
    if left > 0 then
        return nil, T('playerCooling', math.ceil(left / 60))
    end

    if (gates.globalCooldown or 0) > 0 then
        left = Runs.CooldownLeft('global', location.robberyId)
        if left > 0 then
            return nil, T('globalCooling', math.ceil(left / 60))
        end
    end

    if (gates.minCrew or 1) > 1 then
        local near = 0
        local origin = location.origin
        for _, sid in ipairs(GetPlayers()) do
            sid = tonumber(sid)
            if not Framework.IsBlockedJob(sid) then
                local coords = GetEntityCoords(GetPlayerPed(sid))
                if distance(coords, origin) <= (location.radius or 30.0) + 20.0 then
                    near = near + 1
                end
            end
        end

        if near < gates.minCrew then
            return nil, T('crewTooSmall', gates.minCrew, near)
        end
    end

    if (gates.proximityMetres or 0) > 0 and (gates.proximitySeconds or 0) > 0 then
        for _, entry in ipairs(Runs.recent) do
            if now() - entry.at <= gates.proximitySeconds
                and distance(entry.coords, location.origin) <= gates.proximityMetres then
                return nil, T('tooCloseToLast')
            end
        end
    end

    local hasEscape = false
    for _, stage in ipairs(location.stages or {}) do
        if stage.type == 'escape' and not isOptional(stage) then hasEscape = true break end
    end

    local run = {
        locationId = location.id,
        location = location,
        hasEscape = hasEscape,
        startedAt = now(),
        stages = {},
        participants = {},
        pot = {},
        alarm = 'quiet',
        camerasDown = false,
        powerCut = false,
        codes = {},
        lastPresence = now(),
        lastActivity = now(),
    }

    Runs.active[location.id] = run
    Runs.Join(run, src, citizenid)
    Contacts.Consume(citizenid, location.robberyId)

    Runs.recent[#Runs.recent + 1] = { coords = location.origin, at = now() }
    while #Runs.recent > 40 do table.remove(Runs.recent, 1) end

    if Settings.Tunable('logRuns') then
        run.dbId = MySQL.insert.await([[
            INSERT INTO xs_robbery_runs (robbery_id, location_id, outcome, participants)
            VALUES (?, ?, 'active', ?)
        ]], { location.robberyId, location.id, json.encode(participantList(run)) })
    end

    Runs.RaiseAlarm(run, 'Break-in reported.')

    TriggerEvent('XS-Robberies:runStarted', {
        robberyId = location.robberyId,
        locationId = location.id,
        label = location.label,
        coords = location.origin,
        startedBy = citizenid,
        source = src,
    })

    return run
end

function Runs.Join(run, src, citizenid)
    citizenid = citizenid or Framework.GetCitizenId(src)
    if not citizenid then return end

    local gates = run.location.gates or {}
    local count = 0
    for _ in pairs(run.participants) do count = count + 1 end

    if count >= (gates.maxCrew or 99) and not run.participants[citizenid] then
        return false, T('crewFull')
    end

    run.participants[citizenid] = { src = src, name = Framework.GetName(src) }
    return true
end

function Runs.Finish(run, outcome, opts)
    if not Runs.active[run.locationId] then return end
    Runs.active[run.locationId] = nil
    opts = opts or {}

    local gates = run.location.gates or {}
    local cooldowns = opts.cooldowns ~= false

    if cooldowns then
        Runs.Cooldown('location', run.locationId, gates.locationCooldown)
        if (gates.globalCooldown or 0) > 0 then
            Runs.Cooldown('global', run.location.robberyId, gates.globalCooldown)
        end
    end

    local looted = {}
    for id, entry in pairs(run.stages) do
        if entry.done then looted[#looted + 1] = id end
    end

    local resetIn = cooldowns and math.max(0, math.floor(tonumber(gates.locationCooldown) or 0)) or 0
    if resetIn > 0 and #looted > 0 then
        Runs.looted[run.locationId] = { done = looted, untilAt = now() + resetIn }
    else
        Runs.looted[run.locationId] = nil
    end

    TriggerClientEvent('XS-Robberies:client:runPublic', -1, {
        locationId = run.locationId,
        ended = true,
        looted = looted,
        resetIn = resetIn,
    })

    if run.doors and #run.doors > 0 then
        Runs.doorResets[#Runs.doorResets + 1] = { at = now() + math.max(resetIn, 120), run = run }
    end

    if run.blackout then
        TriggerClientEvent('XS-Robberies:client:blackout', -1, { on = false })
    end

    if run.alarmSounding then
        TriggerClientEvent('XS-Robberies:client:alarmSound', -1, {
            locationId = run.locationId,
            on = false,
        })
    end

    for citizenid, entry in pairs(run.participants) do
        if cooldowns then
            Runs.Cooldown('player', Runs.PlayerCooldownKey(citizenid, run.location), gates.playerCooldown)
        end
        if entry.src then
            TriggerClientEvent('XS-Robberies:client:runEnded', entry.src, {
                locationId = run.locationId,
                outcome = outcome,
                reason = opts.reason,
            })
        end
    end

    Mdt.CloseIncident(run, outcome)

    local total = 0
    for _, earned in pairs(run.pot) do
        for _, amount in pairs(earned) do total = total + amount end
    end
    total = total + (run.paidOut or 0)

    if Settings.Tunable('logRuns') and run.dbId then
        MySQL.prepare.await([[
            UPDATE xs_robbery_runs
            SET ended_at = CURRENT_TIMESTAMP, outcome = ?, participants = ?, stages_done = ?, payout = ?
            WHERE id = ?
        ]], { outcome, json.encode(participantList(run)), json.encode(looted), math.floor(total), run.dbId })
    end

    if Config.Run.Webhook and Config.Run.Webhook ~= '' then
        local names = {}
        for _, entry in pairs(participantList(run)) do names[#names + 1] = entry.name end

        PerformHttpRequest(Config.Run.Webhook, function() end, 'POST', json.encode({
            embeds = { {
                title = ('%s — %s'):format(run.location.label or 'Robbery', outcome),
                description = ('Crew: %s\nPayout: $%d'):format(
                    #names > 0 and table.concat(names, ', ') or 'nobody', math.floor(total)),
                color = outcome == 'completed' and 3066993 or 15158332,
            } },
        }), { ['Content-Type'] = 'application/json' })
    end

    saveState(run.locationId)

    TriggerEvent('XS-Robberies:runEnded', {
        robberyId = run.location.robberyId,
        locationId = run.locationId,
        label = run.location.label,
        outcome = outcome,
        payout = math.floor(total),
        participants = participantList(run),
        seconds = now() - run.startedAt,
    })
end

function Runs.Complete(run)
    Runs.PayOut(run)
    Runs.Finish(run, 'completed')
end

function Runs.Cancel(src)
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return false end

    for _, run in pairs(Runs.active) do
        if run.participants[citizenid] then
            local others = 0
            for id, entry in pairs(run.participants) do
                if id ~= citizenid and entry.src and GetPlayerName(entry.src) then others = others + 1 end
            end

            local worked = Runs.AnythingDone(run)

            if others == 0 then
                Runs.Finish(run, 'cancelled', { cooldowns = worked, reason = 'cancelled' })
                return true
            end

            run.participants[citizenid] = nil
            if worked then
                Runs.Cooldown('player', Runs.PlayerCooldownKey(citizenid, run.location),
                    (run.location.gates or {}).playerCooldown)
            end

            TriggerClientEvent('XS-Robberies:client:runEnded', src, {
                locationId = run.locationId,
                outcome = 'left',
                reason = 'left',
            })
            Runs.Push(run)
            return true
        end
    end

    return false
end

local function payDirty(src, amount)
    local payout = Config.Payout or {}
    local item = payout.DirtyItem or 'markedbills'

    if (payout.DirtyMode or 'worth') == 'count' then
        local per = math.max(1, tonumber(payout.DirtyPer) or 1)
        local count = math.floor(amount / per)
        if count > 0 then Inv.Add(src, item, count) end
        return
    end

    Inv.Add(src, item, 1, { worth = math.floor(amount) })
end

local function payAccount(src, account, amount)
    if amount <= 0 then return end

    if account == 'dirty' then
        payDirty(src, amount)
        return
    end

    Framework.AddMoney(src, account == 'bank' and 'bank' or 'cash', math.floor(amount), 'robbery')
end

function Runs.Holds(run)
    local when = (run.location.payout or {}).when or 'default'
    if not run.hasEscape or when == 'instant' then return false end
    if when == 'escape' then return true end
    return Settings.Tunable('payoutOnEscape') == true
end

function Runs.Credit(run, src, account, amount)
    if amount <= 0 then return 0 end

    local shares = {}
    if (run.location.payout or {}).split == 'crew' then
        for citizenid, entry in pairs(run.participants) do
            if entry.src and GetPlayerName(entry.src) then
                shares[#shares + 1] = { citizenid = citizenid, src = entry.src }
            end
        end
    end

    if #shares == 0 then
        shares[1] = { citizenid = Framework.GetCitizenId(src), src = src }
    end

    local each = math.floor(amount / #shares)
    local hold = Runs.Holds(run)

    for _, share in ipairs(shares) do
        if hold then
            run.pot[share.citizenid] = run.pot[share.citizenid] or {}
            run.pot[share.citizenid][account] = (run.pot[share.citizenid][account] or 0) + each
        else
            payAccount(share.src, account, each)
            run.paidOut = (run.paidOut or 0) + each
            if share.src ~= src then
                Framework.Notify(share.src, T('crewShare', each), 'success')
            end
        end
    end

    return each
end

function Runs.AccountFor(location, cash)
    local account = cash and cash.account
    if not account or account == '' or account == 'job' then
        account = (location.payout or {}).account or 'cash'
    end
    return account
end

function Runs.PayOut(run)
    for citizenid, entry in pairs(run.participants) do
        local earned = run.pot[citizenid]

        if entry.src and earned then
            for account, amount in pairs(earned) do
                payAccount(entry.src, account, amount)
            end
        end
    end

    run.pot = {}
end

function Runs.NormalisePayout(payout)
    payout = payout or {}

    if payout.cash or payout.items then
        return {
            cash = payout.cash,
            items = payout.items or {},
            lootTable = payout.lootTable or '',
        }
    end

    local cash = nil
    if (payout.max or 0) > 0 or (payout.min or 0) > 0 then
        cash = { account = payout.account or 'cash', min = payout.min or 0, max = payout.max or 0 }
    end

    return { cash = cash, items = {}, lootTable = payout.lootTable or '' }
end

local function rollLoot(src, lootId)
    local table_ = Store.loot[lootId]
    if not table_ then return end

    for _, entry in ipairs(table_.entries or {}) do
        if math.random(100) <= (entry.chance or 100) then
            local count = math.random(entry.min or 1, math.max(entry.min or 1, entry.max or 1))
            Inv.Add(src, entry.item, count)
        end
    end
end

local function stageRestocked(locationId, stageId)
    local state = Runs.state[locationId]
    local entry = state and state[stageId]
    if not entry or not entry.restockAt then return true end
    return now() >= entry.restockAt
end

local function markLooted(locationId, stageId, restock)
    Runs.state[locationId] = Runs.state[locationId] or {}
    Runs.state[locationId][stageId] = {
        lootedAt = now(),
        restockAt = (restock and restock > 0) and (now() + restock) or nil,
    }
end

local function codeLength(location, stage)
    local length = 0
    for _, other in ipairs(location.stages or {}) do
        local opts = other.opts or {}
        if other.type == 'keypad' and opts.codeFrom == stage.id then
            length = math.max(length, tonumber(opts.digits) or 4)
        end
    end
    if length == 0 then length = tonumber((stage.opts or {}).revealCode) or 0 end
    return math.min(8, math.floor(length))
end

local function markDone(run, stage, src)
    run.stages[stage.id] = { done = true, by = Framework.GetCitizenId(src), at = now() }

    local digits = codeLength(run.location, stage)
    if digits > 0 and not run.codes[stage.id] then
        local out = {}
        for i = 1, digits do out[i] = tostring(math.random(0, 9)) end
        run.codes[stage.id] = table.concat(out)
    end

    if Stages.HasDoors(stage) then
        local opts = stage.opts or {}
        local doors = {}
        for _, door in ipairs(type(opts.doors) == 'table' and opts.doors or {}) do doors[#doors + 1] = door end
        if opts.doorId and opts.doorId ~= '' then doors[#doors + 1] = { id = opts.doorId } end

        CreateThread(function()
            local records = Doors.Apply(doors, opts, src)
            if opts.relockOnEnd == false or #records == 0 then return end

            if Runs.active[run.locationId] == run then
                run.doors = run.doors or {}
                for _, record in ipairs(records) do run.doors[#run.doors + 1] = record end
                return
            end

            local looted = Runs.looted[run.locationId]
            local wait = looted and (looted.untilAt - now()) or 0
            Runs.doorResets[#Runs.doorResets + 1] = { at = now() + math.max(wait, 120), run = { doors = records } }
        end)
    end
end

function Runs.EscapeDeadline(run)
    for _, stage in ipairs(run.location.stages or {}) do
        if stage.type == 'escape' and not (run.stages[stage.id] or {}).done then
            local limit = (stage.opts or {}).timeLimit or 0
            if limit > 0 and Runs.Unlocked(run, stage) and not run.escapeDeadline then
                run.escapeDeadline = now() + limit
            end
        end
    end
end

local function participantSources(run)
    local out = {}
    for _, entry in pairs(run.participants) do
        if entry.src then out[#out + 1] = entry.src end
    end
    return out
end

local function stageDuration(stage)
    local opts = stage.opts or {}
    if stage.type == 'container' then return opts.grabTime or 4 end
    if stage.type == 'twoman' then return opts.holdTime or 6 end
    return opts.duration or 10
end

function Runs.Resolve(ref)
    if type(ref) == 'table' and ref.robberyId then
        return Store.ResolveModel(ref.robberyId, ref.anchor)
    end
    return Store.Resolve(tonumber(ref))
end

function Runs.Begin(src, ref, stageId)
    local location = Runs.Resolve(ref)
    if not location or not location.enabled then
        return { ok = false, error = T('notSetUp') }
    end

    local locationId = location.id

    local stage = stageById(location, stageId)
    if not stage then return { ok = false, error = T('notThisJob') } end

    if Framework.IsBlockedJob(src) then
        return { ok = false, error = T('blockedJob') }
    end

    local ped = GetPlayerPed(src)
    if distance(GetEntityCoords(ped), stage.coords) > 6.0 then
        return { ok = false, error = T('tooFar') }
    end

    local citizenid = Framework.GetCitizenId(src)
    for otherId, other in pairs(Runs.active) do
        if otherId ~= locationId and citizenid and other.participants[citizenid] then
            return { ok = false, error = T('onAnotherJob') }
        end
    end

    local run = Runs.active[locationId]
    if not run then
        local started, err = Runs.Start(src, location)
        if not started then return { ok = false, error = err } end
        run = started
    else
        local joined, err = Runs.Join(run, src)
        if joined == false then return { ok = false, error = err } end
    end

    if (run.stages[stageId] or {}).done then
        return { ok = false, error = T('alreadyDone') }
    end

    if not Runs.Unlocked(run, stage) then
        return { ok = false, error = T('locked') }
    end

    local opts = stage.opts or {}
    local partnerHeld, partnerLabel = nil, nil

    if not stageRestocked(locationId, stageId) then
        return { ok = false, error = T('empty') }
    end

    if opts.requiredItem and opts.requiredItem ~= '' and not Inv.Has(src, opts.requiredItem) then
        return { ok = false, error = T('needItem') }
    end

    run.grabs = run.grabs or {}
    run.holds = run.holds or {}

    if stage.type == 'container' then
        local used = run.grabs[stageId] or 0
        if used >= (opts.grabs or 1) then
            return { ok = false, error = T('containerEmpty') }
        end
        local bag = (opts.bagItem and opts.bagItem ~= '') and opts.bagItem or Config.Run.BagItem
        if opts.needsBag and not Inv.Has(src, bag) then
            return { ok = false, error = T('needBag') }
        end
    end

    if stage.type == 'twoman' then
        if not opts.pairWith or opts.pairWith == '' then
            return { ok = false, error = T('unpaired') }
        end
        run.holds[stageId] = { src = src, expires = now() + (opts.holdTime or 6) + 4 }

        local partner = run.holds[opts.pairWith]
        partnerHeld = partner ~= nil and partner.src ~= src and partner.expires >= now()
        partnerLabel = (stageById(location, opts.pairWith) or {}).label
    end

    if stage.type == 'escape' and run.escapeDeadline and now() > run.escapeDeadline then
        Runs.Finish(run, 'failed', { reason = 'failed' })
        return { ok = false, error = T('outOfTime') }
    end

    local code, crack = nil, false
    if stage.type == 'keypad' then
        local from = opts.codeFrom or ''
        if from ~= '' and stageById(location, from) then
            code = run.codes[from]
            if not code then return { ok = false, error = T('noCodeYet') } end
        else
            crack = true
        end
    end

    run.lastActivity = now()
    local duration = stageDuration(stage)

    Runs.issued = (Runs.issued or 0) + 1
    local token = ('%d:%d:%s:%d'):format(src, now(), stageId, Runs.issued)
    Runs.tokens[token] = {
        src = src,
        run = run,
        locationId = locationId,
        stageId = stageId,
        startedAt = GetGameTimer(),
        duration = duration,
    }

    if opts.notifyPolice then
        Runs.Dispatch(run, ('Activity reported at %s.'):format(location.label or 'a business'))
    end

    if (opts.loudness or 0) > 0 then
        TriggerClientEvent('XS-Robberies:client:noise', -1, {
            coords = stage.coords,
            radius = opts.loudness,
            crew = participantSources(run),
        })
    end

    Runs.Push(run)

    return {
        ok = true,
        token = token,
        duration = duration,
        minigame = opts.minigame,
        type = stage.type,
        opts = opts,
        code = code,
        crack = crack,
        grabsLeft = stage.type == 'container'
            and ((opts.grabs or 1) - (run.grabs[stageId] or 0)) or nil,
        partnerHeld = partnerHeld,
        partnerLabel = partnerLabel,
    }
end

function Runs.FinishStage(src, token, success)
    local ticket = Runs.tokens[token]
    if not ticket or ticket.src ~= src then
        return { ok = false, error = T('badToken') }
    end

    Runs.tokens[token] = nil

    local run = Runs.active[ticket.locationId]
    if not run or run ~= ticket.run then return { ok = false, error = T('runOver') } end

    local location = run.location
    local stage = stageById(location, ticket.stageId)
    if not stage then return { ok = false, error = T('stageGone') } end

    local elapsed = (GetGameTimer() - ticket.startedAt) / 1000
    if success and elapsed < (ticket.duration * 0.75) then
        return { ok = false, error = T('tooQuick') }
    end

    local ped = GetPlayerPed(src)
    if distance(GetEntityCoords(ped), stage.coords) > 8.0 then
        return { ok = false, error = T('walkedAway') }
    end

    local opts = stage.opts or {}
    run.lastPresence = now()
    run.lastActivity = now()

    if success and stage.type == 'twoman' then
        local partner = (run.holds or {})[opts.pairWith or '']
        if not partner or partner.src == src or partner.expires < now() then
            success = false
        end
    end

    if not success then
        if opts.onFail == 'escalate' then
            Runs.Dispatch(run, ('Something went wrong at %s.'):format(location.label or 'a business'))
        elseif opts.onFail == 'fail' then
            Runs.Finish(run, 'failed', { reason = 'failed' })
            return { ok = true, failed = true, ended = true }
        elseif (location.response or {}).dispatchOnFail then
            Runs.Dispatch(run, ('Alarm at %s.'):format(location.label or 'a business'))
        end

        local lost = false
        if opts.requiredItem and opts.requiredItem ~= ''
            and math.random(100) <= (tonumber(opts.loseItemChance) or 0) then
            Inv.Remove(src, opts.requiredItem, 1)
            lost = true
        end

        local penalty = opts.penalty or 'none'
        if penalty == 'none' and stage.type == 'power' and opts.shockRisk == true then
            penalty = 'shock'
        end

        Runs.Push(run)
        return {
            ok = true,
            failed = true,
            penalty = penalty ~= 'none' and penalty or nil,
            lostItem = lost and opts.requiredItem or nil,
        }
    end

    if opts.requiredItem and opts.requiredItem ~= '' then
        if opts.consumeItem then
            Inv.Remove(src, opts.requiredItem, 1)
        elseif (opts.itemDamage or 0) > 0 then
            Inv.Damage(src, opts.requiredItem, opts.itemDamage)
        end
    end

    local payout = stage.payout or {}
    local paid = 0
    local grabsLeft = nil

    local function award()
        local reward = Runs.NormalisePayout(payout)

        if reward.cash and (tonumber(reward.cash.max) or 0) > 0 then
            local high = math.floor(tonumber(reward.cash.max) or 0)
            local low = math.min(math.floor(tonumber(reward.cash.min) or 0), high)
            local total = math.floor(math.random(low, high)
                * (Settings.Tunable('payoutMultiplier') or 1.0)
                * (location.payoutMultiplier or 1.0))

            paid = Runs.Credit(run, src, Runs.AccountFor(location, reward.cash), total)
        end

        for _, entry in ipairs(reward.items or {}) do
            if entry.item and entry.item ~= '' then
                if math.random(100) <= (tonumber(entry.chance) or 100) then
                    local low = tonumber(entry.min) or 1
                    local high = math.max(low, tonumber(entry.max) or low)
                    Inv.Add(src, entry.item, math.random(low, high))
                end
            end
        end

        if reward.lootTable and reward.lootTable ~= '' then
            rollLoot(src, reward.lootTable)
        end
    end

    if stage.type == 'container' then
        run.grabs[stage.id] = (run.grabs[stage.id] or 0) + 1
        award()

        grabsLeft = (opts.grabs or 1) - run.grabs[stage.id]
        if grabsLeft > 0 then
            Runs.Push(run)
            return { ok = true, paid = paid, grabsLeft = grabsLeft }
        end
    else
        award()
    end

    markDone(run, stage, src)

    if stage.type == 'twoman' then
        local partner = stageById(location, opts.pairWith or '')
        if partner and not (run.stages[partner.id] or {}).done then
            markDone(run, partner, src)
        end
    end

    local panicked = false

    if stage.type == 'camera' then
        run.camerasDown = true
    elseif stage.type == 'power' then
        run.powerCut = true
        if opts.killLights then
            TriggerClientEvent('XS-Robberies:client:blackout', -1, {
                coords = location.origin,
                radius = (location.radius or 30.0) + 40.0,
                on = true,
            })
            run.blackout = true
        end
    elseif stage.type == 'hostage' then
        if (opts.stallFor or 0) > 0 and run.alarm == 'pending' and run.alarmAt then
            run.alarmAt = run.alarmAt + opts.stallFor
        end
        if math.random(100) <= (opts.panicChance or 0) then
            panicked = true
            Runs.Dispatch(run, ('Panic alarm from %s.'):format(location.label or 'a business'))
        end
    end

    if opts.restock ~= nil then
        markLooted(ticket.locationId, stage.id, opts.restock)
    end

    if stage.type == 'escape' then
        if opts.inVehicle and GetVehiclePedIsIn(ped, false) == 0 then
            run.stages[stage.id] = nil
            return { ok = false, error = T('needVehicle') }
        end

        if run.escapeDeadline and now() > run.escapeDeadline then
            Runs.Finish(run, 'failed', { reason = 'failed' })
            return { ok = true, failed = true, ended = true }
        end

        Runs.Complete(run)
        return { ok = true, ended = true, completed = true, paid = paid }
    end

    if not run.hasEscape and Runs.EverythingDone(run) then
        Runs.Complete(run)
        return {
            ok = true,
            ended = true,
            completed = true,
            paid = paid,
            code = run.codes[stage.id],
        }
    end

    Runs.EscapeDeadline(run)
    Runs.Push(run)

    TriggerEvent('XS-Robberies:stageCompleted', {
        robberyId = location.robberyId,
        locationId = location.id,
        stageId = stage.id,
        stageType = stage.type,
        citizenid = Framework.GetCitizenId(src),
        source = src,
        paid = paid,
    })

    return {
        ok = true,
        paid = paid,
        panicked = panicked,
        grabsLeft = grabsLeft,
        code = run.codes[stage.id],
    }
end

CreateThread(function()
    while true do
        Wait(1000)

        for locationId, run in pairs(Runs.active) do
            if run.alarm == 'pending' and run.alarmAt and now() >= run.alarmAt then
                Runs.Dispatch(run, 'Alarm at ' .. (run.location.label or 'a business'))
            end

            local repeatAlert = (run.location.response or {}).repeatAlert or 0
            if run.alarm == 'raised' and repeatAlert > 0
                and run.lastAlert and now() - run.lastAlert >= repeatAlert then
                Runs.Dispatch(run, 'Still in progress.')
            end

            local present, online = false, false
            for _, entry in pairs(run.participants) do
                if entry.src and GetPlayerName(entry.src) then
                    online = true
                    local coords = GetEntityCoords(GetPlayerPed(entry.src))
                    if distance(coords, run.location.origin) <= (Config.Run.PresenceRadius or 120.0) then
                        present = true
                        break
                    end
                end
            end

            if present then run.lastPresence = now() end

            local escaping = run.hasEscape and Runs.Escaping(run)
            local idleAfter = Config.Run.IdleAfter or 0

            if not online and now() - run.lastPresence > 60 then
                Runs.Finish(run, 'abandoned', { reason = 'abandoned' })
            elseif not present and not run.hasEscape and Runs.RequiredDone(run) then
                Runs.Complete(run)
            elseif not escaping and now() - run.lastPresence > (Settings.Tunable('abandonAfter') or 300) then
                Runs.Finish(run, 'abandoned', { reason = 'abandoned' })
            elseif not escaping and idleAfter > 0 and now() - (run.lastActivity or run.startedAt) > idleAfter then
                Runs.Finish(run, 'abandoned', { reason = 'idle' })
            elseif (Config.Run.MaxDuration or 0) > 0
                and now() - run.startedAt > Config.Run.MaxDuration then
                Runs.Finish(run, 'failed', { reason = 'tooLong' })
            end
        end

        local stale = GetGameTimer() - 3600000
        for token, ticket in pairs(Runs.tokens) do
            if ticket.startedAt < stale then Runs.tokens[token] = nil end
        end

        for index = #Runs.doorResets, 1, -1 do
            local entry = Runs.doorResets[index]
            if now() >= entry.at then
                table.remove(Runs.doorResets, index)
                Doors.Restore(entry.run.doors)
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, entry in ipairs(Runs.doorResets) do Doors.Restore(entry.run.doors) end
    for _, run in pairs(Runs.active) do Doors.Restore(run.doors) end
end)

AddEventHandler('playerDropped', function()
    local src = source
    for _, run in pairs(Runs.active) do
        for citizenid, entry in pairs(run.participants) do
            if entry.src == src then entry.src = nil end
        end
    end
end)

function Runs.GuardDown(src, ref, stageId)
    local location = Runs.Resolve(ref)
    if not location then return { ok = false } end

    local run = Runs.active[location.id]
    if not run then return { ok = false } end

    local stage = stageById(location, stageId)
    if not stage or stage.type ~= 'guard' then return { ok = false } end
    if (run.stages[stage.id] or {}).done then return { ok = false } end

    local ped = GetPlayerPed(src)
    if distance(GetEntityCoords(ped), stage.coords) > 80.0 then
        return { ok = false }
    end

    markDone(run, stage, src)
    run.lastPresence = now()
    run.lastActivity = now()

    if (stage.opts or {}).alertOnDeath ~= false then
        Runs.Dispatch(run, T('guardDown', location.label or 'a business'))
    end

    local payout = Runs.NormalisePayout(stage.payout)
    for _, entry in ipairs(payout.items or {}) do
        if entry.item and entry.item ~= '' and math.random(100) <= (tonumber(entry.chance) or 100) then
            local low = tonumber(entry.min) or 1
            Inv.Add(src, entry.item, math.random(low, math.max(low, tonumber(entry.max) or low)))
        end
    end

    if payout.lootTable and payout.lootTable ~= '' then
        rollLoot(src, payout.lootTable)
    end

    if not run.hasEscape and Runs.EverythingDone(run) then
        Runs.Complete(run)
        return { ok = true }
    end

    Runs.EscapeDeadline(run)
    Runs.Push(run)
    return { ok = true }
end

function Runs.LaserTripped(src, ref)
    local location = Runs.Resolve(ref)
    if not location then return end

    local run = Runs.active[location.id]
    if not run then return end

    Runs.Dispatch(run, T('laserTripped', location.label or 'a business'))
end

function Runs.Live()
    local out = {}
    for locationId, run in pairs(Runs.active) do
        local doneCount = 0
        for _, entry in pairs(run.stages) do
            if entry.done then doneCount = doneCount + 1 end
        end

        local total = 0
        for _, earned in pairs(run.pot) do
        for _, amount in pairs(earned) do total = total + amount end
    end

        out[#out + 1] = {
            locationId = locationId,
            robberyId = run.location.robberyId,
            name = run.location.name or run.location.label,
            location = run.location.label,
            stage = ('%d of %d stages'):format(doneCount, #(run.location.stages or {})),
            done = doneCount,
            total = #(run.location.stages or {}),
            alarm = run.alarm,
            elapsed = now() - run.startedAt,
            pot = math.floor(total),
            participants = participantList(run),
        }
    end
    return out
end
