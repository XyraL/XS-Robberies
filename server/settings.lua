Settings = { values = {} }

local function decode(raw, fallback)
    if not raw or raw == '' then return fallback end
    local ok, out = pcall(json.decode, raw)
    if not ok or out == nil then return fallback end
    return out
end

function Settings.Load()
    local rows = MySQL.query.await('SELECT `key`, `value` FROM xs_robbery_settings') or {}
    Settings.values = {}
    for _, row in ipairs(rows) do
        Settings.values[row.key] = decode(row.value, nil)
    end
end

function Settings.Get(key, fallback)
    local value = Settings.values[key]
    if value == nil then return fallback end
    return value
end

function Settings.Set(key, value)
    Settings.values[key] = value
    MySQL.prepare.await([[
        INSERT INTO xs_robbery_settings (`key`, `value`) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)
    ]], { key, json.encode(value) })
end

function Settings.Blacklist()
    return Settings.Get('blacklist', {}) or {}
end

function Settings.Blacklisted(citizenid)
    if not citizenid then return false end
    return Settings.Blacklist()[citizenid] ~= nil
end

function Settings.SetBlacklisted(citizenid, name, on)
    local list = Settings.Blacklist()

    if on then
        list[citizenid] = name or citizenid
    else
        list[citizenid] = nil
    end

    Settings.Set('blacklist', list)
    return list
end

function Settings.KillSwitch()
    return Settings.Get('killSwitch', false) == true
end

Settings.tunables = {
    { key = 'payoutMultiplier', label = 'Payout multiplier', kind = 'number', min = 0, max = 20, step = 0.05 },
    { key = 'payoutOnEscape',   label = "Hold each robber's money until the crew escapes", kind = 'toggle' },
    { key = 'respectDuty',      label = 'Off-duty police and EMS may rob', kind = 'toggle' },
    { key = 'logRuns',          label = 'Write finished runs to history', kind = 'toggle' },
    { key = 'abandonAfter',     label = 'Abandon a run after', kind = 'number', min = 60, max = 7200, unit = 's' },
    { key = 'theme',            label = 'Panel theme', kind = 'choice',
      options = { 'emerald', 'amber', 'violet', 'rose', 'ice', 'gold' } },
}

local function fallbackFor(key)
    if key == 'payoutMultiplier' then return Config.Payout.GlobalMultiplier or 1.0 end
    if key == 'payoutOnEscape'   then return Config.Run.PayoutOnEscape ~= false end
    if key == 'respectDuty'      then return Config.BlockedJobsRespectDuty == true end
    if key == 'logRuns'          then return Config.Run.LogRuns ~= false end
    if key == 'abandonAfter'     then return Config.Run.AbandonAfter or 600 end
    if key == 'theme'            then return Config.Builder.Theme or 'emerald' end
end

function Settings.Tunable(key)
    local value = Settings.Get(key, nil)
    if value == nil then return fallbackFor(key) end
    return value
end

function Settings.Tunables()
    local out = {}
    for _, entry in ipairs(Settings.tunables) do
        out[entry.key] = Settings.Tunable(entry.key)
    end
    return out
end

function Settings.Schema()
    local out = {}
    for _, entry in ipairs(Settings.tunables) do
        out[#out + 1] = {
            key = entry.key, label = entry.label, kind = entry.kind,
            min = entry.min, max = entry.max, step = entry.step, unit = entry.unit,
            options = entry.options,
            value = Settings.Tunable(entry.key),
            fromConfig = Settings.Get(entry.key, nil) == nil,
        }
    end
    return out
end
