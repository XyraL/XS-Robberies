Npcs = { byLocation = {} }

local function modelHash(model)
    if type(model) == 'number' then return model end
    return tonumber(model) or joaat(model)
end

local function load(hash)
    if not hash or not IsModelValid(hash) or not IsModelAPed(hash) then return false end
    RequestModel(hash)
    local waited = 0
    while not HasModelLoaded(hash) and waited < 4000 do
        Wait(50)
        waited = waited + 50
    end
    return HasModelLoaded(hash)
end

local function idle(entry)
    local ped, npc = entry.ped, entry.npc
    if not DoesEntityExist(ped) then return end

    ClearPedTasksImmediately(ped)

    if npc.animDict and npc.animDict ~= '' and npc.animClip and npc.animClip ~= '' then
        RequestAnimDict(npc.animDict)
        local waited = 0
        while not HasAnimDictLoaded(npc.animDict) and waited < 3000 do
            Wait(50)
            waited = waited + 50
        end
        if HasAnimDictLoaded(npc.animDict) then
            TaskPlayAnim(ped, npc.animDict, npc.animClip, 4.0, -4.0, -1, 1, 0.0, false, false, false)
            return
        end
    end

    if npc.scenario and npc.scenario ~= '' then
        TaskStartScenarioInPlace(ped, npc.scenario, 0, true)
    end
end

local function spawn(location, npc)
    local hash = modelHash(npc.model)
    if not load(hash) then
        if Config.Debug then
            print(('^3[XS-Robberies]^0 npc %s did not load at %s'):format(tostring(npc.model), tostring(location.label)))
        end
        return nil
    end

    local c = npc.coords
    local ped = CreatePed(4, hash, c.x, c.y, FloorUnder(c.x, c.y, c.z), c.h or 0.0, false, false)
    SetModelAsNoLongerNeeded(hash)
    if not ped or ped == 0 then return nil end

    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedFleeAttributes(ped, 0, false)
    SetPedDiesWhenInjured(ped, false)
    SetPedCanRagdollFromPlayerImpact(ped, false)
    SetPedKeepTask(ped, true)
    FreezeEntityPosition(ped, true)

    local entry = { ped = ped, npc = npc, reacted = false }
    idle(entry)
    return entry
end

function Npcs.Build(location)
    if Npcs.byLocation[location.id] then return end
    if (Config.Scene or {}).Npcs == false then return end

    local list = {}
    for _, npc in ipairs(location.npcs or {}) do
        local entry = spawn(location, npc)
        if entry then list[#list + 1] = entry end
    end

    Npcs.byLocation[location.id] = { location = location, list = list }

    if PublicRuns[location.id] then Npcs.React(location.id) end
end

function Npcs.Remove(locationId)
    local bucket = Npcs.byLocation[locationId]
    if not bucket then return end

    for _, entry in ipairs(bucket.list) do
        if DoesEntityExist(entry.ped) then DeletePed(entry.ped) end
    end
    Npcs.byLocation[locationId] = nil
end

function Npcs.React(locationId)
    local bucket = Npcs.byLocation[locationId]
    if not bucket then return end

    for _, entry in ipairs(bucket.list) do
        local reaction = entry.npc.reaction or 'cower'
        if not entry.reacted and reaction ~= 'none' and DoesEntityExist(entry.ped) then
            entry.reacted = true
            local ped = entry.ped
            ClearPedTasks(ped)

            if reaction == 'flee' then
                FreezeEntityPosition(ped, false)
                SetBlockingOfNonTemporaryEvents(ped, false)
                TaskSmartFleePed(ped, PlayerPedId(), 120.0, -1, false, false)
            else
                TaskHandsUp(ped, -1, PlayerPedId(), -1, true)
            end
        end
    end
end

function Npcs.Reset(locationId)
    local bucket = Npcs.byLocation[locationId]
    if not bucket then return end

    local location = bucket.location
    Npcs.Remove(locationId)
    Npcs.Build(location)
end

RegisterNetEvent('XS-Robberies:client:runPublic', function(data)
    if not data or not data.locationId then return end

    if data.ended then
        SetTimeout(4000, function() Npcs.Reset(data.locationId) end)
        return
    end

    Npcs.React(data.locationId)
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for locationId in pairs(Npcs.byLocation) do Npcs.Remove(locationId) end
end)
