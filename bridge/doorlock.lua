Doors = { name = nil, providers = {}, builtin = {} }

if not Config then return end
if not IsDuplicityVersion() then return end

local forced = Config.Bridges and Config.Bridges.doorlock or 'auto'

local function started(resource)
    return GetResourceState(resource) == 'started'
end

local function anyPlayer(preferred)
    if preferred and GetPlayerName(preferred) then return preferred end
    for _, id in ipairs(GetPlayers()) do return tonumber(id) end
    return nil
end

local function gap(a, b)
    local dx = (a.x or 0.0) - (b.x or 0.0)
    local dy = (a.y or 0.0) - (b.y or 0.0)
    local dz = (a.z or 0.0) - (b.z or 0.0)
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function nearest(door, list, coordsOf)
    local best, bestGap = nil, 1.6
    for _, entry in pairs(list or {}) do
        for _, at in ipairs(coordsOf(entry)) do
            local d = gap(at, door)
            if d < bestGap then best, bestGap = entry, d end
        end
    end
    return best
end

function Doors.RegisterProvider(name, provider)
    Doors.providers[name] = provider
    if forced == name or (forced == 'auto' and not Doors.name and provider.available and provider.available()) then
        Doors.name = name
    end
end

local ORDER = {
    'ox_doorlock', 'mri_Qdoorlock', 'qb-doorlock', 'rcore_doorlock',
    'qs-doorlock-creator', 'doors_creator', 'cd_doorlock',
}

local function oxProvider(resource)
    local function idFor(id)
        local number = tonumber(id)
        if number then return number end
        local door = exports[resource]:getDoorFromName(id)
        return door and door.id or nil
    end

    return {
        available = function() return started(resource) end,
        setState = function(id, locked)
            local doorId = idFor(id)
            if not doorId then return false end
            return exports[resource]:setDoorState(doorId, locked and 1 or 0) ~= false
        end,
        find = function(door)
            local hit = nearest(door, exports[resource]:getAllDoors(), function(entry)
                return { entry.coords or {} }
            end)
            return hit and hit.id or nil
        end,
    }
end

Doors.RegisterProvider('ox_doorlock', oxProvider('ox_doorlock'))
Doors.RegisterProvider('mri_Qdoorlock', oxProvider('mri_Qdoorlock'))

Doors.RegisterProvider('qb-doorlock', {
    available = function() return started('qb-doorlock') end,
    setState = function(id, locked, src)
        local player = anyPlayer(src)
        if not player then return false end
        TriggerEvent('qb-doorlock:server:updateState', tonumber(id) or id, locked == true,
            false, false, true, true, false, player)
        return true
    end,
})

Doors.RegisterProvider('rcore_doorlock', {
    available = function() return started('rcore_doorlock') end,
    setState = function(id, locked)
        local state = locked and 1 or 0
        if exports.rcore_doorlock:changeDoorState(id, state) then return true end
        local number = tonumber(id)
        return number ~= nil and exports.rcore_doorlock:changeDoorState(number, state) == true
    end,
    find = function(door)
        local hit = nearest(door, exports.rcore_doorlock:getLoadedDoors(), function(entry)
            return { entry.coords or {} }
        end)
        return hit and hit.id or nil
    end,
})

Doors.RegisterProvider('qs-doorlock-creator', {
    available = function() return started('qs-doorlock-creator') end,
    setState = function(id, locked)
        return exports['qs-doorlock-creator']:SetDoorState(tonumber(id) or id, locked == true) ~= false
    end,
})

Doors.RegisterProvider('doors_creator', {
    available = function() return started('doors_creator') end,
    setState = function(id, locked)
        exports.doors_creator:setDoorState(tonumber(id) or id, locked and 1 or 0)
        return true
    end,
    find = function(door)
        local hit = nearest(door, exports.doors_creator:getAllDoors(), function(entry)
            local out = {}
            for _, part in ipairs(entry.doors or {}) do out[#out + 1] = part.coords or {} end
            return out
        end)
        return hit and hit.id or nil
    end,
})

Doors.RegisterProvider('cd_doorlock', {
    available = function() return started('cd_doorlock') end,
    setState = function(id, locked, src)
        local player = anyPlayer(src)
        if not player then return false end
        TriggerClientEvent('cd_doorlock:SetDoorState_uniqueid', player, locked == true, tostring(id))
        return true
    end,
})

local function pick()
    if forced == 'none' then return nil end
    if forced ~= 'auto' then return Doors.providers[forced] and forced or nil end

    for _, name in ipairs(ORDER) do
        local provider = Doors.providers[name]
        if provider and provider.available() then return name end
    end
end

Doors.name = pick()

AddEventHandler('onResourceStart', function(resource)
    if forced == 'auto' and not Doors.name and Doors.providers[resource] then
        Doors.name = pick()
    end
end)

function Doors.Available()
    local provider = Doors.name and Doors.providers[Doors.name]
    return provider ~= nil and provider.available()
end

local function call(fn, ...)
    local ok, result = pcall(fn, ...)
    if not ok then
        if Config.Debug then
            print(('^3[XS-Robberies]^0 %s: %s'):format(Doors.name or 'doors', tostring(result)))
        end
        return nil
    end
    return result
end

function Doors.SetState(id, locked, src)
    if id == nil or id == '' or not Doors.Available() then return false end
    return call(Doors.providers[Doors.name].setState, id, locked, src) == true
end

function Doors.Find(door)
    if not door or not door.x or not Doors.Available() then return nil end
    local provider = Doors.providers[Doors.name]
    if not provider.find then return nil end
    return call(provider.find, door)
end

local function keyFor(door)
    return ('%d_%d_%d'):format(math.floor((door.x or 0.0) * 10 + 0.5),
        math.floor((door.y or 0.0) * 10 + 0.5), math.floor((door.z or 0.0) * 10 + 0.5))
end

function Doors.SetBuiltin(door, action, angle, on)
    local key = keyFor(door)

    if on then
        Doors.builtin[key] = {
            key = key,
            model = door.model,
            x = door.x, y = door.y, z = door.z, h = door.h or 0.0,
            action = action,
            angle = tonumber(angle) or 90.0,
        }
    else
        Doors.builtin[key] = nil
    end

    TriggerClientEvent('XS-Robberies:client:door', -1, key, Doors.builtin[key])
    return key
end

function Doors.SyncTo(src)
    TriggerClientEvent('XS-Robberies:client:doors', src, Doors.builtin)
end

function Doors.Apply(doors, opts, src)
    local records = {}
    local lookup = nil

    for index, door in ipairs(doors) do
        local action = door.action or opts.doorAction or 'unlock'

        if action == 'swing' then
            if door.x and door.model then
                records[#records + 1] = { builtin = Doors.SetBuiltin(door, 'swing', door.angle or opts.swingAngle, true), door = door }
            end
        else
            local locked = action == 'lock'
            local id = door.id

            if (id == nil or id == '') and door.x then
                id = Doors.Find(door)
                if not id and Doors.Available() and src then
                    lookup = lookup or lib.callback.await('XS-Robberies:findDoors', src, doors) or {}
                    id = lookup[index]
                end
            end

            if id and id ~= '' and Doors.SetState(id, locked, src) then
                records[#records + 1] = { id = id, restore = not locked }
            elseif door.x and door.model then
                records[#records + 1] = { builtin = Doors.SetBuiltin(door, action, nil, true), door = door }
            end
        end
    end

    return records
end

function Doors.Restore(records)
    for _, record in ipairs(records or {}) do
        if record.builtin then
            Doors.SetBuiltin(record.door, nil, nil, false)
        elseif record.id then
            Doors.SetState(record.id, record.restore)
        end
    end
end

if Config.Debug then
    print(('^2[XS-Robberies]^0 doorlock bridge loaded (%s)'):format(Doors.name or 'built in only'))
end
