Anchors = {}
ModelRobberies = {}
ModelInstances = {}

local hashes = {}
local pools = { CObject = true }
local scanning = false

local POOLS = {
    object  = 'CObject',
    vehicle = 'CVehicle',
    ped     = 'CPed',
}

local function rebuildHashes()
    hashes = {}
    pools = {}

    for _, def in ipairs(ModelRobberies) do
        for _, model in ipairs(def.models or {}) do
            hashes[joaat(model)] = def
        end

        local pool = POOLS[def.pool or 'object'] or 'CObject'
        pools[pool] = true
    end

    if next(pools) == nil then pools.CObject = true end
end

local function instanceId(robberyId, coords)
    return ('m:%s:%.1f_%.1f_%.1f'):format(robberyId, coords.x, coords.y, coords.z)
end

local function layoutStages(def, anchor)
    local base = def.origin or { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
    local turn = math.rad(((anchor.h or 0.0) - (base.h or 0.0)) % 360)
    local cos, sin = math.cos(turn), math.sin(turn)

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
            local vx = stage.coords.x - (base.x or 0.0)
            local vy = stage.coords.y - (base.y or 0.0)

            stages[#stages + 1] = {
                id = stage.id,
                type = stage.type,
                label = stage.label,
                requires = keep(stage.requires),
                payout = stage.payout or {},
                opts = stage.opts or {},
                coords = {
                    x = anchor.x + (vx * cos - vy * sin),
                    y = anchor.y + (vx * sin + vy * cos),
                    z = anchor.z + (stage.coords.z - (base.z or 0.0)),
                    h = ((stage.coords.h or 0.0) + math.deg(turn)) % 360,
                },
            }
        end
    end

    return stages
end

-- Every matching prop in the world is its own robbery. Nothing is stamped and
-- nothing is stored: walk up to an ATM and it is there.
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
        local def = hashes[GetEntityModel(object)]

        if def then
            local coords = GetEntityCoords(object)

            if #(here - coords) <= (def.scanRange or 80.0) then
                local anchor = {
                    x = coords.x,
                    y = coords.y,
                    z = coords.z,
                    h = GetEntityHeading(object),
                }

                local id = instanceId(def.id, anchor)

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
                    stages = layoutStages(def, anchor),
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
