Target = { name = nil }

if IsDuplicityVersion() or not Config then return end

do
    local forced = Config.Bridges and Config.Bridges.target or 'auto'
    if forced ~= 'auto' then
        Target.name = forced
    elseif GetResourceState('ox_target') == 'started' then
        Target.name = 'ox_target'
    elseif GetResourceState('qb-target') == 'started' then
        Target.name = 'qb-target'
    else
        Target.name = 'builtin'
    end
end

local function toQb(opts)
    local out = {}
    for _, o in ipairs(opts) do
        out[#out + 1] = {
            icon = o.icon, label = o.label,
            action = o.onSelect, canInteract = o.canInteract,
        }
    end
    return out
end

local builtin = { points = {}, entities = {}, next = 1, running = false }

local function interactionConfig()
    return Config.Interaction or {}
end

local function pointCoords(entry)
    if entry.entity then
        if not DoesEntityExist(entry.entity) then return nil end
        return GetEntityCoords(entry.entity)
    end
    return entry.coords
end

local function usable(entry)
    for _, option in ipairs(entry.options or {}) do
        if not option.canInteract or option.canInteract(entry.entity) then
            return option
        end
    end
    return nil
end

local function prompt(label)
    local C = interactionConfig()
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(('~INPUT_CONTEXT~ %s'):format(label or 'Interact'))
    EndTextCommandDisplayHelp(0, false, true, -1)
end

local function builtinLoop()
    if builtin.running then return end
    builtin.running = true

    CreateThread(function()
        while builtin.running do
            local C = interactionConfig()
            local drawAt = C.DrawDistance or 8.0
            local reach = C.InteractDistance or 1.6
            local colour = C.MarkerColour or { 90, 162, 255 }

            local ped = PlayerPedId()
            local here = GetEntityCoords(ped)

            local closest, closestDist, closestOption = nil, reach, nil
            local anyNear = false

            for _, entry in pairs(builtin.points) do
                local coords = pointCoords(entry)
                if coords then
                    local dist = #(here - coords)

                    if dist <= drawAt then
                        local option = usable(entry)
                        if option then
                            anyNear = true
                            DrawMarker(C.MarkerType or 21,
                                coords.x, coords.y, coords.z + (C.MarkerZ or 0.9),
                                0, 0, 0, 0, 0, 0,
                                C.MarkerScale or 0.22, C.MarkerScale or 0.22, C.MarkerScale or 0.22,
                                colour[1], colour[2], colour[3], 160,
                                true, false, 2, false, nil, nil, false)

                            if dist < closestDist then
                                closest, closestDist, closestOption = entry, dist, option
                            end
                        end
                    end
                end
            end

            if closest and closestOption then
                prompt(closestOption.label)
                if IsControlJustReleased(0, C.Key or 38) then
                    closestOption.onSelect(closest.entity)
                end
            end

            Wait(anyNear and 0 or 400)
        end
    end)
end

local function builtinAdd(entry)
    local handle = builtin.next
    builtin.next = handle + 1
    builtin.points[handle] = entry
    builtinLoop()
    return handle
end

local function builtinRemove(handle)
    if handle then builtin.points[handle] = nil end
    if next(builtin.points) == nil then builtin.running = false end
end

function Target.AddSphere(id, coords, radius, opts)
    if Target.name == 'ox_target' then
        return exports.ox_target:addSphereZone({
            name = id,
            coords = coords,
            radius = radius,
            options = opts,
        })
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddCircleZone(id, coords, radius, { name = id, useZ = true }, {
            options = toQb(opts), distance = radius + 1.0,
        })
        return id
    end

    return builtinAdd({ coords = coords, options = opts })
end

function Target.Remove(handle)
    if not handle then return end

    if Target.name == 'ox_target' then
        exports.ox_target:removeZone(handle)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveZone(handle)
    else
        builtinRemove(handle)
    end
end

function Target.AddEntity(entity, opts, distance)
    if Target.name == 'ox_target' then
        exports.ox_target:addLocalEntity(entity, opts)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddTargetEntity(entity, {
            options = toQb(opts), distance = distance or 2.0,
        })
    else
        builtin.entities[entity] = builtinAdd({ entity = entity, options = opts })
    end
end

function Target.AddEntityOption(entity, option, distance)
    local handle = { entity = entity, name = option.name, label = option.label }

    if Target.name == 'ox_target' then
        option.distance = option.distance or distance
        exports.ox_target:addLocalEntity(entity, { option })
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddTargetEntity(entity, {
            options = toQb({ option }), distance = distance or 2.0,
        })
    else
        handle.builtin = builtinAdd({ entity = entity, options = { option } })
    end

    return handle
end

function Target.RemoveEntityOption(handle)
    if not handle or not handle.entity then return end

    if Target.name == 'ox_target' then
        exports.ox_target:removeLocalEntity(handle.entity, handle.name)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveTargetEntity(handle.entity, handle.label)
    else
        builtinRemove(handle.builtin)
    end
end

function Target.RemoveEntity(entity)
    if Target.name == 'ox_target' then
        exports.ox_target:removeLocalEntity(entity)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveTargetEntity(entity)
    else
        builtinRemove(builtin.entities[entity])
        builtin.entities[entity] = nil
    end
end

local globals = { ped = {}, vehicle = {}, models = {}, running = false }

local function names(opts)
    local out = {}
    for _, o in ipairs(opts) do out[#out + 1] = o.name end
    return out
end

local function labels(opts)
    local out = {}
    for _, o in ipairs(opts) do out[#out + 1] = o.label end
    return out
end

local function modelKey(model)
    local hash = type(model) == 'number' and model or (tonumber(model) or joaat(model))
    hash = math.floor(hash)
    if hash < 0 then hash = hash + 4294967296 end
    return hash
end

local function globalCount()
    local n = #globals.ped + #globals.vehicle
    for _ in pairs(globals.models) do n = n + 1 end
    return n
end

local PROMPT_KEYS = {
    { control = 38, label = '~INPUT_CONTEXT~' },
    { control = 47, label = '~INPUT_DETONATE~' },
    { control = 74, label = '~INPUT_VEH_HEADLIGHT~' },
}

local function choices(list, entity, dist)
    local out = {}
    for _, option in ipairs(list) do
        if dist <= (option.distance or 2.0) + 0.5 and (not option.canInteract or option.canInteract(entity)) then
            out[#out + 1] = option
            if #out >= #PROMPT_KEYS then break end
        end
    end
    return out
end

local function nearestIn(pool, here, range, pick)
    local best, bestDist, bestList = nil, range, nil
    local self = PlayerPedId()
    for _, entity in ipairs(GetGamePool(pool)) do
        if entity ~= self then
            local dist = #(here - GetEntityCoords(entity))
            if dist < bestDist then
                local list = pick(entity, dist)
                if list and #list > 0 then best, bestDist, bestList = entity, dist, list end
            end
        end
    end
    return best, bestDist, bestList
end

local function globalScan()
    local here = GetEntityCoords(PlayerPedId())
    local found, foundDist, foundOptions = nil, 99.0, nil

    if #globals.ped > 0 then
        local ped, dist, list = nearestIn('CPed', here, 3.5, function(entity, d)
            return choices(globals.ped, entity, d)
        end)
        if ped and dist < foundDist then found, foundDist, foundOptions = ped, dist, list end
    end

    if #globals.vehicle > 0 then
        local vehicle, dist, list = nearestIn('CVehicle', here, 5.0, function(entity, d)
            return choices(globals.vehicle, entity, math.max(0.0, d - 1.5))
        end)
        if vehicle and dist < foundDist then found, foundDist, foundOptions = vehicle, dist, list end
    end

    if next(globals.models) then
        local object, dist, list = nearestIn('CObject', here, 3.0, function(entity, d)
            local options = globals.models[modelKey(GetEntityModel(entity))]
            return options and choices(options, entity, d) or nil
        end)
        if object and dist < foundDist then found, foundDist, foundOptions = object, dist, list end
    end

    return found, foundOptions
end

local function globalLoop()
    if globals.running then return end
    globals.running = true

    CreateThread(function()
        local entity, options, nextScan = nil, nil, 0
        while globals.running do
            if GetGameTimer() >= nextScan then
                entity, options = globalScan()
                nextScan = GetGameTimer() + 250
            end

            if entity and options and DoesEntityExist(entity) and not IsPedInAnyVehicle(PlayerPedId(), false) then
                local C = interactionConfig()
                local colour = C.MarkerColour or { 90, 162, 255 }
                local at = GetEntityCoords(entity)
                DrawMarker(C.MarkerType or 21, at.x, at.y, at.z + 1.1, 0, 0, 0, 0, 0, 0,
                    C.MarkerScale or 0.22, C.MarkerScale or 0.22, C.MarkerScale or 0.22,
                    colour[1], colour[2], colour[3], 160, true, false, 2, false, nil, nil, false)

                local lines = {}
                for i, option in ipairs(options) do
                    lines[#lines + 1] = ('%s %s'):format(PROMPT_KEYS[i].label, option.label or 'Interact')
                end
                BeginTextCommandDisplayHelp('STRING')
                AddTextComponentSubstringPlayerName(table.concat(lines, '~n~'))
                EndTextCommandDisplayHelp(0, false, true, -1)

                for i, option in ipairs(options) do
                    if IsControlJustReleased(0, PROMPT_KEYS[i].control) then
                        option.onSelect(entity)
                        nextScan = 0
                        break
                    end
                end
                Wait(0)
            else
                Wait(entity and 100 or 250)
            end

            if globalCount() == 0 then globals.running = false end
        end
    end)
end

function Target.AddGlobalPed(options)
    if Target.name == 'ox_target' then
        exports.ox_target:addGlobalPed(options)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddGlobalPed({ options = toQb(options), distance = options[1] and options[1].distance or 2.0 })
    else
        for _, o in ipairs(options) do globals.ped[#globals.ped + 1] = o end
        globalLoop()
    end
end

function Target.RemoveGlobalPed(options)
    if Target.name == 'ox_target' then
        exports.ox_target:removeGlobalPed(names(options))
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveGlobalPed(labels(options))
    else
        globals.ped = {}
    end
end

function Target.AddGlobalVehicle(options)
    if Target.name == 'ox_target' then
        exports.ox_target:addGlobalVehicle(options)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddGlobalVehicle({ options = toQb(options), distance = options[1] and options[1].distance or 2.5 })
    else
        for _, o in ipairs(options) do globals.vehicle[#globals.vehicle + 1] = o end
        globalLoop()
    end
end

function Target.RemoveGlobalVehicle(options)
    if Target.name == 'ox_target' then
        exports.ox_target:removeGlobalVehicle(names(options))
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveGlobalVehicle(labels(options))
    else
        globals.vehicle = {}
    end
end

function Target.AddModels(models, options)
    if #models == 0 then return end
    if Target.name == 'ox_target' then
        exports.ox_target:addModel(models, options)
    elseif Target.name == 'qb-target' then
        exports['qb-target']:AddTargetModel(models, { options = toQb(options), distance = options[1] and options[1].distance or 2.0 })
    else
        for _, model in ipairs(models) do
            local key = modelKey(model)
            globals.models[key] = globals.models[key] or {}
            for _, o in ipairs(options) do table.insert(globals.models[key], o) end
        end
        globalLoop()
    end
end

function Target.RemoveModels(models, options)
    if #models == 0 then return end
    if Target.name == 'ox_target' then
        exports.ox_target:removeModel(models, names(options))
    elseif Target.name == 'qb-target' then
        exports['qb-target']:RemoveTargetModel(models, labels(options))
    else
        for _, model in ipairs(models) do globals.models[modelKey(model)] = nil end
    end
end

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        builtin.running = false
        builtin.points = {}
        builtin.entities = {}
        globals.running = false
        globals.ped, globals.vehicle, globals.models = {}, {}, {}
    end
end)

if Config.Debug then
    print(('^2[XS-Robberies]^0 target bridge loaded (%s)'):format(Target.name))
end
