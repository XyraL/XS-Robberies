Markers = { stages = {}, colours = {} }

local drawing = false

function Markers.SetStages(stages, catalogue)
    Markers.stages = stages or {}

    if catalogue then
        Markers.colours = {}
        for _, entry in ipairs(catalogue) do
            Markers.colours[entry.id] = entry.colour or { 25, 229, 140 }
        end
    end

    if #Markers.stages > 0 then Markers.Start() else Markers.Clear() end
end

function Markers.Clear()
    Markers.stages = {}
    drawing = false
end

local function colourFor(stage)
    return Markers.colours[stage.type] or { 25, 229, 140 }
end

local function drawLabel(stage, colour)
    local coords = stage.coords
    local onScreen, sx, sy = World3dToScreen2d(coords.x, coords.y, coords.z + 1.4)
    if not onScreen then return end

    SetTextFont(4)
    SetTextScale(0.3, 0.3)
    SetTextColour(colour[1], colour[2], colour[3], 255)
    SetTextCentre(true)
    SetTextDropshadow(0, 0, 0, 0, 200)
    SetTextEdge(1, 0, 0, 0, 180)
    SetTextEntry('STRING')
    AddTextComponentSubstringPlayerName(stage.label or stage.type)
    DrawText(sx, sy)
end

function Markers.DrawEditorPoints(exclude)
    for _, stage in ipairs(Markers.stages) do
        local c = stage.coords
        if c and not (exclude and math.abs(c.x - exclude.x) < 0.01 and math.abs(c.y - exclude.y) < 0.01) then
            local col = colourFor(stage)
            DrawMarker(28, c.x, c.y, c.z + 0.12, 0, 0, 0, 0, 0, 0,
                0.13, 0.13, 0.13, col[1], col[2], col[3], 150, false, false, 2, false, nil, nil, false)
            drawLabel(stage, col)
        end
    end

    local byId = {}
    for _, stage in ipairs(Markers.stages) do byId[stage.id] = stage end

    for _, stage in ipairs(Markers.stages) do
        if stage.coords then
            for _, dep in ipairs(stage.requires or {}) do
                local from = byId[dep]
                if from and from.coords then
                    local col = colourFor(stage)
                    DrawLine(from.coords.x, from.coords.y, from.coords.z + 0.3,
                        stage.coords.x, stage.coords.y, stage.coords.z + 0.3,
                        col[1], col[2], col[3], 90)
                end
            end
        end
    end
end

function Markers.Start()
    if drawing then return end
    drawing = true

    CreateThread(function()
        while drawing and #Markers.stages > 0 do
            if not Placement.active then
                Markers.DrawEditorPoints(nil)
            end
            Wait(0)
        end
        drawing = false
    end)
end
