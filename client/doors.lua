DoorsClient = { builtin = {}, touched = {}, swung = {} }

local forced = Config.Bridges and Config.Bridges.doorlock or 'auto'

local ORDER = {
    'ox_doorlock', 'mri_Qdoorlock', 'qb-doorlock', 'rcore_doorlock',
    'qs-doorlock-creator', 'doors_creator', 'cd_doorlock',
}

local function activeLock()
    if forced == 'none' then return nil end
    if forced ~= 'auto' then
        return GetResourceState(forced) == 'started' and forced or nil
    end
    for _, name in ipairs(ORDER) do
        if GetResourceState(name) == 'started' then return name end
    end
    return nil
end

local function closest(at, entries, pointsOf, idOf)
    local best, bestGap = nil, 1.2
    for key, entry in pairs(entries or {}) do
        for _, p in ipairs(pointsOf(entry)) do
            if p and p.x then
                local gap = #(at - vector3(p.x, p.y, p.z))
                if gap < bestGap then best, bestGap = idOf(key, entry), gap end
            end
        end
    end
    return best
end

local function oxIdentify(entity, resource)
    local id = Entity(entity).state.doorId
    if id then return id end
    return exports[resource]:getDoorIdFromEntity(entity)
end

local IDENTIFY = {
    ox_doorlock = oxIdentify,
    mri_Qdoorlock = oxIdentify,

    ['qb-doorlock'] = function(entity)
        return closest(GetEntityCoords(entity), exports['qb-doorlock']:GetDoorList(), function(door)
            local points = { door.objCoords }
            for _, part in ipairs(door.doors or {}) do points[#points + 1] = part.objCoords end
            return points
        end, function(key) return key end)
    end,

    rcore_doorlock = function(entity)
        return closest(GetEntityCoords(entity), exports.rcore_doorlock:getLoadedDoors(), function(door)
            return { door.coords }
        end, function(_, door) return door.id end)
    end,

    doors_creator = function(entity)
        return exports.doors_creator:getDoorIdFromEntity(entity)
    end,
}

function DoorsClient.Identify(entity)
    local name = activeLock()
    local identify = name and IDENTIFY[name]
    if not identify or not entity or entity == 0 then return nil, name end

    local ok, id = pcall(identify, entity, name)
    if ok and id ~= nil and id ~= '' then return id, name end
    return nil, name
end

local function findEntity(door)
    if not door or not door.x or not door.model then return 0 end
    return GetClosestObjectOfType(door.x + 0.0, door.y + 0.0, door.z + 0.0, 1.5, door.model, false, false, false)
end

lib.callback.register('XS-Robberies:findDoors', function(list)
    local out = {}
    for index, door in ipairs(list or {}) do
        local id = false
        if not door.id or door.id == '' then
            local entity = findEntity(door)
            if entity ~= 0 then id = DoorsClient.Identify(entity) or false end
        end
        out[index] = id
    end
    return out
end)

local function turnTo(object, target, ms)
    local start = GetEntityHeading(object)
    local delta = ((target - start + 540.0) % 360.0) - 180.0
    if math.abs(delta) < 0.5 then return end

    if not ms or ms <= 0 then
        SetEntityHeading(object, (start + delta) % 360.0)
        return
    end

    CreateThread(function()
        local began = GetGameTimer()
        while DoesEntityExist(object) do
            local t = math.min(1.0, (GetGameTimer() - began) / ms)
            local eased = t * t * (3.0 - 2.0 * t)
            SetEntityHeading(object, (start + delta * eased) % 360.0)
            if t >= 1.0 then break end
            Wait(0)
        end
    end)
end

local function swingTime(entry)
    return math.floor(math.min(7000, math.max(1500, math.abs(entry.angle or 90.0) / 90.0 * 5000)))
end

local function swing(entry, on, animate)
    local state = DoorsClient.swung[entry.key]

    if not on then
        DoorsClient.swung[entry.key] = nil
        if state and DoesEntityExist(state.object) then
            turnTo(state.object, state.base, animate and swingTime(entry) or 0)
        end
        return
    end

    local object = findEntity(entry)
    if object == 0 or (state and state.object == object) then return end

    local base = GetEntityHeading(object)
    DoorsClient.swung[entry.key] = { object = object, base = base }
    FreezeEntityPosition(object, true)
    turnTo(object, base + (entry.angle or 90.0), animate and swingTime(entry) or 0)
end

local function system(entry, on)
    local touched = DoorsClient.touched[entry.key]

    if not on then
        if not touched then return end
        DoorsClient.touched[entry.key] = nil
        if touched.ours then
            DoorSystemSetDoorState(touched.hash, 0, false, false)
            RemoveDoorFromSystem(touched.hash)
        else
            DoorSystemSetDoorState(touched.hash, touched.previous or 0, false, false)
        end
        return
    end

    if not touched then
        local found, hash = DoorSystemFindExistingDoor(entry.x + 0.0, entry.y + 0.0, entry.z + 0.0, entry.model)
        if found and hash and hash ~= 0 then
            touched = { hash = hash, ours = false, previous = DoorSystemGetDoorState(hash) }
        else
            hash = joaat('xs_rob_door_' .. entry.key)
            if not IsDoorRegisteredWithSystem(hash) then
                AddDoorToSystem(hash, entry.model, entry.x + 0.0, entry.y + 0.0, entry.z + 0.0, false, false, false)
            end
            touched = { hash = hash, ours = true }
        end
        DoorsClient.touched[entry.key] = touched
    end

    local want = entry.action == 'lock' and 1 or 0
    if DoorSystemGetDoorState(touched.hash) ~= want then
        if want == 1 then DoorSystemSetDoorState(touched.hash, 4, false, false) end
        DoorSystemSetDoorState(touched.hash, want, false, false)
    end
end

local function apply(entry, on, animate)
    if not entry or not entry.model or not entry.x then return end
    if entry.action == 'swing' then
        swing(entry, on, animate)
    else
        system(entry, on)
    end
end

local function inRange(entry)
    return #(GetEntityCoords(PlayerPedId()) - vector3(entry.x, entry.y, entry.z)) <= 120.0
end

RegisterNetEvent('XS-Robberies:client:doors', function(list)
    list = list or {}
    for key, entry in pairs(DoorsClient.builtin) do
        if not list[key] then apply(entry, false, true) end
    end
    DoorsClient.builtin = list
end)

RegisterNetEvent('XS-Robberies:client:door', function(key, entry)
    local old = DoorsClient.builtin[key]
    DoorsClient.builtin[key] = entry

    if entry then
        if inRange(entry) then apply(entry, true, true) end
    elseif old then
        apply(old, false, true)
    end
end)

CreateThread(function()
    while true do
        Wait(1000)
        for _, entry in pairs(DoorsClient.builtin) do
            if inRange(entry) then apply(entry, true, false) end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, entry in pairs(DoorsClient.builtin) do apply(entry, false, false) end
end)
