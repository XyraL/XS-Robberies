Store = { robberies = {}, locations = {}, loot = {}, ready = false }

local function truthy(value)
    -- oxmysql hands TINYINT(1) back as a Lua boolean, not a number, so a plain
    -- `== 1` is false for every row and everything loads back disabled.
    return value == true or value == 1 or value == '1'
end

local function decode(raw, fallback)
    if not raw or raw == '' then return fallback end
    local ok, out = pcall(json.decode, raw)
    if not ok or out == nil then return fallback end
    return out
end

local function rowToRobbery(row)
    local def = decode(row.data, {})
    def.id       = row.id
    def.name     = row.name
    def.category = row.category
    def.enabled  = truthy(row.enabled)
    def.author   = row.author
    def.revision = row.revision
    def.stages   = def.stages or {}
    def.anchor   = def.anchor or {}
    def.gates    = def.gates or {}
    def.response = def.response or {}
    def.blip     = def.blip or {}
    return def
end

local function rowToLocation(row)
    return {
        id        = row.id,
        robberyId = row.robbery_id,
        label     = row.label,
        enabled   = truthy(row.enabled),
        origin    = decode(row.origin, { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }),
        overrides = decode(row.overrides, {}),
        offsets   = decode(row.offsets, {}),
    }
end

function Store.Load()
    local robberies = MySQL.query.await('SELECT * FROM cipher_robberies') or {}
    Store.robberies = {}
    for _, row in ipairs(robberies) do
        Store.robberies[row.id] = rowToRobbery(row)
    end

    local locations = MySQL.query.await('SELECT * FROM cipher_robbery_locations') or {}
    Store.locations = {}
    for _, row in ipairs(locations) do
        Store.locations[row.id] = rowToLocation(row)
    end

    local loot = MySQL.query.await('SELECT * FROM cipher_robbery_loot') or {}
    Store.loot = {}
    for _, row in ipairs(loot) do
        Store.loot[row.id] = {
            id = row.id,
            label = row.label,
            entries = decode(row.entries, {}),
        }
    end

    Store.ready = true

    if Config.Debug then
        local count = 0
        for _ in pairs(Store.robberies) do count = count + 1 end
        print(('^2[XS-Robberies]^0 loaded %d definitions, %d locations, %d loot tables')
            :format(count, #locations, #loot))
    end
end

function Store.List()
    local out = {}
    for _, def in pairs(Store.robberies) do
        out[#out + 1] = {
            id = def.id,
            name = def.name,
            category = def.category,
            enabled = def.enabled,
            author = def.author,
            revision = def.revision,
            stageCount = #(def.stages or {}),
            locationCount = #Store.LocationsFor(def.id),
        }
    end
    table.sort(out, function(a, b) return a.name < b.name end)
    return out
end

function Store.Get(id)
    return Store.robberies[id]
end

function Store.LocationsFor(robberyId)
    local out = {}
    for _, loc in pairs(Store.locations) do
        if loc.robberyId == robberyId then out[#out + 1] = loc end
    end
    table.sort(out, function(a, b) return a.id < b.id end)
    return out
end

function Store.AllLocations()
    local out = {}
    for _, loc in pairs(Store.locations) do out[#out + 1] = loc end
    table.sort(out, function(a, b) return a.id < b.id end)
    return out
end

local function slugify(name)
    local slug = (name or ''):lower():gsub('[^%w]+', '_'):gsub('^_+', ''):gsub('_+$', '')
    if slug == '' then slug = 'robbery' end
    return slug
end

function Store.NewId(name)
    local base = slugify(name)
    local id, n = base, 2
    while Store.robberies[id] do
        id = ('%s_%d'):format(base, n)
        n = n + 1
    end
    return id
end

function Store.Save(def, author)
    if not def or not def.id or def.id == '' then
        return false, 'That definition has no id.'
    end

    local existing = Store.robberies[def.id]
    def.revision = (existing and existing.revision or 0) + 1
    def.author = def.author or author
    def.stages = def.stages or {}

    local payload = {
        anchor   = def.anchor or {},
        blip     = def.blip or {},
        radius   = def.radius,
        origin   = def.origin,
        gates    = def.gates or {},
        response = def.response or {},
        stages   = def.stages,
        notes    = def.notes,
    }

    MySQL.query.await([[
        INSERT INTO cipher_robberies (id, name, category, enabled, author, revision, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name), category = VALUES(category), enabled = VALUES(enabled),
            author = VALUES(author), revision = VALUES(revision), data = VALUES(data)
    ]], {
        def.id, def.name or 'Untitled', def.category or 'custom',
        def.enabled and 1 or 0, def.author, def.revision, json.encode(payload),
    })

    Store.robberies[def.id] = def
    return true, def
end

function Store.Delete(id)
    if not Store.robberies[id] then return false, 'No such robbery.' end

    MySQL.prepare.await('DELETE FROM cipher_robberies WHERE id = ?', { id })
    Store.robberies[id] = nil

    for locId, loc in pairs(Store.locations) do
        if loc.robberyId == id then Store.locations[locId] = nil end
    end
    return true
end

function Store.Duplicate(id, newName)
    local src = Store.robberies[id]
    if not src then return false, 'No such robbery.' end

    local copy = json.decode(json.encode(src))
    copy.name = newName or (src.name .. ' copy')
    copy.id = Store.NewId(copy.name)
    copy.revision = 0

    return Store.Save(copy, src.author)
end

function Store.SaveLocation(loc)
    if not loc.robberyId or not Store.robberies[loc.robberyId] then
        return false, 'That location points at a robbery that does not exist.'
    end

    local origin    = json.encode(loc.origin or {})
    local overrides = json.encode(loc.overrides or {})
    local offsets   = json.encode(loc.offsets or {})

    if loc.id then
        MySQL.query.await([[
            UPDATE cipher_robbery_locations
            SET label = ?, enabled = ?, origin = ?, overrides = ?, offsets = ?
            WHERE id = ?
        ]], { loc.label or 'Location', loc.enabled and 1 or 0, origin, overrides, offsets, loc.id })
    else
        loc.id = MySQL.insert.await([[
            INSERT INTO cipher_robbery_locations (robbery_id, label, enabled, origin, overrides, offsets)
            VALUES (?, ?, ?, ?, ?, ?)
        ]], { loc.robberyId, loc.label or 'Location', loc.enabled and 1 or 0, origin, overrides, offsets })

        if not loc.id then
            return false, 'The database did not give the new location an id.'
        end
    end

    Store.locations[loc.id] = loc
    return true, loc
end

function Store.DeleteLocation(id)
    MySQL.prepare.await('DELETE FROM cipher_robbery_locations WHERE id = ?', { id })
    Store.locations[id] = nil
    return true
end

function Store.SaveLoot(table_)
    if not table_.id or table_.id == '' then return false, 'That loot table has no id.' end

    MySQL.query.await([[
        INSERT INTO cipher_robbery_loot (id, label, entries) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE label = VALUES(label), entries = VALUES(entries)
    ]], { table_.id, table_.label or table_.id, json.encode(table_.entries or {}) })

    Store.loot[table_.id] = table_
    return true, table_
end

function Store.DeleteLoot(id)
    MySQL.prepare.await('DELETE FROM cipher_robbery_loot WHERE id = ?', { id })
    Store.loot[id] = nil
    return true
end

function Store.LootList()
    local out = {}
    for _, t in pairs(Store.loot) do out[#out + 1] = t end
    table.sort(out, function(a, b) return a.label < b.label end)
    return out
end

local function defOrigin(def)
    if def.origin and def.origin.x then return def.origin end
    local first = (def.stages or {})[1]
    return first and first.coords or { x = 0.0, y = 0.0, z = 0.0, h = 0.0 }
end

function Store.LayoutStages(def, origin, offsets, overrides)
    local base = defOrigin(def)
    local turn = math.rad(((origin.h or 0.0) - (base.h or 0.0)) % 360)
    local cos, sin = math.cos(turn), math.sin(turn)

    offsets = offsets or {}
    overrides = overrides or {}

    -- A stage is gone here if the design switched it off, or if this one site
    -- did. A custom interior with no back room turns the safe off without
    -- touching the fifteen shops that do have one.
    local off = {}
    for _, stage in ipairs(def.stages or {}) do
        if stage.enabled == false then off[stage.id] = true end
    end
    for id, gone in pairs(overrides.disabledStages or {}) do
        if gone then off[id] = true end
    end

    local function keep(requires)
        local out = {}
        for _, id in ipairs(requires or {}) do
            if not off[id] then out[#out + 1] = id end
        end
        return out
    end

    local stages = {}
    for _, stage in ipairs(def.stages or {}) do
        if stage.coords and not off[stage.id] then
            local nudge = offsets[stage.id] or {}

            local vx = stage.coords.x - (base.x or 0.0)
            local vy = stage.coords.y - (base.y or 0.0)

            stages[#stages + 1] = {
                id = stage.id,
                type = stage.type,
                label = stage.label,
                requires = keep(stage.requires),
                payout = stage.payout or {},
                opts = (function()
                    local opts = {}
                    for k, v in pairs(stage.opts or {}) do opts[k] = v end
                    if opts.codeFrom and off[opts.codeFrom] then opts.codeFrom = '' end
                    if opts.pairWith and off[opts.pairWith] then opts.pairWith = '' end
                    return opts
                end)(),
                coords = {
                    x = (origin.x or 0.0) + (vx * cos - vy * sin) + (nudge.x or 0.0),
                    y = (origin.y or 0.0) + (vx * sin + vy * cos) + (nudge.y or 0.0),
                    z = (origin.z or 0.0) + (stage.coords.z - (base.z or 0.0)) + (nudge.z or 0.0),
                    h = ((stage.coords.h or 0.0) + math.deg(turn)) % 360,
                },
            }
        end
    end

    return stages
end

function Store.Anchor(def)
    local anchor = def.anchor or {}
    return {
        kind = anchor.kind or 'location',
        models = anchor.models or {},
        pool = anchor.pool or 'object',
        scanRange = anchor.scanRange or 80.0,
    }
end

function Store.Resolve(locationId)
    local loc = Store.locations[locationId]
    if not loc then return nil end

    local def = Store.robberies[loc.robberyId]
    if not def then return nil end

    local overrides = loc.overrides or {}

    local gates = {}
    for k, v in pairs(def.gates or {}) do gates[k] = v end
    for k, v in pairs(overrides.gates or {}) do gates[k] = v end

    return {
        id = loc.id,
        robberyId = def.id,
        name = def.name,
        label = loc.label,
        enabled = def.enabled and loc.enabled,
        origin = loc.origin,
        payoutMultiplier = overrides.payoutMultiplier or 1.0,
        radius = overrides.radius or def.radius or 30.0,
        blip = def.blip or {},
        gates = gates,
        response = def.response or {},
        stages = Store.LayoutStages(def, loc.origin, loc.offsets, overrides),
    }
end

-- A robbery anchored to prop models has no stamped locations. Every matching
-- object in the world is an instance, identified by where it stands.
function Store.InstanceId(robberyId, anchor)
    return ('m:%s:%.1f_%.1f_%.1f'):format(robberyId, anchor.x or 0.0, anchor.y or 0.0, anchor.z or 0.0)
end

function Store.ResolveModel(robberyId, anchor)
    local def = Store.robberies[robberyId]
    if not def or not def.enabled then return nil end
    if Store.Anchor(def).kind ~= 'model' then return nil end
    if not anchor or not anchor.x then return nil end

    local origin = { x = anchor.x, y = anchor.y, z = anchor.z, h = anchor.h or 0.0 }

    return {
        id = Store.InstanceId(robberyId, origin),
        robberyId = def.id,
        name = def.name,
        label = def.name,
        enabled = true,
        origin = origin,
        payoutMultiplier = 1.0,
        radius = def.radius or 30.0,
        blip = def.blip or {},
        gates = def.gates or {},
        response = def.response or {},
        stages = Store.LayoutStages(def, origin, nil, nil),
        modelAnchored = true,
    }
end

function Store.ModelRobberies()
    local out = {}
    for _, def in pairs(Store.robberies) do
        local anchor = Store.Anchor(def)
        if def.enabled and anchor.kind == 'model' and #anchor.models > 0 then
            out[#out + 1] = {
                id = def.id,
                name = def.name,
                models = anchor.models,
                pool = anchor.pool or 'object',
                scanRange = anchor.scanRange,
                radius = def.radius or 30.0,
                blip = def.blip or {},
                stages = def.stages or {},
                origin = defOrigin(def),
            }
        end
    end
    return out
end

function Store.ResolveAll()
    local out = {}
    for id in pairs(Store.locations) do
        local resolved = Store.Resolve(id)
        if resolved and resolved.enabled then out[#out + 1] = resolved end
    end
    return out
end
