Locations = {}
ActiveRun = nil
PublicRuns = {}

Zones = {}
Access = {}
local peds = {}
local blips = {}
local busy = false
local blackout = nil
local finishedAt = 0

local ANIMATIONS = {
    lockpick = { dict = 'mp_car_bomb', clip = 'car_bomb_mechanic', flag = 16 },
    drill    = { dict = 'anim@heists@fleeca_bank@drilling', clip = 'drill_straight_idle', flag = 16 },
    thermite = { dict = 'anim@heists@ornate_bank@thermal_charge', clip = 'thermal_charge', flag = 16 },
    grinder  = { dict = 'anim@heists@fleeca_bank@drilling', clip = 'drill_straight_idle', flag = 16 },
    torch    = { dict = 'anim@heists@ornate_bank@thermal_charge', clip = 'thermal_charge', flag = 16 },
    crowbar  = { dict = 'melee@large_wpn@streamed_core', clip = 'ground_attack_on_spot', flag = 16 },
    default  = { dict = 'anim@heists@prison_heiststation@cop_reactions', clip = 'cop_a_idle', flag = 16 },
    search   = { dict = 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@', clip = 'machinic_loop_mechandplayer', flag = 16 },
    threaten = { dict = 'anim@heists@ornate_bank@hostages@ped_a', clip = 'flinch_left', flag = 48 },
}

local function animationFor(stage)
    local opts = stage.opts or {}
    if opts.animDict ~= nil and opts.animDict ~= '' and opts.animClip ~= '' then
        return { dict = opts.animDict, clip = opts.animClip, flag = tonumber(opts.animFlag) or 16 }
    end

    if stage.type == 'tool' then
        return ANIMATIONS[(stage.opts or {}).toolKind or 'default'] or ANIMATIONS.default
    end
    if stage.type == 'register' or stage.type == 'container' or stage.type == 'safe' then
        return ANIMATIONS.search
    end
    if stage.type == 'hold' or stage.type == 'twoman' then
        return nil
    end
    return ANIMATIONS.default
end

local function runMinigame(opts)
    local attempts = math.max(1, tonumber(opts.attempts) or 1)

    for try = 1, attempts do
        if Minigames.Run(opts.minigame, opts.difficulty) then return true end
        if try < attempts then
            Framework.Notify(T('retryLeft', attempts - try), 'warning')
            Wait(400)
        end
    end
    return false
end

local function contains(list, value)
    for _, entry in ipairs(list or {}) do
        if entry == value then return true end
    end
    return false
end

local function hasAccess(location)
    if not location.needsContact then return true end
    if ActiveRun and ActiveRun.locationId == location.id then return true end

    local grant = Access[location.robberyId]
    if not grant or GetGameTimer() > grant.untilAt then return false end
    if grant.locationId and grant.locationId ~= location.id then return false end
    return true
end

local function stageAvailable(location, stage)
    if ActiveRun and ActiveRun.locationId ~= location.id then return false end

    local live = PublicRuns[location.id]

    if not live then
        if not hasAccess(location) then return false end
        return #Stages.Needs(stage) == 0
    end

    if contains(live.done, stage.id) then return false end
    return contains(live.unlocked, stage.id)
end

local function keypadPrompt(stage, digits)
    local input = lib.inputDialog(stage.label or 'Keypad', {
        { type = 'input', label = 'Code', required = true, min = digits, max = digits },
    })
    return input and input[1] or nil
end

local function shock()
    local ped = PlayerPedId()
    SetEntityHealth(ped, math.max(101, GetEntityHealth(ped) - 25))
    SetPedToRagdoll(ped, 2200, 2200, 3, true, true, false)
    ShakeGameplayCam('SMALL_EXPLOSION_SHAKE', 0.6)
    StartScreenEffect('DeathFailOut', 1200, false)
    SetTimeout(1400, function() StopScreenEffect('DeathFailOut') end)
end

local function runProgress(stage, duration, label)
    local opts = stage.opts or {}
    local anim = animationFor(stage)

    local payload = {
        duration = math.floor(duration * 1000),
        label = label or stage.label or 'Working',
        position = 'bottom',
        useWhileDead = false,
        canCancel = opts.canCancel ~= false,
        disable = {
            move = opts.freezePlayer ~= false,
            car = true,
            combat = true,
        },
    }

    if opts.scenario and opts.scenario ~= '' then
        payload.anim = { scenario = opts.scenario }
    elseif anim then
        payload.anim = { dict = anim.dict, clip = anim.clip, flag = anim.flag }
    end

    if opts.progressStyle == 'bar' then
        return lib.progressBar(payload)
    end
    return lib.progressCircle(payload)
end

local function holdProgress(stage, duration)
    local coords = vector3(stage.coords.x, stage.coords.y, stage.coords.z)
    local radius = (stage.opts or {}).radius or 3.0
    local breakOnLeave = (stage.opts or {}).breakOnLeave ~= false

    if breakOnLeave then
        CreateThread(function()
            while lib.progressActive() do
                if #(GetEntityCoords(PlayerPedId()) - coords) > radius then
                    lib.cancelProgress()
                    break
                end
                Wait(250)
            end
        end)
    end

    local opts = stage.opts or {}

    local payload = {
        duration = math.floor(duration * 1000),
        label = stage.label or 'Holding',
        position = 'bottom',
        canCancel = opts.canCancel ~= false,
        disable = { combat = true },
    }

    if opts.scenario and opts.scenario ~= '' then
        payload.anim = { scenario = opts.scenario }
    end

    if opts.progressStyle == 'bar' then
        return lib.progressBar(payload)
    end
    return lib.progressCircle(payload)
end

function loadModel(name)
    local model = type(name) == 'number' and name or (tonumber(name) or joaat(name))
    if not IsModelValid(model) then return nil end
    RequestModel(model)

    local waited = 0
    while not HasModelLoaded(model) and waited < 3000 do
        Wait(50)
        waited = waited + 50
    end

    if not HasModelLoaded(model) then return nil end
    return model
end

local function spawnProp(location, stage)
    local opts = stage.opts or {}
    if not opts.prop or opts.prop == '' then return nil end

    local model = loadModel(opts.prop)
    if not model then
        if Config.Debug then
            print(('^3[XS-Robberies]^0 prop model %s did not load for %s'):format(opts.prop, stage.id))
        end
        return nil
    end

    local base = stage.coords.z + (tonumber(opts.propZ) or 0.0)
    local object = CreateObjectNoOffset(model, stage.coords.x, stage.coords.y,
        base + PropLift(model), false, false, false)

    SetEntityHeading(object, stage.coords.h or 0.0)
    FreezeEntityPosition(object, true)
    SetEntityInvincible(object, true)
    SetModelAsNoLongerNeeded(model)

    return object
end

local function numbersIn(text)
    local out = {}
    for value in tostring(text or ''):gmatch('-?%d+%.?%d*') do
        out[#out + 1] = tonumber(value)
    end
    return out
end

local function giveHandProp(opts)
    if not opts.handProp or opts.handProp == '' then return nil end

    local model = loadModel(opts.handProp)
    if not model then return nil end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local object = CreateObject(model, coords.x, coords.y, coords.z, true, true, false)

    local o = numbersIn(opts.handOffset)
    local bone = tonumber(opts.handBone) or 57005

    AttachEntityToEntity(object, ped, GetPedBoneIndex(ped, bone),
        o[1] or 0.09, o[2] or 0.02, o[3] or -0.02,
        o[4] or -70.0, o[5] or 0.0, o[6] or 0.0,
        true, true, false, true, 1, true)

    SetModelAsNoLongerNeeded(model)
    return object
end

local function takeHandProp(object)
    if object and DoesEntityExist(object) then
        DetachEntity(object, true, true)
        DeleteObject(object)
    end
end

local function attemptInner(location, stage)
    local opts = stage.opts or {}

    if stage.type == 'hostage' and opts.needsAim then
        local player = PlayerId()
        if not IsPlayerFreeAiming(player) then
            Framework.Notify(T('aimFirst'), 'error')
            return
        end
    end

    local begun = lib.callback.await('XS-Robberies:beginStage', 10000, {
        locationId = location.modelAnchored and nil or location.id,
        robberyId = location.modelAnchored and location.robberyId or nil,
        anchor = location.modelAnchored and location.origin or nil,
        stageId = stage.id,
    })

    if not begun then
        Framework.Notify(T('serverSilent'), 'error')
        print('^1[XS-Robberies]^0 beginStage got no answer. There is an error in the server console.')
        return
    end

    if not begun.ok then
        Framework.Notify(begun.error or T('notRightNow'), 'error')
        return
    end

    local success = true
    local duration = begun.duration or 10

    if stage.type == 'twoman' then
        if begun.partnerHeld then
            Framework.Notify(T('partnerReady'), 'success')
        else
            Framework.Notify(T('partnerNeeded', begun.partnerLabel or 'the other one'), 'warning')
        end
    end

    if stage.type == 'keypad' and begun.code then
        local entered = keypadPrompt(stage, #begun.code)
        if entered == nil then
            lib.callback.await('XS-Robberies:finishStage', 15000, { token = begun.token, success = false })
            return
        end
        Wait(math.floor(duration * 1000))
        success = entered == begun.code
    elseif stage.type == 'keypad' then
        Framework.Notify(T('crackIt'), 'inform')
        local finished = runProgress(stage, duration)
        if not finished then
            lib.callback.await('XS-Robberies:finishStage', 15000, { token = begun.token, success = false })
            Framework.Notify(T('youStopped'), 'inform')
            return
        end
        success = runMinigame({
            minigame = (opts.minigame and opts.minigame ~= 'none') and opts.minigame or 'xs:pinpad',
            difficulty = opts.difficulty,
            attempts = opts.attempts,
        })
    elseif stage.type == 'hold' then
        success = holdProgress(stage, duration)
        if not success then Framework.Notify(T('holdFailed'), 'error') end
    else
        local held = giveHandProp(opts)
        local finished = runProgress(stage, duration)
        takeHandProp(held)

        if not finished then
            lib.callback.await('XS-Robberies:finishStage', 15000, { token = begun.token, success = false })
            Framework.Notify(T('youStopped'), 'inform')
            return
        end

        if opts.minigame and opts.minigame ~= 'none' then
            success = runMinigame(opts)
        end
    end

    local result = lib.callback.await('XS-Robberies:finishStage', 15000, {
        token = begun.token,
        success = success,
    })


    if not result or not result.ok then
        Framework.Notify(result and result.error or T('didNotCount'), 'error')
        return
    end

    if result.failed then
        if result.penalty then
            Hazards.Punish(result.penalty, vector3(stage.coords.x, stage.coords.y, stage.coords.z))
        end
        if result.lostItem then
            Framework.Notify(T('lostTool', result.lostItem), 'error')
        end
        Sounds.Play('stageFailed')
        Framework.Notify(T('stageFailed'), 'error')
        return
    end

    if result.panicked then
        local ped = peds[('%s_%s'):format(tostring(location.id), stage.id)]
        if ped and DoesEntityExist(ped) then
            SetBlockingOfNonTemporaryEvents(ped, false)
            TaskReactAndFleePed(ped, PlayerPedId())
        end
        Framework.Notify(T('pedFled'), 'warning')
    end

    if result.completed then
        finishedAt = GetGameTimer()
        Sounds.Play('runComplete')
        if (result.paid or 0) > 0 then Framework.Notify(T('paid', result.paid), 'success') end
        Framework.Notify(T('runComplete'), 'success')
        return
    end

    if result.code then
        Sounds.Play('codeFound')
        Framework.Notify(T('codeFound', result.code), 'success', 'Code')
    end

    if result.grabsLeft and result.grabsLeft > 0 then
        Framework.Notify(T('grabsLeft', result.grabsLeft), 'success')
        return
    end

    Sounds.Play('stageDone')

    if (result.paid or 0) > 0 then
        Framework.Notify(T('paid', result.paid), 'success')
    else
        Framework.Notify(T('stageDone'), 'success')
    end
end

local function attempt(location, stage)
    if busy then return end
    busy = true

    local ok, err = pcall(attemptInner, location, stage)
    busy = false

    if not ok then
        print(('^1[XS-Robberies]^0 %s at %s failed: %s'):format(tostring(stage.id), tostring(location.label), tostring(err)))
        Framework.Notify(T('didNotCount'), 'error')
    end
end

local function spawnHostage(location, stage)
    local key = ('%s_%s'):format(tostring(location.id), stage.id)
    if peds[key] and DoesEntityExist(peds[key]) then return peds[key] end

    local model = joaat((stage.opts or {}).ped or 'mp_m_shopkeep_01')
    RequestModel(model)

    local waited = 0
    while not HasModelLoaded(model) and waited < 3000 do
        Wait(50)
        waited = waited + 50
    end
    if not HasModelLoaded(model) then return nil end

    local ped = CreatePed(4, model, stage.coords.x, stage.coords.y,
        FloorUnder(stage.coords.x, stage.coords.y, stage.coords.z), stage.coords.h or 0.0, false, false)

    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedDiesWhenInjured(ped, false)
    SetPedCanRagdollFromPlayerImpact(ped, false)
    SetModelAsNoLongerNeeded(model)

    peds[key] = ped
    return ped
end

local Built = {}

local function dropTarget(entry)
    if not entry.active then return end
    if entry.kind == 'sphere' then
        Target.Remove(entry.active)
    else
        Target.RemoveEntityOption(entry.active)
    end
    entry.active = nil
end

local function wantsTarget(location, stage)
    if Framework.IsBlockedJob() then return false end
    return stageAvailable(location, stage)
end

function SyncTargets(locationId)
    local built = Built[locationId]
    if not built then return end

    for _, entry in pairs(built.targets) do
        local want = wantsTarget(built.location, entry.stage)

        if want and not entry.active then
            if entry.kind == 'sphere' then
                entry.active = Target.AddSphere(entry.option.name, entry.coords, entry.reach, { entry.option })
            elseif entry.entity and DoesEntityExist(entry.entity) then
                entry.active = Target.AddEntityOption(entry.entity, entry.option, entry.reach)
            end
        elseif not want and entry.active then
            dropTarget(entry)
        end
    end
end

function SyncAllTargets()
    for id in pairs(Built) do SyncTargets(id) end
end

local function removeZones(locationId)
    local built = Built[locationId]
    Built[locationId] = nil
    Zones[locationId] = nil

    if built then
        for _, entry in pairs(built.targets) do dropTarget(entry) end

        for _, entry in ipairs(built.peds) do
            if DoesEntityExist(entry.ped) then DeletePed(entry.ped) end
            peds[entry.key] = nil
        end

        for _, object in ipairs(built.props) do
            if DoesEntityExist(object) then DeleteObject(object) end
        end
    end

    Hazards.RemoveGuards(locationId)
    Hazards.RemoveLasers(locationId)
    Props.Remove(locationId)
    Npcs.Remove(locationId)
end

local function buildZones(location)
    if Built[location.id] then return end

    local built = {
        location = location,
        targets = {},
        peds = {},
        props = {},
        sig = not location.modelAnchored and json.encode(location) or nil,
    }
    Built[location.id] = built
    Zones[location.id] = true

    for _, stage in ipairs(location.stages or {}) do
        local def = Stages.Get(stage.type)
        local opts = stage.opts or {}
        local option = {
            name = ('xs_rob_%s_%s'):format(tostring(location.id), stage.id),
            icon = 'fa-solid fa-' .. ((def and def.icon) or 'circle'),
            label = stage.label or (def and def.label) or 'Interact',
            canInteract = function() return wantsTarget(location, stage) end,
            onSelect = function() attempt(location, stage) end,
        }

        if stage.type == 'guard' then
            Hazards.SpawnGuard(location, stage)
            goto continue
        end

        if stage.type == 'laser' then
            Hazards.AddLaser(location, stage)
        end

        do
            local ped = stage.type == 'hostage' and spawnHostage(location, stage) or nil
            local prop = not ped and spawnProp(location, stage) or nil
            local reach = tonumber(opts.reach) or 1.5

            local anchorEntity = nil
            if not ped and not prop and location.entity and DoesEntityExist(location.entity) then
                local at = location.origin
                if math.abs(stage.coords.x - at.x) < 0.6
                    and math.abs(stage.coords.y - at.y) < 0.6
                    and math.abs(stage.coords.z - at.z) < 1.2 then
                    anchorEntity = location.entity
                end
            end

            if anchorEntity then
                built.targets[stage.id] = { kind = 'entity', entity = anchorEntity, option = option, reach = reach, stage = stage }
            elseif ped then
                built.targets[stage.id] = { kind = 'entity', entity = ped, option = option, reach = 2.5, stage = stage }
                built.peds[#built.peds + 1] = { ped = ped, key = ('%s_%s'):format(tostring(location.id), stage.id) }
            elseif prop then
                built.targets[stage.id] = { kind = 'entity', entity = prop, option = option, reach = math.max(2.0, reach), stage = stage }
                built.props[#built.props + 1] = prop
                Props.Track(location, stage, prop, {
                    x = stage.coords.x, y = stage.coords.y,
                    z = stage.coords.z + (tonumber(opts.propZ) or 0.0),
                    h = stage.coords.h or 0.0,
                })
            else
                if stage.type == 'escape' then reach = math.max(reach, 1.6) end
                built.targets[stage.id] = {
                    kind = 'sphere',
                    coords = vector3(stage.coords.x, stage.coords.y, stage.coords.z),
                    option = option,
                    reach = reach,
                    stage = stage,
                }
            end
        end

        ::continue::
    end

    Props.Build(location)
    Npcs.Build(location)
    SyncTargets(location.id)
end

local function refreshBlip(location)
    local blip = location.blip or {}
    local showWhen = blip.showWhen or 'during'

    local shouldShow = showWhen == 'always'
        or (showWhen == 'during' and ActiveRun and ActiveRun.locationId == location.id)

    if shouldShow and not blips[location.id] then
        local b = AddBlipForCoord(location.origin.x, location.origin.y, location.origin.z)
        SetBlipSprite(b, blip.sprite or 500)
        SetBlipColour(b, blip.colour or 1)
        SetBlipScale(b, blip.scale or 0.8)
        SetBlipAsShortRange(b, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(blip.label or location.label or 'Robbery')
        EndTextCommandSetBlipName(b)
        blips[location.id] = b
    elseif not shouldShow and blips[location.id] then
        RemoveBlip(blips[location.id])
        blips[location.id] = nil
    end
end

function Anchors.OnFound(instance)
    buildZones(instance)
end

function Anchors.OnLost(instance)
    removeZones(instance.id)
end

RegisterNetEvent('XS-Robberies:client:locations', function(list)
    local fresh = {}
    for _, location in ipairs(list or {}) do fresh[location.id] = location end

    for id, built in pairs(Built) do
        if not built.location.modelAnchored then
            local nextOne = fresh[id]
            if not nextOne or json.encode(nextOne) ~= built.sig then removeZones(id) end
        end
    end

    Locations = fresh
end)

RegisterNetEvent('XS-Robberies:client:runPublic', function(state)
    if state and state.alarm and state.alarm ~= 'quiet' then
        Hazards.AlarmRaised(state.locationId)
    end
end)

RegisterNetEvent('XS-Robberies:client:runState', function(state)
    if state and state.alarm and state.alarm ~= 'quiet' then
        Hazards.AlarmRaised(state.locationId)
    end
    local changed = not ActiveRun or ActiveRun.locationId ~= state.locationId
    ActiveRun = state
    Hud.Update(state)

    local location = Locations[state.locationId]
    if location then refreshBlip(location) end
    if changed then SyncAllTargets() end
end)

RegisterNetEvent('XS-Robberies:client:runPublic', function(data)
    if not data or not data.locationId then return end

    if data.ended then
        PublicRuns[data.locationId] = nil
    else
        PublicRuns[data.locationId] = { unlocked = data.unlocked or {}, done = data.done or {} }
    end

    SyncTargets(data.locationId)
end)

local ENDED = {
    cancelled = 'runCancelled',
    left = 'runLeft',
    abandoned = 'runAbandoned',
    idle = 'runIdle',
    tooLong = 'runTooLong',
    failed = 'runFailed',
    staff = 'forcedEnd',
}

RegisterNetEvent('XS-Robberies:client:runEnded', function(data)
    ActiveRun = nil
    Hud.Hide()

    if data.outcome == 'completed' then
        if GetGameTimer() - finishedAt > 4000 then
            Sounds.Play('runComplete')
            Framework.Notify(T('runFinished'), 'success')
        end
    else
        local key = ENDED[data.reason or ''] or ENDED[data.outcome or '']
        if key then Framework.Notify(T(key), data.outcome == 'failed' and 'error' or 'inform') end
    end

    local ended = Locations[data.locationId] or ModelInstances[data.locationId]
    if ended then Access[ended.robberyId] = nil end

    local location = Locations[data.locationId]
    if location then refreshBlip(location) end
    SyncAllTargets()
end)

RegisterNetEvent('XS-Robberies:client:noise', function(data)
    if not data or not data.coords then return end

    for _, src in ipairs(data.crew or {}) do
        if src == GetPlayerServerId(PlayerId()) then return end
    end

    local coords = vector3(data.coords.x, data.coords.y, data.coords.z)
    if #(GetEntityCoords(PlayerPedId()) - coords) > (data.radius or 50.0) then return end

    Framework.Notify(T('heardNearby'), 'inform')
end)

RegisterNetEvent('XS-Robberies:client:blackout', function(data)
    if not data or not data.on then
        blackout = nil
        SetArtificialLightsState(false)
        SetArtificialLightsStateAffectsVehicles(true)
        return
    end

    blackout = data

    CreateThread(function()
        while blackout do
            local coords = vector3(blackout.coords.x, blackout.coords.y, blackout.coords.z)
            local inside = #(GetEntityCoords(PlayerPedId()) - coords) <= (blackout.radius or 70.0)

            SetArtificialLightsState(inside)
            SetArtificialLightsStateAffectsVehicles(not inside)
            Wait(1000)
        end

        SetArtificialLightsState(false)
        SetArtificialLightsStateAffectsVehicles(true)
    end)
end)

CreateThread(function()
    Wait(1500)
    TriggerServerEvent('XS-Robberies:server:ready')

    while true do
        local coords = GetEntityCoords(PlayerPedId())
        local nearest = 2000.0

        for id, location in pairs(Locations) do
            local dist = #(coords - vector3(location.origin.x, location.origin.y, location.origin.z))

            if dist <= (location.radius or 30.0) + ((Config.Scene or {}).SpawnDistance or 60.0) then
                buildZones(location)
                if dist < nearest then nearest = dist end
            elseif Built[id] then
                removeZones(id)
            end
        end

        SyncAllTargets()
        Wait(nearest < 150.0 and 1000 or 3000)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    blackout = nil
    SetArtificialLightsState(false)
    SetArtificialLightsStateAffectsVehicles(true)

    for id in pairs(Built) do removeZones(id) end
    for _, blip in pairs(blips) do
        if DoesBlipExist(blip) then RemoveBlip(blip) end
    end
end)
