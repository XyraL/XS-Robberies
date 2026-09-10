Builder = Builder or {}
Builder.open = false

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
    Builder.catalogue = boot.stageTypes

    SetNuiFocus(true, true)
    show({ action = 'open', data = boot })
end

function Builder.Close()
    if not Builder.open then return end

    Builder.open = false
    SetNuiFocus(false, false)
    Markers.Clear()
    show({ action = 'close' })
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
proxy('presets',          'XS-Robberies:presets')
proxy('installPreset',    'XS-Robberies:installPreset')
proxy('live',             'XS-Robberies:live')
proxy('resolveLocation',  'XS-Robberies:resolveLocation')
proxy('forceEnd',         'XS-Robberies:forceEnd')
proxy('killSwitch',       'XS-Robberies:killSwitch')
proxy('blacklist',        'XS-Robberies:blacklist')

RegisterNUICallback('setEditorStages', function(data, cb)
    Markers.SetStages(data and data.stages, Builder.catalogue)
    cb({ ok = true })
end)

RegisterNUICallback('beginPlacement', function(data, cb)
    data = data or {}

    show({ action = 'suspend' })
    SetNuiFocus(false, false)
    Wait(260)

    local result = Placement.Start({
        label = data.label,
        colour = data.colour,
        mode = data.mode or 'point',
        radius = data.radius,
        origin = data.origin,
        snapToGround = data.snapToGround,
    })

    SetNuiFocus(true, true)
    show({ action = 'resume', result = result })
    cb({ ok = result ~= nil, coords = result })
end)

RegisterNUICallback('teleport', function(data, cb)
    if data and data.coords then
        local ped = PlayerPedId()
        SetEntityCoords(ped, data.coords.x + 0.0, data.coords.y + 0.0, data.coords.z + 0.5, false, false, false, false)
        Builder.Close()
    end
    cb({ ok = true })
end)

RegisterNUICallback('previewMinigame', function(data, cb)
    show({ action = 'suspend' })
    SetNuiFocus(false, false)
    Wait(200)

    local passed = Minigames.Run(data and data.id, data and data.difficulty)

    SetNuiFocus(true, true)
    show({ action = 'resume', minigame = { id = data and data.id, passed = passed } })
    cb({ ok = true, passed = passed })
end)
