fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'XS-Robberies'
author 'XyraL'
description 'Cipher — Robberies. Build any robbery from an in-game NUI: stores, banks, jewelry, houses, custom MLOs. Standalone for QBox/QBCore.'
version '0.11.0'

-- Works on QBox (qbx_core) OR QBCore (qb-core). The bridge auto-detects.
-- Inventory: ox_inventory / qb-inventory / qs-inventory / codem-inventory /
-- core_inventory / ps-inventory — bridge auto-detects, force via Config.Bridges.
-- Target: ox_target / qb-target, or a built-in marker and key prompt when the
-- server runs neither. See Config.Interaction.
-- Dispatch: XS-Dispatch / ps-dispatch / qs-dispatch / cd_dispatch /
-- core_dispatch / rcore_dispatch / origen_police, with a plain-notification
-- fallback so it works with none of them.
-- MDT: XS-MDT out of the box, any other through Config.Integrations.Generic
-- or the RegisterMdtProvider export. Entirely optional.
dependencies {
    'ox_lib',
    'oxmysql',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'shared/text.lua',
    'shared/stages.lua',
    'shared/minigames.lua',
}

client_scripts {
    'bridge/framework.lua',
    'bridge/inventory.lua',
    'bridge/target.lua',
    'bridge/dispatch.lua',
    'client/main.lua',
    'client/anchors.lua',
    'client/run.lua',
    'client/hazards.lua',
    'client/hud.lua',
    'client/sounds.lua',
    'client/minigames.lua',
    'client/builder.lua',
    'client/placement.lua',
    'client/markers.lua',
    'client/debug.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'bridge/framework.lua',
    'bridge/inventory.lua',
    'bridge/dispatch.lua',
    'bridge/mdt.lua',
    'bridge/doorlock.lua',
    'server/settings.lua',
    'server/store.lua',
    'server/presets.lua',
    'server/runs.lua',
    'server/validate.lua',
    'server/main.lua',
    'server/commands.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/style.css',
    'html/js/core.js',
    'html/js/hud.js',
    'html/js/minigames.js',
    'html/js/app.js',
    'html/js/panels/robberies.js',
    'html/js/panels/editor.js',
    'html/js/panels/graph.js',
    'html/js/panels/locations.js',
    'html/js/panels/loot.js',
    'html/js/panels/live.js',
    'html/js/panels/history.js',
    'html/js/panels/settings.js',
}
