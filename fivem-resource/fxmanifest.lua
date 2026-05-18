fx_version 'cerulean'
game 'gta5'

name 'Echo-panel'
description 'Echo Panel — FiveM Bridge Resource'
version '1.0.0'
author 'Echo Panel'

dependencies {
  '/server:5682',
}

-- MySQL: The server script auto-detects oxmysql or mysql-async at runtime
-- Do NOT add a mysql dependency here — it will load whichever is running
server_scripts {
  'config.lua',
  'server/main.lua',
}

client_scripts {
  'client/main.lua',
}

ui_page 'html/index.html'

files {
  'html/index.html',
  'html/style.css',
  'html/script.js',
}

lua54 'yes'
