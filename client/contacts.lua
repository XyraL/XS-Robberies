Contacts = { list = {}, spawned = {} }

local function remove(robberyId)
    local entry = Contacts.spawned[robberyId]
    if not entry then return end

    if entry.target then Target.RemoveEntityOption(entry.target) end
    if entry.ped and DoesEntityExist(entry.ped) then DeletePed(entry.ped) end
    Contacts.spawned[robberyId] = nil
end

local function talk(contact)
    local res = lib.callback.await('XS-Robberies:talk', false, contact.robberyId)

    if not res then
        Framework.Notify(T('serverSilent'), 'error')
        return
    end

    if not res.ok then
        Framework.Notify(res.error or T('notRightNow'), 'error', contact.name)
        return
    end

    if res.line and res.line ~= '' then
        Framework.Notify(res.line, 'inform', res.name or contact.name)
    end

    Access[res.robberyId] = {
        untilAt = GetGameTimer() + math.floor((res.minutes or 30) * 60000),
        locationId = res.locationId,
    }

    if res.coords and res.waypoint then
        SetNewWaypoint(res.coords.x + 0.0, res.coords.y + 0.0)
    end

    SyncAllTargets()
end

local function spawn(contact)
    local hash = type(contact.model) == 'number' and contact.model or (tonumber(contact.model) or joaat(contact.model))
    if not IsModelValid(hash) or not IsModelAPed(hash) then return end

    RequestModel(hash)
    local waited = 0
    while not HasModelLoaded(hash) and waited < 4000 do
        Wait(50)
        waited = waited + 50
    end
    if not HasModelLoaded(hash) then return end

    local c = contact.coords
    local ped = CreatePed(4, hash, c.x, c.y, FloorUnder(c.x, c.y, c.z), c.h or 0.0, false, false)
    SetModelAsNoLongerNeeded(hash)
    if not ped or ped == 0 then return end

    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedFleeAttributes(ped, 0, false)
    SetPedDiesWhenInjured(ped, false)
    FreezeEntityPosition(ped, true)

    if contact.scenario and contact.scenario ~= '' then
        TaskStartScenarioInPlace(ped, contact.scenario, 0, true)
    end

    local target = Target.AddEntityOption(ped, {
        name = 'xs_rob_contact_' .. contact.robberyId,
        icon = 'fa-solid fa-comments',
        label = (contact.label and contact.label ~= '') and contact.label or 'Ask about work',
        canInteract = function() return not Framework.IsBlockedJob() end,
        onSelect = function() talk(contact) end,
    }, 2.5)

    Contacts.spawned[contact.robberyId] = { ped = ped, target = target }
end

RegisterNetEvent('XS-Robberies:client:contacts', function(list)
    local signature = json.encode(list or {})
    if signature == Contacts.signature then return end
    Contacts.signature = signature

    for robberyId in pairs(Contacts.spawned) do remove(robberyId) end
    Contacts.list = list or {}
end)

CreateThread(function()
    while true do
        local here = GetEntityCoords(PlayerPedId())

        for _, contact in ipairs(Contacts.list) do
            local c = contact.coords
            local near = #(here - vector3(c.x, c.y, c.z)) <= 60.0

            if near and not Contacts.spawned[contact.robberyId] then
                spawn(contact)
            elseif not near and Contacts.spawned[contact.robberyId] then
                remove(contact.robberyId)
            end
        end

        Wait(2000)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for robberyId in pairs(Contacts.spawned) do remove(robberyId) end
end)
