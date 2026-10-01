Db = { ready = false }

local LEGACY = {
    { old = 'cipher_robberies',         new = 'xs_robberies' },
    { old = 'cipher_robbery_locations', new = 'xs_robbery_locations' },
    { old = 'cipher_robbery_state',     new = 'xs_robbery_state' },
    { old = 'cipher_robbery_runs',      new = 'xs_robbery_runs' },
    { old = 'cipher_robbery_cooldowns', new = 'xs_robbery_cooldowns' },
    { old = 'cipher_robbery_loot',      new = 'xs_robbery_loot' },
    { old = 'cipher_robbery_settings',  new = 'xs_robbery_settings' },
}

local TABLES = {
    [[
        CREATE TABLE IF NOT EXISTS `xs_robberies` (
            `id`          VARCHAR(64)  NOT NULL,
            `name`        VARCHAR(96)  NOT NULL,
            `category`    VARCHAR(32)  NOT NULL DEFAULT 'custom',
            `enabled`     TINYINT(1)   NOT NULL DEFAULT 1,
            `author`      VARCHAR(96)           DEFAULT NULL,
            `revision`    INT          NOT NULL DEFAULT 1,
            `data`        LONGTEXT     NOT NULL,
            `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_category` (`category`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_locations` (
            `id`          INT          NOT NULL AUTO_INCREMENT,
            `robbery_id`  VARCHAR(64)  NOT NULL,
            `label`       VARCHAR(96)  NOT NULL,
            `enabled`     TINYINT(1)   NOT NULL DEFAULT 1,
            `origin`      VARCHAR(128) NOT NULL,
            `overrides`   LONGTEXT              DEFAULT NULL,
            `offsets`     LONGTEXT              DEFAULT NULL,
            `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_robbery` (`robbery_id`),
            FOREIGN KEY (`robbery_id`) REFERENCES `xs_robberies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_state` (
            `location_id` INT          NOT NULL,
            `state`       LONGTEXT              DEFAULT NULL,
            `last_run_at` TIMESTAMP    NULL     DEFAULT NULL,
            `restock_at`  TIMESTAMP    NULL     DEFAULT NULL,
            PRIMARY KEY (`location_id`),
            FOREIGN KEY (`location_id`) REFERENCES `xs_robbery_locations` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_runs` (
            `id`           INT          NOT NULL AUTO_INCREMENT,
            `robbery_id`   VARCHAR(64)  NOT NULL,
            `location_id`  INT                   DEFAULT NULL,
            `started_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `ended_at`     TIMESTAMP    NULL     DEFAULT NULL,
            `outcome`      VARCHAR(24)  NOT NULL DEFAULT 'active',
            `participants` LONGTEXT              DEFAULT NULL,
            `stages_done`  LONGTEXT              DEFAULT NULL,
            `payout`       INT          NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`),
            KEY `idx_robbery` (`robbery_id`),
            KEY `idx_started` (`started_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_cooldowns` (
            `id`         INT          NOT NULL AUTO_INCREMENT,
            `scope`      VARCHAR(16)  NOT NULL,
            `scope_key`  VARCHAR(96)  NOT NULL,
            `expires_at` TIMESTAMP    NOT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_scope` (`scope`, `scope_key`),
            KEY `idx_expires` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_loot` (
            `id`         VARCHAR(64)  NOT NULL,
            `label`      VARCHAR(96)  NOT NULL,
            `entries`    LONGTEXT     NOT NULL,
            `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
    [[
        CREATE TABLE IF NOT EXISTS `xs_robbery_settings` (
            `key`   VARCHAR(64) NOT NULL,
            `value` TEXT                 DEFAULT NULL,
            PRIMARY KEY (`key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]],
}

local function tableExists(name)
    local count = MySQL.scalar.await([[
        SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ]], { name })
    return (tonumber(count) or 0) > 0
end

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

function Db.Install()
    for _, statement in ipairs(TABLES) do
        local ok, err = pcall(MySQL.query.await, statement)
        if not ok then
            print(('^1[XS-Robberies]^0 could not create a table: %s'):format(tostring(err)))
            return false
        end
    end
    return true
end

function Db.Setup()
    Db.Migrate()
    Db.ready = Db.Install()
    return Db.ready
end
