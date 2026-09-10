XSMinigames = { pending = nil }

function XSMinigames.Run(kind, difficulty)
    if XSMinigames.pending then return false end

    local done = promise.new()
    XSMinigames.pending = done

    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({
        action = 'minigame',
        kind = kind,
        difficulty = tonumber(difficulty) or 2,
    })

    local passed = Citizen.Await(done)
    XSMinigames.pending = nil
    return passed
end

RegisterNUICallback('minigameResult', function(data, cb)
    if not Builder.open then SetNuiFocus(false, false) end

    local done = XSMinigames.pending
    XSMinigames.pending = nil

    if done then done:resolve(data and data.passed == true) end
    cb({ ok = true })
end)
