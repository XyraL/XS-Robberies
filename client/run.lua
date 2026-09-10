Locations = {}
ActiveRun = nil
PublicRuns = {}

Zones = {}
local peds = {}
local pedsByLocation = {}
local propsByLocation = {}
local blips = {}
local busy = false
local blackout = nil

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

function Minigames.Run(id, difficulty)
    if not id or id == '' or id == 'none' then return true end

    -- Robberies saved under the Cipher name still carry `cipher:` ids.
    local builtin = id:match('^xs:(.+)$') or id:match('^cipher:(.+)$')
    if builtin then
        return XSMinigames.Run(builtin, difficulty)
    end

    if id == 'ox_lib:skillcheck' then
        return lib.skillCheck({ 'easy', 'easy', 'medium' }, { 'w', 'a', 's', 'd' })
    end

    if id:sub(1, 6) == 'ps-ui:' then
        local kind = id:sub(7)
        local done = promise.new()

        if kind == 'circle' then
            exports['ps-ui']:Circle(function(success) done:resolve(success) end, 3, 20)
        elseif kind == 'maze' then
            exports['ps-ui']:Maze(function(success) done:resolve(success) end, 20)
        elseif kind == 'thermite' then
            exports['ps-ui']:Thermite(function(success) done:resolve(success) end, 10, 5, 3)
        elseif kind == 'scrambler' then
            exports['ps-ui']:Scrambler(function(success) done:resolve(success) end, 'numeric', 20, 3)
        else
            done:resolve(true)
        end
        return Citizen.Await(done)
    end

    if id == 'memorygame:start' then
        local done = promise.new()
        exports['memorygame']:thermiteminigame(10, 5, 3, 3,
            function() done:resolve(true) end,
            function() done:resolve(false) end)
        return Citizen.Await(done)
    end

    if id == 'howdy:hack' then
        local done = promise.new()
        exports['howdy-hackminigame']:Start(4, 30, function(success) done:resolve(success) end)
        return Citizen.Await(done)
    end

    return lib.skillCheck({ 'easy', 'medium' }, { 'w', 'a', 's', 'd' })
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

local function stageAvailable(location, stage)
    -- Busy somewhere else entirely.
    if ActiveRun and ActiveRun.locationId ~= location.id then return false end

    local live = PublicRuns[location.id]

    -- Nothing running here yet, so only a stage that waits on nothing can start it.
    if not live then return #(stage.requires or {}) == 0 end

    if contains(live.done, stage.id) then return false end
    return contains(live.unlocked, stage.id)
end

local function keypadPrompt(stage)
    local digits = (stage.opts or {}).digits or 4
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
    local model = type(name) == 'number' and name or joaat(name)
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

    local object = CreateObject(model, stage.coords.x, stage.coords.y,
        stage.coords.z + (tonumber(opts.propZ) or 0.0), false, false, false)

    SetEntityHeading(object, stage.coords.h or 0.0)
    PlaceObjectOnGroundProperly(object)
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


local busySince = nil

CreateThread(function()
    while true do
        Wait(5000)

        if busy and busySince and GetGameTimer() - busySince > 45000 then
            busy = false
            busySince = nil
            print('^3[XS-Robberies]^0 an interaction never finished, so it has been released. Check the server console for the error behind it.')
        elseif not busy then
            busySince = nil
        elseif busy and not busySince then
            busySince = GetGameTimer()
        end
    end
end)

local function attempt(location, stage)
    if busy then return end
    busy = true

    local opts = stage.opts or {}

    if stage.type == 'hostage' and opts.needsAim then
        local player = PlayerId()
        if not IsPlayerFreeAiming(player) then
            Framework.Notify(T('aimFirst'), 'error')
            busy = false
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
        busy = false
        return
    end

    if not begun.ok then
        Framework.Notify(begun.error or T('notRightNow'), 'error')
        busy = false
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

    if stage.type == 'keypad' then
        local entered = keypadPrompt(stage)
        if entered == nil then
            lib.callback.await('XS-Robberies:finishStage', 15000, { token = begun.token, success = false })
            busy = false
            return
        end
        Wait(math.floor(duration * 1000))
        success = entered == begun.code
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
            busy = false
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

    busy = false

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
        local ped = peds[('%d_%s'):format(location.id, stage.id)]
        if ped and DoesEntityExist(ped) then
            SetBlockingOfNonTemporaryEvents(ped, false)
            TaskReactAndFleePed(ped, PlayerPedId())
        end
        Framework.Notify(T('pedFled'), 'warning')
    end

    if result.completed then
        Sounds.Play('runComplete')
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

local function spawnHostage(location, stage)
    local key = ('%d_%s'):format(location.id, stage.id)
    if peds[key] and DoesEntityExist(peds[key]) then return peds[key] end

    local model = joaat((stage.opts or {}).ped or 'mp_m_shopkeep_01')
    RequestModel(model)

    local waited = 0
    while not HasModelLoaded(model) and waited < 3000 do
        Wait(50)
        waited = waited + 50
    end
    if not HasModelLoaded(model) then return nil end

    local ped = CreatePed(4, model, stage.coords.x, stage.coords.y, stage.coords.z - 1.0,
        stage.coords.h or 0.0, false, false)

    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedDiesWhenInjured(ped, false)
    SetPedCanRagdollFromPlayerImpact(ped, false)
    SetModelAsNoLongerNeeded(model)

    peds[key] = ped
    return ped
end

local function removeZones(locationId)
    for _, handle in ipairs(Zones[locationId] or {}) do
        Target.Remove(handle)
    end
    Zones[locationId] = nil

    Hazards.RemoveGuards(locationId)
    Hazards.RemoveLasers(locationId)

    for _, entry in ipairs(pedsByLocation[locationId] or {}) do
        if DoesEntityExist(entry.ped) then
            Target.RemoveEntity(entry.ped)
            DeletePed(entry.ped)
        end
        peds[entry.key] = nil
    end
    pedsByLocation[locationId] = nil

    for _, object in ipairs(propsByLocation[locationId] or {}) do
        if DoesEntityExist(object) then
            Target.RemoveEntity(object)
            DeleteObject(object)
        end
    end
    propsByLocation[locationId] = nil
end

local function buildZones(location)
    if Zones[location.id] then return end

    local handles = {}
    pedsByLocation[location.id] = {}
    propsByLocation[location.id] = {}

    for _, stage in ipairs(location.stages or {}) do
        local def = Stages.Get(stage.type)
        local option = {
            name = ('xs_rob_%s_%s'):format(tostring(location.id), stage.id),
            icon = 'fa-solid fa-' .. ((def and def.icon) or 'circle'),
            label = stage.label or (def and def.label) or 'Interact',
            canInteract = function()
                if Framework.IsBlockedJob() then return false end
                return stageAvailable(location, stage)
            end,
            onSelect = function() attempt(location, stage) end,
        }

        if stage.type == 'guard' then
            Hazards.SpawnGuard(location, stage)
            goto continue
        end

        if stage.type == 'laser' then
            Hazards.AddLaser(location, stage)
        end

        local ped = stage.type == 'hostage' and spawnHostage(location, stage) or nil
        local prop = not ped and spawnProp(location, stage) or nil

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
            Target.AddEntity(anchorEntity, { option }, tonumber((stage.opts or {}).reach) or 1.5)
        elseif ped then
            Target.AddEntity(ped, { option }, 2.5)
            local key = ('%s_%s'):format(tostring(location.id), stage.id)
            pedsByLocation[location.id][#pedsByLocation[location.id] + 1] = { ped = ped, key = key }
        elseif prop then
            Target.AddEntity(prop, { option }, 2.0)
            propsByLocation[location.id][#propsByLocation[location.id] + 1] = prop
        else
            local reach = tonumber((stage.opts or {}).reach) or 1.5
            if stage.type == 'escape' then reach = math.max(reach, 1.6) end

            handles[#handles + 1] = Target.AddSphere(
                option.name,
                vector3(stage.coords.x, stage.coords.y, stage.coords.z),
                reach,
                { option }
            )
        end

        ::continue::
    end

    Zones[location.id] = handles
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
    for id in pairs(Zones) do removeZones(id) end

    Locations = {}
    for _, location in ipairs(list or {}) do
        Locations[location.id] = location
    end
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
    ActiveRun = state
    Hud.Update(state)

    local location = Locations[state.locationId]
    if location then refreshBlip(location) end
end)

RegisterNetEvent('XS-Robberies:client:runPublic', function(data)
    if not data or not data.locationId then return end

    if data.ended then
        PublicRuns[data.locationId] = nil
        return
    end

    PublicRuns[data.locationId] = { unlocked = data.unlocked or {}, done = data.done or {} }
end)

RegisterNetEvent('XS-Robberies:client:runEnded', function(data)
    ActiveRun = nil
    Hud.Hide()

    local location = Locations[data.locationId]
    if location then refreshBlip(location) end
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

            if dist <= (location.radius or 30.0) + 60.0 then
                buildZones(location)
                if dist < nearest then nearest = dist end
            elseif Zones[id] then
                removeZones(id)
            end
        end

        Wait(nearest < 150.0 and 1000 or 3000)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    blackout = nil
    SetArtificialLightsState(false)
    SetArtificialLightsStateAffectsVehicles(true)

    for id in pairs(Zones) do removeZones(id) end
    for id in pairs(propsByLocation) do removeZones(id) end
    for _, blip in pairs(blips) do
        if DoesBlipExist(blip) then RemoveBlip(blip) end
    end
end)
