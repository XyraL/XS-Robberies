Db = {}

local LEGACY = {
    { old = 'cipher_robberies',         new = 'xs_robberies' },
    { old = 'cipher_robbery_locations', new = 'xs_robbery_locations' },
    { old = 'cipher_robbery_state',     new = 'xs_robbery_state' },
    { old = 'cipher_robbery_runs',      new = 'xs_robbery_runs' },
    { old = 'cipher_robbery_cooldowns', new = 'xs_robbery_cooldowns' },
    { old = 'cipher_robbery_loot',      new = 'xs_robbery_loot' },
    { old = 'cipher_robbery_settings',  new = 'xs_robbery_settings' },
}

local function tableExists(name)
    local count = MySQL.scalar.await([[
        SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ]], { name })
    return (tonumber(count) or 0) > 0
end

-- Servers that ran this resource under the Cipher name still hold every robbery
-- they built in cipher_* tables. Rename them in place rather than asking owners
-- to migrate by hand. A table is only touched when the old name exists and the
-- new one does not, so this is safe to run on every start and does nothing at
-- all on a fresh install.
function Db.Migrate()
    local moved = 0

    for _, entry in ipairs(LEGACY) do
        if tableExists(entry.old) and not tableExists(entry.new) then
            local ok = pcall(function()
                MySQL.query.await(('RENAME TABLE `%s` TO `%s`'):format(entry.old, entry.new))
            end)

            if ok then
                moved = moved + 1
            else
                print(('^1[XS-Robberies]^0 could not rename %s to %s. Do it by hand before anyone builds a robbery, or the old data is stranded.')
                    :format(entry.old, entry.new))
            end
        end
    end

    if moved > 0 then
        print(('^2[XS-Robberies]^0 carried %d table%s over from the Cipher name. Your robberies came with them.')
            :format(moved, moved == 1 and '' or 's'))
    end

    return moved
end
