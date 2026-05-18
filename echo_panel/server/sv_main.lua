local IsLicenseValid = false
local PlayerPlayTime = {}

-- Function to get the server IP
local function GetServerIP()
    local ip = "127.0.0.1"
    PerformHttpRequest("https://api.ipify.org/", function(err, text, headers)
        if err == 200 then ip = text end
    end, 'GET', '')
    Wait(2000)
    return ip
end

local function PrintLog(msg, isError)
    if isError then print("^1[Echo-Panel] ERROR: " .. msg .. "^0")
    else print("^2[Echo-Panel] " .. msg .. "^0") end
end

Citizen.CreateThread(function()
    PrintLog("Initializing Echo-Panel...")
    if Config.LicenseKey == "" or Config.LicenseKey == "PUT_YOUR_LICENSE_KEY_HERE" then
        PrintLog("Invalid License Key in config.lua. Stopping resource.", true)
        StopResource(GetCurrentResourceName())
        return
    end

    local serverIP = GetServerIP()
    PerformHttpRequest(Config.PanelAPI .. "/api/verify-license", function(err, text, headers)
        if err == 200 then
            local data = json.decode(text)
            if data and data.valid then
                IsLicenseValid = true
                PrintLog("License Verified Successfully! Welcome to Echo Panel.")
                StartPanelSync()
            else
                PrintLog("License Verification Failed: " .. (data.message or "Unknown Error"), true)
                StopResource(GetCurrentResourceName())
            end
        else
            PrintLog("Failed to connect to Echo Panel API. Error Code: " .. tostring(err), true)
            StopResource(GetCurrentResourceName())
        end
    end, 'POST', json.encode({
        licenseKey = Config.LicenseKey,
        serverIp = serverIP
    }), { ['Content-Type'] = 'application/json' })
end)

function StartPanelSync()
    -- Play Time Tracker
    Citizen.CreateThread(function()
        while true do
            Wait(60000) -- Update play time every minute
            if IsLicenseValid then
                local players = GetPlayers()
                for _, i in ipairs(players) do
                    local license = GetPlayerIdentifier(i, 0)
                    if license then
                        if not PlayerPlayTime[license] then PlayerPlayTime[license] = 0 end
                        PlayerPlayTime[license] = PlayerPlayTime[license] + 1
                    end
                end
            end
        end
    end)

    -- Main Sync Thread
    Citizen.CreateThread(function()
        local firstSync = true
        while true do
            Wait(Config.SyncInterval or 60000)
            if IsLicenseValid then
                local maxPlayers = GetConvarInt('sv_maxclients', 32)
                local serverName = GetConvar('sv_hostname', 'FiveM Server')
                local serverIP = GetServerIP()
                local playersData = {}
                local playerList = GetPlayers()

                for _, i in ipairs(playerList) do
                    local name = GetPlayerName(i)
                    local discord = ""
                    for _, id in ipairs(GetPlayerIdentifiers(i)) do
                        if string.find(id, "discord:") then
                            discord = string.gsub(id, "discord:", "")
                            break
                        end
                    end
                    table.insert(playersData, {
                        id = i,
                        name = name,
                        discordId = discord,
                        license = GetPlayerIdentifier(i, 0),
                        playTime = PlayerPlayTime[GetPlayerIdentifier(i, 0)] or 0
                    })
                end

                local sharedItems = nil
                local sharedJobs = nil
                local sharedGangs = nil

                -- Send shared config only on first sync or every 30 mins to save bandwidth
                if firstSync or (GetGameTimer() % 1800000 < 60000) then
                    if GetResourceState('qb-core') == 'started' then
                        local QBCore = exports['qb-core']:GetCoreObject()
                        sharedItems = QBCore.Shared.Items
                        sharedJobs = QBCore.Shared.Jobs
                        sharedGangs = QBCore.Shared.Gangs
                        sharedVehicles = QBCore.Shared.Vehicles
                    elseif GetResourceState('es_extended') == 'started' then
                        local ESX = exports['es_extended']:getSharedObject()
                        sharedItems = ESX.Items or {}
                        sharedJobs = ESX.Jobs or {}
                        sharedVehicles = ESX.Vehicles or {}
                    end
                    firstSync = false
                end

                PerformHttpRequest(Config.PanelAPI .. "/api/sync", function(err, text, headers)
                    if err == 200 then
                        local data = json.decode(text)
                        if data and data.pendingActions then
                            for _, action in ipairs(data.pendingActions) do
                                ExecuteAction(action)
                            end
                        end
                    end
                end, 'POST', json.encode({
                    licenseKey = Config.LicenseKey,
                    serverIp = serverIP,
                    players = #playerList,
                    maxPlayers = maxPlayers,
                    serverName = serverName,
                    playersData = playersData,
                    sharedItems = sharedItems,
                    sharedJobs = sharedJobs,
                    sharedGangs = sharedGangs,
                    sharedVehicles = sharedVehicles
                }), { ['Content-Type'] = 'application/json' })
            end
        end
    end)
end

function ExecuteAction(action)
    local target = action.target_id -- citizenid or source
    local type = action.action_type
    local data = json.decode(action.data or "{}")

    if type == "screenshot" then
        local src = GetPlayerFromCitizenID(target)
        if src then
            if GetResourceState('screenshot-basic') == 'started' then
                exports['screenshot-basic']:requestScreenshot(function(data)
                    PerformHttpRequest(Config.PanelAPI .. "/api/screenshots/upload", function(err, text, headers)
                    end, 'POST', json.encode({
                        targetId = target,
                        file = data
                    }), { ['Content-Type'] = 'application/json' })
                end)
            end
        end
    elseif type == "kick" then
        local src = GetPlayerFromCitizenID(target)
        if src then DropPlayer(src, data.reason or "Kicked by Admin") end
    elseif type == "additem" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then
                Player.Functions.AddItem(data.item, tonumber(data.amount) or 1)
                TriggerClientEvent('inventory:client:ItemBox', Player.PlayerData.source, exports['qb-core']:GetCoreObject().Shared.Items[data.item], "add")
            end
        end
    elseif type == "removeitem" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then
                Player.Functions.RemoveItem(data.item, 1, data.slot)
                TriggerClientEvent('inventory:client:ItemBox', Player.PlayerData.source, exports['qb-core']:GetCoreObject().Shared.Items[data.item], "remove")
            end
        end
    elseif type == "setjob" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then Player.Functions.SetJob(data.job, tonumber(data.grade) or 0) end
        end
    elseif type == "setgang" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then Player.Functions.SetGang(data.gang, tonumber(data.grade) or 0) end
        end
    elseif type == "edit_identity" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then
                local char = Player.PlayerData.charinfo
                char.firstname = data.firstname or char.firstname
                char.lastname = data.lastname or char.lastname
                char.birthdate = data.birthdate or char.birthdate
                char.gender = tonumber(data.gender) or char.gender
                char.nationality = data.nationality or char.nationality
                Player.Functions.SetPlayerData("charinfo", char)
            end
        end
    elseif type == "addvehicle" then
        if GetResourceState('qb-core') == 'started' then
            local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(target)
            if Player then
                local plate = data.plate or (string.upper(GetRandomLetter(3) .. GetRandomNumber(3)))
                MySQL.Async.insert('INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, state) VALUES (?, ?, ?, ?, ?, ?, ?)', {
                    Player.PlayerData.license,
                    Player.PlayerData.citizenid,
                    data.model,
                    GetHashKey(data.model),
                    '{}',
                    plate,
                    0
                })
                TriggerClientEvent('QBCore:Notify', Player.PlayerData.source, "تم منحك مركبة جديدة: " .. data.model, "success")
            end
        end
    end
end

function GetRandomLetter(length)
    local res = ""
    for i = 1, length do res = res .. string.char(math.random(65, 90)) end
    return res
end

function GetRandomNumber(length)
    local res = ""
    for i = 1, length do res = res .. tostring(math.random(0, 9)) end
    return res
end

function GetPlayerFromCitizenID(citizenid)
    if GetResourceState('qb-core') == 'started' then
        local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayerByCitizenId(citizenid)
        if Player then return Player.PlayerData.source end
    end
    return nil
end

-- On Player Join Sync
AddEventHandler('playerJoining', function()
    local src = source
    local name = GetPlayerName(src)
    local identifiers = GetPlayerIdentifiers(src)
    local discord = ""
    local license = ""
    for _, id in ipairs(identifiers) do
        if string.find(id, "discord:") then discord = string.gsub(id, "discord:", "")
        elseif string.find(id, "license:") then license = id end
    end
    if IsLicenseValid then
        PerformHttpRequest(Config.PanelAPI .. "/api/sync-join", function(err, text, headers) end, 'POST', json.encode({
            licenseKey = Config.LicenseKey,
            discordId = discord,
            license = license,
            name = name,
            source = src
        }), { ['Content-Type'] = 'application/json' })
    end
end)
