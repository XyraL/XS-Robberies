Props = { byLocation = {}, done = {} }

local function modelHash(model)
    if type(model) == 'number' then return model end
    return tonumber(model) or joaat(model)
end

local function spawnAt(model, coords)
    local hash = modelHash(model)
    if not hash or not IsModelValid(hash) then return nil end

    RequestModel(hash)
    local waited = 0
    while not HasModelLoaded(hash) and waited < 3000 do
        Wait(50)
        waited = waited + 50
    end
    if not HasModelLoaded(hash) then return nil end

    local object = CreateObjectNoOffset(hash, coords.x, coords.y, coords.z + PropLift(hash), false, false, false)
    SetEntityHeading(object, coords.h or 0.0)
    FreezeEntityPosition(object, true)
    SetEntityInvincible(object, true)
    SetModelAsNoLongerNeeded(hash)
    return object
end

local function bucket(locationId)
    local entry = Props.byLocation[locationId]
    if not entry then
        entry = {}
        Props.byLocation[locationId] = entry
    end
    return entry
end

function Props.Build(location)
    local list = bucket(location.id)
    local scene = (Config.Scene or {}).Props ~= false and location.props or {}

    for _, prop in ipairs(scene) do
        local entity = spawnAt(prop.model, prop.coords)
        if entity then
            list[#list + 1] = {
                entity = entity,
                owned = true,
                coords = prop.coords,
                linkStage = prop.linkStage,
                onDone = prop.onDone or 'keep',
                swapModel = prop.swapModel,
            }
        elseif Config.Debug then
            print(('^3[XS-Robberies]^0 prop %s did not load at %s'):format(tostring(prop.model), tostring(location.label)))
        end
    end

    Props.Apply(location.id)
end

function Props.Track(location, stage, entity, base)
    local opts = stage.opts or {}
    local onDone = opts.propDone or 'keep'
    if onDone == 'keep' then return end

    local list = bucket(location.id)
    list[#list + 1] = {
        entity = entity,
        owned = false,
        coords = base,
        linkStage = stage.id,
        onDone = onDone,
        swapModel = opts.propSwap,
    }
end

local function release(entry)
    if entry.swapEntity and DoesEntityExist(entry.swapEntity) then
        DeleteObject(entry.swapEntity)
    end
    entry.swapEntity = nil
end

function Props.Remove(locationId)
    for _, entry in ipairs(Props.byLocation[locationId] or {}) do
        release(entry)
        if entry.owned and entry.entity and DoesEntityExist(entry.entity) then
            DeleteObject(entry.entity)
        end
    end
    Props.byLocation[locationId] = nil
end

local function doneSet(locationId)
    local state = Props.done[locationId]
    if not state then return {} end
    if state.untilAt and GetGameTimer() > state.untilAt then
        Props.done[locationId] = nil
        return {}
    end
    return state.set
end

local function show(entity, visible)
    if not entity or not DoesEntityExist(entity) then return end
    SetEntityVisible(entity, visible, false)
    SetEntityCollision(entity, visible, visible)
end

function Props.Apply(locationId)
    local list = Props.byLocation[locationId]
    if not list then return end

    local done = doneSet(locationId)

    for _, entry in ipairs(list) do
        local hit = entry.linkStage and done[entry.linkStage]

        if hit and entry.onDone == 'remove' then
            show(entry.entity, false)
            release(entry)
        elseif hit and entry.onDone == 'swap' then
            show(entry.entity, false)
            if not entry.swapEntity and entry.swapModel and entry.swapModel ~= '' then
                entry.swapEntity = spawnAt(entry.swapModel, entry.coords)
            end
        else
            show(entry.entity, true)
            release(entry)
        end
    end
end

local function toSet(list)
    local set = {}
    for _, id in ipairs(list or {}) do set[id] = true end
    return set
end

RegisterNetEvent('XS-Robberies:client:runPublic', function(data)
    if not data or not data.locationId then return end

    if data.ended then
        if (data.resetIn or 0) > 0 and data.looted and #data.looted > 0 then
            Props.done[data.locationId] = {
                set = toSet(data.looted),
                untilAt = GetGameTimer() + math.floor(data.resetIn * 1000),
            }
        else
            Props.done[data.locationId] = nil
        end
    else
        Props.done[data.locationId] = { set = toSet(data.done) }
    end

    Props.Apply(data.locationId)
end)

CreateThread(function()
    while true do
        Wait(1000)
        for locationId, state in pairs(Props.done) do
            if state.untilAt and GetGameTimer() > state.untilAt then
                Props.done[locationId] = nil
                Props.Apply(locationId)
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for locationId in pairs(Props.byLocation) do Props.Remove(locationId) end
end)
