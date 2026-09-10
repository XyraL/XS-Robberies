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

-- ─────────────────────────────────────────────────────────────────────────────
-- Built-in interaction, used when the server runs no target resource at all.
-- A marker where the point is and a key prompt when you are on it. Nothing
-- fancy, but it means ox_target and qb-target are a nicety rather than a
-- requirement.
-- ─────────────────────────────────────────────────────────────────────────────

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
            local colour = C.MarkerColour or { 25, 224, 140 }

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

-- ─────────────────────────────────────────────────────────────────────────────

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

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        builtin.running = false
        builtin.points = {}
        builtin.entities = {}
    end
end)

if Config.Debug then
    print(('^2[XS-Robberies]^0 target bridge loaded (%s)'):format(Target.name))
end
