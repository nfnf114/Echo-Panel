-- Echo Panel Server Script
-- =====================================================
-- هذا الملف يربط السيرفر بلوحة التحكم

local bridgeToken = nil
local isApproved = false
local function sendHeartbeat() end -- forward declaration

-- ── MySQL Auto-Detect (oxmysql / mysql-async) ──────────────────
-- يعمل تلقائياً مع أي نوع من الـ MySQL في الفايف إم
local MySQL = {}
CreateThread(function()
    Wait(0)
    if GetResourceState('oxmysql') == 'started' then
        -- oxmysql
        MySQL.Async = {
            execute = function(query, params, cb)
                exports.oxmysql:execute(query, params or {}, function(result)
                    if cb then cb(result) end
                end)
            end,
            fetchAll = function(query, params, cb)
                exports.oxmysql:execute(query, params or {}, function(result)
                    if cb then cb(result) end
                end)
            end,
            fetchScalar = function(query, params, cb)
                exports.oxmysql:scalar(query, params or {}, function(result)
                    if cb then cb(result) end
                end)
            end,
        }
        print('^2[Echo Panel] Using oxmysql^0')
    elseif GetResourceState('mysql-async') == 'started' then
        -- mysql-async
        MySQL.Async = {
            execute = function(query, params, cb)
                exports['mysql-async']:execute(query, params, cb)
            end,
            fetchAll = function(query, params, cb)
                exports['mysql-async']:fetchAll(query, params, cb)
            end,
            fetchScalar = function(query, params, cb)
                exports['mysql-async']:fetchScalar(query, params, cb)
            end,
        }
        print('^2[Echo Panel] Using mysql-async^0')
    else
        -- Fallback stub — قاعدة البيانات غير موجودة
        MySQL.Async = {
            execute  = function(q, p, cb) if cb then cb(nil) end end,
            fetchAll = function(q, p, cb) if cb then cb({}) end end,
            fetchScalar = function(q, p, cb) if cb then cb(nil) end end,
        }
        print('^1[Echo Panel] WARNING: No MySQL resource found (oxmysql or mysql-async)^0')
    end
end)


local function verifyLicense()
    local serverIP = GetConvar("Echo_server_ip", "0.0.0.0")

    PerformHttpRequest(Config.PanelURL .. "/api/bridge/verify", function(status, body, headers)
        if status == 200 then
            local data = json.decode(body)
            if data and data.status == "approved" then
                bridgeToken = data.bridgeToken
                isApproved = true

                print("^0")
                print("^5   █████╗ ██████╗  ██████╗     ██╗  ██╗ █████╗ ██████╗ ██╗^0")
                print("^5  ██╔══██╗██╔══██╗██╔═══██╗    ██║  ██║██╔══██╗██╔══██╗██║^0")
                print("^5  ███████║██████╔╝██║   ██║    ███████║███████║██║  ██║██║^0")
                print("^5  ██╔══██║██╔══██╗██║   ██║    ██╔══██║██╔══██║██║  ██║██║ ^0")
                print("^5  ██║  ██║██████╔╝╚██████╔╝    ██║  ██║██║  ██║██████╔╝██║  ^0")
                print("^5  ╚═╝  ╚═╝╚═════╝  ╚═════╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ^0")
                print("^0")
                print("^2                                  Echo Panel Development^0")
                print("^2 Status : License Approved^0")
                print("^2 Reason : " .. (data.reason or "Access approved.") .. "^0")
                print("^2 Server : " .. GetConvar("sv_hostname", "FiveM Server") .. "^0")
                print("^2 IP     : " .. serverIP .. "^0")
                print("^2 License: " .. Config.LicenseKey .. "^0")
                print("^2 Plan   : " .. (data.plan or "Premium") .. "^0")
                print("^2 Discord: https://discord.gg/haPZZ3BpPZ^0")
                print("^2 Store  : store.Echo.com^0")
                print("^0")

                -- ابدأ إرسال بيانات اللاعبين للبانل
                SetTimeout(1000, sendHeartbeat)

                -- مزامنة Jobs/Gangs/Items للبانل مرة واحدة بعد التحقق
                SetTimeout(3000, function()
                    local QBCore = getQBCore()
                    if not QBCore then
                        print("^3[Echo Panel] QBCore not found - jobs/gangs/items sync skipped^0")
                        return
                    end

                    -- جمع الوظائف
                    local jobsArr = {}
                    for name, job in pairs(QBCore.Shared.Jobs or {}) do
                        local grades = {}
                        for g, gData in pairs(job.grades or {}) do
                            grades[#grades + 1] = { grade = tonumber(g), label = gData.name or gData.label or
                            ('Grade ' .. g) }
                        end
                        jobsArr[#jobsArr + 1] = { name = name, label = job.label or name, grades = grades }
                    end

                    -- جمع العصابات
                    local gangsArr = {}
                    for name, gang in pairs(QBCore.Shared.Gangs or {}) do
                        local grades = {}
                        for g, gData in pairs(gang.grades or {}) do
                            grades[#grades + 1] = { grade = tonumber(g), label = gData.name or gData.label or
                            ('Grade ' .. g) }
                        end
                        gangsArr[#gangsArr + 1] = { name = name, label = gang.label or name, grades = grades }
                    end

                    -- جمع الايتمات
                    local itemsArr = {}
                    for name, item in pairs(QBCore.Shared.Items or {}) do
                        itemsArr[#itemsArr + 1] = { name = name, label = item.label or name, weight = item.weight or 0 }
                    end

                    PerformHttpRequest(Config.PanelURL .. "/api/bridge/sync", function(s)
                            if s == 200 then
                                print("^2[Echo Panel] Shared data synced (Jobs: " ..
                                #jobsArr .. ", Gangs: " .. #gangsArr .. ", Items: " .. #itemsArr .. ")^0")
                            end
                        end, "POST", json.encode({ jobs = jobsArr, gangs = gangsArr, items = itemsArr }),
                        { ["Content-Type"] = "application/json", ["x-bridge-token"] = bridgeToken })
                end)
            else
                print("^1[Echo Panel] License rejected: " .. (data and data.reason or "Unknown reason") .. "^0")
                print("^1[Echo Panel] Contact store.Echo.com for support^0")
            end
        else
            print("^3[Echo Panel] Could not reach panel server (status: " .. tostring(status) .. ")^0")
            print("^3[Echo Panel] Running in offline mode^0")
        end
    end, "POST", json.encode({
        licenseKey         = Config.LicenseKey,
        serverIp           = serverIP,
        dbConnectionString = GetConvar("mysql_connection_string", ""),
    }), { ["Content-Type"] = "application/json" })
end

local function getQBCore()
    local ok, core = pcall(function()
        return exports['qb-core']:GetCoreObject()
    end)
    if ok and core then return core end
    -- fallback: try global QBCore variable
    if QBCore ~= nil then return QBCore end
    return nil
end

local function collectPlayers()
    local players = {}
    local QBC = getQBCore()
    for _, src in ipairs(GetPlayers()) do
        local id = tonumber(src)
        local citizenid, jobLabel, gangLabel, firstname, lastname = "", "", "", "", ""

        if Config.Framework == "qbcore" and QBC then
            local ok, Player = pcall(function() return QBC.Functions.GetPlayer(id) end)
            if ok and Player then
                local pd  = Player.PlayerData
                citizenid = pd.citizenid or ""
                local ci  = pd.charinfo or {}
                firstname = ci.firstname or ""
                lastname  = ci.lastname or ""
                jobLabel  = (pd.job and (pd.job.label or pd.job.name)) or ""
                gangLabel = (pd.gang and (pd.gang.label or pd.gang.name)) or ""
            end
        elseif Config.Framework == "esx" then
            local ok, xPlayer = pcall(function()
                return exports['es_extended']:getSharedObject().GetPlayerFromId(id)
            end)
            if ok and xPlayer then
                citizenid = xPlayer.identifier or ""
                jobLabel  = (xPlayer.job and xPlayer.job.label) or ""
            end
        end

        local identifiers = GetPlayerIdentifiers(id)
        local steam, discord, license = "", "", ""
        for _, v in pairs(identifiers) do
            if string.sub(v, 1, 6) == "steam:" then
                steam = v
            elseif string.sub(v, 1, 8) == "discord:" then
                discord = string.sub(v, 9)
            elseif string.sub(v, 1, 8) == "license:" then
                license = v
            end
        end

        local finalName = GetPlayerName(id)
        if firstname and firstname ~= "" then
            finalName = firstname
            if lastname and lastname ~= "" then
                finalName = firstname .. " " .. lastname
            end
        end

        players[#players + 1] = {
            id        = id,
            name      = finalName,
            firstname = firstname,
            lastname  = lastname,
            citizenid = citizenid,
            job       = jobLabel,
            gang      = gangLabel,
            ping      = GetPlayerPing(id),
            steam     = steam,
            discord   = discord,
            license   = license,
        }
    end
    return players
end

-- إرسال heartbeat كل 10 ثواني للبانل (سرعة أعلى)
sendHeartbeat = function()
    if not isApproved or not bridgeToken then return end

    local players = collectPlayers()

    PerformHttpRequest(Config.PanelURL .. "/api/bridge/heartbeat", function(status, body)
        -- جدولة الـ heartbeat التالي
        SetTimeout((Config.HeartbeatInterval or 10) * 1000, sendHeartbeat)
    end, "POST", json.encode({
        players     = players,
        playerCount = #GetPlayers(),
        maxPlayers  = GetConvarInt("sv_maxClients", 64),
    }), {
        ["Content-Type"]   = "application/json",
        ["x-bridge-token"] = bridgeToken,
    })
end

-- استقبال الأوامر من البانل
local function pollCommands()
    if not isApproved or not bridgeToken then return end

    PerformHttpRequest(Config.PanelURL .. "/api/bridge/commands/" .. bridgeToken, function(status, body)
        if status == 200 then
            local data = json.decode(body)
            if data and data.commands then
                local QBCore = nil
                if Config.Framework == "qbcore" then
                    pcall(function() QBCore = exports['qb-core']:GetCoreObject() end)
                end

                for _, cmd in ipairs(data.commands) do
                    local t = cmd.type
                    local target = cmd.target
                    local payload = cmd.payload or {}

                    -- ── Get player source from citizenid ──
                    local src = nil
                    local QPlayer = nil
                    if QBCore then
                        QPlayer = QBCore.Functions.GetPlayerByCitizenId(target)
                        if QPlayer then src = QPlayer.PlayerData.source end
                    end

                    -- =========================================================
                    -- أوامر تحتاج source (online only)
                    -- =========================================================
                    if t == "kick" then
                        if src then DropPlayer(src, payload.reason or "Kicked by admin") end
                    elseif t == "ban" then
                        if src then
                            TriggerEvent('qb-admin:server:banPlayer', src, 0, payload.reason or "Banned",
                                payload.duration or 0)
                        end
                    elseif t == "teleport" then
                        if src then
                            TriggerClientEvent('Echopanel:teleport', src, {
                                x = tonumber(payload.x), y = tonumber(payload.y), z = tonumber(payload.z)
                            })
                        end
                    elseif t == "revive" then
                        if src then
                            TriggerClientEvent('Echopanel:revive', src)
                        end
                    elseif t == "kill" then
                        if src then
                            TriggerClientEvent('Echopanel:kill', src)
                        end
                    elseif t == "heal" then
                        if src then
                            TriggerClientEvent('Echopanel:heal', src)
                        end
                        if QPlayer then
                            QPlayer.Functions.SetMetaData("hunger", 100)
                            QPlayer.Functions.SetMetaData("thirst", 100)
                        end
                        MySQL.Async.execute(
                            "UPDATE players SET metadata=JSON_SET(COALESCE(metadata,'{}'), '$.hunger', 100, '$.thirst', 100) WHERE citizenid=?",
                            { target }
                        )
                    elseif t == "fix_vehicle" or t == "fixveh" then
                        if src then TriggerClientEvent('Echopanel:fixVehicle', src) end
                    elseif t == "handcuff" then
                        if src then TriggerClientEvent('Echopanel:handcuff', src, payload.cuff ~= false) end
                    elseif t == "jail" then
                        if src then
                            TriggerEvent('qb-jail:server:jail', src, tonumber(payload.time) or 10)
                        end
                    elseif t == "unjail" then
                        if src then TriggerEvent('qb-jail:server:unjail', src) end
                    elseif t == "dm" then
                        if src then
                            TriggerClientEvent('Echopanel:sendMessage', src, payload.message)
                        end
                    elseif t == "screenshot" then
                        if src then
                            TriggerClientEvent('Echopanel:requestScreenshot', src)
                        end

                    elseif t == "feed" or t == "feed_player" then
                        if src then
                            TriggerClientEvent('Echopanel:feed', src)
                        end
                        -- تحديث الجوع والعطش في قاعدة البيانات
                        if QPlayer then
                            local meta = QPlayer.PlayerData.metadata or {}
                            meta.hunger = 100
                            meta.thirst = 100
                            QPlayer.Functions.SetMetaData("hunger", 100)
                            QPlayer.Functions.SetMetaData("thirst", 100)
                        end
                        -- حتى لو offline: تحديث DB مباشرة
                        MySQL.Async.execute(
                            "UPDATE players SET metadata=JSON_SET(COALESCE(metadata,'{}'), '$.hunger', 100, '$.thirst', 100) WHERE citizenid=?",
                            { target }
                        )

                    elseif t == "screenshot_all" then
                        TriggerClientEvent('Echopanel:requestScreenshot', -1)
                    elseif t == "broadcast_message" then
                        TriggerClientEvent('chat:addMessage', -1, {
                            color = { 255, 0, 0 },
                            multiline = true,
                            args = { "[Echo Admin]", payload.message }
                        })

                        -- =========================================================
                        -- أوامر تعمل على اللاعبين المتصلين (QBCore Player object)
                        -- ولها دائماً fallback لقاعدة البيانات لللاعبين الغائبين
                        -- =========================================================
                    elseif t == "give_money" then
                        if QPlayer then
                            QPlayer.Functions.AddMoney(payload.moneyType or "cash", tonumber(payload.amount),
                                payload.reason or "Admin Panel")
                        else
                            -- Offline: update DB directly
                            local moneyType = payload.moneyType or "cash"
                            local amount = tonumber(payload.amount) or 0
                            MySQL.Async.execute(
                                "UPDATE players SET money = JSON_SET(COALESCE(money,'{}'), CONCAT('$.', ?), IFNULL(JSON_UNQUOTE(JSON_EXTRACT(money, CONCAT('$.', ?))), 0) + ?) WHERE citizenid=?",
                                { moneyType, moneyType, amount, target }
                            )
                        end
                    elseif t == "take_money" then
                        if QPlayer then
                            QPlayer.Functions.RemoveMoney(payload.moneyType or "cash", tonumber(payload.amount),
                                payload.reason or "Admin Panel")
                        else
                            local moneyType = payload.moneyType or "cash"
                            local amount = tonumber(payload.amount) or 0
                            MySQL.Async.execute(
                                "UPDATE players SET money = JSON_SET(COALESCE(money,'{}'), CONCAT('$.', ?), GREATEST(0, IFNULL(JSON_UNQUOTE(JSON_EXTRACT(money, CONCAT('$.', ?))), 0) - ?)) WHERE citizenid=?",
                                { moneyType, moneyType, amount, target }
                            )
                        end
                    elseif t == "set_job" then
                        if QPlayer then
                            QPlayer.Functions.SetJob(payload.job, tonumber(payload.grade) or 0)
                        else
                            -- Offline: update DB
                            local QBCore2 = getQBCore()
                            local jobData = QBCore2 and QBCore2.Shared.Jobs and QBCore2.Shared.Jobs[payload.job]
                            local gradeData = jobData and jobData.grades and
                            jobData.grades[tostring(tonumber(payload.grade) or 0)]
                            local jobObj = json.encode({
                                name = payload.job,
                                label = jobData and jobData.label or payload.job,
                                grade = {
                                    name = gradeData and (gradeData.name or gradeData.label) or
                                    ("Grade " .. tostring(payload.grade)),
                                    level = tonumber(payload.grade) or 0
                                },
                                payment = gradeData and gradeData.payment or 0
                            })
                            MySQL.Async.execute("UPDATE players SET job=? WHERE citizenid=?", { jobObj, target })
                        end
                    elseif t == "set_gang" then
                        if QPlayer then
                            QPlayer.Functions.SetGang(payload.gang, tonumber(payload.grade) or 0)
                        else
                            local QBCore2 = getQBCore()
                            local gangData = QBCore2 and QBCore2.Shared.Gangs and QBCore2.Shared.Gangs[payload.gang]
                            local gradeData = gangData and gangData.grades and
                            gangData.grades[tostring(tonumber(payload.grade) or 0)]
                            local gangObj = json.encode({
                                name = payload.gang,
                                label = gangData and gangData.label or payload.gang,
                                grade = {
                                    name = gradeData and (gradeData.name or gradeData.label) or
                                    ("Grade " .. tostring(payload.grade)),
                                    level = tonumber(payload.grade) or 0
                                }
                            })
                            MySQL.Async.execute("UPDATE players SET gang=? WHERE citizenid=?", { gangObj, target })
                        end
                    elseif t == "give_item" then
                        if QPlayer then
                            -- اللاعب متصل: نضيف الغرض مباشرة عبر QBCore
                            local success = QPlayer.Functions.AddItem(payload.item, tonumber(payload.amount) or 1)
                            if success then
                                local QBC2 = getQBCore()
                                if QBC2 and QBC2.Shared.Items and QBC2.Shared.Items[payload.item] then
                                    TriggerClientEvent('inventory:client:ItemBox', src, QBC2.Shared.Items[payload.item], "add")
                                end
                            end
                        else
                            -- اللاعب غير متصل: نحدث inventory في قاعدة البيانات مباشرة
                            local itemName = payload.item
                            local itemAmt  = tonumber(payload.amount) or 1
                            -- محاولة ox_inventory أولاً
                            MySQL.Async.fetchScalar(
                                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ox_inventory'",
                                {},
                                function(oxExists)
                                    if oxExists and tonumber(oxExists) > 0 then
                                        MySQL.Async.execute(
                                            "INSERT INTO ox_inventory (owner, name, count) VALUES (?,?,?) ON DUPLICATE KEY UPDATE count=count+?",
                                            { target, itemName, itemAmt, itemAmt }
                                        )
                                    else
                                        -- qb-inventory: تعديل JSON في عمود inventory في جدول players
                                        MySQL.Async.fetchAll(
                                            "SELECT inventory FROM players WHERE citizenid=? LIMIT 1",
                                            { target },
                                            function(rows)
                                                if not rows or not rows[1] then return end
                                                local ok2, inv = pcall(function() return json.decode(rows[1].inventory or '{}') end)
                                                if not ok2 then inv = {} end
                                                -- إيجاد سلوت فارغ أو إضافة جديد
                                                local found = false
                                                for slot, item in pairs(inv) do
                                                    if item and item.name == itemName then
                                                        inv[slot].amount = (inv[slot].amount or 0) + itemAmt
                                                        found = true
                                                        break
                                                    end
                                                end
                                                if not found then
                                                    local nextSlot = 1
                                                    while inv[tostring(nextSlot)] do nextSlot = nextSlot + 1 end
                                                    inv[tostring(nextSlot)] = { name = itemName, amount = itemAmt, slot = nextSlot, info = {}, type = "item", useable = true, shouldClose = true, combinable = nil }
                                                end
                                                MySQL.Async.execute(
                                                    "UPDATE players SET inventory=? WHERE citizenid=?",
                                                    { json.encode(inv), target }
                                                )
                                            end
                                        )
                                    end
                                end
                            )
                        end
                    elseif t == "remove_item" then
                        if QPlayer then
                            QPlayer.Functions.RemoveItem(payload.item, tonumber(payload.amount) or 1, tonumber(payload.slot))
                            local QBC2 = getQBCore()
                            if QBC2 and QBC2.Shared.Items and QBC2.Shared.Items[payload.item] then
                                TriggerClientEvent('inventory:client:ItemBox', src, QBC2.Shared.Items[payload.item], "remove")
                            end
                        end
                        -- Offline: محاولة الحذف من DB
                        MySQL.Async.fetchScalar(
                            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ox_inventory'",
                            {},
                            function(oxExists)
                                if oxExists and tonumber(oxExists) > 0 then
                                    MySQL.Async.execute(
                                        "UPDATE ox_inventory SET count=GREATEST(0, count-?) WHERE owner=? AND name=? LIMIT 1",
                                        { tonumber(payload.amount) or 1, target, payload.item }
                                    )
                                else
                                    -- qb-inventory: إزالة من JSON
                                    MySQL.Async.fetchAll(
                                        "SELECT inventory FROM players WHERE citizenid=? LIMIT 1",
                                        { target },
                                        function(rows)
                                            if not rows or not rows[1] then return end
                                            local ok2, inv = pcall(function() return json.decode(rows[1].inventory or '{}') end)
                                            if not ok2 then return end
                                            local removeAmt = tonumber(payload.amount) or 1
                                            for slot, item in pairs(inv) do
                                                if item and item.name == payload.item then
                                                    local newAmt = (inv[slot].amount or 0) - removeAmt
                                                    if newAmt <= 0 then
                                                        inv[slot] = nil
                                                    else
                                                        inv[slot].amount = newAmt
                                                    end
                                                    break
                                                end
                                            end
                                            MySQL.Async.execute(
                                                "UPDATE players SET inventory=? WHERE citizenid=?",
                                                { json.encode(inv), target }
                                            )
                                        end
                                    )
                                end
                            end
                        )
                    elseif t == "clear_inventory" then
                        if QPlayer then
                            pcall(function() QPlayer.Functions.ClearInventory() end)
                        end
                        MySQL.Async.execute("UPDATE players SET inventory='[]' WHERE citizenid=?", { target })
                        MySQL.Async.execute("DELETE FROM ox_inventory WHERE owner=? OR identifier=?", { target, target })
                    elseif t == "set_metadata" then
                        if QPlayer then
                            QPlayer.Functions.SetMetaData(payload.key, payload.value)
                        end
                        -- Persist to DB always (works both online and offline)
                        MySQL.Async.execute(
                            "UPDATE players SET metadata=JSON_SET(COALESCE(metadata,'{}'), CONCAT('$.', ?), ?) WHERE citizenid=?",
                            { payload.key, payload.value, target }
                        )
                    elseif t == "set_charinfo" then
                        if src then DropPlayer(src, "تم تحديث هويتك من قبل الإدارة. يرجى إعادة الدخول.") end
                        SetTimeout(1500, function()
                            MySQL.Async.fetchAll("SELECT charinfo FROM players WHERE citizenid=? LIMIT 1", { target },
                                function(rows)
                                    if rows and rows[1] then
                                        local ok2, ci2 = pcall(function() return json.decode(rows[1].charinfo) end)
                                        if not ok2 or not ci2 then ci2 = {} end
                                        for k, v in pairs(payload) do ci2[k] = v end
                                        MySQL.Async.execute("UPDATE players SET charinfo=? WHERE citizenid=?",
                                            { json.encode(ci2), target })
                                    end
                                end)
                        end)
                    elseif t == "delete_character" then
                        if src then DropPlayer(src, "تم حذف شخصيتك من قبل الإدارة.") end
                        SetTimeout(1500, function()
                            MySQL.Async.execute("DELETE FROM players WHERE citizenid=?", { target })
                            MySQL.Async.execute("DELETE FROM player_vehicles WHERE citizenid=?", { target })
                            MySQL.Async.execute("DELETE FROM player_houses WHERE citizenid=?", { target })
                            MySQL.Async.execute("DELETE FROM player_contacts WHERE citizenid=?", { target })
                            MySQL.Async.execute("DELETE FROM ox_inventory WHERE owner=?", { target })
                        end)
                    elseif t == "remove_vehicle" then
                        -- Remove a specific vehicle by plate from the DB
                        MySQL.Async.execute("DELETE FROM player_vehicles WHERE citizenid=? AND plate=?",
                            { target, payload.plate })
                    elseif t == "set_permission" then
                        if QPlayer then
                            QPlayer.Functions.AddPermission(payload.group or "user")
                        end
                        -- Also persist in DB (QBCore stores it in players table)
                        MySQL.Async.execute("UPDATE players SET `group`=? WHERE citizenid=?",
                            { payload.group or "user", target })
                    end
                end
            end
        end
        SetTimeout(5000, pollCommands)
    end, "GET", "", { ["x-bridge-token"] = bridgeToken })
end

-- ── Client-side helpers ──
RegisterNetEvent('Echopanel:submitScreenshot', function(citizenid, name, data)
    if not isApproved or not bridgeToken then return end
    PerformHttpRequest(Config.PanelURL .. "/api/bridge/screenshot", function() end, "POST", json.encode({
        citizenid = citizenid,
        name = name,
        image = data
    }), { ["Content-Type"] = "application/json", ["x-bridge-token"] = bridgeToken })
end)

-- عند إيقاف الريسورس
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if isApproved and bridgeToken then
        PerformHttpRequest(Config.PanelURL .. "/api/bridge/offline", function() end,
            "POST", "{}", {
                ["Content-Type"]   = "application/json",
                ["x-bridge-token"] = bridgeToken,
            })
    end
end)

-- عند تشغيل الريسورس
AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    print("[Echo Panel] Starting license verification...")
    SetTimeout(2000, verifyLicense)
    SetTimeout(15000, pollCommands)
end)

-- Export لإرسال رسالة للاعب من ريسورس آخر
exports('sendPlayerMessage', function(src, message)
    TriggerClientEvent('Echopanel:sendMessage', src, message)
end)

-- ── نظام الـ Webhooks المباشر ──
AddEventHandler('entityCreating', function(entity)
    if not isApproved or not bridgeToken then return end
    if GetEntityType(entity) == 2 then -- 2 يعني مركبة (Vehicle)
        local owner = NetworkGetEntityOwner(entity)
        if owner and owner > 0 then
            local model = GetEntityModel(entity)
            local identifiers = GetPlayerIdentifiers(owner)
            local steam, discord, license = "Unknown", "Unknown", "Unknown"
            for _, id in pairs(identifiers) do
                if string.sub(id, 1, 6) == "steam:" then
                    steam = id
                elseif string.sub(id, 1, 8) == "discord:" then
                    discord = string.sub(id, 9)
                elseif string.sub(id, 1, 8) == "license:" then
                    license = id
                end
            end
            local playerName = GetPlayerName(owner) or "Unknown"

            local payload = {
                embeds = {
                    {
                        title = "🚗 Vehicle Spawned",
                        description = string.format(
                            "**Player:** %s (ID: %s)\n**Vehicle Hash:** %s\n**Steam:** %s\n**Discord:** <@%s> (%s)\n**License:** %s",
                            playerName, owner, model, steam, discord, discord, license),
                        color = 15548997, -- Red color
                        timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ')
                    }
                }
            }

            PerformHttpRequest(Config.PanelURL .. "/api/bridge/log", function() end, "POST", json.encode({
                eventType = "vehicle_spawns",
                payload = payload
            }), { ["Content-Type"] = "application/json", ["x-bridge-token"] = bridgeToken })
        end
    end
end)

-- تحديث الـ Metadata من جهة السيرفر (بديل لـ SetPlayerData الغير موجودة في الكلاينت)
RegisterNetEvent('Echopanel:updateNeeds', function(hunger, thirst)
    local src = source
    local QBCore = getQBCore()
    if QBCore then
        local Player = QBCore.Functions.GetPlayer(src)
        if Player then
            Player.Functions.SetMetaData("hunger", hunger)
            Player.Functions.SetMetaData("thirst", thirst)
            
            -- حفظها فوراً في قاعدة البيانات حتى لا تضيع
            MySQL.Async.execute(
                "UPDATE players SET metadata=JSON_SET(COALESCE(metadata,'{}'), '$.hunger', ?, '$.thirst', ?) WHERE citizenid=?",
                { hunger, thirst, Player.PlayerData.citizenid }
            )
        end
    end
end)
