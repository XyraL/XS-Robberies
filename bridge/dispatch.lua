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
    'origen_police',
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

-- Which jobs count as police for the alert. Add yours here if it is not listed.
local POLICE_JOBS = Config.PoliceJobs or { 'police', 'sheriff', 'bcso', 'sast' }

if IS_SERVER then
    function Dispatch.Alert(payload)
        TriggerClientEvent('XS-Robberies:client:alert', -1, payload)
    end
else
    local function isPolice()
        local job = Framework.GetJob and Framework.GetJob()
        if not job then return false end
        for _, name in ipairs(POLICE_JOBS) do
            if job.name == name then return true end
        end
        return false
    end

    RegisterNetEvent('XS-Robberies:client:alert', function(data)
        if not isPolice() then return end

        local coords = vector3(data.coords.x, data.coords.y, data.coords.z)
        local code = data.code or '10-90'
        local title = data.title or 'Robbery In Progress'
        local description = data.description or 'Alarm triggered.'
        local sprite = data.sprite or 500
        local colour = data.colour or 1
        local radius = data.radius or 0

        local custom = (Config.Integrations or {}).GenericDispatch or {}
        if custom.resource ~= '' and custom.export ~= ''
            and GetResourceState(custom.resource) == 'started' then
            local sent = pcall(function()
                exports[custom.resource][custom.export](exports[custom.resource], {
                    coords = coords,
                    code = code,
                    title = title,
                    description = description,
                    sprite = sprite,
                    colour = colour,
                    radius = radius,
                    priority = data.priority or 1,
                    jobs = POLICE_JOBS,
                    blipTime = data.blipTime or 300,
                })
            end)
            if sent then return end
        end

        if Dispatch.name == 'XS-Dispatch' then
            exports['XS-Dispatch']:CustomAlert({
                code = code,
                title = title,
                description = description,
                coords = coords,
                priority = data.priority or 1,
                jobs = POLICE_JOBS,
                blip = { sprite = sprite, colour = colour, scale = 1.0, time = data.blipTime or 300 },
            })
            return
        end

        if Dispatch.name == 'ps-dispatch' then
            exports['ps-dispatch']:CustomAlert({
                coords = coords,
                message = title,
                dispatchCode = code,
                description = description,
                radius = radius,
                sprite = sprite,
                color = colour,
                scale = 1.0,
                length = 5,
            })
            return
        end

        if Dispatch.name == 'qs-dispatch' then
            exports['qs-dispatch']:StoreRobbery({
                displayCode = code,
                description = title,
                radius = radius,
                coords = coords,
            })
            return
        end

        if Dispatch.name == 'cd_dispatch' then
            TriggerEvent('cd_dispatch:AddNotification', {
                job_table = POLICE_JOBS,
                coords = coords,
                title = code .. ' - ' .. title,
                message = description,
                flash = 0,
                unique_id = tostring(math.random(0000000, 9999999)),
                blip = {
                    sprite = sprite,
                    scale = 1.0,
                    colour = colour,
                    flashes = false,
                    text = code .. ' - ' .. title,
                    time = 5,
                    radius = radius,
                },
            })
            return
        end

        if Dispatch.name == 'core_dispatch' then
            TriggerEvent('core_dispatch:addCall', code, title, {
                { icon = 'fa-circle-info', info = description },
            }, { coords.x, coords.y, coords.z }, POLICE_JOBS, 15000, sprite, colour)
            return
        end

        Framework.Notify(('%s — %s'):format(code, title), 'warning', 'Dispatch')
        local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
        SetBlipSprite(blip, sprite)
        SetBlipColour(blip, colour)
        SetBlipScale(blip, 1.0)
        SetBlipAsShortRange(blip, false)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(title)
        EndTextCommandSetBlipName(blip)
        SetTimeout((data.blipTime or 300) * 1000, function()
            if DoesBlipExist(blip) then RemoveBlip(blip) end
        end)
    end)
end

if Config.Debug then
    print(('^2[XS-Robberies]^0 dispatch bridge loaded (%s) on %s'):format(
        Dispatch.name or 'notifications', IS_SERVER and 'server' or 'client'))
end
