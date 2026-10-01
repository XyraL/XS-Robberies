Builder = Builder or {}

local checkedAdmin, isAdmin = false, false

function FloorUnder(x, y, z)
    local ray = StartExpensiveSynchronousShapeTestLosProbe(x, y, z + 0.6, x, y, z - 2.5, 1, 0, 4)
    local _, hit, at = GetShapeTestResult(ray)
    if hit == 1 then return at.z end
    return z
end

function PropLift(model)
    local hash = type(model) == 'number' and model or (tonumber(model) or joaat(model))
    if not hash or not IsModelValid(hash) then return 0.0 end
    local low = GetModelDimensions(hash)
    return -(low and low.z or 0.0)
end

local function ensureAdmin()
    if checkedAdmin then return isAdmin end
    isAdmin = lib.callback.await('XS-Robberies:isAdmin', false) == true
    checkedAdmin = true
    return isAdmin
end

RegisterCommand(Config.Builder.Command, function()
    if not ensureAdmin() then
        Framework.Notify('You do not have access to the robbery builder.', 'error')
        return
    end
    Builder.Open()
end, false)

if Config.Builder.KeyBind and Config.Builder.KeyBind ~= '' then
    CreateThread(function()
        Wait(2000)
        if not ensureAdmin() then return end
        lib.addKeybind({
            name = 'xs_robberies_builder',
            description = 'Open the robbery builder',
            defaultKey = Config.Builder.KeyBind,
            onPressed = function() Builder.Open() end,
        })
    end)
end

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    Placement.Abort()
    Markers.Clear()
end)
