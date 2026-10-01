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

local function await(start, timeoutMs, onTimeout)
    local p = promise.new()
    local settled = false

    local function finish(value)
        if settled then return end
        settled = true
        p:resolve(value == true)
    end

    start(finish)

    if timeoutMs then
        SetTimeout(timeoutMs, function()
            if not settled and onTimeout then onTimeout() end
            finish(false)
        end)
    end

    return Citizen.Await(p)
end

local function pick(list, d)
    return list[math.max(1, math.min(#list, d))]
end

local Bridges = {}

Bridges['ox_lib'] = function(_, d)
    local levels = pick({ { 'easy', 'easy' }, { 'easy', 'medium', 'medium' }, { 'medium', 'hard', 'hard' } }, d)
    return lib.skillCheck(levels, { 'w', 'a', 's', 'd' }) == true
end

Bridges['ps-ui'] = function(kind, d)
    local ps = exports['ps-ui']

    if kind == 'circle' then
        local v = pick({ { 2, 20 }, { 3, 12 }, { 4, 8 } }, d)
        return await(function(cb) ps:Circle(cb, v[1], v[2]) end, 180000)
    elseif kind == 'maze' then
        local s = pick({ 30, 20, 12 }, d)
        return await(function(cb) ps:Maze(cb, s) end, (s + 15) * 1000)
    elseif kind == 'varhack' then
        local v = pick({ { 3, 25 }, { 5, 20 }, { 7, 15 } }, d)
        return await(function(cb) ps:VarHack(cb, v[1], v[2]) end, 60000)
    elseif kind == 'thermite' then
        local v = pick({ { 15, 6, 4 }, { 12, 7, 3 }, { 10, 8, 2 } }, d)
        return await(function(cb) ps:Thermite(cb, v[1], v[2], v[3]) end, (v[1] + 20) * 1000)
    elseif kind == 'scrambler' then
        local v = pick({ { 'numeric', 40 }, { 'alphanumeric', 30 }, { 'greek', 20 } }, d)
        return await(function(cb) ps:Scrambler(cb, v[1], v[2], 0) end, (v[2] + 15) * 1000)
    end
    return true
end

local BL_SKILL = {
    circle_progress = 'CircleProgress',
    progress = 'Progress',
    key_spam = 'KeySpam',
    key_circle = 'KeyCircle',
    number_slide = 'NumberSlide',
    rapid_lines = 'RapidLines',
    circle_shake = 'CircleShake',
}

local BL_HACK = {
    circle_sum = { name = 'CircleSum', config = function(d, ms) return { length = pick({ 3, 4, 6 }, d), duration = ms } end },
    word_wiz = { name = 'WordWiz', config = function(d, ms) return { length = pick({ 3, 4, 6 }, d), duration = ms } end },
    digit_dazzle = { name = 'DigitDazzle', config = function(d, ms) return { length = pick({ 3, 4, 6 }, d), duration = ms } end },
    lights_out = { name = 'LightsOut', config = function(d, ms) return { level = pick({ 1, 2, 3 }, d), duration = ms } end },
    mine_sweeper = { name = 'MineSweeper', config = function(d, ms) return { grid = pick({ 4, 4, 5 }, d), duration = ms, target = pick({ 3, 4, 6 }, d), previewDuration = 5000 } end },
    path_find = { name = 'PathFind', config = function(d, ms) return { numberOfNodes = pick({ 6, 10, 14 }, d), duration = ms } end },
    untangle = { name = 'Untangle', config = function(d, ms) return { numberOfNodes = pick({ 6, 10, 14 }, d), duration = ms } end },
    print_lock = { name = 'PrintLock', config = function(d, ms) return { grid = pick({ 3, 4, 5 }, d), duration = ms, target = pick({ 3, 4, 5 }, d) } end },
    wave_match = { name = 'WaveMatch', config = function(_, ms) return { duration = ms } end },
}

Bridges['bl_ui'] = function(kind, d)
    local bl = exports['bl_ui']

    local skill = BL_SKILL[kind]
    if skill then
        local v = pick({ { 1, 25, 3 }, { 2, 50, 5 }, { 3, 75, 7 } }, d)
        return bl[skill](bl, v[1], v[2], v[3]) == true
    end

    local hack = BL_HACK[kind]
    if hack then
        local ms = pick({ 15000, 10000, 7000 }, d)
        return bl[hack.name](bl, pick({ 1, 1, 2 }, d), hack.config(d, ms)) == true
    end
    return true
end

Bridges['qb-minigames'] = function(kind, d)
    local qb = exports['qb-minigames']

    if kind == 'skillbar' then
        return qb:Skillbar(pick({ 'easy', 'medium', 'hard' }, d), '1234') == true
    elseif kind == 'hacking' then
        local v = pick({ { 3, 30 }, { 5, 25 }, { 7, 20 } }, d)
        return qb:Hacking(v[1], v[2]) == true
    elseif kind == 'lockpick' then
        return qb:Lockpick(pick({ 5, 3, 2 }, d)) == true
    end
    return true
end

local GLOW = {
    path = { { gridSize = 15, lives = 4, timeLimit = 15000 }, { gridSize = 19, lives = 3, timeLimit = 10000 }, { gridSize = 23, lives = 2, timeLimit = 8000 } },
    spot = { { gridSize = 5, timeLimit = 12000, charSet = 'numeric', required = 6 }, { gridSize = 6, timeLimit = 8000, charSet = 'alphabet', required = 10 }, { gridSize = 8, timeLimit = 7000, charSet = 'alphanumeric', required = 14 } },
    math = { { timeLimit = 300000 }, { timeLimit = 180000 }, { timeLimit = 120000 } },
}

Bridges['glow_minigames'] = function(kind, d)
    local settings = GLOW[kind] and pick(GLOW[kind], d)
    if not settings then return true end
    return await(function(cb)
        exports['glow_minigames']:StartMinigame(function(success) cb(success) end, kind, settings)
    end, settings.timeLimit + 20000)
end

Bridges['utk_fingerprint'] = function(_, d)
    local v = pick({ { 2, 6, 4 }, { 3, 4, 3 }, { 4, 2, 2 } }, d)
    return await(function(cb)
        TriggerEvent('utk_fingerprint:Start', v[1], v[2], v[3], function(outcome) cb(outcome) end)
    end, (v[3] * 60 + 20) * 1000)
end

Bridges['ultra-voltlab'] = function(_, d)
    local seconds = pick({ 60, 40, 25 }, d)
    return await(function(cb)
        TriggerEvent('ultra-voltlab', seconds, function(result) cb(result == 1) end)
    end, (seconds + 10) * 1000)
end

Bridges['mhacking'] = function(_, d)
    local v = pick({ { 3, 40 }, { 5, 30 }, { 7, 20 } }, d)
    return await(function(cb)
        TriggerEvent('mhacking:show')
        TriggerEvent('mhacking:start', v[1], v[2], function(success)
            TriggerEvent('mhacking:hide')
            cb(success)
        end)
    end, (v[2] + 15) * 1000, function() TriggerEvent('mhacking:hide') end)
end

Bridges['SN-Hacking'] = function(kind, d)
    local sn = exports['SN-Hacking']

    if kind == 'memory' then
        local v = pick({ { 4, 1, 12000 }, { 5, 1, 10000 }, { 7, 2, 8000 } }, d)
        return sn:MemoryGame(v[1], v[2], v[3]) == true
    elseif kind == 'thermite' then
        local v = pick({ { 5, 5, 12000, 3, 1, 4000 }, { 7, 5, 10000, 2, 2, 3000 }, { 8, 8, 8000, 1, 3, 2000 } }, d)
        return sn:Thermite(v[1], v[2], v[3], v[4], v[5], v[6]) == true
    elseif kind == 'skillbar' then
        local v = pick({ { 4000, 15, 1 }, { 3000, 10, 2 }, { 2000, 7, 3 } }, d)
        return sn:SkillBar(v[1], v[2], v[3]) == true
    end
    return true
end

local BOII = {
    chip_hack = function(d) return { style = 'default', loading_time = 5000, chips = pick({ 2, 3, 4 }, d), timer = pick({ 60000, 45000, 30000 }, d) } end,
    safe_crack = function(d) return { style = 'default', difficulty = pick({ 1, 3, 5 }, d) } end,
    wire_cut = function(d) return { style = 'default', timer = pick({ 60000, 45000, 30000 }, d) } end,
    pincode = function(d) return { style = 'default', difficulty = pick({ 2, 4, 6 }, d), guesses = pick({ 6, 5, 4 }, d) } end,
    anagram = function(d) return { style = 'default', loading_time = 5000, difficulty = pick({ 3, 6, 9 }, d), guesses = pick({ 5, 4, 3 }, d), timer = pick({ 60000, 45000, 30000 }, d) } end,
}

Bridges['boii_minigames'] = function(kind, d)
    local build = BOII[kind]
    if not build then return true end
    return await(function(cb)
        exports['boii_minigames'][kind](exports['boii_minigames'], build(d), function(result) cb(result) end)
    end, 180000)
end

Bridges['memorygame'] = function(_, d)
    local v = pick({ { 8, 4, 4, 12 }, { 10, 3, 3, 10 }, { 12, 2, 3, 8 } }, d)
    return await(function(cb)
        exports['memorygame']:thermiteminigame(v[1], v[2], v[3], v[4], function() cb(true) end, function() cb(false) end)
    end, (v[3] + v[4] + 15) * 1000)
end

Bridges['howdy-hackminigame'] = function(_, d)
    local v = pick({ { 3, 8000 }, { 4, 5000 }, { 6, 3000 } }, d)
    return exports['howdy-hackminigame']:Begin(v[1], v[2]) == true
end

function Minigames.Run(id, difficulty)
    if not id or id == '' or id == 'none' then return true end

    local d = math.floor(tonumber(difficulty) or 2)

    local builtin = id:match('^xs:(.+)$') or id:match('^cipher:(.+)$')
    if builtin then
        return XSMinigames.Run(builtin, d)
    end

    local def = Minigames.list[id]
    if not def then return lib.skillCheck({ 'easy', 'medium' }, { 'w', 'a', 's', 'd' }) == true end

    local bridge = Bridges[def.provider]
    local resource = Minigames.Resource(def)

    if not bridge or (resource and GetResourceState(resource) ~= 'started') then
        print(('^3[XS-Robberies]^0 %s is not running, so %s fell back to an ox_lib skill check.'):format(tostring(resource), id))
        return lib.skillCheck({ 'easy', 'medium' }, { 'w', 'a', 's', 'd' }) == true
    end

    local kind = id:match(':(.+)$')
    local ok, result = pcall(bridge, kind, d)
    if not ok then
        print(('^1[XS-Robberies]^0 %s failed to start: %s'):format(id, tostring(result)))
        return false
    end
    return result == true
end
