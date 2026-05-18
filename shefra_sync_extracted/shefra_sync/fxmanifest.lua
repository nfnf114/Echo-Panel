fx_version 'cerulean'
game 'gta5'

author 'Shefra Store'
description 'Shefra Panel Synchronization Script'
version '1.0.0'

-- qb-core is required. screenshot-basic is required for live game screen capture.
-- If screenshot-basic is not installed, screenshots will not work (face portraits won't be shown as substitute).
dependencies {
    'qb-core',
    'screenshot-basic'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'shared_config.lua',
    'config.lua',
    'server.lua'
}

client_scripts {
    'shared_config.lua',
    'client.lua'
}

ui_page 'nui/index.html'

files {
    'nui/index.html'
}
