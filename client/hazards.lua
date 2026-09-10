Hazards = {}

local guards = {}
local lasers = {}

local function locationRef(location)
    if location.modelAnchored then
        return { robberyId = location.robberyId, anchor = location.origin }
    end
    return { locationId = location.id }
end

-- ── Penalties ───────────────────────────────────────────────────────────────

function Hazards.Punish(kind, coords)
    local ped = PlayerPedId()

    if kind == 'shock' then
        SetEntityHealth(ped, math.max(101, GetEntityHealth(ped) - 25))
        SetPedToRagdoll(ped, 2200, 2200, 3, true, true, false)
        ShakeGameplayCam('SMALL_EXPLOSION_SHAKE', 0.6)
        StartScreenEffect('DeathFailOut', 1200, false)
        SetTimeout(1400, function() StopScreenEffect('DeathFailOut') end)
        return
    end

    if kind == 'fire' then
        local at = coords or GetEntityCoords(ped)
        StartEntityFire(ped)
        AddExplosion(at.x, at.y, at.z, 12, 0.0, false, true, 0.0)
        SetEntityHealth(ped, math.max(101, GetEntityHealth(ped) - 35))
        return
    end

    if kind == 'gas' then
        local at = coords or GetEntityCoords(ped)
        UseParticleFxAssetNextCall('core')
        StartParticleFxLoopedAtCoord('exp_grd_bzgas_smoke', at.x, at.y, at.z,
            0.0, 0.0, 0.0, 1.6, false, false, false, false)

        CreateThread(function()
            for _ = 1, 12 do
                if #(GetEntityCoords(PlayerPedId()) - at) < 6.0 then
                    SetEntityHealth(PlayerPedId(), math.max(101, GetEntityHealth(PlayerPedId()) - 6))
                    SetPedMotionBlur(PlayerPedId(), true)
                end
                Wait(1000)
            end
            SetPedMotionBlur(PlayerPedId(), false)
        end)
        return
    end

    if kind == 'explosion' then
        local at = coords or GetEntityCoords(ped)
        AddExplosion(at.x, at.y, at.z, 2, 1.0, true, false, 1.0)
    end
end

-- ── Armed guards ────────────────────────────────────────────────────────────

local function guardKey(location, stage)
    return ('%s_%s'):format(tostring(location.id), stage.id)
end

function Hazards.SpawnGuard(location, stage)
    local key = guardKey(location, stage)
    if guards[key] and DoesEntityExist(guards[key].ped) then return guards[key].ped end

    local opts = stage.opts or {}
    local model = loadModel(opts.ped or 's_m_m_security_01')
    if not model then return nil end

    local ped = CreatePed(4, model, stage.coords.x, stage.coords.y, stage.coords.z - 1.0,
        stage.coords.h or 0.0, false, false)

    SetEntityMaxHealth(ped, tonumber(opts.guardHealth) or 200)
    SetEntityHealth(ped, tonumber(opts.guardHealth) or 200)
    SetPedArmour(ped, tonumber(opts.armour) or 0)
    SetPedAccuracy(ped, tonumber(opts.accuracy) or 40)
    SetPedDropsWeaponsWhenDead(ped, false)
    SetPedDiesWhenInjured(ped, false)
    SetPedFleeAttributes(ped, 0, false)
    SetPedCombatAttributes(ped, 46, true)
    SetPedCombatAbility(ped, 2)
    SetPedCombatRange(ped, 2)
    SetPedSeeingRange(ped, 40.0)
    SetPedHearingRange(ped, 40.0)
    SetPedAlertness(ped, 3)

    if opts.weapon and opts.weapon ~= '' then
        GiveWeaponToPed(ped, joaat(opts.weapon), 250, false, true)
    end

    if opts.hostile then
        Hazards.WakeGuard(ped)
    elseif opts.guardScenario and opts.guardScenario ~= '' then
        TaskStartScenarioInPlace(ped, opts.guardScenario, 0, true)
    end

    SetModelAsNoLongerNeeded(model)

    guards[key] = { ped = ped, location = location, stage = stage, reported = false }
    return ped
end

function Hazards.WakeGuard(ped)
    if not DoesEntityExist(ped) then return end

    ClearPedTasks(ped)
    SetPedRelationshipGroupHash(ped, joaat('HATES_PLAYER'))
    SetRelationshipBetweenGroups(5, joaat('HATES_PLAYER'), joaat('PLAYER'))
    TaskCombatPed(ped, PlayerPedId(), 0, 16)
end

function Hazards.AlarmRaised(locationId)
    for _, guard in pairs(guards) do
        if guard.location.id == locationId and not (guard.stage.opts or {}).hostile then
            Hazards.WakeGuard(guard.ped)
        end
    end
end

function Hazards.RemoveGuards(locationId)
    for key, guard in pairs(guards) do
        if guard.location.id == locationId then
            if DoesEntityExist(guard.ped) then
                Target.RemoveEntity(guard.ped)
                DeletePed(guard.ped)
            end
            guards[key] = nil
        end
    end
end

-- ── Laser grids ─────────────────────────────────────────────────────────────

function Hazards.AddLaser(location, stage)
    lasers[guardKey(location, stage)] = { location = location, stage = stage, tripped = false }
end

function Hazards.RemoveLasers(locationId)
    for key, laser in pairs(lasers) do
        if laser.location.id == locationId then lasers[key] = nil end
    end
end

local function laserLive(laser)
    local live = PublicRuns[laser.location.id]
    if live then
        for _, id in ipairs(live.done or {}) do
            if id == laser.stage.id then return false end
        end
    end
    return true
end

CreateThread(function()
    while true do
        local wait = 500
        local ped = PlayerPedId()
        local here = GetEntityCoords(ped)

        for _, laser in pairs(lasers) do
            local c = laser.stage.coords
            local at = vector3(c.x, c.y, c.z)
            local dist = #(here - at)

            if dist < 40.0 then
                wait = 0

                if laserLive(laser) then
                    local opts = laser.stage.opts or {}
                    local span = tonumber(opts.span) or 2.0
                    local beams = math.floor(tonumber(opts.beams) or 4)
                    local rad = math.rad(c.h or 0.0)
                    local dx, dy = math.cos(rad) * span * 0.5, math.sin(rad) * span * 0.5

                    for i = 1, beams do
                        local z = c.z + (i - 1) * (1.6 / math.max(1, beams - 1))
                        DrawLine(c.x - dx, c.y - dy, z, c.x + dx, c.y + dy, z, 255, 60, 60, 180)
                    end

                    if dist < 1.2 and not laser.tripped and opts.tripAlarm ~= false then
                        laser.tripped = true
                        Framework.Notify(T('laserHit'), 'error')

                        local ref = locationRef(laser.location)
                        ref.stageId = laser.stage.id
                        TriggerServerEvent('XS-Robberies:server:laserTripped', ref)

                        SetTimeout(15000, function() laser.tripped = false end)
                    end
                end
            end
        end

        Wait(wait)
    end
end)

-- ── Guards report their own death ───────────────────────────────────────────

CreateThread(function()
    while true do
        for key, guard in pairs(guards) do
            if not guard.reported and DoesEntityExist(guard.ped) and IsPedDeadOrDying(guard.ped, true) then
                guard.reported = true

                local ref = locationRef(guard.location)
                ref.stageId = guard.stage.id
                TriggerServerEvent('XS-Robberies:server:guardDown', ref)
            end
        end
        Wait(1000)
    end
end)
