Trucks = { active = {} }

local SEATS = { driver = 1, passenger = 2, back = 3, auto = 4 }

local function now()
    return os.time()
end

local function cfg()
    return Config.Trucks or {}
end

local function entityOf(netId)
    if not netId then return nil end
    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end
    return entity
end

local function poseOf(entity)
    local c = GetEntityCoords(entity)
    return { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(entity) }
end

local function speedOf(entity)
    local v = GetEntityVelocity(entity)
    return math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
end

local function gap(a, b)
    local dx, dy = (a.x or 0.0) - (b.x or 0.0), (a.y or 0.0) - (b.y or 0.0)
    return math.sqrt(dx * dx + dy * dy)
end

local function keep(entity)
    if entity then pcall(SetEntityOrphanMode, entity, 2) end
end

local function killerOf(ped)
    if not ped then return nil end
    local ok, killer = pcall(GetPedSourceOfDeath, ped)
    if not ok or not killer or killer == 0 then return nil end
    local isPlayer = false
    pcall(function() isPlayer = IsPedAPlayer(killer) end)
    if not isPlayer then return nil end
    local owner = NetworkGetEntityOwner(killer)
    return owner and owner > 0 and owner or nil
end

function Trucks.ForRobbery(robberyId)
    for _, truck in pairs(Trucks.active) do
        if truck.robberyId == robberyId and not truck.cleanupAt then return truck end
    end
    return nil
end

function Trucks.Resolve(truckId)
    local truck = Trucks.active[truckId]
    local entity = truck and entityOf(truck.netId)
    if not entity then return nil end
    return Store.ResolveSpawned(truck.robberyId, truckId, poseOf(entity))
end

function Trucks.Moving(truckId)
    local truck = Trucks.active[truckId]
    local entity = truck and entityOf(truck.netId)
    return entity ~= nil and speedOf(entity) > 1.0
end

local function guardSpecs(def)
    local list = {}
    for index, stage in ipairs(def.stages or {}) do
        if stage.type == 'guard' and stage.enabled ~= false and stage.coords then
            local opts = stage.opts or {}
            local seat = SEATS[opts.seat or 'auto'] and (opts.seat or 'auto') or 'auto'
            list[#list + 1] = {
                stageId = stage.id,
                seat = seat,
                order = index,
                ped = opts.ped,
                weapon = opts.weapon,
                accuracy = opts.accuracy,
                health = opts.guardHealth,
                armour = opts.armour,
                hostile = opts.hostile == true,
            }
        end
    end

    table.sort(list, function(a, b)
        if SEATS[a.seat] ~= SEATS[b.seat] then return SEATS[a.seat] < SEATS[b.seat] end
        return a.order < b.order
    end)
    return list
end

local function pick(points)
    if type(points) ~= 'table' or #points == 0 then return nil end
    return points[math.random(#points)]
end

function Trucks.Broadcast(target)
    local list = {}
    for id, truck in pairs(Trucks.active) do
        local def = Store.Get(truck.robberyId)
        local spawn = def and Store.Spawns(def) or {}
        list[#list + 1] = {
            id = id,
            robberyId = truck.robberyId,
            name = def and def.name or truck.robberyId,
            netId = truck.netId,
            state = truck.state,
            hostile = truck.hostile,
            guards = truck.guards,
            extras = truck.extras,
            dest = truck.dest,
            speed = truck.speed,
            origin = def and Store.DefOrigin(def) or nil,
            stages = def and def.stages or {},
            blip = spawn.blip ~= false,
        }
    end
    TriggerClientEvent('XS-Robberies:client:trucks', target or -1, list)
end

function Trucks.SyncTo(src)
    Trucks.Broadcast(src)
end

function Trucks.Remove(truck)
    if not truck then return end
    Trucks.active[truck.id] = nil

    for _, netId in pairs(truck.guards or {}) do
        local ped = entityOf(netId)
        if ped then DeleteEntity(ped) end
    end
    for _, netId in ipairs(truck.extras or {}) do
        local ped = entityOf(netId)
        if ped then DeleteEntity(ped) end
    end

    local vehicle = entityOf(truck.netId)
    if vehicle then DeleteEntity(vehicle) end

    Trucks.Broadcast()
end

function Trucks.Send(src, def, from)
    local spawn = Store.Spawns(def)
    if not spawn then return nil, T('contactBusy') end
    if GetConvar('onesync', 'off') == 'off' then return nil, T('noOneSync') end
    if Trucks.ForRobbery(def.id) then return nil, T('truckOut') end

    local model = Store.Anchor(def).models[1]
    if not model then return nil, T('noTruckRoad') end

    local distance = cfg().SpawnDistance or {}
    local dest = spawn.heads == 'points' and pick(spawn.ends) or nil
    local spec = {
        model = model,
        start = spawn.start == 'points' and pick(spawn.starts) or nil,
        near = {
            min = tonumber(spawn.nearMin) or distance.min or 250,
            max = tonumber(spawn.nearMax) or distance.max or 650,
        },
        dest = dest,
        speed = math.max(5.0, (tonumber(spawn.speed) or 60) / 3.6),
        guards = guardSpecs(def),
        driver = cfg().Driver or { ped = 's_m_m_security_01', weapon = 'WEAPON_PISTOL' },
    }

    local ok, res = pcall(lib.callback.await, 'XS-Robberies:spawnTruck', src, spec)
    if not ok or type(res) ~= 'table' or not res.ok or not res.netId then
        return nil, (ok and type(res) == 'table' and res.error) or T('noTruckRoad')
    end

    local entity
    for _ = 1, 40 do
        entity = entityOf(res.netId)
        if entity then break end
        Wait(100)
    end
    if not entity then return nil, T('noTruckRoad') end
    keep(entity)

    local hostile = false
    for _, g in ipairs(spec.guards) do
        if g.hostile then hostile = true end
    end

    local id = ('t:%s:%d'):format(def.id, res.netId)
    local truck = {
        id = id,
        robberyId = def.id,
        netId = res.netId,
        guards = res.guards or {},
        extras = res.extras or {},
        dest = dest,
        speed = spec.speed,
        hostile = hostile,
        state = 'driving',
        expiresAt = now() + math.floor((tonumber(spawn.lasts) or 20) * 60),
        body = GetVehicleBodyHealth(entity),
        engine = GetVehicleEngineHealth(entity),
        guardHealth = {},
    }

    truck.guardArmour = {}
    for _, g in ipairs(spec.guards) do
        local netId = truck.guards[g.stageId]
        if netId then
            keep(entityOf(netId))
            truck.guardHealth[g.stageId] = math.max(100, math.floor(tonumber(g.health) or 200))
            truck.guardArmour[g.stageId] = math.floor(tonumber(g.armour) or 0)
        end
    end
    for _, netId in ipairs(truck.extras) do keep(entityOf(netId)) end

    Trucks.active[id] = truck

    local location = Trucks.Resolve(id)
    if location then location.crewOrigin = from end

    local run, err = nil, nil
    if location then run, err = Runs.Start(src, location) end
    if not run then
        Trucks.Remove(truck)
        return nil, err or T('noTruckRoad')
    end

    truck.run = run
    run.truck = id

    for _, g in ipairs(spec.guards) do
        if not truck.guards[g.stageId] then Runs.StageDone(run, g.stageId, nil, true) end
    end

    Trucks.Broadcast()
    Runs.Push(run)
    return truck, poseOf(entity)
end

function Trucks.Attacked(truck)
    if not truck or truck.state ~= 'driving' then return end
    truck.state = 'attacked'

    local run = truck.run
    if run and Runs.active[run.locationId] == run then
        run.lastActivity = now()
        Runs.RaiseAlarm(run, 'Armoured truck under attack.')
    end

    Trucks.Broadcast()
end

function Trucks.RunEnded(run, outcome)
    local truck = Trucks.active[run.truck or '']
    if not truck then return end
    truck.run = nil

    local linger = (outcome == 'completed' or outcome == 'stopped by staff') and (cfg().CleanUpAfter or 60) or 10
    truck.cleanupAt = now() + linger
end

RegisterNetEvent('XS-Robberies:server:truckHit', function(truckId)
    local src = source
    local truck = Trucks.active[truckId]
    if not truck or truck.state ~= 'driving' then return end

    local entity = entityOf(truck.netId)
    if not entity then return end
    if #(GetEntityCoords(GetPlayerPed(src)) - GetEntityCoords(entity)) > 150.0 then return end

    Trucks.Attacked(truck)
end)

local function tick(truck)
    local at = now()
    local run = truck.run
    if run and Runs.active[run.locationId] ~= run then
        run = nil
        truck.run = nil
        truck.cleanupAt = truck.cleanupAt or (at + 10)
    end

    if truck.cleanupAt then
        if at >= truck.cleanupAt then Trucks.Remove(truck) end
        return
    end

    if not run then return end

    local entity = entityOf(truck.netId)
    if not entity then
        Runs.Finish(run, 'failed', { reason = 'truckGone' })
        Trucks.Remove(truck)
        return
    end

    local pose = poseOf(entity)
    run.location.origin = pose

    if truck.state == 'driving' then
        local hit = GetVehicleBodyHealth(entity) < (truck.body or 1000.0) - 25.0
            or GetVehicleEngineHealth(entity) < (truck.engine or 1000.0) - 25.0
        for stageId, netId in pairs(truck.guards) do
            local ped = entityOf(netId)
            if not ped or GetEntityHealth(ped) < (truck.guardHealth[stageId] or 0) then
                hit = true
            else
                local ok, armour = pcall(GetPedArmour, ped)
                if ok and armour and armour < (truck.guardArmour[stageId] or 0) then hit = true end
            end
        end
        if hit then Trucks.Attacked(truck) end
    end

    for stageId, netId in pairs(truck.guards) do
        if Runs.active[run.locationId] ~= run then return end
        if not (run.stages[stageId] or {}).done then
            local ped = entityOf(netId)
            if not ped or GetEntityHealth(ped) <= 0 then
                Runs.StageDone(run, stageId, killerOf(ped))
            end
        end
    end

    if Runs.active[run.locationId] ~= run then return end

    if truck.state == 'driving' and truck.dest and gap(pose, truck.dest) < 30.0 then
        Runs.Finish(run, 'failed', { reason = 'gotAway' })
        return
    end

    if at >= truck.expiresAt then
        Runs.Finish(run, 'abandoned', { reason = 'truckLeft' })
        return
    end

    if (truck.lastPing or 0) + 2 <= at then
        truck.lastPing = at
        for _, entry in pairs(run.participants) do
            if entry.src then TriggerClientEvent('XS-Robberies:client:truckAt', entry.src, truck.id, pose) end
        end
    end
end

CreateThread(function()
    while true do
        Wait(1000)
        for _, truck in pairs(Trucks.active) do
            local ok, err = pcall(tick, truck)
            if not ok then print(('^1[XS-Robberies]^0 truck %s: %s'):format(tostring(truck.id), tostring(err))) end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, truck in pairs(Trucks.active) do Trucks.Remove(truck) end
end)
