Builder = Builder or {}

local checkedAdmin, isAdmin = false, false

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
            name = 'cipher_robberies_builder',
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
