Anchors = {}
ModelRobberies = {}
ModelInstances = {}

local hashes = {}
local pools = { CObject = true }
local scanning = false
local lastList = nil

local POOLS = {
    object  = 'CObject',
    vehicle = 'CVehicle',
    ped     = 'CPed',
}

local function unsigned(hash)
    hash = math.tointeger(hash) or hash
    if type(hash) ~= 'number' then return nil end
    if hash < 0 then hash = hash + 4294967296 end
    return hash
end

local function modelKey(model)
    if type(model) == 'number' then return unsigned(model) end
    local numeric = tonumber(model)
    if numeric then return unsigned(numeric) end
    return unsigned(joaat(model))
end

local function rebuildHashes()
    hashes = {}
    pools = {}

    for _, def in ipairs(ModelRobberies) do
        for _, model in ipairs(def.models or {}) do
            local key = modelKey(model)
            if key then
                hashes[key] = hashes[key] or {}
                table.insert(hashes[key], def)
            end
        end

        local pool = POOLS[def.pool or 'object'] or 'CObject'
        pools[pool] = true
    end

    if next(pools) == nil then pools.CObject = true end
end

local function instanceId(robberyId, coords)
    return ('m:%s:%.1f_%.1f_%.1f'):format(robberyId, coords.x, coords.y, coords.z)
end

local function placer(def, anchor)
    local base = def.origin or { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
    local turn = math.rad(((anchor.h or 0.0) - (base.h or 0.0)) % 360)
    local cos, sin = math.cos(turn), math.sin(turn)

    return function(point)
        local vx = point.x - (base.x or 0.0)
        local vy = point.y - (base.y or 0.0)
        return {
            x = anchor.x + (vx * cos - vy * sin),
            y = anchor.y + (vx * sin + vy * cos),
            z = anchor.z + (point.z - (base.z or 0.0)),
            h = ((point.h or 0.0) + math.deg(turn)) % 360,
        }
    end
end

local function layoutProps(def, anchor, off)
    local place = placer(def, anchor)
    local props = {}

    for _, prop in ipairs(def.props or {}) do
        if prop.coords and prop.model and prop.model ~= '' then
            local link = prop.linkStage
            if link and off[link] then link = nil end

            props[#props + 1] = {
                id = prop.id,
                model = prop.model,
                linkStage = link,
                onDone = link and (prop.onDone or 'keep') or 'keep',
                swapModel = prop.swapModel,
                coords = place(prop.coords),
            }
        end
    end

    return props
end

local function layoutNpcs(def, anchor)
    local place = placer(def, anchor)
    local npcs = {}

    for _, npc in ipairs(def.npcs or {}) do
        if npc.coords and npc.model and npc.model ~= '' then
            npcs[#npcs + 1] = {
                id = npc.id,
                model = npc.model,
                scenario = npc.scenario,
                animDict = npc.animDict,
                animClip = npc.animClip,
                reaction = npc.reaction or 'cower',
                coords = place(npc.coords),
            }
        end
    end

    return npcs
end

local function layoutStages(def, anchor)
    local place = placer(def, anchor)

    local off = {}
    for _, stage in ipairs(def.stages or {}) do
        if stage.enabled == false then off[stage.id] = true end
    end

    local function keep(requires)
        local out = {}
        for _, id in ipairs(requires or {}) do
            if not off[id] then out[#out + 1] = id end
        end
        return out
    end

    local stages = {}
    for _, stage in ipairs(def.stages or {}) do
        if stage.coords and stage.enabled ~= false then
            stages[#stages + 1] = {
                id = stage.id,
                type = stage.type,
                label = stage.label,
                requires = keep(stage.requires),
                payout = stage.payout or {},
                opts = stage.opts or {},
                coords = place(stage.coords),
            }
        end
    end

    return stages, layoutProps(def, anchor, off), layoutNpcs(def, anchor)
end

local function pickDef(list, coords)
    local best, bestRadius, fallback = nil, math.huge, nil

    for _, def in ipairs(list) do
        local areas = def.areas or {}
        if #areas == 0 then
            fallback = fallback or def
        else
            for _, area in ipairs(areas) do
                local dx, dy = coords.x - (area.x or 0.0), coords.y - (area.y or 0.0)
                local radius = tonumber(area.radius) or 0.0
                if math.sqrt(dx * dx + dy * dy) <= radius and radius < bestRadius then
                    best, bestRadius = def, radius
                end
            end
        end
    end

    return best or fallback
end

local function scan()
    if #ModelRobberies == 0 then
        ModelInstances = {}
        return
    end

    local ped = PlayerPedId()
    local here = GetEntityCoords(ped)
    local found = {}

    local entities = {}
    for pool in pairs(pools) do
        for _, entity in ipairs(GetGamePool(pool)) do
            entities[#entities + 1] = entity
        end
    end

    for _, object in ipairs(entities) do
        local list = hashes[unsigned(GetEntityModel(object))]
        local coords = list and GetEntityCoords(object)
        local def = list and pickDef(list, coords)

        if def then
            if #(here - coords) <= (def.scanRange or 80.0) then
                local anchor = {
                    x = coords.x,
                    y = coords.y,
                    z = coords.z,
                    h = GetEntityHeading(object),
                }

                local id = instanceId(def.id, anchor)
                local stages, props, npcs = layoutStages(def, anchor)

                found[id] = {
                    id = id,
                    robberyId = def.id,
                    name = def.name,
                    label = def.name,
                    origin = anchor,
                    radius = def.radius or 30.0,
                    blip = def.blip or {},
                    entity = object,
                    modelAnchored = true,
                    needsContact = def.needsContact,
                    stages = stages,
                    props = props,
                    npcs = npcs,
                }
            end
        end
    end

    for id, instance in pairs(found) do
        if not ModelInstances[id] then
            ModelInstances[id] = instance
            Anchors.OnFound(instance)
        else
            ModelInstances[id].entity = instance.entity
        end
    end

    for id, instance in pairs(ModelInstances) do
        if not found[id] then
            Anchors.OnLost(instance)
            ModelInstances[id] = nil
        end
    end
end

function Anchors.OnFound(instance) end
function Anchors.OnLost(instance) end

RegisterNetEvent('XS-Robberies:client:modelRobberies', function(list)
    local signature = json.encode(list or {})
    if signature == lastList then return end
    lastList = signature

    for id, instance in pairs(ModelInstances) do
        Anchors.OnLost(instance)
        ModelInstances[id] = nil
    end

    ModelRobberies = list or {}
    rebuildHashes()

    if Config.Debug then
        print(('^2[XS-Robberies]^0 %d model-anchored robberies'):format(#ModelRobberies))
    end
end)

CreateThread(function()
    while true do
        if #ModelRobberies > 0 then
            if not scanning then
                scanning = true
                scan()
                scanning = false
            end
            Wait(2000)
        else
            Wait(5000)
        end
    end
end)
