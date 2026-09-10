CipherMinigames = { pending = nil }

function CipherMinigames.Run(kind, difficulty)
    if CipherMinigames.pending then return false end

    local done = promise.new()
    CipherMinigames.pending = done

    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({
        action = 'minigame',
        kind = kind,
        difficulty = tonumber(difficulty) or 2,
    })

    local passed = Citizen.Await(done)
    CipherMinigames.pending = nil
    return passed
end

RegisterNUICallback('minigameResult', function(data, cb)
    if not Builder.open then SetNuiFocus(false, false) end

    local done = CipherMinigames.pending
    CipherMinigames.pending = nil

    if done then done:resolve(data and data.passed == true) end
    cb({ ok = true })
end)
