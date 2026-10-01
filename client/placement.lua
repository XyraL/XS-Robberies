Placement = { active = false }

local cam, resolve
local ghost = { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
local snapToGround = false
local pinned = false
local mode = 'point'
local label = 'Point'
local colour = { 90, 162, 255 }
local radius = 10.0
local guided = nil
local layout = nil
local preview = { entity = nil, model = nil, ped = false, failed = false }
local pickEntity = false
local picked = nil
local keepCam = false

local CONTROLS = {
    forward = 32, back = 33, left = 34, right = 35,
    up = 44, down = 38,
    fast = 21, slow = 19,
    confirm = 191, cancel = 194, stop = 178,
    snap = 47, rotateL = 174, rotateR = 175,
    nudgeF = 172, nudgeB = 173,
    growZ = 10, shrinkZ = 11,
    grow = 241, shrink = 242,
    pin = 22,
    drop = 73,
    grid = 20,
    fine = 36,
}

local GRID_STEPS = { 0, 0.1, 0.25, 0.5, 1.0 }
local gridIndex = 1

local function snapToGrid(value)
    local step = GRID_STEPS[gridIndex]
    if not step or step <= 0 then return value end
    return math.floor(value / step + 0.5) * step
end

local function ignored()
    return PlayerPedId()
end

local function surfaceUnder(x, y, z)
    local ray = StartExpensiveSynchronousShapeTestLosProbe(
        x, y, z + 1.0, x, y, z - 4.0, -1, ignored(), 4)
    local _, hit, endCoords = GetShapeTestResult(ray)

    if hit == 1 then return endCoords.z end
    return nil
end

local function camForward()
    local rot = GetCamRot(cam, 2)
    local pitch, yaw = math.rad(rot.x), math.rad(rot.z)
    local cosP = math.abs(math.cos(pitch))
    return vector3(-math.sin(yaw) * cosP, math.cos(yaw) * cosP, math.sin(pitch))
end

local function aimPoint(distance)
    local pos = GetCamCoord(cam)
    local dir = camForward()
    local target = pos + dir * distance

    local ray = StartExpensiveSynchronousShapeTestLosProbe(
        pos.x, pos.y, pos.z, target.x, target.y, target.z, -1, ignored(), 4)
    local _, hit, endCoords, _, entity = GetShapeTestResult(ray)

    if hit == 1 then return endCoords, true, entity end
    return target, false, 0
end

local function nearestEntity(point)
    local best, bestDist = nil, 2.5
    for _, pool in ipairs({ 'CObject', 'CVehicle' }) do
        for _, entity in ipairs(GetGamePool(pool)) do
            local dist = #(GetEntityCoords(entity) - point)
            if dist < bestDist then best, bestDist = entity, dist end
        end
    end
    return best
end

local function text(str, x, y, scale, r, g, b, a, centre)
    SetTextFont(4)
    SetTextScale(scale, scale)
    SetTextColour(r, g, b, a)
    SetTextCentre(centre ~= false)
    SetTextDropshadow(0, 0, 0, 0, 200)
    SetTextEdge(1, 0, 0, 0, 180)
    SetTextEntry('STRING')
    AddTextComponentSubstringPlayerName(str)
    DrawText(x, y)
end

local function drawHeader()
    local top = guided and 0.063 or 0.055
    local height = guided and 0.09 or 0.062

    DrawRect(0.5, top, 0.38, height, 5, 9, 20, 215)
    DrawRect(0.5, top + height / 2, 0.38, 0.002, colour[1], colour[2], colour[3], 255)

    if guided then
        text(('STEP %d OF %d'):format(guided.step or 1, guided.total or 1), 0.5, 0.024, 0.26, 124, 196, 255, 255)
        text(string.upper(guided.title or label), 0.5, 0.041, 0.46, 235, 242, 255, 255)
        text(guided.subtitle or '', 0.5, 0.079, 0.3, 150, 168, 200, 255)
        return
    end

    text(pickEntity and 'AIM AT IT' or ('PLACING  ' .. string.upper(label)), 0.5, 0.036, 0.44, colour[1], colour[2], colour[3], 255)

    local grid = GRID_STEPS[gridIndex]
    text(('%.2f  %.2f  %.2f   facing %d°   %s   grid %s')
        :format(ghost.x, ghost.y, ghost.z, math.floor(ghost.h),
            pinned and 'PINNED' or 'following view',
            (grid and grid > 0) and (('%.2fm'):format(grid)) or 'off'), 0.5, 0.062, 0.3, 150, 158, 176, 255)
end

local function hintLine()
    if pickEntity then
        return guided and 'WASD fly   aim at it   ENTER pick   BACKSPACE skip   DEL stop setup'
            or 'WASD fly   aim at it   ENTER pick   BACKSPACE cancel'
    end

    local base = mode == 'zone'
        and 'WASD fly   SPACE pin   arrows nudge   scroll radius'
        or 'WASD fly   ALT slow   SPACE pin   X drop   Z grid   arrows nudge   PgUp/PgDn raise   scroll turn'

    if guided then
        if guided.repeating then
            return base .. '   ENTER place   BACKSPACE that is all   DEL stop setup'
        end
        return base .. (guided.skippable == false and '   ENTER place   DEL stop setup'
            or '   ENTER place   BACKSPACE skip   DEL stop setup')
    end

    return base .. '   ENTER place   BACKSPACE cancel'
end

local function drawBox(entity, r, g, b)
    local min, max = GetModelDimensions(GetEntityModel(entity))
    local corners = {}
    for _, cx in ipairs({ min.x, max.x }) do
        for _, cy in ipairs({ min.y, max.y }) do
            for _, cz in ipairs({ min.z, max.z }) do
                corners[#corners + 1] = GetOffsetFromEntityInWorldCoords(entity, cx, cy, cz)
            end
        end
    end

    local edges = { {1,2},{3,4},{5,6},{7,8},{1,3},{2,4},{5,7},{6,8},{1,5},{2,6},{3,7},{4,8} }
    for _, e in ipairs(edges) do
        local a, c = corners[e[1]], corners[e[2]]
        DrawLine(a.x, a.y, a.z, c.x, c.y, c.z, r, g, b, 255)
    end
end

local function drawLayout()
    if not layout or not layout.base then return end

    local base = layout.base
    local turn = math.rad(((ghost.h or 0.0) - (base.h or 0.0)) % 360)
    local cos, sin = math.cos(turn), math.sin(turn)

    for _, point in ipairs(layout.points or {}) do
        local vx, vy = point.x - base.x, point.y - base.y
        local x = ghost.x + (vx * cos - vy * sin)
        local y = ghost.y + (vx * sin + vy * cos)
        local z = ghost.z + (point.z - base.z)
        local c = point.colour or colour

        DrawMarker(28, x, y, z + 0.12, 0, 0, 0, 0, 0, 0, 0.14, 0.14, 0.14,
            c[1], c[2], c[3], 190, false, false, 2, false, nil, nil, false)
        DrawLine(ghost.x, ghost.y, ghost.z + 0.1, x, y, z + 0.1, c[1], c[2], c[3], 70)

        local onScreen, sx, sy = World3dToScreen2d(x, y, z + 0.5)
        if onScreen then text(point.label or '', sx, sy, 0.28, c[1], c[2], c[3], 230) end
    end
end

local function drawGhost()
    local r, g, b = colour[1], colour[2], colour[3]

    if pickEntity then
        if picked and DoesEntityExist(picked) then
            drawBox(picked, r, g, b)
            local at = GetEntityCoords(picked)
            local _, top = GetModelDimensions(GetEntityModel(picked))
            DrawMarker(2, at.x, at.y, at.z + top.z + 0.5, 0, 0, 0, 180.0, 0, 0, 0.3, 0.3, 0.3,
                r, g, b, 220, true, false, 2, false, nil, nil, false)
        end
        return
    end

    if mode == 'zone' then
        DrawMarker(1, ghost.x, ghost.y, ghost.z - 1.0, 0, 0, 0, 0, 0, 0,
            radius * 2, radius * 2, 2.0, r, g, b, 70, false, false, 2, false, nil, nil, false)
    end

    if preview.entity and DoesEntityExist(preview.entity) then
        if preview.ped then
            SetEntityCoords(preview.entity, ghost.x, ghost.y, ghost.z, false, false, false, false)
        else
            SetEntityCoordsNoOffset(preview.entity, ghost.x, ghost.y, ghost.z, false, false, false)
        end
        SetEntityHeading(preview.entity, ghost.h)
    else
        DrawMarker(28, ghost.x, ghost.y, ghost.z + 0.15, 0, 0, 0, 0, 0, 0,
            0.18, 0.18, 0.18, r, g, b, 210, false, false, 2, false, nil, nil, false)
        DrawLine(ghost.x, ghost.y, ghost.z, ghost.x, ghost.y, ghost.z + 1.9, r, g, b, 200)
        DrawMarker(28, ghost.x, ghost.y, ghost.z + 1.9, 0, 0, 0, 0, 0, 0,
            0.06, 0.06, 0.06, r, g, b, 150, false, false, 2, false, nil, nil, false)
        DrawMarker(21, ghost.x, ghost.y, ghost.z + 1.25, 0, 0, 0, 0, 0, 0,
            0.5, 0.5, 0.5, r, g, b, 120, true, false, 2, false, nil, nil, false)
    end

    local floor = surfaceUnder(ghost.x, ghost.y, ghost.z)
    if floor then
        DrawMarker(25, ghost.x, ghost.y, floor + 0.02, 0, 0, 0, 0, 0, 0,
            0.55, 0.55, 0.55, r, g, b, 80, false, false, 2, false, nil, nil, false)
    end

    local hx = ghost.x + math.sin(math.rad(-ghost.h)) * 2.0
    local hy = ghost.y + math.cos(math.rad(-ghost.h)) * 2.0
    DrawLine(ghost.x, ghost.y, ghost.z + 0.1, hx, hy, ghost.z + 0.1, r, g, b, 255)
    DrawMarker(28, hx, hy, ghost.z + 0.1, 0, 0, 0, 0, 0, 0,
        0.08, 0.08, 0.08, r, g, b, 200, false, false, 2, false, nil, nil, false)

    drawLayout()
end

local function clearPreview()
    if preview.entity and DoesEntityExist(preview.entity) then
        DeleteEntity(preview.entity)
    end
    preview.entity, preview.model, preview.ped = nil, nil, false
end

local function makePreview(model)
    clearPreview()
    if not model or model == '' then return end

    local hash = type(model) == 'number' and model or (tonumber(model) or joaat(model))
    if not IsModelValid(hash) then
        preview.failed = true
        return
    end

    RequestModel(hash)
    local waited = 0
    while not HasModelLoaded(hash) and waited < 3000 do
        Wait(25)
        waited = waited + 25
    end
    if not HasModelLoaded(hash) then
        preview.failed = true
        return
    end

    local isPed = IsModelAPed(hash)
    local entity
    if isPed then
        entity = CreatePed(4, hash, ghost.x, ghost.y, ghost.z, ghost.h, false, false)
        SetBlockingOfNonTemporaryEvents(entity, true)
        SetEntityInvincible(entity, true)
    else
        entity = CreateObjectNoOffset(hash, ghost.x, ghost.y, ghost.z, false, false, false)
    end

    SetEntityCollision(entity, false, false)
    SetEntityAlpha(entity, 185, false)
    FreezeEntityPosition(entity, true)
    SetEntityHeading(entity, ghost.h)
    SetModelAsNoLongerNeeded(hash)

    preview.entity, preview.model, preview.ped = entity, model, isPed
end

local function stopCam()
    RenderScriptCams(false, true, 320, true, true)
    if cam then
        SetCamActive(cam, false)
        DestroyCam(cam, true)
        cam = nil
    end
    ClearFocus()
    FreezeEntityPosition(PlayerPedId(), false)
end

local function finish(result)
    if not Placement.active then return end
    Placement.active = false
    clearPreview()

    if not keepCam or not result or result.action == 'stop' or result.action == 'cancel' then
        stopCam()
    end

    local done = resolve
    resolve = nil
    if done then done(result) end
end

function Placement.Abort()
    if Placement.active then finish({ action = 'cancel' }) end
    Placement.EndSession()
end

function Placement.EndSession()
    keepCam = false
    if not Placement.active and cam then stopCam() end
end

local function pickResult(entity)
    local coords = GetEntityCoords(entity)
    local model = GetEntityModel(entity)
    return {
        x = math.floor(coords.x * 1000 + 0.5) / 1000,
        y = math.floor(coords.y * 1000 + 0.5) / 1000,
        z = math.floor(coords.z * 1000 + 0.5) / 1000,
        h = math.floor(GetEntityHeading(entity) * 10 + 0.5) / 10,
        model = model,
        vehicle = IsEntityAVehicle(entity),
        name = IsEntityAVehicle(entity) and string.lower(GetDisplayNameFromVehicleModel(model) or '') or nil,
    }
end

function Placement.Start(opts)
    if Placement.active then return nil end

    opts = opts or {}
    mode = opts.mode or 'point'
    label = opts.label or 'Point'
    colour = opts.colour or { 90, 162, 255 }
    radius = opts.radius or 10.0
    guided = opts.guided
    layout = opts.layout
    pickEntity = opts.pickEntity == true
    picked = nil
    keepCam = opts.session == true
    pinned = false

    if opts.snapToGround ~= nil then
        snapToGround = opts.snapToGround
    else
        snapToGround = Config.Builder.SnapToGround == true
    end

    local ped = PlayerPedId()
    local start = opts.origin and vector3(opts.origin.x, opts.origin.y, opts.origin.z) or GetEntityCoords(ped)

    ghost = { x = start.x, y = start.y, z = start.z, h = opts.origin and opts.origin.h or GetEntityHeading(ped) }

    if not cam then
        cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
        SetCamCoord(cam, start.x, start.y, start.z + 2.0)
        SetCamRot(cam, -15.0, 0.0, GetEntityHeading(ped), 2)
        SetCamFov(cam, 60.0)
        SetCamActive(cam, true)
        RenderScriptCams(true, true, 320, true, true)
    end

    FreezeEntityPosition(ped, true)
    Placement.active = true

    preview.failed = false
    if opts.previewModel and not pickEntity then makePreview(opts.previewModel) end

    local p = promise.new()
    resolve = function(value) p:resolve(value) end

    CreateThread(function()
        local speeds = Config.Builder.CameraSpeed
        local nudge = Config.Builder.NudgeStep
        local manual = false

        while Placement.active do
            local dt = GetFrameTime()

            DisableAllControlActions(0)
            EnableControlAction(0, CONTROLS.confirm, true)
            EnableControlAction(0, CONTROLS.cancel, true)
            EnableControlAction(0, CONTROLS.stop, true)

            local pos = GetCamCoord(cam)
            local rot = GetCamRot(cam, 2)

            local dx = GetDisabledControlNormal(0, 1) * 6.0
            local dy = GetDisabledControlNormal(0, 2) * 6.0
            local newPitch = math.max(-89.0, math.min(89.0, rot.x - dy))
            SetCamRot(cam, newPitch, 0.0, rot.z - dx, 2)

            local speed = speeds.normal
            if IsDisabledControlPressed(0, CONTROLS.fast) then speed = speeds.fast end
            if IsDisabledControlPressed(0, CONTROLS.slow) then speed = speeds.slow end
            speed = speed * dt

            local fwd = camForward()
            local right = vector3(-fwd.y, fwd.x, 0.0)
            local move = vector3(0.0, 0.0, 0.0)

            if IsDisabledControlPressed(0, CONTROLS.forward) then move = move + fwd end
            if IsDisabledControlPressed(0, CONTROLS.back)    then move = move - fwd end
            if IsDisabledControlPressed(0, CONTROLS.right)   then move = move + right end
            if IsDisabledControlPressed(0, CONTROLS.left)    then move = move - right end
            if IsDisabledControlPressed(0, CONTROLS.up)      then move = move + vector3(0.0, 0.0, 1.0) end
            if IsDisabledControlPressed(0, CONTROLS.down)    then move = move - vector3(0.0, 0.0, 1.0) end

            if #move > 0.0 then
                pos = pos + move * speed
                SetCamCoord(cam, pos.x, pos.y, pos.z)
                if not pinned then manual = false end
            end

            SetFocusPosAndVel(pos.x, pos.y, pos.z, 0.0, 0.0, 0.0)

            if pickEntity then
                local hit, didHit, entity = aimPoint(Config.Builder.PlacementRange)
                local candidate = nil

                if didHit and entity and entity ~= 0 and DoesEntityExist(entity)
                    and (IsEntityAnObject(entity) or IsEntityAVehicle(entity)) then
                    candidate = entity
                elseif didHit then
                    candidate = nearestEntity(hit)
                end

                picked = candidate
            elseif not manual and not pinned then
                local hit = aimPoint(Config.Builder.PlacementRange)
                ghost.x, ghost.y, ghost.z = snapToGrid(hit.x), snapToGrid(hit.y), hit.z

                if snapToGround then
                    local found, groundZ = GetGroundZFor_3dCoord(ghost.x, ghost.y, ghost.z + 1.0, false)
                    if found and math.abs(ghost.z - groundZ) <= 1.5 then
                        ghost.z = groundZ
                    end
                end
            end

            if not pickEntity then
                if IsDisabledControlJustPressed(0, CONTROLS.snap) then
                    snapToGround = not snapToGround
                end

                if IsDisabledControlJustPressed(0, CONTROLS.pin) then
                    pinned = not pinned
                    if pinned then manual = true end
                end

                if IsDisabledControlJustPressed(0, CONTROLS.grid) then
                    gridIndex = gridIndex % #GRID_STEPS + 1
                    ghost.x, ghost.y = snapToGrid(ghost.x), snapToGrid(ghost.y)
                    manual = true
                    pinned = true
                end

                if IsDisabledControlJustPressed(0, CONTROLS.drop) then
                    local floor = surfaceUnder(ghost.x, ghost.y, ghost.z)
                    if floor then
                        ghost.z = floor
                        manual = true
                        pinned = true
                    end
                end

                local step = IsDisabledControlPressed(0, CONTROLS.fine) and (nudge / 10) or nudge

                if IsDisabledControlPressed(0, CONTROLS.nudgeF) then ghost.y = ghost.y + step manual = true end
                if IsDisabledControlPressed(0, CONTROLS.nudgeB) then ghost.y = ghost.y - step manual = true end
                if IsDisabledControlPressed(0, CONTROLS.rotateL) then ghost.x = ghost.x - step manual = true end
                if IsDisabledControlPressed(0, CONTROLS.rotateR) then ghost.x = ghost.x + step manual = true end
                if IsDisabledControlPressed(0, CONTROLS.growZ) then ghost.z = ghost.z + step manual = true end
                if IsDisabledControlPressed(0, CONTROLS.shrinkZ) then ghost.z = ghost.z - step manual = true end

                if mode == 'zone' then
                    if IsDisabledControlPressed(0, CONTROLS.grow) then radius = math.min(300.0, radius + 0.5) end
                    if IsDisabledControlPressed(0, CONTROLS.shrink) then radius = math.max(1.0, radius - 0.5) end
                else
                    if IsDisabledControlPressed(0, CONTROLS.grow) then ghost.h = (ghost.h + 2.0) % 360 end
                    if IsDisabledControlPressed(0, CONTROLS.shrink) then ghost.h = (ghost.h - 2.0) % 360 end
                end
            end

            drawGhost()
            Markers.DrawEditorPoints(ghost)
            drawHeader()
            text(hintLine(), 0.5, 0.92, 0.32, 225, 233, 248, 225)

            if IsControlJustPressed(0, CONTROLS.confirm) then
                if pickEntity then
                    if picked and DoesEntityExist(picked) then
                        local result = pickResult(picked)
                        result.action = 'placed'
                        finish(result)
                        break
                    end
                else
                    finish({
                        action = 'placed',
                        previewFailed = preview.failed == true,
                        x = math.floor(ghost.x * 1000 + 0.5) / 1000,
                        y = math.floor(ghost.y * 1000 + 0.5) / 1000,
                        z = math.floor(ghost.z * 1000 + 0.5) / 1000,
                        h = math.floor(ghost.h * 10 + 0.5) / 10,
                        radius = mode == 'zone' and (math.floor(radius * 10 + 0.5) / 10) or nil,
                    })
                    break
                end
            end

            if guided and IsDisabledControlJustPressed(0, CONTROLS.stop) then
                finish({ action = 'stop' })
                break
            end

            if IsControlJustPressed(0, CONTROLS.cancel) then
                if guided and guided.skippable == false and not guided.repeating then
                    finish({ action = 'stop' })
                else
                    finish({ action = guided and 'skip' or 'cancel' })
                end
                break
            end

            Wait(0)
        end
    end)

    return Citizen.Await(p)
end
