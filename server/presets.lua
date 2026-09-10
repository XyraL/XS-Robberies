Presets = { files = { 'store_247', 'atm', 'banktruck', 'fleeca', 'jewelry', 'paleto', 'pacific' } }

local function read(id)
    local raw = LoadResourceFile(GetCurrentResourceName(), ('presets/%s.json'):format(id))
    if not raw then return nil end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then return nil end
    return decoded
end

local function missingItems(data)
    local missing = {}
    for _, name in ipairs((data.preset or {}).requires or {}) do
        if not Inv.Exists(name) then missing[#missing + 1] = name end
    end
    return missing
end

function Presets.List()
    local out = {}

    for _, id in ipairs(Presets.files) do
        local data = read(id)

        if data and data.robbery then
            local anchor = data.robbery.anchor or {}

            out[#out + 1] = {
                id = id,
                name = data.preset.name,
                description = data.preset.description,
                alignedTo = data.preset.alignedTo,
                locationsNote = data.preset.locationsNote,
                stageCount = #(data.robbery.stages or {}),
                locationCount = #(data.locations or {}),
                anchorKind = anchor.kind or 'location',
                models = anchor.models or {},
                installed = Store.robberies[data.robbery.id or id] ~= nil,
                missingItems = missingItems(data),
            }
        end
    end

    return out
end

function Presets.Install(id, author, stampAll)
    local data = read(id)
    if not data or not data.robbery then
        return false, 'That preset could not be read.'
    end

    for _, table_ in ipairs(data.loot or {}) do
        if not Store.loot[table_.id] then Store.SaveLoot(table_) end
    end

    local def = data.robbery
    def.id = Store.NewId(def.name or id)
    def.author = author
    def.enabled = false
    def.revision = 0

    local ok, saved = Store.Save(def, author)
    if not ok then return false, saved end

    local stamped = 0
    if stampAll then
        for _, entry in ipairs(data.locations or {}) do
            local placed = Store.SaveLocation({
                robberyId = saved.id,
                label = entry.label,
                enabled = true,
                origin = entry.origin,
                overrides = {},
                offsets = {},
            })
            if placed then stamped = stamped + 1 end
        end
    end

    return true, saved, stamped
end
