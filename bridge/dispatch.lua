Dispatch = { name = nil }

if not Config then return end

local IS_SERVER = IsDuplicityVersion()

local CANDIDATES = {
    'XS-Dispatch',
    'ps-dispatch',
    'qs-dispatch',
    'cd_dispatch',
    'core_dispatch',
    'rcore_dispatch',
    'linden_outlawalert',
}

do
    local forced = Config.Bridges and Config.Bridges.dispatch or 'auto'
    if forced == 'none' then
        Dispatch.name = nil
    elseif forced ~= 'auto' then
        Dispatch.name = forced
    else
        for _, r in ipairs(CANDIDATES) do
            if GetResourceState(r) == 'started' then Dispatch.name = r break end
        end
    end
end

local POLICE_JOBS = Config.PoliceJobs or { 'police', 'sheriff', 'bcso', 'sast' }

local function custom()
    local c = (Config.Integrations or {}).GenericDispatch or {}
    if c.resource and c.resource ~= '' and c.export and c.export ~= '' then return c end
    return nil
end

if IS_SERVER then
    local function vec(c)
        return vector3((tonumber(c.x) or 0.0) + 0.0, (tonumber(c.y) or 0.0) + 0.0, (tonumber(c.z) or 0.0) + 0.0)
    end

    local Senders = {}

    Senders['XS-Dispatch'] = function(a)
        exports['XS-Dispatch']:CreateCall({
            type = 'custom',
            code = a.code,
            title = a.title,
            description = a.description,
            priority = a.priority,
            coords = a.coords,
            sprite = a.sprite,
            color = a.colour,
            caller = 'Alarm company',
            origin = GetCurrentResourceName(),
        })
    end

    Senders['ps-dispatch'] = function(a)
        local jobs = {}
        for _, j in ipairs(POLICE_JOBS) do jobs[#jobs + 1] = j end
        jobs[#jobs + 1] = 'leo'

        local alert = {
            message = a.title,
            codeName = 'xs_robbery',
            code = a.code,
            icon = 'fas fa-mask',
            priority = a.priority == 1 and 1 or 2,
            coords = vec(a.coords),
            information = a.description,
            jobs = jobs,
            addToList = true,
            alert = {
                radius = 0, sprite = a.sprite, color = a.colour, scale = 1.0, length = 3,
                sound = 'Lose_1st', sound2 = 'GTAO_FM_Events_Soundset', offset = false, flash = a.priority == 1,
            },
        }

        local sent = pcall(function()
            exports['ps-dispatch']:SendTargetedAlert(Framework.PoliceSources(true), alert)
        end)
        if not sent then TriggerEvent('ps-dispatch:server:notify', alert) end
    end

    Senders['qs-dispatch'] = function(a)
        TriggerEvent('qs-dispatch:server:CreateDispatchCall', {
            job = POLICE_JOBS,
            callLocation = vec(a.coords),
            callCode = { code = a.code, snippet = a.title },
            message = a.description,
            flashes = a.priority == 1,
            image = nil,
            blip = {
                sprite = a.sprite, scale = 1.0, colour = a.colour, flashes = a.priority == 1,
                text = a.title, time = (a.blipTime or 300) * 1000,
            },
        })
    end

    Senders['cd_dispatch'] = function(a)
        TriggerClientEvent('cd_dispatch:AddNotification', -1, {
            job_table = POLICE_JOBS,
            coords = vec(a.coords),
            title = ('%s - %s'):format(a.code, a.title),
            message = a.description,
            flash = a.priority == 1 and 1 or 0,
            unique_id = tostring(math.random(1000000, 9999999)),
            sound = 1,
            blip = {
                sprite = a.sprite, scale = 1.0, colour = a.colour, flashes = a.priority == 1,
                text = ('%s - %s'):format(a.code, a.title), time = math.max(1, math.floor((a.blipTime or 300) / 60)), radius = 0,
            },
        })
    end

    Senders['core_dispatch'] = function(a)
        local extra = { { icon = 'fa-circle-info', info = a.description } }
        local urgent = a.priority == 1

        local sent = pcall(function()
            exports['core_dispatch']:sendAlert({
                code = a.code,
                message = a.title,
                extraInfo = extra,
                coords = vec(a.coords),
                priority = urgent,
                job = POLICE_JOBS,
                time = 10000,
                blip = a.sprite,
                color = a.colour,
            })
        end)
        if sent then return end

        local c = vec(a.coords)
        for _, job in ipairs(POLICE_JOBS) do
            TriggerEvent('core_dispatch:addCall', a.code, a.title, extra, { c.x, c.y, c.z }, job, 10000, a.sprite, a.colour, urgent)
        end
    end

    Senders['rcore_dispatch'] = function(a)
        TriggerEvent('rcore_dispatch:server:sendAlert', {
            code = ('%s - %s'):format(a.code, a.title),
            default_priority = a.priority == 1 and 'high' or 'medium',
            coords = vec(a.coords),
            job = POLICE_JOBS,
            text = a.description,
            type = 'alerts',
            blip = {
                sprite = a.sprite, colour = a.colour, scale = 1.0, text = a.title,
                flashes = a.priority == 1, radius = 0,
            },
        })
    end

    Senders['linden_outlawalert'] = function(a)
        TriggerEvent('wf-alerts:svNotify', {
            dispatchData = {
                displayCode = a.code,
                description = a.title,
                isImportant = a.priority == 1 and 1 or 0,
                recipientList = POLICE_JOBS,
                length = 10000,
                infoM = 'fa-info-circle',
                info = a.description,
                blipSprite = a.sprite,
                blipColour = a.colour,
                blipScale = 1.0,
            },
            caller = 'Alarm company',
            coords = vec(a.coords),
        })
    end

    local function toPolice(a)
        for _, src in ipairs(Framework.PoliceSources(false)) do
            TriggerClientEvent('XS-Robberies:client:alert', src, a)
        end
    end

    function Dispatch.Alert(a)
        a.code = a.code or '10-90'
        a.title = a.title or 'Robbery in progress'
        a.description = a.description or 'Alarm triggered.'
        a.sprite = a.sprite or 500
        a.colour = a.colour or 1
        a.priority = a.priority or 1

        if custom() then
            toPolice(a)
            return
        end

        local sender = Dispatch.name and Senders[Dispatch.name]
        if sender and GetResourceState(Dispatch.name) == 'started' then
            local ok, err = pcall(sender, a)
            if ok then return end
            print(('^3[XS-Robberies]^0 %s refused the alert (%s). Police get a plain notification instead.')
                :format(Dispatch.name, tostring(err)))
        end

        toPolice(a)
    end
else
    RegisterNetEvent('XS-Robberies:client:alert', function(data)
        local coords = vector3(data.coords.x, data.coords.y, data.coords.z)

        local c = custom()
        if c and GetResourceState(c.resource) == 'started' then
            local sent = pcall(function()
                exports[c.resource][c.export](exports[c.resource], {
                    coords = coords,
                    code = data.code,
                    title = data.title,
                    description = data.description,
                    sprite = data.sprite,
                    colour = data.colour,
                    radius = data.radius or 0,
                    priority = data.priority or 1,
                    jobs = POLICE_JOBS,
                    blipTime = data.blipTime or 300,
                })
            end)
            if sent then return end
        end

        Framework.Notify(('%s — %s'):format(data.code, data.title), 'warning', 'Dispatch')
        local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
        SetBlipSprite(blip, data.sprite or 500)
        SetBlipColour(blip, data.colour or 1)
        SetBlipScale(blip, 1.0)
        SetBlipAsShortRange(blip, false)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(data.title)
        EndTextCommandSetBlipName(blip)
        SetTimeout((data.blipTime or 300) * 1000, function()
            if DoesBlipExist(blip) then RemoveBlip(blip) end
        end)
    end)
end
