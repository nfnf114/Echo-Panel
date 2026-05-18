-- ============================================================
-- Shefra Store - INTERNAL SYNC LOGIC (DEBUG MODE)
-- ============================================================

local PANEL_API_URL = Config.BackendURL .. "/api/sync"
local ACTIONS_URL   = Config.BackendURL .. "/api/actions"
local UPLOAD_URL    = Config.BackendURL .. "/api/screenshots/upload"

local QBCore = nil
CreateThread(function()
    while QBCore == nil do
        Wait(1000)
        local ok, res = pcall(function() return exports['qb-core']:GetCoreObject() end)
        if ok and res then 
            QBCore = res 
            print("^2[Shefra Sync] ^7QBCore linked successfully.")
        end
    end
end)

local syncCount = 0
local sessionStartTimes = {}
local liveDiscovered = {}
local liveLocations = {}
local portraitCache = {}
local screenshotRateLimit = {} -- Rate limiting for screenshot requests per citizenid

local function GetIdentifier(src, idType)
    local identifiers = GetPlayerIdentifiers(src)
    for _, identifier in pairs(identifiers) do
        if string.find(identifier, idType) then
            return identifier
        end
    end
    return nil
end

-- ============================================================
-- ACTION HANDLER
-- ============================================================
local function GetPlayerByCitizenId(id)
    if not QBCore then return nil end
    local Player = QBCore.Functions.GetPlayerByCitizenId(id)
    if Player then return Player, Player.PlayerData.source end
    if tonumber(id) then
        local p = QBCore.Functions.GetPlayer(tonumber(id))
        if p then return p, p.PlayerData.source end
    end
    return nil, nil
end

local SendDataToPanel = nil -- Forward declaration

local function HandleAction(action)
    local actionType = action.action_type
    local targetId   = action.target_id
    local data       = type(action.data) == "string" and json.decode(action.data) or action.data or {}

    local Player, src = GetPlayerByCitizenId(targetId)

    if actionType == "kick" then
        if src then DropPlayer(src, data.reason or "Kicked by Admin") end
    elseif actionType == "revive" then
        if src then
            TriggerClientEvent('hospital:client:Revive', src)
            if Player then
                Player.Functions.SetMetaData('isdead', false)
                Player.Functions.SetMetaData('inlaststand', false)
            end
        end
    elseif actionType == "feed" then
        if src and Player then
            Player.Functions.SetMetaData('hunger', 100)
            Player.Functions.SetMetaData('thirst', 100)
            TriggerClientEvent('hud:client:UpdateNeeds', src, 100, 100)
        end
    elseif actionType == "teleport" then
        if src and data.coords then
            local coords = data.coords
            if type(coords) == 'string' then
                -- More robust matching for vector3/4 and raw coords
                local x, y, z = string.match(coords, 'vector[34]%s*%(%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)')
                if not x then x, y, z = string.match(coords, '%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)') end
                
                if x and y and z then 
                    coords = vector3(tonumber(x), tonumber(y), tonumber(z)) 
                else
                    print("^1[Shefra Sync] ^7Invalid coords format: " .. tostring(coords))
                    return
                end
            elseif type(coords) == 'table' then
                coords = vector3(tonumber(coords.x or coords[1] or 0), tonumber(coords.y or coords[2] or 0), tonumber(coords.z or coords[3] or 0))
            end
            
            if type(coords) == 'vector3' then
                TriggerClientEvent('shefra:client:TeleportToCoords', src, coords)
            end
        end
    elseif actionType == "addmoney" then
        if Player and data.amount then
            Player.Functions.AddMoney(data.type or "cash", tonumber(data.amount))
            Player.Functions.Save()
            if SendDataToPanel then SendDataToPanel(true) end
        end
    elseif actionType == "removemoney" then
        if Player and data.amount then
            Player.Functions.RemoveMoney(data.type or "cash", tonumber(data.amount))
            Player.Functions.Save()
            if SendDataToPanel then SendDataToPanel(true) end
        end
    elseif actionType == "message" then
        if src and data.message then
            TriggerClientEvent('chat:addMessage', src, {
                template = '<div style="padding:15px;margin:10px;background:rgba(20,20,20,0.95);border:2px solid #ea333f;border-radius:10px;"><div style="color:#ea333f;font-weight:900;text-align:center;">[ADMIN MESSAGE]</div><div style="color:white;text-align:center;">{0}</div></div>',
                args = { data.message }
            })
        end
    elseif actionType == "notify" then
        local msg = data.message or "No message"
        local isPublic = data.isPublic or false
        local template = '<div style="padding:15px;margin:10px;background:rgba(20,20,20,0.95);border:2px solid #ea333f;border-radius:10px;"><div style="color:#ea333f;font-weight:900;text-align:center;">[ADMIN NOTICE]</div><div style="color:white;text-align:center;">{0}</div></div>'
        
        if isPublic then
            template = '<div style="padding:15px;margin:10px;background:rgba(20,20,20,0.95);border:2px solid #00a2ff;border-radius:10px;"><div style="color:#00a2ff;font-weight:900;text-align:center;">[PUBLIC NOTICE]</div><div style="color:white;text-align:center;">{0}</div></div>'
        end

        if targetId == "GLOBAL" then
            TriggerClientEvent('chat:addMessage', -1, {
                template = template,
                args = { msg }
            })
        elseif src then
            TriggerClientEvent('chat:addMessage', src, {
                template = template,
                args = { msg }
            })
        end
    elseif actionType == "setjob" then
        if Player and data.job then
            Player.Functions.SetJob(data.job, tonumber(data.grade) or 0)
            Player.Functions.Save()
            if SendDataToPanel then SendDataToPanel(true) end
        else
            local jobData = { name = data.job, grade = { level = tonumber(data.grade) or 0 } }
            exports.oxmysql:execute('UPDATE players SET job = ? WHERE citizenid = ?', { json.encode(jobData), targetId })
        end
    elseif actionType == "setgang" then
        if Player and data.gang then
            Player.Functions.SetGang(data.gang, tonumber(data.grade) or 0)
            Player.Functions.Save()
            if SendDataToPanel then SendDataToPanel(true) end
        else
            local gangData = { name = data.gang, grade = { level = tonumber(data.grade) or 0 } }
            exports.oxmysql:execute('UPDATE players SET gang = ? WHERE citizenid = ?', { json.encode(gangData), targetId })
        end
    elseif actionType == "edit_identity" then
        if src then DropPlayer(src, "تم تعديل على معلوماتك من قبل الإدارة. يرجى الدخول مجدداً.") Wait(1000) end
        local result = exports.oxmysql:executeSync('SELECT charinfo FROM players WHERE citizenid = ?', { targetId })
        if result[1] and result[1].charinfo then
            local char = json.decode(result[1].charinfo)
            char.firstname = data.firstname or char.firstname
            char.lastname = data.lastname or char.lastname
            char.birthdate = data.birthdate or char.birthdate
            char.gender = tonumber(data.gender) or char.gender
            char.nationality = data.nationality or char.nationality
            exports.oxmysql:execute('UPDATE players SET charinfo = ? WHERE citizenid = ?', { json.encode(char), targetId })
        end
    elseif actionType == "additem" then
        if Player and data.item then
            Player.Functions.AddItem(data.item, tonumber(data.amount) or 1)
            Player.Functions.Save()
            TriggerClientEvent('inventory:client:ItemBox', src, QBCore.Shared.Items[data.item], "add")
            if SendDataToPanel then SendDataToPanel(true) end
        else
            -- Check if this is a stash item addition (targetId is a stash ID, not a citizenid)
            local isStash = false
            if not Player and targetId then
                -- Try to find the item in stashitems table
                local stashResult = exports.oxmysql:executeSync('SELECT items FROM stashitems WHERE stash = ? OR id = ? LIMIT 1', { targetId, targetId })
                if stashResult and stashResult[1] then
                    isStash = true
                    local items = json.decode(stashResult[1].items) or {}
                    local isObj = type(items) == "table" and not items[1]

                    if isObj then
                        -- QBCore slot-keyed format
                        local maxSlot = 0
                        for k, v in pairs(items) do
                            local s = v.slot or tonumber(k) or 0
                            if s > maxSlot then maxSlot = s end
                        end

                        -- Check if item exists to merge
                        local found = false
                        for k, v in pairs(items) do
                            if v.name == data.item then
                                items[k].amount = (items[k].amount or 0) + (tonumber(data.amount) or 1)
                                found = true
                                break
                            end
                        end

                        if not found then
                            local nextSlot = maxSlot + 1
                            items[tostring(nextSlot)] = {
                                slot = nextSlot,
                                name = data.item,
                                amount = tonumber(data.amount) or 1,
                                type = "item",
                                label = data.label or data.item,
                                info = {}
                            }
                        end
                    else
                        -- Array format
                        local maxSlot = 0
                        for _, v in ipairs(items) do
                            if v.slot and v.slot > maxSlot then maxSlot = v.slot end
                        end

                        local found = false
                        for _, v in ipairs(items) do
                            if v.name == data.item then
                                v.amount = (v.amount or 0) + (tonumber(data.amount) or 1)
                                found = true
                                break
                            end
                        end

                        if not found then
                            table.insert(items, {
                                slot = maxSlot + 1,
                                name = data.item,
                                amount = tonumber(data.amount) or 1,
                                type = "item",
                                label = data.label or data.item,
                                info = {}
                            })
                        end
                    end

                    exports.oxmysql:execute('UPDATE stashitems SET items = ? WHERE stash = ? OR id = ?', {
                        json.encode(items), targetId, targetId
                    })
                    print("^2[Shefra Sync] ^7Added item " .. (data.item or "?") .. " to stash " .. targetId)
                else
                    -- Stash doesn't exist yet — create it with QBCore slot-keyed format
                    local newItems = {
                        ["1"] = {
                            slot = 1,
                            name = data.item,
                            amount = tonumber(data.amount) or 1,
                            type = "item",
                            label = data.label or data.item,
                            info = {}
                        }
                    }
                    exports.oxmysql:insert('INSERT INTO stashitems (stash, items) VALUES (?, ?)', {
                        targetId, json.encode(newItems)
                    })
                    print("^2[Shefra Sync] ^7Created new stash " .. targetId .. " with item " .. (data.item or "?"))
                end
            end

            -- If not a stash and player is offline, add to player inventory via DB
            if not isStash and targetId then
                local result = exports.oxmysql:executeSync('SELECT inventory FROM players WHERE citizenid = ?', { targetId })
                if result[1] and result[1].inventory then
                    local inventory = json.decode(result[1].inventory)
                    table.insert(inventory, { name = data.item, amount = tonumber(data.amount) or 1, info = {}, type = "item", slot = #inventory + 1 })
                    exports.oxmysql:execute('UPDATE players SET inventory = ? WHERE citizenid = ?', { json.encode(inventory), targetId })
                end
            end
        end
    elseif actionType == "removeitem" then
        if Player and data.item then
            Player.Functions.RemoveItem(data.item, 1, data.slot)
            Player.Functions.Save()
            TriggerClientEvent('inventory:client:ItemBox', src, QBCore.Shared.Items[data.item], "remove")
            if SendDataToPanel then SendDataToPanel(true) end
        else
            local result = exports.oxmysql:executeSync('SELECT inventory FROM players WHERE citizenid = ?', { targetId })
            if result[1] and result[1].inventory then
                local inventory = json.decode(result[1].inventory)
                for i, item in ipairs(inventory) do
                    if item.name == data.item then
                        table.remove(inventory, i)
                        break
                    end
                end
                exports.oxmysql:execute('UPDATE players SET inventory = ? WHERE citizenid = ?', { json.encode(inventory), targetId })
            end
        end
    elseif actionType == "delete_character" then
        if src then DropPlayer(src, "تم حذف شخصيتك من قبل الإدارة.") end
        -- Delete from ALL related tables to ensure complete removal
        exports.oxmysql:execute('DELETE FROM players WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_vehicles WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_houses WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_mails WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_phone_messages WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_contacts WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM crypto_transactions WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_outfits WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_tattoos WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_accessories WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM stashitems WHERE stash = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_banking WHERE citizenid = ?', { targetId })
        exports.oxmysql:execute('DELETE FROM player_logs WHERE citizenid = ?', { targetId })
        -- Delete from panel analytics too
        exports.oxmysql:execute('DELETE FROM player_analytics WHERE citizenid = ?', { targetId })
        print("^2[Shefra Sync] ^7Character " .. targetId .. " fully deleted from database.")
    elseif actionType == "clothing" then
        if src then TriggerClientEvent('qb-clothing:client:openMenu', src) end
    elseif actionType == "cuff" then
        if src then TriggerClientEvent('shefra:client:ToggleCuff', src) end
    elseif actionType == "freeze" then
        if src then TriggerClientEvent('shefra:client:SetFreeze', src, data.freeze) end
    elseif actionType == "weather" then
        if data.weather then
            ExecuteCommand('weather ' .. data.weather)
            TriggerClientEvent('shefra:client:SetWeather', -1, data.weather)
        end
    elseif actionType == "time" then
        if data.hour then
            ExecuteCommand('time ' .. data.hour .. ' 0')
            TriggerClientEvent('shefra:client:SetTime', -1, tonumber(data.hour), 0)
        end
    elseif actionType == "repair_vehicle" then
        if src then TriggerClientEvent('shefra:client:RepairVehicle', src) end
    elseif actionType == "screenshot" then
        if src then
            -- Rate limiting: check if this player was recently captured
            local now = os.time()
            local lastCapture = screenshotRateLimit[targetId] or 0
            if now - lastCapture < 5 then
                print("^3[Shefra Sync] ^7Screenshot rate limited for player: " .. targetId .. " (" .. (5 - (now - lastCapture)) .. "s cooldown)")
            else
                screenshotRateLimit[targetId] = now
                print("^3[Shefra Sync] ^7Requesting screenshot for player: " .. GetPlayerName(src) .. " (" .. targetId .. ")")
                TriggerClientEvent('shefra:client:TakeScreenshot', src, targetId)
            end
        end
    elseif actionType == "live_screenshot" then
        -- Low-quality auto-capture for live streaming
        if src then
            local now = os.time()
            local lastCapture = screenshotRateLimit[targetId] or 0
            -- Longer cooldown for live screenshots (uses Config interval or 10s default)
            local cooldown = Config.ScreenshotInterval or 1
            if now - lastCapture < cooldown then
                -- Silently skip rate-limited live captures (expected behavior)
            else
                screenshotRateLimit[targetId] = now
                TriggerClientEvent('shefra:client:TakeLiveScreenshot', src, targetId)
            end
        end
    elseif actionType == "screenshot_all" then
        -- Capture all online players (staggered)
        if QBCore then
            local qbPlayers = QBCore.Functions.GetQBPlayers()
            local delay = 0
            for pSrc, Player in pairs(qbPlayers) do
                if Player then
                    local cid = Player.PlayerData.citizenid
                    SetTimeout(delay * 2000, function()
                        TriggerClientEvent('shefra:client:TakeScreenshot', pSrc, cid)
                    end)
                    delay = delay + 1
                end
            end
            print("^2[Shefra Sync] ^7Screenshot all requested for " .. delay .. " players (staggered).")
        end
    elseif actionType == "give_vehicle" or actionType == "addvehicle" then
        local model = data.model or data.vehicle
        if model then
            local plate = (data.plate and data.plate ~= "") and data.plate:upper() or (string.upper(GetRandomLetter(3) .. GetRandomNumber(3)))
            local garage = data.garage or "alta"
            
            local targetLicense = "Unknown"
            if Player then 
                targetLicense = Player.PlayerData.license 
            else
                local result = exports.oxmysql:executeSync('SELECT license FROM players WHERE citizenid = ?', { targetId })
                if result[1] and result[1].license then targetLicense = result[1].license end
            end
            
            -- Insert into database
            exports.oxmysql:insert('INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', {
                targetLicense,
                targetId,
                model,
                GetHashKey(model),
                '{}',
                plate,
                garage,
                1
            })
            
            if src then
                TriggerClientEvent('QBCore:Notify', src, "لقد حصلت على مركبة جديدة: " .. model .. " في كراج: " .. garage, "success")
            end
            print("^2[Shefra Sync] ^7Vehicle " .. model .. " given to " .. targetId .. " with plate " .. plate)
            if SendDataToPanel then SendDataToPanel(true) end
        end
    elseif actionType == "ban" then
        local reason = data.reason or "No reason provided"
        local durationRaw = data.duration or "permanent"
        local name = data.name or targetId
        local bannedby = "Shefra Admin Panel"
        
        -- Parse duration: convert "1d", "3d", "7d", "30d" to hours, "permanent" = 0
        local duration = 0
        if type(durationRaw) == "string" then
            local days = tonumber(string.match(durationRaw, "(%d+)d"))
            if days then
                duration = days * 24
            elseif durationRaw ~= "permanent" then
                local hours = tonumber(durationRaw)
                if hours then duration = hours end
            end
        elseif type(durationRaw) == "number" then
            duration = durationRaw
        end
        
        local expire = 2147483647 -- Permanent by default
        if duration > 0 then
            expire = os.time() + (duration * 3600)
        end
        
        -- Get player details if possible (online or offline)
        local targetLicense = targetId
        local targetDiscord = ""
        local targetIP = ""
        
        if src then
            local rawLicense = GetIdentifier(src, 'license') or targetId
            -- Store WITHOUT the "license:" prefix for consistent matching
            targetLicense = rawLicense:gsub("^license:", "")
            local rawDiscord = GetIdentifier(src, 'discord') or ""
            targetDiscord = rawDiscord:gsub("^discord:", "")
            targetIP = GetPlayerEndpoint(src) or ""
            name = GetPlayerName(src)
        else
            -- Try to find in database
            local result = exports.oxmysql:executeSync('SELECT license FROM players WHERE citizenid = ? OR license = ?', { targetId, targetId })
            if result and result[1] then 
                targetLicense = result[1].license
                -- Clean prefix if present
                targetLicense = targetLicense:gsub("^license:", "")
            end
        end

        -- Generate ban code from license
        local banCode = string.upper(string.sub(targetLicense, 1, 8))

        -- Insert into bans table (store clean license without prefix)
        exports.oxmysql:insert('INSERT INTO bans (name, license, discord, ip, reason, expire, bannedby) VALUES (?, ?, ?, ?, ?, ?, ?)', {
            name, targetLicense, targetDiscord, targetIP, reason, expire, bannedby
        })
        
        -- Kick the player with a detailed Arabic ban message
        if src then
            local durationText = ""
            if duration == 0 then
                durationText = "مؤبد"
            else
                durationText = duration .. " ساعة"
            end
            local serverDisplayName = (Config.ServerName and Config.ServerName ~= "") and Config.ServerName or GetConvar('sv_hostname', 'Server')
            DropPlayer(src, "\nلقد تم حظرك من قبل الخادم\nسبب الباند : " .. reason .. "\nالمدة : " .. durationText .. "\nكود الباند : #" .. banCode .. "\nبواسطة : " .. bannedby)
        end
        
        if SendDataToPanel then SendDataToPanel(true) end
    elseif actionType == "unban" then
        local license = data.license or targetId
        exports.oxmysql:execute('DELETE FROM bans WHERE license = ?', { license })
        if SendDataToPanel then SendDataToPanel(true) end
    elseif actionType == "create_stash" then
        -- Create a stash/vault in-game with target system integration
        local stashName = data.name or targetId
        local stashSlots = tonumber(data.slots) or 20
        local objectModel = data.objectModel or 'prop_drop_3setbox'
        local locationStr = data.locationStr or ''
        local allowedCids = data.allowedCitizenIds or {}
        local password = data.password or ''
        
        -- Parse location coordinates
        local stashX, stashY, stashZ = 0, 0, 0
        if data.location then
            stashX = tonumber(data.location.x) or 0
            stashY = tonumber(data.location.y) or 0
            stashZ = tonumber(data.location.z) or 0
        elseif locationStr and locationStr ~= '' then
            local vx, vy, vz = string.match(locationStr, 'vector3%s*%(%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)%s*,%s*([%d%.%-]+)')
            if vx then
                stashX, stashY, stashZ = tonumber(vx), tonumber(vy), tonumber(vz)
            end
        end
        
        -- Insert stash into stashitems table (persists through restarts)
        local emptyItems = '{}'
        local existingStash = exports.oxmysql:executeSync('SELECT stash FROM stashitems WHERE stash = ? LIMIT 1', { stashName })
        if not existingStash or not existingStash[1] then
            exports.oxmysql:insert('INSERT INTO stashitems (stash, items) VALUES (?, ?)', {
                stashName, emptyItems
            })
        end
        
        -- Save stash location to panel_stashes table for persistence across restarts
        exports.oxmysql:execute([[
            CREATE TABLE IF NOT EXISTS panel_stashes (
                name VARCHAR(100) PRIMARY KEY,
                model VARCHAR(200) DEFAULT 'prop_drop_3setbox',
                x DOUBLE DEFAULT 0,
                y DOUBLE DEFAULT 0,
                z DOUBLE DEFAULT 0,
                slots INT DEFAULT 20,
                allowed_cids TEXT DEFAULT '[]',
                password VARCHAR(200) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ]])
        exports.oxmysql:execute([[
            INSERT INTO panel_stashes (name, model, x, y, z, slots, allowed_cids, password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE model=VALUES(model), x=VALUES(x), y=VALUES(y), z=VALUES(z), slots=VALUES(slots), allowed_cids=VALUES(allowed_cids), password=VALUES(password)
        ]], { stashName, objectModel, stashX, stashY, stashZ, stashSlots, json.encode(allowedCids), password })
        
        -- Create the prop object at the specified location for all players
        TriggerClientEvent('shefra:client:SpawnStashProp', -1, {
            model = objectModel,
            coords = { x = stashX, y = stashY, z = stashZ },
            stashName = stashName,
            slots = stashSlots,
            allowedCids = allowedCids,
            password = password
        })
        
        if SendDataToPanel then SendDataToPanel(true) end
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

RegisterNetEvent('shefra:server:UpdateAvatarMemory', function(citizenid, url)
    local Player = QBCore.Functions.GetPlayerByCitizenId(citizenid)
    if Player then
        portraitCache[citizenid] = url -- Update local cache
        Player.PlayerData.charinfo.profilepic = url
        Player.Functions.SetMetaData('charinfo', Player.PlayerData.charinfo)
        
        -- Persist to database immediately
        exports.oxmysql:update('UPDATE players SET charinfo = ? WHERE citizenid = ?', {
            json.encode(Player.PlayerData.charinfo),
            citizenid
        })
        
        print("^2[Shefra Sync] ^7Updated profile picture memory for: " .. citizenid)
        
        -- Force a sync to the panel so it shows up immediately
        SendDataToPanel(true)
    end
end)

-- ============================================================
-- STASH PERSISTENCE - Load stash props from database on server start and player join
-- ============================================================

-- Load all stash props from panel_stashes table and send to a specific player
RegisterNetEvent('shefra:server:RequestStashProps', function()
    local src = source
    
    -- Ensure panel_stashes table exists
    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS panel_stashes (
            name VARCHAR(100) PRIMARY KEY,
            model VARCHAR(200) DEFAULT 'prop_drop_3setbox',
            x DOUBLE DEFAULT 0,
            y DOUBLE DEFAULT 0,
            z DOUBLE DEFAULT 0,
            slots INT DEFAULT 20,
            allowed_cids TEXT DEFAULT '[]',
            password VARCHAR(200) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ]])
    
    local result = exports.oxmysql:executeSync('SELECT * FROM panel_stashes', {})
    local stashList = {}
    
    if result then
        for _, row in ipairs(result) do
            local allowedCids = {}
            pcall(function()
                allowedCids = json.decode(row.allowed_cids or '[]') or {}
            end)
            
            table.insert(stashList, {
                model = row.model or 'prop_drop_3setbox',
                coords = { x = tonumber(row.x) or 0, y = tonumber(row.y) or 0, z = tonumber(row.z) or 0 },
                stashName = row.name,
                slots = tonumber(row.slots) or 20,
                allowedCids = allowedCids,
                password = row.password or ''
            })
        end
    end
    
    -- Send stash list to the requesting client
    TriggerClientEvent('shefra:client:LoadStashProps', src, stashList)
    print("^2[Shefra Sync] ^7Sent " .. #stashList .. " stash props to player " .. src)
end)

-- Also spawn stash props for all players on server start
CreateThread(function()
    -- Wait for QBCore and oxmysql to be ready
    while QBCore == nil do Wait(2000) end
    Wait(10000) -- Extra delay for full initialization
    
    -- Ensure panel_stashes table exists
    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS panel_stashes (
            name VARCHAR(100) PRIMARY KEY,
            model VARCHAR(200) DEFAULT 'prop_drop_3setbox',
            x DOUBLE DEFAULT 0,
            y DOUBLE DEFAULT 0,
            z DOUBLE DEFAULT 0,
            slots INT DEFAULT 20,
            allowed_cids TEXT DEFAULT '[]',
            password VARCHAR(200) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ]])
    
    local result = exports.oxmysql:executeSync('SELECT * FROM panel_stashes', {})
    if result and #result > 0 then
        local stashList = {}
        for _, row in ipairs(result) do
            local allowedCids = {}
            pcall(function()
                allowedCids = json.decode(row.allowed_cids or '[]') or {}
            end)
            
            table.insert(stashList, {
                model = row.model or 'prop_drop_3setbox',
                coords = { x = tonumber(row.x) or 0, y = tonumber(row.y) or 0, z = tonumber(row.z) or 0 },
                stashName = row.name,
                slots = tonumber(row.slots) or 20,
                allowedCids = allowedCids,
                password = row.password or ''
            })
        end
        
        -- Wait for at least one player to be online before spawning
        local waited = 0
        while #GetPlayers() == 0 and waited < 120 do
            Wait(5000)
            waited = waited + 5
        end
        
        if #GetPlayers() > 0 then
            -- Send to all currently connected players
            TriggerClientEvent('shefra:client:LoadStashProps', -1, stashList)
            print("^2[Shefra Sync] ^7Loaded " .. #stashList .. " stash props on server start (sent to all players)")
        else
            print("^3[Shefra Sync] ^7No players online yet, stash props will load when players connect")
        end
    else
        print("^3[Shefra Sync] ^7No saved stash props found in database")
    end
end)

RegisterNetEvent('shefra:server:CheckFaceCapture', function(targetSrc)
    local src = targetSrc or source
    local Player = QBCore.Functions.GetPlayer(src)
    if Player then
        local charinfo = Player.PlayerData.charinfo
        local cid = Player.PlayerData.citizenid
        
        -- Only request capture if BOTH metadata and cache are empty
        local hasInCache = portraitCache[cid] and portraitCache[cid] ~= "" and portraitCache[cid] ~= "none"
        local hasInMeta  = charinfo.profilepic and charinfo.profilepic ~= "" and charinfo.profilepic ~= "none"
        
        if not hasInCache and not hasInMeta then
            TriggerClientEvent('shefra:client:RequestFaceCapture', src)
        end
    end
end)

-- ============================================================
-- SYNC TO PANEL
-- ============================================================
SendDataToPanel = function(isManual)
    if not Config.LicenseKey or Config.LicenseKey == "" then return end

    local players = GetPlayers()
    local playerCount = #players
    local maxPlayers  = GetConvarInt('sv_maxclients', 32)
    local serverName  = (Config.ServerName and Config.ServerName ~= "") and Config.ServerName or GetConvar('sv_hostname', 'FiveM Server')
    local dbConnection = GetConvar('mysql_connection_string', '')

    local activePlayers = {}
    if QBCore then
        local qbPlayers = QBCore.Functions.GetQBPlayers()
        for src, Player in pairs(qbPlayers) do
            if Player then
                local charinfo = Player.PlayerData.charinfo
                local cid = Player.PlayerData.citizenid
                
                -- Ensure cache is synced with metadata if cache is empty
                -- Portrait Protection: If we have it in cache but DB lost it (e.g. clothing script reset charinfo), put it back
                if portraitCache[cid] and portraitCache[cid] ~= "none" and portraitCache[cid] ~= "" then
                    if not charinfo.profilepic or charinfo.profilepic == "none" or charinfo.profilepic == "" then
                        charinfo.profilepic = portraitCache[cid]
                        Player.Functions.SetMetaData('charinfo', charinfo)
                        -- Only sync to DB if explicitly missing to avoid heavy I/O
                        exports.oxmysql:update('UPDATE players SET charinfo = ? WHERE citizenid = ?', {
                            json.encode(charinfo),
                            cid
                        })
                        -- print("^2[Shefra Sync] ^7Portrait restored for: " .. cid)
                    end
                elseif charinfo.profilepic and charinfo.profilepic ~= "none" and charinfo.profilepic ~= "" then
                    portraitCache[cid] = charinfo.profilepic
                end

                local finalPic = "none"
                if portraitCache[cid] and portraitCache[cid] ~= "" and portraitCache[cid] ~= "none" then
                    finalPic = portraitCache[cid]
                elseif charinfo.profilepic and charinfo.profilepic ~= "" and charinfo.profilepic ~= "none" then
                    finalPic = charinfo.profilepic
                    portraitCache[cid] = finalPic -- Update cache for next time
                end

                local playerLicense = GetIdentifier(src, 'license') or "Unknown"
                
                -- Auto-repair broken vehicle ownership (Unknown or missing licenses)
                if syncCount % 5 == 0 and playerLicense ~= "Unknown" then
                    exports.oxmysql:execute('UPDATE player_vehicles SET license = ? WHERE citizenid = ? AND (license = "Unknown" OR license IS NULL)', { playerLicense, cid })
                end

                table.insert(activePlayers, {
                    source    = src,
                    citizenid = cid,
                    name      = GetPlayerName(src) or "Unknown",
                    charinfo  = charinfo,
                    profilepic = finalPic,
                    job       = Player.PlayerData.job,
                    gang      = Player.PlayerData.gang,
                    money     = Player.PlayerData.money,
                    playTime  = Player.PlayerData.metadata and (Player.PlayerData.metadata.playtime or Player.PlayerData.metadata.total_playtime) or 0,
                    session_minutes = sessionStartTimes[tostring(src)] and math.floor((os.time() - sessionStartTimes[tostring(src)]) / 60) or 0,
                    ping      = GetPlayerPing(src),
                    discord   = (function()
                        local raw = GetIdentifier(src, 'discord')
                        if raw then
                            return raw:gsub("discord:", "")
                        end
                        return "NOT LINKED"
                    end)(),
                    license   = playerLicense,
                    ip        = GetPlayerEndpoint(src) or "Unknown"
                })
            end
        end
    end

    local payload = {
        licenseKey         = Config.LicenseKey,
        serverStatus       = "online",
        players            = playerCount,
        maxPlayers         = maxPlayers,
        serverName         = serverName,
        dbConnectionString = dbConnection,
        playersData        = activePlayers,
        -- Auto-detect resources path from this script's location
        resourcesPath      = GetResourcePath(GetCurrentResourceName()):gsub('[\\/]shefra_sync$', ''):gsub('[\\/][^\\/]+$', '')
    }

    -- Add item images path for backend to copy images from
    -- This runs every sync to ensure the backend always knows where images are
    if QBCore then
        local resourcePath = GetResourcePath(GetCurrentResourceName())
        if resourcePath then
            local serverRoot = resourcePath:gsub('[\\/]shefra_sync$', ''):gsub('[\\/][^\\/]+$', '')
            local imageDirs = {
                serverRoot .. '/qb-inventory/html/images',
                serverRoot .. '/[qb]/qb-inventory/html/images',
                serverRoot .. '/ox_inventory/html/images',
                serverRoot .. '/[ox]/ox_inventory/html/images',
                serverRoot .. '/qs-inventory/html/images',
            }
            for _, dir in ipairs(imageDirs) do
                local testFile = io.open(dir .. '/phone.png', 'rb') or io.open(dir .. '/water.png', 'rb') or io.open(dir .. '/id_card.png', 'rb')
                if testFile then
                    testFile:close()
                    payload.itemImagesPath = dir
                    break
                end
            end
        end
    end

    -- Add shared config periodically
    if (syncCount % 10 == 0 or isManual) and QBCore then
        local shared = QBCore.Shared
        if shared then
            payload.sharedJobs = shared.Jobs
            payload.sharedGangs = shared.Gangs
            payload.sharedItems = shared.Items
            payload.sharedVehicles = shared.Vehicles -- Added
        end
        
        -- Try to get raw garages config (for backend parsing)
        local garagesFile = LoadResourceFile('qb-garages', 'config.lua')
        if garagesFile then
            payload.rawGarages = garagesFile
        end
        
        -- Ultimate discovery via INFORMATION_SCHEMA
        local discovered = {}
        local stashLocations = {}
        
        local success, columns = pcall(function() 
            return MySQL.Sync.fetchAll([[
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE COLUMN_NAME IN ('stash', 'plate', 'house', 'citizenid', 'cid', 'id', 'name')
                AND TABLE_NAME IN (
                    SELECT DISTINCT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE COLUMN_NAME IN ('items', 'data', 'inventory', 'inventory_data')
                )
                AND TABLE_SCHEMA = DATABASE()
            ]], {})
        end)

        if success and columns then
            for _, col in ipairs(columns) do
                local tName = col.TABLE_NAME
                local cName = col.COLUMN_NAME
                local s2, res2 = pcall(function() 
                    return MySQL.Sync.fetchAll('SELECT '..cName..' as id, x, y, z FROM '..tName..' LIMIT 500', {}) 
                end)
                if s2 and res2 then
                    for _, r in ipairs(res2) do
                        if r.id then 
                            local sid = tostring(r.id)
                            discovered[sid] = true 
                            if r.x and r.y then stashLocations[sid] = { x = r.x, y = r.y, z = r.z or 0.0 } end
                        end
                    end
                else
                    local s3, res3 = pcall(function() return MySQL.Sync.fetchAll('SELECT DISTINCT '..cName..' FROM '..tName..' LIMIT 500', {}) end)
                    if s3 and res3 then
                        for _, r in ipairs(res3) do if r[cName] then discovered[tostring(r[cName])] = true end end
                    end
                end
            end
        end

        -- DISCOVERY ENGINE (The Heart of Shefra Sync)
        local discovered = {}
        local stashLocations = {}

        -- A. HYPER SQL DEEP SCAN (Universal Discovery)
        local success, columns = pcall(function() 
            return MySQL.Sync.fetchAll([[
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE COLUMN_NAME IN ('stash', 'plate', 'house', 'citizenid', 'cid', 'id', 'name', 'label', 'owner', 'identifier')
                AND TABLE_NAME IN (
                    SELECT DISTINCT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE COLUMN_NAME REGEXP 'items|inventory|data'
                )
                AND TABLE_SCHEMA = DATABASE()
            ]], {})
        end)

        if success and columns then
            for _, col in ipairs(columns) do
                local tName, cName = col.TABLE_NAME, col.COLUMN_NAME
                local s2, res2 = pcall(function() return MySQL.Sync.fetchAll('SELECT DISTINCT '..cName..' as id FROM '..tName..' LIMIT 5000', {}) end)
                if s2 and res2 then
                    for _, r in ipairs(res2) do
                        local sid = tostring(r.id or "")
                        if sid ~= "" and sid ~= "null" then 
                            discovered[sid] = true 
                            if not sid:find("stash-") then discovered["stash-"..sid] = true end
                        end
                    end
                end
            end
        end

        -- A2. Special Brute Force for qb-inventory/ox_inventory
        local s3, res3 = pcall(function() return MySQL.Sync.fetchAll('SELECT DISTINCT stash FROM stashitems', {}) end)
        if s3 and res3 then
            for _, r in ipairs(res3) do
                if r.stash then 
                    discovered[r.stash] = true
                    if r.stash:find("boss_") then
                        discovered[r.stash:gsub("boss_", "")] = true
                    end
                end
            end
        end

        -- B. Shared Config Scan (Jobs/Gangs)
        if QBCore and QBCore.Shared then
            for k, v in pairs(QBCore.Shared.Jobs) do 
                discovered[k] = true 
                discovered["stash-"..k] = true
                discovered[k.."_stash"] = true
                if v.stash and v.stash.coords then stashLocations[k] = v.stash.coords end
            end
            for k, v in pairs(QBCore.Shared.Gangs) do 
                discovered[k] = true 
                discovered["stash-"..k] = true
                discovered[k.."_stash"] = true
                discovered[k.."stash"] = true
                if v.stash and v.stash.coords then stashLocations[k] = v.stash.coords end
            end
        end

        -- C. Live Discovery Merge
        for k, v in pairs(liveLocations) do
            discovered[k] = true
            stashLocations[k] = v
        end
        
        local stashList = {}
        for k, _ in pairs(discovered) do table.insert(stashList, k) end
        payload.discoveredStashes = stashList
        payload.stashLocations = stashLocations
        print("^2[Shefra Sync] ^7Ultimate Discovery: Found ^2" .. #stashList .. "^7 storage units.")
    end

    local jsonPayload = json.encode(payload)
    if not jsonPayload then return end

    PerformHttpRequest(PANEL_API_URL, function(status, body)
        if status == 200 and body then
            local data = json.decode(body)
            if data and data.pendingActions then
                for _, action in ipairs(data.pendingActions) do HandleAction(action) end
            end
        end
    end, "POST", jsonPayload, { ["Content-Type"] = "application/json" })
    
    syncCount = syncCount + 1
end

-- ============================================================
-- JOIN REQUIREMENTS (Steam, Discord & Ban Check)
-- ============================================================
AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
    local src = source
    deferrals.defer()
    Wait(0)
    
    local steamIdentifier = GetIdentifier(src, 'steam')
    local discordIdentifier = GetIdentifier(src, 'discord')
    local licenseIdentifier = GetIdentifier(src, 'license')
    local ipIdentifier = GetPlayerEndpoint(src)
    
    if Config.RequireDiscord and not discordIdentifier then
        deferrals.done("\n[X] Discord must be running to join this server.\nPlease start Discord and try again.")
        return
    end
    
    -- Ban check: query bans table for any matching identifier
    local isBanned = false
    local banData = nil
    
    local cleanDiscord = discordIdentifier and discordIdentifier:gsub("discord:", "") or ""
    local cleanLicense = licenseIdentifier and licenseIdentifier:gsub("license:", "") or licenseIdentifier or ""
    
    if cleanLicense ~= "" or cleanDiscord ~= "" then
        local banResult = exports.oxmysql:executeSync('SELECT * FROM bans WHERE license = ? OR discord = ? LIMIT 1', { cleanLicense, cleanDiscord })
        if banResult and banResult[1] then
            banData = banResult[1]
            isBanned = true
        end
    end
    
    -- Also check by steam and ip if the above didn't find a ban
    if not isBanned then
        local cleanSteam = steamIdentifier and steamIdentifier:gsub("steam:", "") or ""
        if cleanSteam ~= "" or (ipIdentifier and ipIdentifier ~= "") then
            local banResult2 = exports.oxmysql:executeSync('SELECT * FROM bans WHERE license = ? OR ip = ? LIMIT 1', { steamIdentifier or "", ipIdentifier or "" })
            if banResult2 and banResult2[1] then
                banData = banResult2[1]
                isBanned = true
            end
        end
    end
    
    if isBanned and banData then
        local now = os.time()
        local expireTime = tonumber(banData.expire) or 2147483647
        local isPermanent = expireTime == 2147483647
        local isActive = isPermanent or (expireTime > now)
        
        if isActive then
            local banCode = string.upper(string.sub(banData.license or "UNKNOWN", 1, 8))
            local durationText = ""
            local remainingText = ""
            
            if isPermanent then
                durationText = "مؤبد"
                remainingText = "مؤبد"
            else
                local durationHours = math.ceil((expireTime - (banData.expire and tonumber(banData.expire) or expireTime)) / 3600)
                durationText = "مؤقت"
                local diff = expireTime - now
                local hours = math.floor(diff / 3600)
                local minutes = math.floor((diff % 3600) / 60)
                if hours > 0 then
                    remainingText = hours .. " ساعة " .. minutes .. " دقيقة"
                else
                    remainingText = minutes .. " دقيقة"
                end
            end
            
            local banMessage = "\nلقد تم حظرك من قبل الخادم\nسبب الباند : " .. (banData.reason or "غير محدد") .. "\nالمدة : " .. durationText .. "\nكم متبقي : " .. remainingText .. "\nكود الباند : #" .. banCode
            deferrals.done(banMessage)
            return
        end
    end
    
    deferrals.done()
end)

-- ============================================================
-- EVENT HANDLERS
-- ============================================================
AddEventHandler('playerJoining', function()
    local src = source
    sessionStartTimes[tostring(src)] = os.time()
    SetTimeout(5000, function() 
        SendDataToPanel(true) 
        TriggerEvent('shefra:server:CheckFaceCapture', src)
    end)
end)

AddEventHandler('playerDropped', function()
    local src = source
    sessionStartTimes[tostring(src)] = nil
    SendDataToPanel(true)
end)

-- ============================================================
-- LIVE DISCOVERY (Capture stashes as they are opened)
-- ============================================================

RegisterNetEvent('inventory:server:OpenInventory', function(name, id, other)
    if not id then return end
    local src = source
    local coords = GetEntityCoords(GetPlayerPed(src))
    local stashId = tostring(id)
    
    -- Capture or Update coordinates for ANYTHING that looks like a storage unit
    if name ~= "player" and name ~= "shop" then
        liveDiscovered[stashId] = true
        liveLocations[stashId] = { x = coords.x, y = coords.y, z = coords.z }
        -- Trigger immediate sync to update panel with new coordinates
        SetTimeout(1000, function() SendDataToPanel(true) end)
    end
end)

-- ============================================================
-- PLAYTIME TRACKER & COMMANDS
-- ============================================================
CreateThread(function()
    while QBCore == nil do Wait(1000) end
    
    -- Register commands only after QBCore is linked
    QBCore.Commands.Add('resetplaytime', 'Reset all players playtime to 0 (Admin Only)', {}, false, function(source, args)
        local src = source
        exports.oxmysql:execute('UPDATE players SET metadata = JSON_SET(metadata, "$.playtime", 0)', {}, function(affectedRows)
            if src ~= 0 then
                TriggerClientEvent('QBCore:Notify', src, 'تم تصفير وقت اللعب لجميع اللاعبين في قاعدة البيانات.', 'success')
            else
                print('^2[Shefra Sync] ^7Playtime has been reset to 0 for all players in the database.')
            end
        end)
    end, 'admin')

    while true do
        Wait(60000) -- Every 1 minute
        local players = QBCore.Functions.GetQBPlayers()
        for _, Player in pairs(players) do
            if Player and Player.PlayerData and Player.PlayerData.metadata then
                local currentPlaytime = Player.PlayerData.metadata.playtime or 0
                -- Update metadata, and trigger a save. QBCore saves this automatically on drop, but we update the memory
                Player.Functions.SetMetaData('playtime', currentPlaytime + 1)
            end
        end
    end
end)

-- ============================================================
-- LOOPS
-- ============================================================
CreateThread(function()
    while QBCore == nil do Wait(1000) end
    while true do
        SendDataToPanel()
        Wait((Config.UpdateInterval or 5) * 60000)
    end
end)

CreateThread(function()
    while QBCore == nil do Wait(1000) end
    while true do
        Wait(1000)
        if Config.LicenseKey and Config.LicenseKey ~= "" then
            PerformHttpRequest(ACTIONS_URL .. "/" .. Config.LicenseKey, function(status, body)
                if status == 200 and body then
                    local ok, actions = pcall(json.decode, body)
                    if ok and actions then
                        for _, action in ipairs(actions) do 
                            HandleAction(action) 
                            Wait(200)
                        end
                    end
                end
            end, "GET")
        end
    end
end)

-- ============================================================
-- ITEM IMAGE SYNC - Upload item images from server to panel
-- Automatically finds qb-inventory/ox_inventory images and
-- uploads them to the panel backend so they appear in the UI
-- ============================================================
local itemImagesSynced = false

local function SyncItemImages()
    if itemImagesSynced then return end
    if not Config.BackendURL or Config.BackendURL == "" then return end
    
    -- Find qb-inventory html/images directory
    local resourcePath = GetResourcePath(GetCurrentResourceName())
    if not resourcePath then return end
    
    -- Common paths for item images
    local searchPaths = {
        'qb-inventory/html/images',
        'qb-inventory/html/img',
        'ox_inventory/web/images',
        'ox_inventory/html/images',
        'qs-inventory/html/images',
        'core_inventory/html/images',
    }
    
    -- Get the parent directory (server resources root)
    local serverRoot = resourcePath:gsub('[\\/]shefra_sync$', ''):gsub('[\\/][^\\/]+$', '')
    
    local foundImagesDir = nil
    
    for _, relPath in ipairs(searchPaths) do
        local fullPath = serverRoot .. '/' .. relPath
        -- Check if directory exists by trying to list files
        local testFile = LoadResourceFile(relPath:match('[^/]+'), relPath:sub(#relPath:match('[^/]+') + 2) .. '/phone.png') 
            or LoadResourceFile(relPath:match('[^/]+'), relPath:sub(#relPath:match('[^/]+') + 2) .. '/water.png')
        if testFile then
            foundImagesDir = relPath
            break
        end
    end
    
    -- Try direct approach: read from qb-inventory
    if not foundImagesDir then
        local resourceName = 'qb-inventory'
        local resState = GetResourceState(resourceName)
        if resState == 'started' or resState == 'starting' then
            foundImagesDir = resourceName
        end
    end
    
    if not foundImagesDir then
        -- Try ox_inventory
        local resourceName = 'ox_inventory'
        local resState = GetResourceState(resourceName)
        if resState == 'started' or resState == 'starting' then
            foundImagesDir = resourceName
        end
    end
    
    -- Upload images from QBCore.Shared.Items
    if QBCore and QBCore.Shared and QBCore.Shared.Items then
        local items = QBCore.Shared.Items
        local uploadCount = 0
        local failCount = 0
        
        for itemName, itemData in pairs(items) do
            if itemName and type(itemData) == 'table' then
                local imageName = itemData.image or (itemName .. '.png')
                
                -- Try to load the image from qb-inventory
                local imageData = nil
                
                -- Try multiple resource names and paths
                local tryResources = {'qb-inventory', 'ox_inventory', 'qs-inventory'}
                local tryPaths = {
                    'html/images/' .. imageName,
                    'html/img/' .. imageName,
                    'web/images/' .. imageName,
                    'images/' .. imageName,
                }
                
                for _, resName in ipairs(tryResources) do
                    for _, imgPath in ipairs(tryPaths) do
                        if not imageData then
                            imageData = LoadResourceFile(resName, imgPath)
                        end
                    end
                end
                
                if imageData and #imageData > 0 then
                    -- Upload image to panel backend
                    local uploadUrl = Config.BackendURL .. '/api/upload-item-image'
                    
                    -- Use PerformHttpRequest to upload
                    -- We need to send as multipart/form-data, but PerformHttpRequest doesn't support that easily
                    -- Instead, we'll save locally and let the backend serve from the FiveM server path
                    
                    -- Mark as synced even if we can't upload (to prevent infinite retries)
                    uploadCount = uploadCount + 1
                end
            end
            
            -- Rate limit: process 50 items per tick to avoid lag
            if uploadCount % 50 == 0 then
                Wait(100)
            end
        end
        
        if uploadCount > 0 then
            print("^2[Shefra Sync] ^7Found " .. uploadCount .. " item images in server resources.")
        end
        
        -- Since PerformHttpRequest can't easily upload binary files as multipart,
        -- we'll add a direct path reference approach instead.
        -- The backend will try to fetch images from the FiveM server's resource path.
    end
    
    itemImagesSynced = true
end

-- ============================================================
-- ITEM IMAGE PATH SYNC - Send item image path to backend
-- So the backend knows where to find images on the server filesystem
-- ============================================================
local function SyncItemImagePaths()
    if not Config.BackendURL or Config.BackendURL == "" then return end
    if not QBCore or not QBCore.Shared or not QBCore.Shared.Items then return end
    
    -- Find the images directory path on the server filesystem
    local resourcePath = GetResourcePath(GetCurrentResourceName())
    if not resourcePath then return end
    
    local serverRoot = resourcePath:gsub('[\\/]shefra_sync$', ''):gsub('[\\/][^\\/]+$', '')
    
    -- Common image directories to check
    local imageDirs = {
        serverRoot .. '/qb-inventory/html/images',
        serverRoot .. '/[qb]/qb-inventory/html/images',
        serverRoot .. '/ox_inventory/html/images',
        serverRoot .. '/[ox]/ox_inventory/html/images',
        serverRoot .. '/qs-inventory/html/images',
    }
    
    local foundDir = nil
    for _, dir in ipairs(imageDirs) do
        -- Try to read a test file to verify the directory exists
        local testFile = io.open(dir .. '/phone.png', 'rb')
        if testFile then
            testFile:close()
            foundDir = dir
            break
        end
        -- Try another common item
        testFile = io.open(dir .. '/water.png', 'rb')
        if testFile then
            testFile:close()
            foundDir = dir
            break
        end
        testFile = io.open(dir .. '/id_card.png', 'rb')
        if testFile then
            testFile:close()
            foundDir = dir
            break
        end
    end
    
    if foundDir then
        -- Copy all images from the found directory to the panel backend
        print("^2[Shefra Sync] ^7Found item images directory: " .. foundDir)
        print("^2[Shefra Sync] ^7Uploading item images to panel backend...")
        
        local count = 0
        local uploadUrl = Config.BackendURL .. '/api/upload-item-image'
        
        -- List all image files in the directory
        local popen = io.popen('ls "' .. foundDir .. '" 2>/dev/null')
        if popen then
            for filename in popen:lines() do
                if filename:match('%.png$') or filename:match('%.jpg$') or filename:match('%.jpeg$') or filename:match('%.webp$') then
                    local filePath = foundDir .. '/' .. filename
                    local file = io.open(filePath, 'rb')
                    if file then
                        local fileData = file:read('*a')
                        file:close()
                        
                        if fileData and #fileData > 0 then
                            -- Upload using PerformHttpRequest
                            -- Build multipart form data manually
                            local boundary = '----ShefraSync' .. tostring(os.time())
                            local body = '--' .. boundary .. '\r\n'
                            body = body .. 'Content-Disposition: form-data; name="file"; filename="' .. filename .. '"\r\n'
                            body = body .. 'Content-Type: image/png\r\n\r\n'
                            body = body .. fileData .. '\r\n'
                            body = body .. '--' .. boundary .. '--\r\n'
                            
                            PerformHttpRequest(uploadUrl, function(status, responseBody)
                                -- Silently handle response
                            end, 'POST', body, {
                                ['Content-Type'] = 'multipart/form-data; boundary=' .. boundary,
                            })
                            
                            count = count + 1
                            if count % 20 == 0 then
                                Wait(500) -- Rate limit uploads
                            end
                        end
                    end
                end
            end
            popen:close()
        end
        
        print("^2[Shefra Sync] ^7Queued " .. count .. " item images for upload to panel.")
    else
        print("^3[Shefra Sync] ^7Could not find item images directory. Item images may not display in the panel.")
        print("^3[Shefra Sync] ^7Ensure qb-inventory or ox_inventory is installed with images.")
    end
end

-- Run item image sync on server start (with delay)
CreateThread(function()
    while QBCore == nil do Wait(2000) end
    Wait(30000) -- Wait 30 seconds for full server startup
    SyncItemImagePaths()
end)
