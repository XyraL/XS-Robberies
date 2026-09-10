Doors = { name = nil, providers = {} }

if not Config then return end
if not IsDuplicityVersion() then return end

local forced = Config.Bridges and Config.Bridges.doorlock or 'auto'

function Doors.RegisterProvider(name, provider)
    Doors.providers[name] = provider
    if Doors.name == nil and forced == 'auto' and provider.available and provider.available() then
        Doors.name = name
    end
end

local ORDER = { 'ox_doorlock', 'qb-doorlock', 'nui_doorlock', 'jd_doorlock' }

Doors.RegisterProvider('ox_doorlock', {
    resource = 'ox_doorlock',
    available = function() return GetResourceState('ox_doorlock') == 'started' end,
    setState = function(id, locked)
        local ok = pcall(function()
            exports.ox_doorlock:setDoorState(id, locked and 1 or 0)
        end)
        if not ok then
            TriggerEvent('ox_doorlock:setState', id, locked and 1 or 0)
        end
        return true
    end,
})

Doors.RegisterProvider('qb-doorlock', {
    resource = 'qb-doorlock',
    available = function() return GetResourceState('qb-doorlock') == 'started' end,
    setState = function(id, locked)
        local ok = pcall(function()
            exports['qb-doorlock']:SetDoorState(id, locked)
        end)
        if not ok then
            TriggerClientEvent('qb-doorlock:client:setDoorState', -1, id, locked)
        end
        return true
    end,
})

Doors.RegisterProvider('nui_doorlock', {
    resource = 'nui_doorlock',
    available = function() return GetResourceState('nui_doorlock') == 'started' end,
    setState = function(id, locked)
        TriggerEvent('nui_doorlock:updateState', id, locked, false, false, nil, true)
        return true
    end,
})

Doors.RegisterProvider('jd_doorlock', {
    resource = 'jd_doorlock',
    available = function() return GetResourceState('jd_doorlock') == 'started' end,
    setState = function(id, locked)
        local ok = pcall(function()
            exports.jd_doorlock:setDoorLock(id, locked)
        end)
        return ok
    end,
})

do
    if forced == 'none' then
        Doors.name = nil
    elseif forced ~= 'auto' then
        Doors.name = forced
    else
        for _, name in ipairs(ORDER) do
            local provider = Doors.providers[name]
            if provider and provider.available() then
                Doors.name = name
                break
            end
        end
    end
end

function Doors.Available()
    return Doors.name ~= nil
end

function Doors.SetState(id, locked)
    if not id or id == '' then return false end

    local provider = Doors.providers[Doors.name]
    if not provider then return false end

    local ok, err = pcall(provider.setState, id, locked)

    if not ok and Config.Debug then
        print(('^3[XS-Robberies]^0 %s refused door "%s": %s')
            :format(Doors.name, tostring(id), tostring(err)))
    end

    return ok
end

if Config.Debug then
    print(('^2[XS-Robberies]^0 doorlock bridge loaded (%s)'):format(Doors.name or 'none'))
end
