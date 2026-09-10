CREATE TABLE IF NOT EXISTS `cipher_robberies` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_locations` (
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
    CONSTRAINT `fk_location_robbery` FOREIGN KEY (`robbery_id`)
        REFERENCES `cipher_robberies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_state` (
    `location_id` INT          NOT NULL,
    `state`       LONGTEXT              DEFAULT NULL,
    `last_run_at` TIMESTAMP    NULL     DEFAULT NULL,
    `restock_at`  TIMESTAMP    NULL     DEFAULT NULL,
    PRIMARY KEY (`location_id`),
    CONSTRAINT `fk_state_location` FOREIGN KEY (`location_id`)
        REFERENCES `cipher_robbery_locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_runs` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_cooldowns` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `scope`      VARCHAR(16)  NOT NULL,
    `scope_key`  VARCHAR(96)  NOT NULL,
    `expires_at` TIMESTAMP    NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_scope` (`scope`, `scope_key`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_loot` (
    `id`         VARCHAR(64)  NOT NULL,
    `label`      VARCHAR(96)  NOT NULL,
    `entries`    LONGTEXT     NOT NULL,
    `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cipher_robbery_settings` (
    `key`   VARCHAR(64) NOT NULL,
    `value` TEXT                 DEFAULT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
