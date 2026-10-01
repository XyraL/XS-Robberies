Builder = Builder or {}
Builder.open = false
Builder.hidden = false

local function show(payload)
    SendNUIMessage(payload)
end

function Builder.Open()
    if Builder.open then return end

    local boot = lib.callback.await('XS-Robberies:bootstrap', false)
    if not boot or not boot.ok then
        Framework.Notify(boot and boot.error or 'The builder could not load.', 'error')
        return
    end

    boot.target = Target.name

    Builder.open = true
    Builder.hidden = false
    Builder.catalogue = boot.stageTypes

    SetNuiFocus(true, true)
    show({ action = 'open', data = boot })
end

function Builder.Close()
    if not Builder.open then return end

    Builder.open = false
    Builder.hidden = false
    Placement.Abort()
    SetNuiFocus(false, false)
    Markers.Clear()
    show({ action = 'close' })
end

local function hide()
    if Builder.hidden then return end
    Builder.hidden = true
    show({ action = 'suspend' })
    SetNuiFocus(false, false)
    Wait(260)
end

local function reveal(payload)
    Builder.hidden = false
    SetNuiFocus(true, true)
    payload = payload or {}
    payload.action = 'resume'
    show(payload)
end

RegisterNUICallback('close', function(_, cb)
    Builder.Close()
    cb({ ok = true })
end)

local function proxy(endpoint, callbackName)
    RegisterNUICallback(endpoint, function(data, cb)
        cb(lib.callback.await(callbackName, false, data) or { ok = false, error = 'The server did not answer.' })
    end)
end

proxy('getRobbery',       'XS-Robberies:getRobbery')
proxy('createRobbery',    'XS-Robberies:createRobbery')
proxy('saveRobbery',      'XS-Robberies:saveRobbery')
proxy('deleteRobbery',    'XS-Robberies:deleteRobbery')
proxy('duplicateRobbery', 'XS-Robberies:duplicateRobbery')
proxy('validateRobbery',  'XS-Robberies:validateRobbery')
proxy('exportRobbery',    'XS-Robberies:exportRobbery')
proxy('importRobbery',    'XS-Robberies:importRobbery')
proxy('saveLocation',     'XS-Robberies:saveLocation')
proxy('deleteLocation',   'XS-Robberies:deleteLocation')
proxy('saveLoot',         'XS-Robberies:saveLoot')
proxy('deleteLoot',       'XS-Robberies:deleteLoot')
proxy('history',          'XS-Robberies:history')
proxy('live',             'XS-Robberies:live')
proxy('resolveLocation',  'XS-Robberies:resolveLocation')
proxy('forceEnd',         'XS-Robberies:forceEnd')
proxy('killSwitch',       'XS-Robberies:killSwitch')
proxy('blacklist',        'XS-Robberies:blacklist')
proxy('saveTunables',     'XS-Robberies:saveTunables')

RegisterNUICallback('setEditorStages', function(data, cb)
    Markers.SetStages(data and data.stages, Builder.catalogue)
    cb({ ok = true })
end)

RegisterNUICallback('beginPlacement', function(data, cb)
    data = data or {}

    hide()

    local result = Placement.Start({
        label = data.label,
        colour = data.colour,
        mode = data.mode or 'point',
        radius = data.radius,
        origin = data.origin,
        snapToGround = data.snapToGround,
        previewModel = data.previewModel,
        pickEntity = data.pickEntity,
        layout = data.layout,
        guided = data.guided,
        session = data.session == true,
    }) or { action = 'cancel' }

    local placed = result.action == 'placed'
    local coords = nil

    if placed then
        coords = { x = result.x, y = result.y, z = result.z, h = result.h, radius = result.radius }
    end

    if not data.session then reveal() end

    cb({
        ok = placed,
        action = result.action,
        coords = coords,
        previewFailed = result.previewFailed == true,
        pick = (placed and data.pickEntity) and {
            model = result.model,
            name = result.name,
            vehicle = result.vehicle,
        } or nil,
    })
end)

RegisterNUICallback('endPlacementSession', function(_, cb)
    Placement.EndSession()
    reveal()
    cb({ ok = true })
end)

RegisterNUICallback('teleport', function(data, cb)
    if data and data.coords then
        local ped = PlayerPedId()
        SetEntityCoords(ped, data.coords.x + 0.0, data.coords.y + 0.0, data.coords.z + 0.5, false, false, false, false)
        if data.heading then SetEntityHeading(ped, data.heading + 0.0) end
        Builder.Close()
    end
    cb({ ok = true })
end)

RegisterNUICallback('previewMinigame', function(data, cb)
    hide()

    local passed = Minigames.Run(data and data.id, data and data.difficulty)

    reveal({ minigame = { id = data and data.id, passed = passed } })
    cb({ ok = true, passed = passed })
end)
