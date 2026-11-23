PettyState = { on = false, kinds = {}, shops = nil, openables = {}, hit = {}, time = 0, syncedAt = 0 }

local busy = false
local sets = {}
local registered = { ped = {}, vehicle = {}, models = {} }
local spotsBuilt = {}
local clerkPeds = {}
local shownText = nil

local WHEELS = {
    { bone = 'wheel_lf', index = 0, tyre = 0 },
    { bone = 'wheel_rf', index = 1, tyre = 1 },
    { bone = 'wheel_lr', index = 2, tyre = 4 },
    { bone = 'wheel_rr', index = 3, tyre = 5 },
}

local WINDOWS = {
    { bone = 'window_lf', index = 0 },
    { bone = 'window_rf', index = 1 },
    { bone = 'window_lr', index = 2 },
    { bone = 'window_rr', index = 3 },
}

local function serverNow()
    return PettyState.time + (GetGameTimer() - PettyState.syncedAt) / 1000
end

local function spawnDistance()
    return tonumber((Config.Petty or {}).SpawnDistance) or 50.0
end

local function stateOf(entity)
    local ok, value = pcall(function() return Entity(entity).state.xsPetty end)
    if ok and type(value) == 'table' then return value end
    return {}
end

local function hitActive(key)
    local untilAt = PettyState.hit[key]
    if not untilAt then return false end
    if GetGameTimer() >= untilAt then
        PettyState.hit[key] = nil
        return false
    end
    return true
end

local function objectKey(id, coords)
    return ('obj:%s:%.1f_%.1f_%.1f'):format(id, coords.x, coords.y, coords.z)
end

local function spotKey(id, spot)
    return ('spot:%s:%s'):format(id, spot.id)
end

local function entityOf(data)
    if type(data) == 'table' then return data.entity end
    return data
end

local function canAct()
    if busy or lib.progressActive() then return false end
    if Framework.IsBlockedJob() then return false end
    if IsPedInAnyVehicle(PlayerPedId(), false) then return false end
    return true
end

local function enabled(id)
    local cfg = PettyState.kinds[id]
    return PettyState.on and cfg ~= nil and cfg.enabled == true
end

local function takeControl(entity)
    if not DoesEntityExist(entity) then return false end
    if NetworkHasControlOfEntity(entity) then return true end
    NetworkRequestControlOfEntity(entity)
    local waited = 0
    while not NetworkHasControlOfEntity(entity) and waited < 600 do
        Wait(50)
        waited = waited + 50
        NetworkRequestControlOfEntity(entity)
    end
    return NetworkHasControlOfEntity(entity)
end

local function nearestWheel(vehicle)
    local here = GetEntityCoords(PlayerPedId())
    local best, bestDist = nil, 1.9
    for _, wheel in ipairs(WHEELS) do
        local bone = GetEntityBoneIndexByName(vehicle, wheel.bone)
        if bone ~= -1 then
            local at = GetWorldPositionOfEntityBone(vehicle, bone)
            local dist = #(here - at)
            if dist < bestDist then
                best, bestDist = { index = wheel.index, tyre = wheel.tyre, coords = at }, dist
            end
        end
    end
    return best
end

local function nearestWindow(vehicle)
    local here = GetEntityCoords(PlayerPedId())
    local best, bestDist = nil, 99.0
    for _, window in ipairs(WINDOWS) do
        if IsVehicleWindowIntact(vehicle, window.index) then
            local bone = GetEntityBoneIndexByName(vehicle, window.bone)
            if bone ~= -1 then
                local dist = #(here - GetWorldPositionOfEntityBone(vehicle, bone))
                if dist < bestDist then best, bestDist = window.index, dist end
            elseif not best then
                best = window.index
            end
        end
    end
    return best
end

local function pedOk(id, ped)
    if not enabled(id) or not canAct() then return false end
    if not ped or ped == 0 or not DoesEntityExist(ped) or not IsEntityAPed(ped) then return false end
    if IsPedAPlayer(ped) or IsPedDeadOrDying(ped, true) or not IsPedHuman(ped) then return false end
    if IsPedInAnyVehicle(ped, false) or IsPedFleeing(ped) or IsPedInCombat(ped, 0) then return false end
    if not NetworkGetEntityIsNetworked(ped) then return false end

    local peds = PettyState.kinds[id].peds or {}
    if peds.skipMission and IsEntityAMissionEntity(ped) then return false end
    if peds.skipCops then
        local kind = GetPedType(ped)
        if kind == 6 or kind == 27 or kind == 29 then return false end
    end
    if peds.gender == 'male' and not IsPedMale(ped) then return false end
    if peds.gender == 'female' and IsPedMale(ped) then return false end

    local model = Petty.Unsigned(GetEntityModel(ped))
    local s = sets[id] or {}
    if s.exclude and s.exclude[model] then return false end
    if s.only and not s.only[model] then return false end

    return stateOf(ped).done ~= true
end

local function vehicleOk(id, vehicle)
    if not enabled(id) or not canAct() then return false end
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then return false end
    if not NetworkGetEntityIsNetworked(vehicle) then return false end

    local cfg = PettyState.kinds[id]
    local s = sets[id] or {}
    if s.classes and not s.classes[GetVehicleClass(vehicle)] then return false end
    if cfg.vehicles and cfg.vehicles.parked then
        if not IsVehicleSeatFree(vehicle, -1) or GetEntitySpeed(vehicle) > 1.0 then return false end
    end

    local state = stateOf(vehicle)
    if id == 'wheels' then
        local wheel = nearestWheel(vehicle)
        if not wheel then return false end
        return not (type(state.wheels) == 'table' and state.wheels[tostring(wheel.index)])
    end
    if state[id] then return false end
    if id == 'carwindow' then return nearestWindow(vehicle) ~= nil end
    return true
end

local function modelOk(id, entity)
    if not enabled(id) or not canAct() then return false end
    if not entity or entity == 0 or not DoesEntityExist(entity) then return false end
    return not hitActive(objectKey(id, GetEntityCoords(entity)))
end

local function spotOk(id, spot)
    if not enabled(id) or not canAct() then return false end
    return not hitActive(spotKey(id, spot))
end

local function progress(res, opts)
    opts = opts or {}
    local payload = {
        duration = math.floor((tonumber(res.duration) or 3) * 1000),
        label = res.label or 'Working',
        position = 'bottom',
        useWhileDead = false,
        canCancel = true,
        disable = {
            move = opts.move ~= true,
            car = true,
            combat = opts.combat ~= false,
        },
    }

    local anim = opts.anim ~= false and res.anim or nil
    if anim and anim.mode == 'scenario' and anim.scenario and anim.scenario ~= '' then
        payload.anim = { scenario = anim.scenario }
    elseif anim and anim.mode == 'anim' and anim.dict and anim.dict ~= '' and anim.clip and anim.clip ~= '' then
        if pcall(lib.requestAnimDict, anim.dict, 3000) and HasAnimDictLoaded(anim.dict) then
            payload.anim = { dict = anim.dict, clip = anim.clip, flag = math.floor(tonumber(anim.flag) or 1) }
        end
    end

    return lib.progressCircle(payload)
end

local function minigame(res)
    if not res.minigame or res.minigame == '' or res.minigame == 'none' then return true end
    return Minigames.Run(res.minigame, res.difficulty)
end

local function begin(id, payload)
    payload.kind = id
    local res = lib.callback.await('XS-Robberies:petty:begin', false, payload)
    if not res then
        Framework.Notify(T('serverSilent'), 'error')
        return nil
    end
    if not res.ok then
        Framework.Notify(res.error or T('notRightNow'), 'error')
        return nil
    end
    return res
end

local function finish(res, success, cancelled)
    return lib.callback.await('XS-Robberies:petty:finish', false, {
        token = res.token,
        success = success == true,
        cancelled = cancelled == true,
    })
end

local function report(out)
    if not out then
        Framework.Notify(T('serverSilent'), 'error')
        return
    end
    if not out.ok then
        Framework.Notify(out.error or T('didNotCount'), 'error')
        return
    end
    if out.broke then Framework.Notify(T('pettyBroke', out.broke), 'error') end
    if out.cancelled then
        Framework.Notify(T('youStopped'), 'inform')
        return
    end
    if out.shocked and Hazards and Hazards.Punish then Hazards.Punish('shock') end
    if out.failed then
        Sounds.Play('stageFailed')
        Framework.Notify(out.message or T('stageFailed'), 'error')
        return
    end
    if out.noticed then Framework.Notify(T('pettyNoticed'), 'warning') end
    if out.summary and out.summary ~= '' then
        Sounds.Play('stageDone')
        Framework.Notify(T('pettyTook', out.summary), 'success')
    else
        Framework.Notify(T('pettyNothing'), 'inform')
    end
end

local function react(ped, how)
    if not how or not ped or not DoesEntityExist(ped) or IsPedDeadOrDying(ped, true) then return end
    takeControl(ped)
    ClearPedTasks(ped)
    SetBlockingOfNonTemporaryEvents(ped, false)

    if how == 'fight' then
        SetPedCombatAttributes(ped, 46, true)
        TaskCombatPed(ped, PlayerPedId(), 0, 16)
    else
        TaskSmartFleePed(ped, PlayerPedId(), 120.0, -1, false, false)
    end
    SetPedKeepTask(ped, true)
end

local function letGo(ped)
    if not ped or not DoesEntityExist(ped) or IsPedDeadOrDying(ped, true) then return end
    takeControl(ped)
    ClearPedTasks(ped)
    SetPedKeepTask(ped, false)
end

local flows = {}

flows.ped = function(id, ped)
    local res = begin(id, { netId = PedToNet(ped) })
    if not res then return end

    if id == 'pickpocket' and takeControl(ped) then
        TaskStandStill(ped, math.floor(res.duration * 1000) + 2500)
    end

    local done = progress(res)
    local success = done and minigame(res)
    local out = finish(res, success, not done)
    if out and out.ok then react(ped, out.reaction) end
    report(out)
end

flows.aim = function(id, ped)
    local res = begin(id, { netId = PedToNet(ped) })
    if not res then return end

    if res.resisted then
        react(ped, res.reaction)
        Framework.Notify(T('pettyResisted'), 'error')
        return
    end

    if takeControl(ped) then
        ClearPedTasks(ped)
        if pcall(lib.requestAnimDict, 'mp_am_hold_up', 2000) and HasAnimDictLoaded('mp_am_hold_up') then
            TaskPlayAnim(ped, 'mp_am_hold_up', 'handsup_base', 4.0, -4.0, -1, 49, 0.0, false, false, false)
        else
            TaskHandsUp(ped, math.floor(res.duration * 1000) + 3000, PlayerPedId(), -1, true)
        end
        SetPedKeepTask(ped, true)
    end

    local lost = false
    local reach = (tonumber(res.reach) or 8.0) + 3.0
    CreateThread(function()
        local started = GetGameTimer()
        while not lib.progressActive() and GetGameTimer() - started < 1500 do Wait(0) end
        while lib.progressActive() do
            local far = not DoesEntityExist(ped) or #(GetEntityCoords(PlayerPedId()) - GetEntityCoords(ped)) > reach
            if far or not IsPlayerFreeAiming(PlayerId()) then
                lost = true
                if lib.progressActive() then lib.cancelProgress() end
                break
            end
            Wait(150)
        end
    end)

    local done = progress(res, { move = true, combat = false, anim = false })
    local out = finish(res, done and not lost, not done and not lost)

    if lost then
        Framework.Notify(T('pettyKeepAiming'), 'warning')
        react(ped, 'flee')
        if out and out.ok then report({ ok = true, failed = true, message = T('pettyKeepAiming'), broke = out.broke }) end
        return
    end

    if out and out.ok and not out.failed and not out.cancelled and DoesEntityExist(ped) then
        if pcall(lib.requestAnimDict, 'mp_common', 2000) and HasAnimDictLoaded('mp_common') then
            TaskPlayAnim(ped, 'mp_common', 'givetake1_b', 8.0, -8.0, 1600, 48, 0.0, false, false, false)
            Wait(1200)
        end
    end
    if out and out.ok then
        if out.reaction then react(ped, out.reaction) else letGo(ped) end
    else
        react(ped, 'flee')
    end
    report(out)
end

local function smash(vehicle)
    local window = nearestWindow(vehicle)
    if not window then return end
    local ped = PlayerPedId()
    TaskTurnPedToFaceEntity(ped, vehicle, 600)
    Wait(500)
    if pcall(lib.requestAnimDict, 'veh@break_in@0h@p_m_one@', 2000) and HasAnimDictLoaded('veh@break_in@0h@p_m_one@') then
        TaskPlayAnim(ped, 'veh@break_in@0h@p_m_one@', 'low_force_entry_ds', 8.0, -8.0, 1400, 48, 0.0, false, false, false)
    end
    Wait(650)
    if takeControl(vehicle) then SmashVehicleWindow(vehicle, window) end
    Wait(500)
end

local function underneath(vehicle)
    local ped = PlayerPedId()
    local min, max = GetModelDimensions(GetEntityModel(vehicle))
    local half = ((max and max.x or 1.0) - (min and min.x or -1.0)) / 2
    local left = GetOffsetFromEntityInWorldCoords(vehicle, -(half + 0.45), 0.0, 0.0)
    local right = GetOffsetFromEntityInWorldCoords(vehicle, half + 0.45, 0.0, 0.0)
    local here = GetEntityCoords(ped)
    local onLeft = #(here - left) <= #(here - right)
    local spot = onLeft and left or right
    local heading = (GetEntityHeading(vehicle) + (onLeft and 90.0 or -90.0)) % 360.0

    TaskGoStraightToCoord(ped, spot.x, spot.y, spot.z, 1.0, 3000, heading, 0.15)
    local started = GetGameTimer()
    while GetGameTimer() - started < 3200 do
        local now = GetEntityCoords(ped)
        if #(vector3(now.x, now.y, 0.0) - vector3(spot.x, spot.y, 0.0)) < 0.35 then break end
        Wait(100)
    end
    ClearPedTasks(ped)
    SetEntityHeading(ped, heading)
end

local function dropWheel(vehicle, wheel)
    if not wheel or not DoesEntityExist(vehicle) or not takeControl(vehicle) then return end
    local ok = pcall(BreakOffVehicleWheel, vehicle, wheel.index, false, true, true, false)
    if not ok then SetVehicleTyreBurst(vehicle, wheel.tyre, true, 1000.0) end
end

flows.vehicle = function(id, vehicle)
    local payload = { netId = VehToNet(vehicle), class = GetVehicleClass(vehicle) }
    local wheel = nil
    if id == 'wheels' then
        wheel = nearestWheel(vehicle)
        if not wheel then
            Framework.Notify(T('pettyNoWheel'), 'error')
            return
        end
        payload.wheel = wheel.index
    end

    local res = begin(id, payload)
    if not res then return end

    if res.alarm then
        if takeControl(vehicle) then
            SetVehicleAlarm(vehicle, true)
            StartVehicleAlarm(vehicle)
        end
        Framework.Notify(T('pettyAlarm'), 'warning')
    end

    if id == 'carwindow' then
        smash(vehicle)
    elseif id == 'catalytic' then
        underneath(vehicle)
    elseif wheel then
        TaskTurnPedToFaceCoord(PlayerPedId(), wheel.coords.x, wheel.coords.y, wheel.coords.z, 700)
        Wait(700)
    end

    local done = progress(res)
    local success = done and minigame(res)
    local out = finish(res, success, not done)

    if out and out.ok and not out.failed and not out.cancelled and id == 'wheels' then
        dropWheel(vehicle, wheel)
    end
    report(out)
end

flows.model = function(id, entity)
    local coords = GetEntityCoords(entity)
    local res = begin(id, {
        coords = { x = coords.x, y = coords.y, z = coords.z },
        model = GetEntityModel(entity),
    })
    if not res then return end

    TaskTurnPedToFaceEntity(PlayerPedId(), entity, 700)
    Wait(600)

    local done = progress(res)
    local success = done and minigame(res)
    local out = finish(res, success, not done)
    if out and out.ok and not out.failed and not out.cancelled then
        PettyState.hit[objectKey(id, coords)] = GetGameTimer() + 5000
    end
    report(out)
end

flows.spot = function(id, spot)
    local res = begin(id, { spot = spot.id })
    if not res then return end

    TaskTurnPedToFaceCoord(PlayerPedId(), spot.x + 0.0, spot.y + 0.0, spot.z + 0.0, 700)
    Wait(500)

    local done = progress(res)
    local success = done and minigame(res)
    local out = finish(res, success, not done)
    report(out)
end

local FLOW = { ped = 'ped', aim = 'aim', vehicle = 'vehicle', model = 'model', spot = 'spot' }

local function attempt(id, target)
    if busy then return end
    local def = Petty.kinds[id]
    if not def or not target then return end

    busy = true
    local ok, err = pcall(flows[FLOW[def.target]], id, target)
    busy = false

    if not ok then
        print(('^1[XS-Robberies]^0 %s failed: %s'):format(id, tostring(err)))
        Framework.Notify(T('didNotCount'), 'error')
    end
end

local function option(id, check)
    local cfg = PettyState.kinds[id]
    local def = Petty.kinds[id]
    return {
        name = 'xs_petty_' .. id,
        icon = 'fa-solid fa-' .. (def.fa or 'hand'),
        label = cfg.label,
        distance = (tonumber(cfg.reach) or 1.5) + 0.5,
        canInteract = function(entity) return check(id, entity) end,
        onSelect = function(data)
            local entity = entityOf(data)
            CreateThread(function() attempt(id, entity) end)
        end,
    }
end

local function clearTargets()
    if #registered.ped > 0 then Target.RemoveGlobalPed(registered.ped) end
    if #registered.vehicle > 0 then Target.RemoveGlobalVehicle(registered.vehicle) end
    for _, entry in ipairs(registered.models) do Target.RemoveModels(entry.models, { entry.option }) end
    registered = { ped = {}, vehicle = {}, models = {} }
end

local function buildTargets()
    clearTargets()
    if not PettyState.on then return end

    for _, id in ipairs(Petty.order) do
        local def = Petty.kinds[id]
        local cfg = PettyState.kinds[id]
        if cfg and cfg.enabled then
            if def.target == 'ped' then
                registered.ped[#registered.ped + 1] = option(id, pedOk)
            elseif def.target == 'vehicle' then
                registered.vehicle[#registered.vehicle + 1] = option(id, vehicleOk)
            elseif def.target == 'model' and #(cfg.models or {}) > 0 then
                local entry = { models = cfg.models, option = option(id, modelOk) }
                Target.AddModels(entry.models, { entry.option })
                registered.models[#registered.models + 1] = entry
            end
        end
    end

    if #registered.ped > 0 then Target.AddGlobalPed(registered.ped) end
    if #registered.vehicle > 0 then Target.AddGlobalVehicle(registered.vehicle) end
end

local function buildSets()
    sets = {}
    for _, id in ipairs(Petty.order) do
        local cfg = PettyState.kinds[id]
        if cfg then
            local entry = {}
            if cfg.peds then
                entry.exclude = Petty.HashSet(cfg.peds.exclude)
                if #(cfg.peds.models or {}) > 0 then entry.only = Petty.HashSet(cfg.peds.models) end
            end
            if cfg.vehicles then
                entry.classes = {}
                for _, c in ipairs(cfg.vehicles.classes or {}) do entry.classes[c] = true end
            end
            sets[id] = entry
        end
    end
end

local function dropSpot(key)
    local built = spotsBuilt[key]
    if not built then return end
    spotsBuilt[key] = nil

    if built.target then
        if built.kind == 'sphere' then Target.Remove(built.target) else Target.RemoveEntityOption(built.target) end
    end
    if built.prop and DoesEntityExist(built.prop) then DeleteObject(built.prop) end
end

local function buildSpot(id, spot, cfg, sig)
    local key = spotKey(id, spot)
    local built = { sig = sig, kind = 'sphere' }
    spotsBuilt[key] = built

    local entry = option(id, function() return spotOk(id, spot) end)
    entry.name = ('xs_petty_%s_%s'):format(id, spot.id)
    entry.onSelect = function() CreateThread(function() attempt(id, spot) end) end

    if cfg.prop and cfg.prop ~= '' then
        local model = loadModel(cfg.prop)
        if model and spotsBuilt[key] == built then
            local object = CreateObjectNoOffset(model, spot.x + 0.0, spot.y + 0.0, spot.z + PropLift(model), false, false, false)
            SetEntityHeading(object, (spot.h or 0.0) + 0.0)
            FreezeEntityPosition(object, true)
            SetModelAsNoLongerNeeded(model)
            built.prop = object
            built.kind = 'entity'
            built.target = Target.AddEntityOption(object, entry, entry.distance)
            return
        end
    end

    built.target = Target.AddSphere(entry.name, vector3(spot.x + 0.0, spot.y + 0.0, spot.z + 0.0), 0.6, { entry })
end

local function syncSpots()
    local here = GetEntityCoords(PlayerPedId())
    local range = spawnDistance()
    local wanted = {}

    if PettyState.on then
        for _, id in ipairs(Petty.order) do
            local def = Petty.kinds[id]
            local cfg = PettyState.kinds[id]
            if def.target == 'spot' and cfg and cfg.enabled then
                for _, spot in ipairs(cfg.spots or {}) do
                    local key = spotKey(id, spot)
                    local near = #(here - vector3(spot.x + 0.0, spot.y + 0.0, spot.z + 0.0)) <= range
                    if near and not hitActive(key) then
                        wanted[key] = true
                        local sig = ('%s|%.2f|%.2f|%.2f|%.1f|%s|%s'):format(cfg.prop or '', spot.x, spot.y, spot.z, spot.h or 0, cfg.label, cfg.reach)
                        local built = spotsBuilt[key]
                        if built and built.sig ~= sig then dropSpot(key) built = nil end
                        if not built then buildSpot(id, spot, cfg, sig) end
                    end
                end
            end
        end
    end

    for key in pairs(spotsBuilt) do
        if not wanted[key] then dropSpot(key) end
    end
end

local function clerkName(clerk)
    return Petty.ShopKey(clerk.shop)
end

local function removeClerk(id)
    local entry = clerkPeds[id]
    clerkPeds[id] = nil
    if entry and DoesEntityExist(entry.ped) then DeletePed(entry.ped) end
end

local function spawnClerk(clerk, model)
    local hash = loadModel(model)
    if not hash or not IsModelAPed(hash) then return nil end

    local ped = CreatePed(4, hash, clerk.x + 0.0, clerk.y + 0.0, FloorUnder(clerk.x + 0.0, clerk.y + 0.0, clerk.z + 0.0), (clerk.h or 0.0) + 0.0, false, false)
    SetModelAsNoLongerNeeded(hash)
    if not ped or ped == 0 then return nil end

    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedFleeAttributes(ped, 0, false)
    SetPedCanRagdollFromPlayerImpact(ped, false)
    FreezeEntityPosition(ped, true)
    return ped
end

local function animateClerk(entry, clerk, state)
    if entry.state == state then return end
    entry.state = state
    local ped = entry.ped
    if not DoesEntityExist(ped) then return end

    ClearPedTasks(ped)
    if state == 'away' then
        SetEntityHeading(ped, ((clerk.h or 0.0) + 180.0) % 360.0)
        TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_STAND_MOBILE', 0, true)
    else
        SetEntityHeading(ped, (clerk.h or 0.0) + 0.0)
        TaskLookAtEntity(ped, PlayerPedId(), -1, 2048, 3)
    end
end

local function syncClerks(here)
    local shops = PettyState.shops
    local wanted = {}
    local shopOn = enabled('shoplift') or enabled('till')

    if shops and shopOn then
        for _, clerk in ipairs(shops.clerks or {}) do
            if #(here - vector3(clerk.x + 0.0, clerk.y + 0.0, clerk.z + 0.0)) <= spawnDistance() then
                wanted[clerk.id] = true
                local entry = clerkPeds[clerk.id]
                local sig = ('%s|%.2f|%.2f|%.2f|%s'):format(shops.model, clerk.x, clerk.y, clerk.z, clerk.shop or '')
                if entry and entry.sig ~= sig then removeClerk(clerk.id) entry = nil end
                if not entry then
                    local ped = spawnClerk(clerk, shops.model)
                    if ped then
                        entry = { ped = ped, sig = sig }
                        clerkPeds[clerk.id] = entry
                    end
                end
                local name = clerkName(clerk)
                if entry and name then
                    animateClerk(entry, clerk, Petty.Clerk(name, serverNow(), shops).state)
                end
            end
        end
    end

    for id in pairs(clerkPeds) do
        if not wanted[id] then removeClerk(id) end
    end
end

local function clerkText(here)
    local shops = PettyState.shops
    local best, bestDist, bestKind = nil, 9.0, nil

    if shops then
        for _, id in ipairs({ 'shoplift', 'till' }) do
            local cfg = PettyState.kinds[id]
            if enabled(id) then
                for _, spot in ipairs(cfg.spots or {}) do
                    local dist = #(here - vector3(spot.x + 0.0, spot.y + 0.0, spot.z + 0.0))
                    if dist < bestDist then best, bestDist, bestKind = spot, dist, id end
                end
            end
        end
    end

    local text = nil
    if best and not Framework.IsBlockedJob() then
        local clerk = Petty.Clerk(Petty.ClerkName(bestKind, best), serverNow(), shops)
        if clerk.state == 'away' then
            text = T('pettyClerkAway', math.max(1, math.ceil(clerk.left)))
        else
            text = T('pettyClerkWatching')
        end
    end

    if text ~= shownText then
        if text then
            lib.showTextUI(text, { position = 'left-center', icon = text == T('pettyClerkWatching') and 'eye' or 'eye-slash' })
        elseif shownText then
            lib.hideTextUI()
        end
        shownText = text
    end
end

local function hideClerkText()
    if shownText then
        lib.hideTextUI()
        shownText = nil
    end
end

CreateThread(function()
    local nextSpots = 0
    while true do
        local here = GetEntityCoords(PlayerPedId())
        if GetGameTimer() >= nextSpots then
            syncSpots()
            nextSpots = GetGameTimer() + 1000
        end
        syncClerks(here)
        clerkText(here)
        Wait(250)
    end
end)

CreateThread(function()
    while true do
        local wait = 400
        if enabled('mugging') and not busy and IsPlayerFreeAiming(PlayerId()) then
            wait = 0
            local ok, entity = GetEntityPlayerIsFreeAimingAt(PlayerId())
            if (ok == true or ok == 1) and entity and entity ~= 0 and pedOk('mugging', entity) and IsPedArmed(PlayerPedId(), 4) then
                local reach = tonumber(PettyState.kinds.mugging.reach) or 8.0
                if #(GetEntityCoords(PlayerPedId()) - GetEntityCoords(entity)) <= reach then
                    BeginTextCommandDisplayHelp('STRING')
                    AddTextComponentSubstringPlayerName(('~INPUT_CONTEXT~ %s'):format(PettyState.kinds.mugging.label or 'Rob them'))
                    EndTextCommandDisplayHelp(0, false, true, -1)
                    if IsControlJustReleased(0, 38) then
                        local target = entity
                        CreateThread(function() attempt('mugging', target) end)
                    end
                end
            end
        end
        Wait(wait)
    end
end)

local function openItem(name)
    local entry = PettyState.openables[name]
    if not entry or busy or lib.progressActive() then return end

    busy = true
    local ok, err = pcall(function()
        local done = lib.progressCircle({
            duration = math.floor((tonumber(entry.duration) or 3) * 1000),
            label = entry.label or 'Going through it',
            position = 'bottom',
            canCancel = true,
            disable = { car = true, combat = true },
        })
        if not done then return end

        local out = lib.callback.await('XS-Robberies:petty:open', false, name)
        if not out or not out.ok then
            Framework.Notify(out and out.error or T('serverSilent'), 'error')
        elseif out.summary and out.summary ~= '' then
            Sounds.Play('stageDone')
            Framework.Notify(T('pettyOpened', out.summary), 'success')
        else
            Framework.Notify(T('pettyEmptyItem'), 'inform')
        end
    end)
    busy = false

    if not ok then print(('^1[XS-Robberies]^0 opening %s failed: %s'):format(tostring(name), tostring(err))) end
end

exports('openStolen', function(...)
    for _, arg in ipairs({ ... }) do
        if type(arg) == 'table' and type(arg.name) == 'string' then
            local name = arg.name
            CreateThread(function() openItem(name) end)
            return
        end
    end
end)

RegisterNetEvent('XS-Robberies:client:pettyOpen', function(name)
    if type(name) ~= 'string' then return end
    openItem(name)
end)

RegisterNetEvent('XS-Robberies:client:petty', function(data)
    data = type(data) == 'table' and data or {}
    PettyState.on = data.on == true
    PettyState.kinds = type(data.kinds) == 'table' and data.kinds or {}
    PettyState.shops = data.shops
    PettyState.openables = type(data.openables) == 'table' and data.openables or {}
    PettyState.time = tonumber(data.time) or 0
    PettyState.syncedAt = GetGameTimer()

    PettyState.hit = {}
    for key, left in pairs(type(data.hit) == 'table' and data.hit or {}) do
        PettyState.hit[key] = GetGameTimer() + (tonumber(left) or 0) * 1000
    end

    buildSets()
    buildTargets()
    for key in pairs(spotsBuilt) do dropSpot(key) end
end)

RegisterNetEvent('XS-Robberies:client:pettyHit', function(key, left)
    if type(key) ~= 'string' then return end
    PettyState.hit[key] = GetGameTimer() + (tonumber(left) or 0) * 1000
    if spotsBuilt[key] then dropSpot(key) end
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
    busy = false
    hideClerkText()
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    clearTargets()
    for key in pairs(spotsBuilt) do dropSpot(key) end
    for id in pairs(clerkPeds) do removeClerk(id) end
    hideClerkText()
end)
