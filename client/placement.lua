Placement = { active = false }

local cam, resolve
local ghost = { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
local snapToGround = false
local pinned = false
local mode = 'point'
local label = 'Point'
local colour = { 25, 229, 140 }
local radius = 10.0

local CONTROLS = {
    forward = 32, back = 33, left = 34, right = 35,
    up = 44, down = 38,
    fast = 21, slow = 19,
    confirm = 191, cancel = 194,
    snap = 47, rotateL = 174, rotateR = 175,
    nudgeF = 172, nudgeB = 173,
    growZ = 10, shrinkZ = 11,
    grow = 241, shrink = 242,
    pin = 22,        -- SPACE, stop the point following your view
    drop = 73,       -- X, drop it onto whatever is underneath
    grid = 20,       -- Z, cycle grid snapping
    fine = 36,       -- CTRL, ten times finer nudging
}

local GRID_STEPS = { 0, 0.1, 0.25, 0.5, 1.0 }
local gridIndex = 1

local function snapToGrid(value)
    local step = GRID_STEPS[gridIndex]
    if not step or step <= 0 then return value end
    return math.floor(value / step + 0.5) * step
end

-- A straight probe downwards finds the floor you are actually standing over,
-- including inside a building. GetGroundZFor_3dCoord cannot do that.
local function surfaceUnder(x, y, z)
    local ray = StartExpensiveSynchronousShapeTestLosProbe(
        x, y, z + 1.0, x, y, z - 4.0, -1, PlayerPedId(), 4)
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
        pos.x, pos.y, pos.z, target.x, target.y, target.z, -1, PlayerPedId(), 4)
    local _, hit, endCoords = GetShapeTestResult(ray)

    if hit == 1 then return endCoords, true end
    return target, false
end

local function drawHint(text)
    SetTextFont(4)
    SetTextScale(0.34, 0.34)
    SetTextColour(235, 240, 245, 220)
    SetTextDropshadow(0, 0, 0, 0, 210)
    SetTextEdge(1, 0, 0, 0, 200)
    SetTextEntry('STRING')
    AddTextComponentSubstringPlayerName(text)
    DrawText(0.5, 0.92)
end

local function drawHeader()
    DrawRect(0.5, 0.055, 0.34, 0.062, 8, 10, 11, 200)
    DrawRect(0.5, 0.0855, 0.34, 0.002, colour[1], colour[2], colour[3], 255)

    SetTextFont(4)
    SetTextScale(0.44, 0.44)
    SetTextColour(colour[1], colour[2], colour[3], 255)
    SetTextCentre(true)
    SetTextEntry('STRING')
    AddTextComponentSubstringPlayerName('PLACING  ' .. string.upper(label))
    DrawText(0.5, 0.036)

    SetTextFont(4)
    SetTextScale(0.3, 0.3)
    SetTextColour(150, 158, 166, 255)
    SetTextCentre(true)
    SetTextEntry('STRING')
    local grid = GRID_STEPS[gridIndex]
    AddTextComponentSubstringPlayerName(('%.2f  %.2f  %.2f   facing %d°   %s   grid %s')
        :format(ghost.x, ghost.y, ghost.z, math.floor(ghost.h),
            pinned and 'PINNED' or 'following view',
            (grid and grid > 0) and (('%.2fm'):format(grid)) or 'off'))
    DrawText(0.5, 0.062)
end

local function drawGhost()
    local r, g, b = colour[1], colour[2], colour[3]

    if mode == 'zone' then
        DrawMarker(1, ghost.x, ghost.y, ghost.z - 1.0, 0, 0, 0, 0, 0, 0,
            radius * 2, radius * 2, 2.0, r, g, b, 70, false, false, 2, false, nil, nil, false)
    end

    DrawMarker(28, ghost.x, ghost.y, ghost.z + 0.15, 0, 0, 0, 0, 0, 0,
        0.18, 0.18, 0.18, r, g, b, 210, false, false, 2, false, nil, nil, false)

    -- A person-high column, so a point buried in the floor or poking through a
    -- ceiling is obvious before you commit to it.
    DrawLine(ghost.x, ghost.y, ghost.z, ghost.x, ghost.y, ghost.z + 1.9, r, g, b, 200)
    DrawMarker(28, ghost.x, ghost.y, ghost.z + 1.9, 0, 0, 0, 0, 0, 0,
        0.06, 0.06, 0.06, r, g, b, 150, false, false, 2, false, nil, nil, false)

    local floor = surfaceUnder(ghost.x, ghost.y, ghost.z)
    if floor then
        DrawMarker(25, ghost.x, ghost.y, floor + 0.02, 0, 0, 0, 0, 0, 0,
            0.55, 0.55, 0.55, r, g, b, 80, false, false, 2, false, nil, nil, false)
    end
    DrawMarker(21, ghost.x, ghost.y, ghost.z + 1.25, 0, 0, 0, 0, 0, 0,
        0.5, 0.5, 0.5, r, g, b, 120, true, false, 2, false, nil, nil, false)

    local hx = ghost.x + math.sin(math.rad(-ghost.h)) * 2.0
    local hy = ghost.y + math.cos(math.rad(-ghost.h)) * 2.0
    DrawLine(ghost.x, ghost.y, ghost.z + 0.1, hx, hy, ghost.z + 0.1, r, g, b, 255)
    DrawMarker(28, hx, hy, ghost.z + 0.1, 0, 0, 0, 0, 0, 0,
        0.08, 0.08, 0.08, r, g, b, 200, false, false, 2, false, nil, nil, false)
end

local function stopCam()
    RenderScriptCams(false, true, 320, true, true)
    if cam then
        SetCamActive(cam, false)
        DestroyCam(cam, true)
        cam = nil
    end
    ClearFocus()
    SetEntityVisible(PlayerPedId(), true, false)
    FreezeEntityPosition(PlayerPedId(), false)
end

local function finish(result)
    if not Placement.active then return end
    Placement.active = false
    stopCam()

    local done = resolve
    resolve = nil
    if done then done(result) end
end

function Placement.Abort()
    if Placement.active then finish(nil) end
end

function Placement.Start(opts)
    if Placement.active then return nil end

    opts = opts or {}
    mode = opts.mode or 'point'
    label = opts.label or 'Point'
    colour = opts.colour or { 25, 229, 140 }
    radius = opts.radius or 10.0
    pinned = false

    if opts.snapToGround ~= nil then
        snapToGround = opts.snapToGround
    else
        snapToGround = Config.Builder.SnapToGround == true
    end

    local ped = PlayerPedId()
    local start = opts.origin and vector3(opts.origin.x, opts.origin.y, opts.origin.z) or GetEntityCoords(ped)

    ghost = { x = start.x, y = start.y, z = start.z, h = opts.origin and opts.origin.h or GetEntityHeading(ped) }

    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamCoord(cam, start.x, start.y, start.z + 2.0)
    SetCamRot(cam, -15.0, 0.0, GetEntityHeading(ped), 2)
    SetCamFov(cam, 60.0)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 320, true, true)

    FreezeEntityPosition(ped, true)
    Placement.active = true

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

            if not manual and not pinned then
                local hit = aimPoint(Config.Builder.PlacementRange)
                ghost.x, ghost.y, ghost.z = snapToGrid(hit.x), snapToGrid(hit.y), hit.z

                if snapToGround then
                    local found, groundZ = GetGroundZFor_3dCoord(ghost.x, ghost.y, ghost.z + 1.0, false)

                    -- Terrain height ignores interior floors, kerbs and anything
                    -- raised. A big drop means it punched through what you were
                    -- looking at, so keep the surface the ray actually hit.
                    if found and math.abs(ghost.z - groundZ) <= 1.5 then
                        ghost.z = groundZ
                    end
                end
            end

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

            -- Drop it onto whatever is directly underneath. This is the one for
            -- a ped: aim roughly, then X puts their feet on the floor.
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

            drawGhost()
            Markers.DrawEditorPoints(ghost)
            drawHeader()
            drawHint(mode == 'zone'
                and 'WASD fly   Q/E height   SPACE pin   arrows nudge   scroll radius   ENTER place   BACKSPACE cancel'
                or  'WASD fly   ALT slow   SPACE pin   X drop to floor   Z grid   CTRL fine   arrows nudge   PgUp/PgDn raise   scroll to aim   ENTER place')

            if IsControlJustPressed(0, CONTROLS.confirm) then
                finish({
                    x = math.floor(ghost.x * 1000 + 0.5) / 1000,
                    y = math.floor(ghost.y * 1000 + 0.5) / 1000,
                    z = math.floor(ghost.z * 1000 + 0.5) / 1000,
                    h = math.floor(ghost.h * 10 + 0.5) / 10,
                    radius = mode == 'zone' and (math.floor(radius * 10 + 0.5) / 10) or nil,
                })
                break
            end

            if IsControlJustPressed(0, CONTROLS.cancel) then
                finish(nil)
                break
            end

            Wait(0)
        end
    end)

    return Citizen.Await(p)
end
