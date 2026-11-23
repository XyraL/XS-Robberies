Petty = Petty or {}
Petty.config = {}
Petty.saved = {}
Petty.shops = nil
Petty.openables = nil
Petty.tokens = {}
Petty.targets = {}
Petty.players = {}
Petty.inUse = {}
Petty.busy = {}
Petty.alerted = {}
Petty.owned = {}
Petty.opening = {}
Petty.registered = {}
Petty.stats = {}
Petty.issued = 0

local known = nil

local function now()
    return os.time()
end

local function distance(a, b)
    if not a or not b then return 9999.0 end
    local dx, dy, dz = a.x - b.x, a.y - b.y, a.z - b.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function plain(c)
    return { x = c.x + 0.0, y = c.y + 0.0, z = c.z + 0.0 }
end

local function decode(raw)
    if not raw or raw == '' then return nil end
    local ok, out = pcall(json.decode, raw)
    if ok and type(out) == 'table' then return out end
    return nil
end

local function items()
    if known then return known end
    local list = Inv.Items and Inv.Items() or {}
    known = { count = #list, names = {}, labels = {} }
    for _, entry in ipairs(list) do
        known.names[entry.name] = true
        known.labels[entry.name] = entry.label
    end
    return known
end

local function resolver(names)
    local set = items()
    if set.count == 0 then return names[1] end
    for _, name in ipairs(names) do
        if set.names[name] then return name end
    end
    return names[1]
end

local function itemLabel(name)
    return items().labels[name] or name
end

local function contains(list, value)
    for _, entry in ipairs(list or {}) do
        if entry == value then return true end
    end
    return false
end

local function roll(chance)
    chance = tonumber(chance) or 0
    if chance <= 0 then return false end
    if chance >= 100 then return true end
    return math.random(100) <= chance
end

function Petty.On()
    return Settings.Tunable('pettyEnabled') ~= false
end

function Petty.Load()
    known = nil
    local rows = MySQL.query.await('SELECT `kind`, `data` FROM xs_robbery_petty') or {}
    local stored = {}
    for _, row in ipairs(rows) do stored[row.kind] = decode(row.data) end

    Petty.saved = {}
    for _, id in ipairs(Petty.order) do
        Petty.config[id] = Petty.Clean(id, stored[id], resolver)
        Petty.saved[id] = stored[id] ~= nil
    end

    Petty.shops = Petty.CleanShops(stored._shops)
    Petty.openables = Petty.CleanOpenables(stored._open, resolver)
    Petty.saved._shops = stored._shops ~= nil
    Petty.saved._open = stored._open ~= nil

    Petty.RegisterOpenables()
    Petty.loaded = true
end

function Petty.Count()
    local on = 0
    for _, id in ipairs(Petty.order) do
        if (Petty.config[id] or {}).enabled then on = on + 1 end
    end
    return on, #Petty.order
end

local function hits()
    local out, at = {}, now()
    for key, untilAt in pairs(Petty.targets) do
        if untilAt <= at then
            Petty.targets[key] = nil
        elseif key:sub(1, 4) == 'obj:' or key:sub(1, 5) == 'spot:' then
            out[key] = untilAt - at
        end
    end
    return out
end

function Petty.Public()
    local kinds = {}
    for _, id in ipairs(Petty.order) do
        local cfg = Petty.config[id]
        local def = Petty.kinds[id]
        if cfg then
            kinds[id] = {
                enabled = cfg.enabled,
                label = cfg.label,
                reach = cfg.reach,
                target = def.target,
                peds = cfg.peds,
                vehicles = cfg.vehicles and { classes = cfg.vehicles.classes, parked = cfg.vehicles.parked } or nil,
                models = cfg.models,
                spots = cfg.spots,
                prop = cfg.prop,
            }
        end
    end

    local openables = {}
    for _, entry in ipairs(Petty.openables.list) do
        if entry.enabled then openables[entry.item] = { label = entry.label, duration = entry.duration } end
    end

    return {
        on = Petty.On(),
        time = now(),
        kinds = kinds,
        shops = Petty.shops,
        openables = openables,
        hit = hits(),
    }
end

function Petty.SyncTo(target)
    TriggerClientEvent('XS-Robberies:client:petty', target or -1, Petty.Public())
end

function Petty.RegisterOpenables()
    if Inv.name == 'ox_inventory' then return end
    if not Framework.UseableItem then return end

    for _, entry in ipairs(Petty.openables.list) do
        if not Petty.registered[entry.item] then
            local name = entry.item
            local ok = Framework.UseableItem(name, function(source)
                TriggerClientEvent('XS-Robberies:client:pettyOpen', source, name)
            end)
            if ok then Petty.registered[name] = true end
        end
    end
end

function Petty.Save(id, input)
    local clean
    if id == '_shops' then
        clean = Petty.CleanShops(input)
        Petty.shops = clean
    elseif id == '_open' then
        clean = Petty.CleanOpenables(input, resolver)
        Petty.openables = clean
    elseif Petty.kinds[id] then
        clean = Petty.Clean(id, input, resolver)
        Petty.config[id] = clean
    else
        return false, 'There is no crime called that.'
    end

    MySQL.prepare.await([[
        INSERT INTO xs_robbery_petty (`kind`, `data`) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)
    ]], { id, json.encode(clean) })

    Petty.saved[id] = true
    if id == '_open' then Petty.RegisterOpenables() end
    Petty.SyncTo()
    return true, clean
end

function Petty.Reset(id)
    if id ~= '_shops' and id ~= '_open' and not Petty.kinds[id] then
        return false, 'There is no crime called that.'
    end

    MySQL.prepare.await('DELETE FROM xs_robbery_petty WHERE `kind` = ?', { id })
    known = nil

    if id == '_shops' then
        Petty.shops = Petty.CleanShops(nil)
    elseif id == '_open' then
        Petty.openables = Petty.CleanOpenables(nil, resolver)
    else
        Petty.config[id] = Petty.Clean(id, nil, resolver)
    end

    Petty.saved[id] = false
    Petty.SyncTo()
    return true
end

function Petty.Owned(plate)
    local cached = Petty.owned[plate]
    if cached and cached.at > now() - 300 then return cached.owned end

    local owned = false
    local ok, row = pcall(MySQL.scalar.await, 'SELECT plate FROM player_vehicles WHERE plate = ? LIMIT 1', { plate })
    if ok and row then owned = true end

    Petty.owned[plate] = { owned = owned, at = now() }
    return owned
end

local function entityFrom(netId)
    netId = tonumber(netId)
    if not netId then return 0 end
    local ok, entity = pcall(NetworkGetEntityFromNetworkId, math.floor(netId))
    if not ok or not entity or entity == 0 or not DoesEntityExist(entity) then return 0 end
    return entity
end

local function trimmed(value)
    return (tostring(value or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function pedTarget(def, cfg, payload, here)
    local ped = entityFrom(payload.netId)
    if ped == 0 or GetEntityType(ped) ~= 1 then return nil, T('pettyGone') end
    if IsPedAPlayer(ped) then return nil, T('pettyNotThem') end
    if (GetEntityHealth(ped) or 0) <= 0 then return nil, T('pettyGone') end
    if GetVehiclePedIsIn(ped, false) ~= 0 then return nil, T('pettyNotThem') end

    local peds = cfg.peds
    local population = GetEntityPopulationType(ped)
    if peds.skipMission and (population == 6 or population == 7) then return nil, T('pettyNotThem') end

    local model = Petty.Hash(GetEntityModel(ped))
    if Petty.HashSet(peds.exclude)[model] then return nil, T('pettyNotThem') end
    if #peds.models > 0 and not Petty.HashSet(peds.models)[model] then return nil, T('pettyNotThem') end

    local at = GetEntityCoords(ped)
    local reach = cfg.reach + (def.target == 'aim' and 3.0 or 1.5)
    if distance(here, at) > reach then return nil, T('pettyTooFar') end

    return { key = 'ped:' .. math.floor(tonumber(payload.netId)), entity = ped, coords = at }
end

local function vehicleTarget(def, cfg, payload, here)
    local vehicle = entityFrom(payload.netId)
    if vehicle == 0 or GetEntityType(vehicle) ~= 2 then return nil, T('pettyGone') end

    local v = cfg.vehicles
    local class = tonumber(payload.class)
    if class == nil or not contains(v.classes, math.floor(class)) then return nil, T('pettyWrongCar') end

    if v.parked then
        if GetPedInVehicleSeat(vehicle, -1) ~= 0 then return nil, T('pettyOccupied') end
        if (GetEntitySpeed(vehicle) or 0) > 1.0 then return nil, T('pettyMoving') end
    end

    local at = GetEntityCoords(vehicle)
    if distance(here, at) > cfg.reach + 3.5 then return nil, T('pettyTooFar') end

    local plate = trimmed(GetVehicleNumberPlateText(vehicle))
    if v.skipOwned and plate ~= '' and Petty.Owned(plate) then return nil, T('pettyOwned') end

    local key = ('veh:%s:%s'):format(def.id, plate ~= '' and plate or tostring(payload.netId))
    local wheel = nil
    if def.id == 'wheels' then
        wheel = tonumber(payload.wheel)
        if not wheel or wheel < 0 or wheel > 3 then return nil, T('pettyNoWheel') end
        wheel = math.floor(wheel)
        key = key .. ':' .. wheel
    end

    return { key = key, entity = vehicle, coords = at, plate = plate, wheel = wheel }
end

local function modelTarget(def, cfg, payload, here)
    local c = payload.coords
    if type(c) ~= 'table' or not tonumber(c.x) or not tonumber(c.y) or not tonumber(c.z) then
        return nil, T('pettyGone')
    end

    local model = Petty.Hash(payload.model)
    if not model or not Petty.HashSet(cfg.models)[model] then return nil, T('pettyNotThem') end

    local at = { x = tonumber(c.x) + 0.0, y = tonumber(c.y) + 0.0, z = tonumber(c.z) + 0.0 }
    if distance(here, at) > cfg.reach + 1.5 then return nil, T('pettyTooFar') end

    return { key = ('obj:%s:%.1f_%.1f_%.1f'):format(def.id, at.x, at.y, at.z), coords = at }
end

local function spotTarget(def, cfg, payload, here)
    local spot = nil
    for _, entry in ipairs(cfg.spots or {}) do
        if entry.id == payload.spot then spot = entry break end
    end
    if not spot then return nil, T('pettyGone') end

    local at = { x = spot.x, y = spot.y, z = spot.z }
    if distance(here, at) > cfg.reach + 1.5 then return nil, T('pettyTooFar') end

    return { key = ('spot:%s:%s'):format(def.id, spot.id), coords = at, spot = spot }
end

local RESOLVE = {
    ped = pedTarget,
    aim = pedTarget,
    vehicle = vehicleTarget,
    model = modelTarget,
    spot = spotTarget,
}

local function waitText(left)
    if left >= 60 then return T('pettyWaitMinutes', math.ceil(left / 60)) end
    return T('pettyWaitSeconds', math.max(1, math.ceil(left)))
end

local function witnesses(coords, radius, except)
    if (radius or 0) <= 0 then return 0 end
    local ok, peds = pcall(GetAllPeds)
    if not ok or type(peds) ~= 'table' then return 0 end

    local count = 0
    for _, ped in ipairs(peds) do
        if ped ~= except and not IsPedAPlayer(ped) and (GetEntityHealth(ped) or 0) > 0 then
            if distance(GetEntityCoords(ped), coords) <= radius then
                count = count + 1
                if count >= 8 then break end
            end
        end
    end
    return count
end

local function markEntity(entity, field, value)
    if not entity then return end
    pcall(function()
        local state = Entity(entity).state
        local current = state.xsPetty
        if type(current) ~= 'table' then current = {} end
        if field == 'wheels' then
            current.wheels = type(current.wheels) == 'table' and current.wheels or {}
            current.wheels[tostring(value)] = true
        else
            current[field] = value
        end
        state:set('xsPetty', current, true)
    end)
end

function Petty.Alert(def, cfg, coords, reason, key)
    if Settings.Tunable('pettyAlerts') == false then return false end

    if key then
        if (Petty.alerted[key] or 0) > now() then return false end
        Petty.alerted[key] = now() + 60
    end

    local alert = cfg.alert
    local data = {
        coords = plain(coords),
        code = alert.code,
        title = alert.title ~= '' and alert.title or def.label,
        description = reason,
        sprite = 500,
        colour = 1,
        priority = 2,
        radius = 0,
        blipTime = 180,
    }

    local delay = math.max(0, math.floor(tonumber(alert.delay) or 0))
    if delay > 0 then
        SetTimeout(delay * 1000, function() Dispatch.Alert(data) end)
    else
        Dispatch.Alert(data)
    end
    return true
end

local function moneyText(account, amount)
    if account == 'bank' then return T('pettyBank', amount) end
    if account == 'dirty' then return T('pettyDirty', amount) end
    return T('pettyCash', amount)
end

function Petty.Award(src, payout, scale)
    local reward = Runs.NormalisePayout(payout)
    local parts, paid, account = {}, 0, 'cash'

    if reward.cash and (tonumber(reward.cash.max) or 0) > 0 then
        local high = math.floor(tonumber(reward.cash.max) or 0)
        local low = math.min(math.floor(tonumber(reward.cash.min) or 0), high)
        local amount = math.floor(math.random(low, high) * (scale or 1.0))
        account = reward.cash.account
        if account ~= 'bank' and account ~= 'dirty' then account = 'cash' end

        if amount > 0 then
            Runs.PayAccount(src, account, amount)
            paid = amount
            parts[#parts + 1] = moneyText(account, amount)
        end
    end

    local given = {}
    local set = items()

    for _, entry in ipairs(reward.items or {}) do
        if entry.item and entry.item ~= '' and roll(entry.chance or 100) then
            local low = math.max(1, math.floor(tonumber(entry.min) or 1))
            local high = math.max(low, math.floor(tonumber(entry.max) or low))
            local count = math.random(low, high)

            if set.count > 0 and not set.names[entry.item] then
                print(('^3[XS-Robberies]^0 petty crime tried to give %s, which your inventory does not have. Add it or change the loot in the builder.')
                    :format(entry.item))
            elseif Inv.Add(src, entry.item, count) then
                given[#given + 1] = { item = entry.item, count = count }
            end
        end
    end

    if reward.lootTable and reward.lootTable ~= '' then
        for _, entry in ipairs(Runs.RollLoot(src, reward.lootTable) or {}) do
            given[#given + 1] = entry
        end
    end

    for _, entry in ipairs(given) do
        local label = itemLabel(entry.item)
        parts[#parts + 1] = entry.count > 1 and T('pettyItems', entry.count, label) or label
    end

    return paid, table.concat(parts, ', '), account
end

local function scale()
    return (tonumber(Settings.Tunable('payoutMultiplier')) or 1.0) * (tonumber(Settings.Tunable('pettyMultiplier')) or 1.0)
end

local function playerKey(citizenid, id)
    return ('%s:%s'):format(citizenid, id)
end

function Petty.PlayerLeft(citizenid, id)
    local untilAt = Petty.players[playerKey(citizenid, id)]
    if not untilAt then return 0 end
    return math.max(0, untilAt - now())
end

function Petty.TargetLeft(key)
    local untilAt = Petty.targets[key]
    if not untilAt then return 0 end
    return math.max(0, untilAt - now())
end

local HOLD = 200

local function shopCheck(def, target)
    if def.group ~= 'shop' or not target.spot then return nil end
    local name = Petty.ClerkName(def.id, target.spot)
    local clerk = Petty.Clerk(name, now(), Petty.shops)
    if clerk.state == 'away' then return clerk end
    local soon = Petty.Clerk(name, now() + 1, Petty.shops)
    if soon.state == 'away' then
        soon.left = soon.left + 1
        return soon
    end
    return clerk
end

local function fail(message, extra)
    local out = extra or {}
    out.ok = false
    out.error = message
    return out
end

function Petty.Begin(src, payload)
    payload = type(payload) == 'table' and payload or {}
    local id = payload.kind
    local def = Petty.kinds[id]
    local cfg = Petty.config[id]
    if not def or not cfg then return fail(T('notRightNow')) end

    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return fail(T('notRightNow')) end

    if not Petty.On() or not cfg.enabled then return fail(T('pettyOff')) end
    if Settings.KillSwitch() then return fail(T('killSwitch')) end
    if Settings.Blacklisted(citizenid) then return fail(T('blacklisted')) end
    if Framework.IsBlockedJob(src) then return fail(T('blockedJob')) end

    local busy = Petty.busy[src]
    if busy and busy.untilAt > now() and Petty.tokens[busy.token] then return fail(T('pettyBusy')) end

    local left = Petty.PlayerLeft(citizenid, id)
    if left > 0 then return fail(waitText(left)) end

    if (cfg.police or 0) > 0 then
        local police = Framework.CountPolice(true)
        if police < cfg.police then return fail(T('noPolice', police, cfg.police)) end
    end

    local here = GetEntityCoords(GetPlayerPed(src))
    local target, err = RESOLVE[def.target](def, cfg, payload, here)
    if not target then return fail(err) end

    if Petty.TargetLeft(target.key) > 0 then return fail(T('pettyTargetDone')) end

    local using = Petty.inUse[target.key]
    if using and using.src ~= src and using.untilAt > now() then return fail(T('pettyInUse')) end

    local tool = cfg.item.name
    if tool ~= '' and not Inv.Has(src, tool) then return fail(T('pettyNeedItem', itemLabel(tool))) end

    local clerk = shopCheck(def, target)
    if clerk and clerk.state ~= 'away' then
        if roll(Petty.shops.caught) then Petty.Alert(def, cfg, target.coords, T('pettyAlertClerk'), target.key) end
        return fail(T('pettyCaught'), { caught = true })
    end

    if def.target == 'aim' and roll(cfg.victim.resist) then
        Petty.targets[target.key] = now() + math.floor(cfg.cooldown.target * 60)
        markEntity(target.entity, 'done', true)
        if roll(cfg.alert.chance) or cfg.alert.onFail then
            Petty.Alert(def, cfg, target.coords, T('pettyAlertCaller'), target.key)
        end
        return {
            ok = true,
            resisted = true,
            reaction = roll(cfg.victim.fight) and 'fight' or 'flee',
        }
    end

    local alarm = false
    if def.target == 'vehicle' and roll(cfg.vehicles.alarm) then
        alarm = true
        if cfg.vehicles.alarmAlerts then
            Petty.Alert(def, cfg, target.coords, T('pettyAlertAlarm'), target.key)
        end
    end

    Petty.issued = Petty.issued + 1
    local token = ('p%d:%d:%d'):format(src, Petty.issued, GetGameTimer())

    Petty.tokens[token] = {
        src = src,
        kind = id,
        key = target.key,
        coords = target.coords,
        entity = target.entity,
        wheel = target.wheel,
        spot = target.spot,
        window = clerk and clerk.window or nil,
        citizenid = citizenid,
        startedAt = GetGameTimer(),
        duration = cfg.duration,
    }

    Petty.busy[src] = { token = token, untilAt = now() + math.ceil(cfg.duration) + HOLD }
    Petty.inUse[target.key] = { src = src, untilAt = now() + math.ceil(cfg.duration) + HOLD }

    return {
        ok = true,
        token = token,
        duration = cfg.duration,
        minigame = cfg.minigame,
        difficulty = cfg.difficulty,
        anim = cfg.anim,
        label = cfg.label,
        reach = cfg.reach,
        alarm = alarm,
        wheel = target.wheel,
        clerkLeft = clerk and clerk.left or nil,
    }
end

local function release(ticket, token)
    Petty.tokens[token] = nil
    if Petty.busy[ticket.src] and Petty.busy[ticket.src].token == token then Petty.busy[ticket.src] = nil end
    if Petty.inUse[ticket.key] and Petty.inUse[ticket.key].src == ticket.src then Petty.inUse[ticket.key] = nil end
end

local function breakTool(src, cfg, success)
    local tool = cfg.item.name
    if tool == '' then return nil end

    if success and cfg.item.consume then
        Inv.Remove(src, tool, 1)
        return nil
    end

    if roll(cfg.item.breakChance) then
        Inv.Remove(src, tool, 1)
        return itemLabel(tool)
    end
    return nil
end

local function reactionFor(def, cfg, success)
    if def.target == 'aim' then
        return cfg.victim.flee and 'flee' or nil
    end
    if def.target ~= 'ped' then return nil end

    local noticed = not success or roll(cfg.victim.notice)
    if not noticed then return nil end
    return roll(cfg.victim.fight) and 'fight' or 'flee'
end

local function stillThere(def, cfg, ticket, here)
    if def.target ~= 'ped' and def.target ~= 'aim' then return true end
    if not ticket.entity or not DoesEntityExist(ticket.entity) then return false end
    return distance(here, GetEntityCoords(ticket.entity)) <= cfg.reach + (def.target == 'aim' and 5.0 or 3.0)
end

function Petty.Finish(src, payload)
    payload = type(payload) == 'table' and payload or {}
    local token = payload.token
    local ticket = token and Petty.tokens[token]
    if not ticket or ticket.src ~= src then return fail(T('badToken')) end

    release(ticket, token)

    local def = Petty.kinds[ticket.kind]
    local cfg = Petty.config[ticket.kind]
    if not def or not cfg then return fail(T('notRightNow')) end

    if payload.cancelled == true then
        return { ok = true, cancelled = true, reaction = def.target == 'aim' and 'flee' or nil }
    end

    if Petty.TargetLeft(ticket.key) > 0 then return fail(T('pettyTargetDone')) end
    local wait = Petty.PlayerLeft(ticket.citizenid, ticket.kind)
    if wait > 0 then return fail(waitText(wait)) end

    local success = payload.success == true
    local elapsed = (GetGameTimer() - ticket.startedAt) / 1000
    if success and elapsed < ticket.duration * 0.75 then return fail(T('tooQuick')) end

    local here = GetEntityCoords(GetPlayerPed(src))
    if distance(here, ticket.coords) > cfg.reach + 4.0 then return fail(T('walkedAway')) end

    local message = nil

    if success and not stillThere(def, cfg, ticket, here) then
        success = false
        message = T('pettyGotAway')
    end

    local shocked = false
    if (cfg.shock or 0) > 0 and roll(cfg.shock) then
        success = false
        shocked = true
        message = T('pettyShocked')
    end

    local caught = false
    if success and ticket.spot and def.group == 'shop' then
        local name = Petty.ClerkName(def.id, ticket.spot)
        local clerk = Petty.Clerk(name, now(), Petty.shops)
        if clerk.state ~= 'away' or clerk.window ~= ticket.window then
            clerk = Petty.Clerk(name, now() - 1, Petty.shops)
        end
        if clerk.state ~= 'away' or clerk.window ~= ticket.window then
            success = false
            caught = true
            message = T('pettyCaught')
        end
    end

    local broke = breakTool(src, cfg, success)
    local reaction = reactionFor(def, cfg, success)
    local victim = (def.target == 'ped' or def.target == 'aim') and ticket.entity or nil

    local alerted = false
    if caught then
        if roll(Petty.shops.caught) then
            alerted = Petty.Alert(def, cfg, ticket.coords, T('pettyAlertClerk'), ticket.key)
        end
    elseif not success and cfg.alert.onFail then
        alerted = Petty.Alert(def, cfg, ticket.coords, T('pettyAlertCaller'), ticket.key)
    end

    if not alerted then
        local seen = witnesses(ticket.coords, cfg.witness.radius, victim)
        for _ = 1, seen do
            if roll(cfg.witness.chance) then
                alerted = Petty.Alert(def, cfg, ticket.coords, T('pettyAlertWitness'), ticket.key)
                break
            end
        end
    end

    if not success then
        if def.target == 'ped' or def.group == 'shop' then
            Petty.players[playerKey(ticket.citizenid, ticket.kind)] = now() + math.floor(cfg.cooldown.player * 60)
        end
        if def.target == 'ped' then
            Petty.targets[ticket.key] = now() + math.floor(cfg.cooldown.target * 60)
            markEntity(ticket.entity, 'done', true)
        end
        return {
            ok = true,
            failed = true,
            message = message,
            broke = broke,
            reaction = reaction,
            shocked = shocked or nil,
        }
    end

    if not alerted and roll(cfg.alert.chance) then
        Petty.Alert(def, cfg, ticket.coords, T('pettyAlertCaller'), ticket.key)
    end

    local targetFor = math.floor(cfg.cooldown.target * 60)
    if targetFor > 0 then
        Petty.targets[ticket.key] = now() + targetFor
        if def.target == 'model' or def.target == 'spot' then
            TriggerClientEvent('XS-Robberies:client:pettyHit', -1, ticket.key, targetFor)
        end
    end
    Petty.players[playerKey(ticket.citizenid, ticket.kind)] = now() + math.floor(cfg.cooldown.player * 60)

    if def.target == 'ped' or def.target == 'aim' then
        markEntity(ticket.entity, 'done', true)
    elseif def.target == 'vehicle' then
        if def.id == 'wheels' then markEntity(ticket.entity, 'wheels', ticket.wheel)
        else markEntity(ticket.entity, def.id, true) end
    end

    local paid, summary, account = Petty.Award(src, cfg.payout, scale())

    local stat = Petty.stats[ticket.kind] or { hits = 0, paid = 0 }
    stat.hits = stat.hits + 1
    stat.paid = stat.paid + paid
    stat.last = now()
    Petty.stats[ticket.kind] = stat

    TriggerEvent('XS-Robberies:pettyCrime', {
        kind = ticket.kind,
        citizenid = ticket.citizenid,
        source = src,
        paid = paid,
        account = account,
        coords = plain(ticket.coords),
    })

    return {
        ok = true,
        paid = paid,
        summary = summary,
        broke = broke,
        reaction = reaction,
        noticed = def.target == 'ped' and reaction ~= nil and (cfg.victim.notice or 0) < 100,
        wheel = ticket.wheel,
    }
end

function Petty.Open(src, name)
    if type(name) ~= 'string' then return fail(T('notRightNow')) end

    local entry = nil
    for _, item in ipairs(Petty.openables.list) do
        if item.item == name and item.enabled then entry = item break end
    end
    if not entry then return fail(T('notRightNow')) end

    local last = Petty.opening[src] or 0
    if GetGameTimer() - last < 1000 then return fail(T('tooQuick')) end
    Petty.opening[src] = GetGameTimer()

    if not Inv.Has(src, name) or not Inv.Remove(src, name, 1) then return fail(T('pettyNothingToOpen')) end

    local paid, summary = Petty.Award(src, entry.payout, scale())
    return { ok = true, paid = paid, summary = summary }
end

local function forget(src)
    for token, ticket in pairs(Petty.tokens) do
        if ticket.src == src then release(ticket, token) end
    end
    Petty.busy[src] = nil
    Petty.opening[src] = nil
end

AddEventHandler('playerDropped', function()
    forget(source)
end)

AddEventHandler('QBCore:Server:OnPlayerUnload', function(src)
    forget(tonumber(src) or source)
end)

CreateThread(function()
    while true do
        Wait(30000)
        local at, timer = now(), GetGameTimer()

        for token, ticket in pairs(Petty.tokens) do
            if timer - ticket.startedAt > (ticket.duration + HOLD) * 1000 then release(ticket, token) end
        end
        for key, untilAt in pairs(Petty.targets) do
            if untilAt <= at then Petty.targets[key] = nil end
        end
        for key, untilAt in pairs(Petty.players) do
            if untilAt <= at then Petty.players[key] = nil end
        end
        for key, entry in pairs(Petty.inUse) do
            if entry.untilAt <= at then Petty.inUse[key] = nil end
        end
        for key, untilAt in pairs(Petty.alerted) do
            if untilAt <= at then Petty.alerted[key] = nil end
        end
        for src, entry in pairs(Petty.busy) do
            if entry.untilAt <= at then Petty.busy[src] = nil end
        end
    end
end)

lib.callback.register('XS-Robberies:petty:begin', function(src, payload)
    local ok, result = pcall(Petty.Begin, src, payload)
    if ok then return result end
    print(('^1[XS-Robberies]^0 petty crime failed to start: %s'):format(tostring(result)))
    return fail(T('didNotCount'))
end)

lib.callback.register('XS-Robberies:petty:finish', function(src, payload)
    local ok, result = pcall(Petty.Finish, src, payload)
    if ok then return result end
    print(('^1[XS-Robberies]^0 petty crime failed to finish: %s'):format(tostring(result)))
    return fail(T('didNotCount'))
end)

lib.callback.register('XS-Robberies:petty:open', function(src, name)
    local ok, result = pcall(Petty.Open, src, name)
    if ok then return result end
    print(('^1[XS-Robberies]^0 opening %s failed: %s'):format(tostring(name), tostring(result)))
    return fail(T('didNotCount'))
end)

local function admin(name, handler)
    lib.callback.register(name, function(src, ...)
        if not (Framework.IsAdmin and Framework.IsAdmin(src)) then
            return { ok = false, error = 'You are not allowed to do that.' }
        end

        local done, result = pcall(handler, src, ...)
        if not done then
            print(('^1[XS-Robberies]^0 %s failed: %s'):format(name, tostring(result)))
            return { ok = false, error = 'That failed on the server. The server console has the reason.' }
        end
        return result
    end)
end

local function snapshot()
    known = nil
    return {
        ok = true,
        on = Petty.On(),
        catalogue = Petty.Catalogue(resolver),
        config = Petty.config,
        shops = Petty.shops,
        openables = Petty.openables,
        saved = Petty.saved,
        stats = Petty.stats,
    }
end

admin('XS-Robberies:petty:get', function()
    return snapshot()
end)

admin('XS-Robberies:petty:save', function(src, payload)
    payload = type(payload) == 'table' and payload or {}
    local ok, result = Petty.Save(payload.kind, payload.config)
    if not ok then return { ok = false, error = result } end
    return { ok = true, kind = payload.kind, config = result, saved = Petty.saved }
end)

admin('XS-Robberies:petty:reset', function(src, kind)
    local ok, err = Petty.Reset(kind)
    if not ok then return { ok = false, error = err } end
    local out = snapshot()
    out.kind = kind
    return out
end)
