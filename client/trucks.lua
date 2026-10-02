Trucks = { list = {}, groups = {}, tasked = {}, fleeing = {}, leaving = {}, blips = {}, stuck = {} }
TruckInstances = {}

local CALM = 786603
local FLEE = 1074528293

local function cfg()
    return Config.Trucks or {}
end

local function fromNet(netId)
    if not netId or not NetworkDoesNetworkIdExist(netId) then return nil end
    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end
    return entity
end

local function groupFor(netId)
    local name = ('XS_ROB_TRUCK_%d'):format(netId)
    local hash = Trucks.groups[name]
    if not hash then
        local _, created = AddRelationshipGroup(name)
        hash = created
        Trucks.groups[name] = hash
    end
    return hash
end

local function roadNear(min, max)
    local here = GetEntityCoords(PlayerPedId())
    for attempt = 1, 30 do
        local angle = math.random() * math.pi * 2.0
        local dist = min + math.random() * math.max(0.0, max - min)
        local x, y = here.x + math.cos(angle) * dist, here.y + math.sin(angle) * dist
        local found, node, heading = GetClosestVehicleNodeWithHeading(x, y, here.z, attempt <= 20 and 0 or 1, 3.0, 0)
        if found and node then
            local away = #(vector3(node.x, node.y, 0.0) - vector3(here.x, here.y, 0.0))
            if away >= min * 0.6 then
                return { x = node.x, y = node.y, z = node.z, h = heading }
            end
        end
    end
    return nil
end

local function freeSeat(vehicle, want)
    if want == 'driver' then return IsVehicleSeatFree(vehicle, -1) and -1 or nil end
    if want == 'passenger' then return IsVehicleSeatFree(vehicle, 0) and 0 or nil end

    local seats = GetVehicleModelNumberOfSeats(GetEntityModel(vehicle))
    for seat = want == 'back' and 1 or -1, seats - 2 do
        if IsVehicleSeatFree(vehicle, seat) then return seat end
    end
    return nil
end

local function arm(ped, g, group)
    local health = math.max(100, math.floor(tonumber(g.health) or 200))
    SetEntityMaxHealth(ped, health)
    SetEntityHealth(ped, health)
    SetPedArmour(ped, math.floor(tonumber(g.armour) or 0))
    SetPedAccuracy(ped, math.floor(tonumber(g.accuracy) or 40))
    SetPedDropsWeaponsWhenDead(ped, false)
    SetPedDiesWhenInjured(ped, false)
    SetPedFleeAttributes(ped, 0, false)
    SetPedCombatAttributes(ped, 46, true)
    SetPedCombatAttributes(ped, 0, true)
    SetPedCombatAbility(ped, 2)
    SetPedCombatRange(ped, 2)
    SetPedSeeingRange(ped, 60.0)
    SetPedHearingRange(ped, 60.0)
    SetPedKeepTask(ped, true)
    SetEntityAsMissionEntity(ped, true, true)
    SetPedRelationshipGroupHash(ped, group)
    if g.weapon and g.weapon ~= '' then
        GiveWeaponToPed(ped, joaat(g.weapon), 250, false, true)
    end
end

local function drive(driver, vehicle, dest, speed, style)
    if dest then
        TaskVehicleDriveToCoordLongrange(driver, vehicle, dest.x + 0.0, dest.y + 0.0, dest.z + 0.0, speed + 0.0, style, 25.0)
    else
        TaskVehicleDriveWander(driver, vehicle, speed + 0.0, style)
    end
    SetPedKeepTask(driver, true)
end

local function spawn(spec)
    local start = spec.start or roadNear(spec.near.min, spec.near.max)
    if not start then return { ok = false, error = T('noTruckRoad') } end

    local model = loadModel(spec.model)
    if not model then return { ok = false, error = T('noTruckRoad') } end

    RequestCollisionAtCoord(start.x + 0.0, start.y + 0.0, start.z + 0.0)
    local vehicle = CreateVehicle(model, start.x + 0.0, start.y + 0.0, start.z + 0.5, (start.h or 0.0) + 0.0, true, true)
    local waited = 0
    while not DoesEntityExist(vehicle) and waited < 3000 do
        Wait(50)
        waited = waited + 50
    end
    SetModelAsNoLongerNeeded(model)
    if not DoesEntityExist(vehicle) then return { ok = false, error = T('noTruckRoad') } end

    SetEntityAsMissionEntity(vehicle, true, true)
    SetEntityLoadCollisionFlag(vehicle, true)
    SetVehicleOnGroundProperly(vehicle)
    SetVehicleEngineOn(vehicle, true, true, false)
    SetVehicleDoorsLocked(vehicle, 2)

    local netId = NetworkGetNetworkIdFromEntity(vehicle)
    SetNetworkIdCanMigrate(netId, true)

    local group = groupFor(netId)
    local guards, extras, driver = {}, {}, nil

    for _, g in ipairs(spec.guards or {}) do
        local seat = freeSeat(vehicle, g.seat) or freeSeat(vehicle, 'auto')
        if seat then
            local pedModel = loadModel((g.ped and g.ped ~= '') and g.ped or 's_m_m_security_01')
            if pedModel then
                local ped = CreatePedInsideVehicle(vehicle, 4, pedModel, seat, true, true)
                SetModelAsNoLongerNeeded(pedModel)
                if ped and ped ~= 0 then
                    arm(ped, g, group)
                    guards[g.stageId] = NetworkGetNetworkIdFromEntity(ped)
                    if seat == -1 then driver = ped end
                end
            end
        end
    end

    if not driver then
        local d = spec.driver or {}
        local pedModel = loadModel(d.ped or 's_m_m_security_01')
        if pedModel then
            driver = CreatePedInsideVehicle(vehicle, 4, pedModel, -1, true, true)
            SetModelAsNoLongerNeeded(pedModel)
            if driver and driver ~= 0 then
                arm(driver, { weapon = d.weapon, health = 200, accuracy = 30 }, group)
                extras[#extras + 1] = NetworkGetNetworkIdFromEntity(driver)
            else
                driver = nil
            end
        end
    end

    if not driver then
        DeleteEntity(vehicle)
        return { ok = false, error = T('noTruckRoad') }
    end

    drive(driver, vehicle, spec.dest, spec.speed or 16.0, CALM)
    Trucks.tasked[NetworkGetNetworkIdFromEntity(driver)] = true

    return { ok = true, netId = netId, guards = guards, extras = extras, start = start }
end

lib.callback.register('XS-Robberies:spawnTruck', function(spec)
    local ok, result = pcall(spawn, spec or {})
    if not ok then
        print(('^1[XS-Robberies]^0 the truck did not spawn: %s'):format(tostring(result)))
        return { ok = false }
    end
    return result
end)

local function crewOf(truck)
    local out = {}
    for _, netId in pairs(truck.guards or {}) do out[#out + 1] = netId end
    for _, netId in ipairs(truck.extras or {}) do out[#out + 1] = netId end
    return out
end

local function offsetsFor(truck)
    local base = truck.origin or { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
    local turn = math.rad(-(base.h or 0.0))
    local cos, sin = math.cos(turn), math.sin(turn)

    local out = {}
    for _, stage in ipairs(truck.stages or {}) do
        if stage.coords and stage.enabled ~= false then
            local vx, vy = stage.coords.x - (base.x or 0.0), stage.coords.y - (base.y or 0.0)
            out[stage.id] = vector3(vx * cos - vy * sin, vx * sin + vy * cos, stage.coords.z - (base.z or 0.0))
        end
    end
    return out
end

local function instanceFor(truck, vehicle)
    local offsets = offsetsFor(truck)
    local stages = {}

    for _, stage in ipairs(truck.stages or {}) do
        local offset = offsets[stage.id]
        if offset then
            local opts = {}
            for k, v in pairs(stage.opts or {}) do opts[k] = v end
            Stages.Clamp(stage.type, opts)

            local requires = {}
            for _, dep in ipairs(stage.requires or {}) do
                if offsets[dep] then requires[#requires + 1] = dep end
            end
            if opts.codeFrom and not offsets[opts.codeFrom] then opts.codeFrom = '' end

            local at = GetOffsetFromEntityInWorldCoords(vehicle, offset.x, offset.y, offset.z)
            stages[#stages + 1] = {
                id = stage.id,
                type = stage.type,
                label = stage.label,
                requires = requires,
                payout = stage.payout or {},
                opts = opts,
                offset = offset,
                coords = { x = at.x, y = at.y, z = at.z, h = GetEntityHeading(vehicle) },
            }
        end
    end

    local c = GetEntityCoords(vehicle)
    return {
        id = truck.id,
        robberyId = truck.robberyId,
        name = truck.name,
        label = truck.name,
        origin = { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(vehicle) },
        radius = 30.0,
        blip = {},
        entity = vehicle,
        spawned = true,
        truckId = truck.id,
        stages = stages,
        props = {},
        npcs = {},
    }
end

local function dropBlip(id)
    local blip = Trucks.blips[id]
    if blip and DoesBlipExist(blip) then RemoveBlip(blip) end
    Trucks.blips[id] = nil
end

RegisterNetEvent('XS-Robberies:client:trucks', function(list)
    local fresh = {}
    for _, truck in ipairs(list or {}) do fresh[truck.id] = truck end

    for id, instance in pairs(TruckInstances) do
        if not fresh[id] then
            Anchors.OnLost(instance)
            TruckInstances[id] = nil
        end
    end

    for id in pairs(Trucks.blips) do
        if not fresh[id] then dropBlip(id) end
    end

    Trucks.list = fresh
end)

RegisterNetEvent('XS-Robberies:client:truckAt', function(id, pose)
    local truck = Trucks.list[id]
    if not truck or truck.blip == false or not pose then return end

    local look = cfg().Blip or {}
    local blip = Trucks.blips[id]
    if not blip or not DoesBlipExist(blip) then
        blip = AddBlipForCoord(pose.x + 0.0, pose.y + 0.0, pose.z + 0.0)
        SetBlipSprite(blip, look.sprite or 67)
        SetBlipColour(blip, look.colour or 1)
        SetBlipScale(blip, look.scale or 0.9)
        SetBlipAsShortRange(blip, false)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(truck.name or 'Truck')
        EndTextCommandSetBlipName(blip)
        Trucks.blips[id] = blip
    else
        SetBlipCoords(blip, pose.x + 0.0, pose.y + 0.0, pose.z + 0.0)
    end
end)

RegisterNetEvent('XS-Robberies:client:runEnded', function(data)
    if data and data.locationId then dropBlip(data.locationId) end
end)

RegisterNetEvent('XS-Robberies:client:runPublic', function(data)
    local instance = data and TruckInstances[data.locationId]
    if not instance or data.ended or instance.doorsOpen then return end

    local done = {}
    for _, id in ipairs(data.done or {}) do done[id] = true end

    for _, stage in ipairs(instance.stages) do
        if done[stage.id] and stage.type == 'tool' and stage.offset and stage.offset.y < -1.0 then
            local vehicle = instance.entity
            if DoesEntityExist(vehicle) and NetworkHasControlOfEntity(vehicle) then
                SetVehicleDoorOpen(vehicle, 2, false, false)
                SetVehicleDoorOpen(vehicle, 3, false, false)
            end
            instance.doorsOpen = true
            return
        end
    end
end)

local function tyresGone(vehicle)
    for wheel = 0, 7 do
        if IsVehicleTyreBurst(vehicle, wheel, false) then return true end
    end
    return false
end

local function playerNear(vehicle, radius)
    local at = GetEntityCoords(vehicle)
    for _, player in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(player)
        if ped ~= 0 and #(GetEntityCoords(ped) - at) <= radius then return true end
    end
    return false
end

local function behave(truck, vehicle)
    local group = groupFor(truck.netId)
    local attacked = truck.state == 'attacked'

    if attacked or truck.hostile then
        SetRelationshipBetweenGroups(5, group, `PLAYER`)
        SetRelationshipBetweenGroups(5, `PLAYER`, group)
    else
        SetRelationshipBetweenGroups(3, group, `PLAYER`)
        SetRelationshipBetweenGroups(3, `PLAYER`, group)
    end

    local speed = GetEntitySpeed(vehicle)
    local driver = GetPedInVehicleSeat(vehicle, -1)
    local driverGone = driver == 0 or IsPedDeadOrDying(driver, true)
    local stopped = speed < 2.0 or driverGone or not IsVehicleDriveable(vehicle, false)

    if not attacked and NetworkHasControlOfEntity(vehicle) then
        local blocked = speed < 1.0 and playerNear(vehicle, 25.0)
        if blocked then
            Trucks.stuck[truck.id] = Trucks.stuck[truck.id] or GetGameTimer()
        else
            Trucks.stuck[truck.id] = nil
        end

        if tyresGone(vehicle) or (Trucks.stuck[truck.id] and GetGameTimer() - Trucks.stuck[truck.id] > 5000) then
            Trucks.stuck[truck.id] = nil
            TriggerServerEvent('XS-Robberies:server:truckHit', truck.id)
        end
    end

    for _, netId in ipairs(crewOf(truck)) do
        local ped = fromNet(netId)
        if ped and not IsPedDeadOrDying(ped, true) and NetworkHasControlOfEntity(ped) then
            local inside = IsPedInVehicle(ped, vehicle, false)
            if GetPedRelationshipGroupHash(ped) ~= group then SetPedRelationshipGroupHash(ped, group) end

            if attacked then
                if inside and stopped then
                    if GetGameTimer() - (Trucks.leaving[netId] or 0) > 4000 then
                        Trucks.leaving[netId] = GetGameTimer()
                        TaskLeaveVehicle(ped, vehicle, 256)
                    end
                elseif inside and ped == driver then
                    if not Trucks.fleeing[netId] then
                        Trucks.fleeing[netId] = true
                        drive(ped, vehicle, nil, math.max(truck.speed or 16.0, 24.0), FLEE)
                    end
                elseif not inside and not IsPedInCombat(ped, 0) then
                    TaskCombatHatedTargetsAroundPed(ped, 150.0, 0)
                end
            elseif inside and ped == driver and not Trucks.tasked[netId] then
                Trucks.tasked[netId] = true
                drive(ped, vehicle, truck.dest, truck.speed or 16.0, CALM)
            end
        end
    end
end

CreateThread(function()
    while true do
        Wait(1000)

        for id, truck in pairs(Trucks.list) do
            local vehicle = fromNet(truck.netId)
            local instance = TruckInstances[id]

            if instance and (not vehicle or instance.entity ~= vehicle) then
                Anchors.OnLost(instance)
                TruckInstances[id] = nil
                instance = nil
            end

            if vehicle then
                if not instance then
                    instance = instanceFor(truck, vehicle)
                    TruckInstances[id] = instance
                    Anchors.OnFound(instance)
                else
                    local c = GetEntityCoords(vehicle)
                    instance.origin = { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(vehicle) }
                    for _, stage in ipairs(instance.stages) do
                        local at = GetOffsetFromEntityInWorldCoords(vehicle, stage.offset.x, stage.offset.y, stage.offset.z)
                        stage.coords = { x = at.x, y = at.y, z = at.z, h = instance.origin.h }
                    end
                end

                local blip = Trucks.blips[id]
                if blip and DoesBlipExist(blip) then
                    local c = GetEntityCoords(vehicle)
                    SetBlipCoords(blip, c.x, c.y, c.z)
                end

                local ok, err = pcall(behave, truck, vehicle)
                if not ok and Config.Debug then
                    print(('^3[XS-Robberies]^0 truck %s: %s'):format(id, tostring(err)))
                end
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for id in pairs(Trucks.blips) do dropBlip(id) end
end)
