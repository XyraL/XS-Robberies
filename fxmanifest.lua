fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'XS-Robberies'
author 'XyraL'
description 'XS-Robberies. Build any robbery in-game: stores, ATMs, banks, jewelry, houses, vehicles, custom MLOs. QBox and QBCore.'
version '1.0.0'

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
    'client/props.lua',
    'client/npcs.lua',
    'client/contacts.lua',
    'client/doors.lua',
    'client/trucks.lua',
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
    'server/db.lua',
    'server/settings.lua',
    'server/store.lua',
    'server/runs.lua',
    'server/trucks.lua',
    'server/contacts.lua',
    'server/validate.lua',
    'server/main.lua',
    'server/commands.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/app.css',
    'html/css/play.css',
    'html/js/core.js',
    'html/js/model.js',
    'html/js/hud.js',
    'html/js/minigames.js',
    'html/js/steps.js',
    'html/js/views/plan.js',
    'html/js/views/flow.js',
    'html/js/views/loot.js',
    'html/js/views/props.js',
    'html/js/views/npcs.js',
    'html/js/views/places.js',
    'html/js/views/rules.js',
    'html/js/views/server.js',
    'html/js/inspector.js',
    'html/js/setup.js',
    'html/js/app.js',
}
