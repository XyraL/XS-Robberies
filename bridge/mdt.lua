Mdt = { name = nil, provider = nil, providers = {} }

if not IsDuplicityVersion() or not Config then return end

local order = {}

local function register(name, provider)
    if type(name) ~= 'string' or type(provider) ~= 'table' then return false end
    if type(provider.createIncident) ~= 'function' then return false end

    if not Mdt.providers[name] then order[#order + 1] = name end
    provider.name = name
    Mdt.providers[name] = provider
    return true
end

local function running(resource)
    return resource and GetResourceState(resource) == 'started'
end

register('XS-MDT', {
    resource = 'XS-MDT',
    available = function() return running('XS-MDT') end,

    createIncident = function(data)
        return exports['XS-MDT']:CreateIncidentExternal({
            title = data.title,
            narrative = data.narrative,
            location = data.location,
            severity = data.severity,
            status = 'open',
            actorName = data.actorName,
        })
    end,

    attachNote = function(handle, text)
        if not handle or not handle.id then return false end
        return exports['XS-MDT']:AttachEvidence(handle.id, {
            kind = 'note',
            label = 'Alarm monitoring update',
            detail = text,
        }) and true or false
    end,
})

-- Anything else. Fill in Config.Integrations.Generic with the export names your
-- MDT documents and this calls them — no code change, no waiting on us. The
-- table it passes is the same one every provider gets, so most MDTs that take
-- a plain incident table will work as-is.
register('generic', {
    available = function()
        local g = Config.Integrations.Generic or {}
        return running(g.resource) and g.createExport ~= nil and g.createExport ~= ''
    end,

    createIncident = function(data)
        local g = Config.Integrations.Generic or {}
        return exports[g.resource][g.createExport](exports[g.resource], data)
    end,

    attachNote = function(handle, text)
        local g = Config.Integrations.Generic or {}
        if not g.noteExport or g.noteExport == '' then return false end
        return exports[g.resource][g.noteExport](exports[g.resource], handle, text) and true or false
    end,
})

-- Any resource can add one of its own, the same way XS-Evidence does it:
--
--   exports['XS-Robberies']:RegisterMdtProvider('my-mdt', {
--       available = function() return GetResourceState('my-mdt') == 'started' end,
--       createIncident = function(data) return { id = ... } end,
--       attachNote = function(handle, text) return true end,
--   })
exports('RegisterMdtProvider', function(name, provider)
    local ok = register(name, provider)
    if ok then Mdt.Detect() end
    return ok
end)

function Mdt.Detect()
    local forced = Config.Integrations and Config.Integrations.Provider or 'auto'

    if forced == 'none' then
        Mdt.name, Mdt.provider = nil, nil
        return
    end

    if forced ~= 'auto' then
        local provider = Mdt.providers[forced]
        if provider and (not provider.available or provider.available()) then
            Mdt.name, Mdt.provider = forced, provider
        else
            Mdt.name, Mdt.provider = nil, nil
            print(('^3[XS-Robberies]^0 MDT provider "%s" was asked for but is not available.'):format(forced))
        end
        return
    end

    for _, name in ipairs(order) do
        local provider = Mdt.providers[name]
        if not provider.available or provider.available() then
            Mdt.name, Mdt.provider = name, provider
            return
        end
    end

    Mdt.name, Mdt.provider = nil, nil
end

CreateThread(function()
    Wait(2500)
    Mdt.Detect()

    if Config.Debug then
        print(('^2[XS-Robberies]^0 mdt bridge: %s'):format(Mdt.name or 'none'))
    end
end)

local function participantNames(run)
    local out = {}
    for _, entry in pairs(run.participants) do
        if entry.name then out[#out + 1] = entry.name end
    end
    return out
end

function Mdt.OpenIncident(run)
    if not Mdt.provider or not Config.Integrations.Mdt then return end
    if run.incident then return end

    local location = run.location
    local response = location.response or {}

    local ok, handle = pcall(Mdt.provider.createIncident, {
        title = ('%s — %s'):format(response.title or 'Robbery', location.label or 'Unknown'),
        narrative = ('Alarm raised at %s. Reported %s. Nobody has been identified from the alarm alone.')
            :format(location.label or 'an unknown business', os.date('%Y-%m-%d %H:%M')),
        location = location.label,
        severity = Config.Integrations.MdtSeverity,
        status = 'open',
        actorName = 'Alarm Monitoring',
        code = response.code,
        coords = location.origin,
        robberyId = location.robberyId,
    })

    if not ok or not handle then
        if Config.Debug then
            print(('^3[XS-Robberies]^0 %s did not open an incident'):format(Mdt.name))
        end
        return
    end

    run.incident = handle
end

function Mdt.CloseIncident(run, outcome)
    if not run.incident or not Mdt.provider then return end
    if not Config.Integrations.MdtOutcome then return end
    if type(Mdt.provider.attachNote) ~= 'function' then return end

    local names = participantNames(run)
    local line = ('Outcome: %s at %s. %s'):format(
        outcome,
        os.date('%H:%M'),
        #names > 0 and ('Seen at the scene: ' .. table.concat(names, ', ') .. '.')
            or 'Nobody was identified.')

    pcall(Mdt.provider.attachNote, run.incident, line)
end
