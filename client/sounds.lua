Sounds = { alarms = {} }

local function enabled()
    return Config.Sounds and Config.Sounds.Enabled
end

function Sounds.Play(event)
    if not enabled() then return end

    local cue = (Config.Sounds.Events or {})[event]
    if not cue or not cue.name then return end

    PlaySoundFrontend(-1, cue.name, cue.set, true)
end

local function alarmLoop()
    local cfg = Config.Sounds.Alarm or {}

    CreateThread(function()
        while next(Sounds.alarms) do
            local coords = GetEntityCoords(PlayerPedId())

            for _, alarm in pairs(Sounds.alarms) do
                local at = vector3(alarm.x, alarm.y, alarm.z)
                if #(coords - at) <= (cfg.range or 60.0) then
                    PlaySoundFromCoord(-1, cfg.name or 'Beep_Red', at.x, at.y, at.z,
                        cfg.set or 'DLC_HEIST_HACKING_SNAKE_SOUNDS', false, cfg.range or 60.0, false)
                end
            end

            Wait(cfg.interval or 1200)
        end
    end)
end

RegisterNetEvent('XS-Robberies:client:alarmSound', function(data)
    if not enabled() or not (Config.Sounds.Alarm or {}).Enabled then return end
    if not data or not data.locationId then return end

    if not data.on then
        Sounds.alarms[data.locationId] = nil
        return
    end

    local wasQuiet = next(Sounds.alarms) == nil
    Sounds.alarms[data.locationId] = data.coords

    if wasQuiet then alarmLoop() end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then Sounds.alarms = {} end
end)
