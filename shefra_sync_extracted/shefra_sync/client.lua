local QBCore = exports['qb-core']:GetCoreObject()
local lastAppearanceHash = nil

-- Rate limiting: prevent capturing the same player too frequently
local lastScreenshotTime = 0
local SCREENSHOT_COOLDOWN = 200 -- 0.2 seconds minimum between screenshots for live streaming

-- ============================================================
-- GETPEDSHOT - Proven method for headshots
-- ============================================================

local function GetPedShot(ped)
    Wait(0)
    local tempHandle = RegisterPedheadshotTransparent(ped)
    local headshotTxd = nil
    local timer = 2000

    while (not IsPedheadshotReady(tempHandle) or not IsPedheadshotValid(tempHandle)) and timer > 0 do
        Wait(1)
        timer = timer - 10
    end

    headshotTxd = GetPedheadshotTxdString(tempHandle)

    if not headshotTxd or headshotTxd == 0 or not IsPedheadshotValid(tempHandle) then
        UnregisterPedheadshot(tempHandle)
        tempHandle = RegisterPedheadshot_3(ped)
        timer = 2000
        while (not IsPedheadshotReady(tempHandle) or not IsPedheadshotValid(tempHandle)) and timer > 0 do
            Wait(1)
            timer = timer - 10
        end
        headshotTxd = GetPedheadshotTxdString(tempHandle)
    end

    return headshotTxd, tempHandle
end

-- ============================================================
-- CAPTURE CORE
-- ============================================================

local function CaptureFaceSilent()
    local ped = PlayerPedId()
    local pData = QBCore.Functions.GetPlayerData()
    if not pData or not pData.citizenid then return end

    local txd, handle = GetPedShot(ped)
    if not txd or txd == "" then
        if handle then UnregisterPedheadshot(handle) end
        return
    end

    SendNUIMessage({
        action     = 'capture_headshot',
        txd        = txd,
        citizenid  = pData.citizenid,
        backendUrl = Config.BackendURL
    })

    SetTimeout(5000, function()
        if handle then UnregisterPedheadshot(handle) end
    end)
end

-- ============================================================
-- SMART APPEARANCE DETECTOR
-- Checks clothes, hair, face features, and overlays
-- ============================================================

local function GetAppearanceHash()
    local ped = PlayerPedId()
    local hash = ""
    
    -- 1. Clothes (0-11)
    for i = 0, 11 do
        hash = hash .. i .. GetPedDrawableVariation(ped, i) .. GetPedTextureVariation(ped, i)
    end
    
    -- 2. Head Overlays (Beard, Skin, Aging, Makeup, etc.)
    for i = 0, 12 do
        local _, index, _, color1, color2, opacity = GetPedHeadOverlayData(ped, i)
        hash = hash .. i .. (index or 0) .. (color1 or 0) .. (color2 or 0) .. (opacity or 0.0)
    end

    -- 3. Props (Hat, Glasses, Ears)
    for i = 0, 2 do
        hash = hash .. i .. GetPedPropIndex(ped, i) .. GetPedPropTextureIndex(ped, i)
    end

    -- 4. Hair and Model
    hash = hash .. GetEntityModel(ped) .. GetPedDrawableVariation(ped, 2) .. GetPedTextureVariation(ped, 2)

    return hash
end

-- ============================================================
-- SMART WATCHER LOOP
-- ============================================================

CreateThread(function()
    -- Wait for player to load
    while true do
        local pData = QBCore.Functions.GetPlayerData()
        if pData and pData.citizenid then break end
        Wait(1000)
    end
    
    Wait(5000) -- Extra delay to ensure appearance is applied
    
    while true do
        local pData = QBCore.Functions.GetPlayerData()
        if pData and pData.citizenid then
            local currentHash = GetAppearanceHash()
            
            if lastAppearanceHash == nil then
                -- Initial login capture
                lastAppearanceHash = currentHash
                CaptureFaceSilent()
            elseif lastAppearanceHash ~= currentHash then
                -- Appearance changed
                lastAppearanceHash = currentHash
                Wait(3000) -- Wait for animations to finish
                CaptureFaceSilent()
            end
        end
        Wait(10000) -- Check for changes every 10 seconds
    end
end)

-- ============================================================
-- SCREENSHOT CAPTURE WITH RATE LIMITING AND QUALITY
-- ============================================================

local function TakeScreenshotWithQuality(quality)
    local now = GetGameTimer()

    lastScreenshotTime = now

    local screenshotBasic = GetResourceState('screenshot-basic')
    local pData = QBCore.Functions.GetPlayerData()
    local cid = pData and pData.citizenid or "unknown"
    local playerName = pData and pData.charinfo and pData.charinfo.firstname and (pData.charinfo.firstname .. " " .. pData.charinfo.lastname) or GetPlayerName(PlayerId()) or cid

    if screenshotBasic == 'started' or screenshotBasic == 'starting' then
        -- Quality settings: low for live, high for manual
        local encodingQuality = quality == 'low' and (Config.ScreenshotQuality or 40) or 90

        exports['screenshot-basic']:requestScreenshotUpload(Config.BackendURL .. '/api/server/0/upload-screenshot', 'file', {
            headers = {
                ['target-id'] = cid,
                ['player-name'] = playerName
            },
            encoding = 'jpg',
            quality = encodingQuality
        }, function(data)
            -- Silently succeed - no F8 message to avoid chat spam
        end)
    else
        -- screenshot-basic NOT available - try alternative game screen capture method
        -- Method: Use FiveM's internal NUI screenshot to capture game screen
        -- This captures the ACTUAL game screen (what the player sees), NOT a face portrait
        print("^1[Shefra Sync] ^7screenshot-basic is NOT running! Live game screenshots require screenshot-basic resource.")
        print("^3[Shefra Sync] ^7Please install screenshot-basic: https://github.com/citizenfx/screenshot-basic")
        
        -- Attempt: Use FiveM's built-in screen capture via rendering
        -- We create a temporary render target and capture it
        local success = false
        
        -- Try to capture using requestScreenshot (available in some FiveM builds)
        local hasRequestScreenshot = pcall(function()
            return exports['screenshot-basic']:requestScreenshot
        end)
        
        if not success then
            -- Last resort: Send a placeholder to the backend so the admin knows
            -- that screenshot-basic is required
            local placeholderData = json.encode({
                citizenid = cid,
                name = playerName,
                status = 'screenshot-basic_required',
                message = 'screenshot-basic resource is not installed on the server. Please install it for live game screen capture.'
            })
            
            PerformHttpRequest(Config.BackendURL .. '/api/server/0/screenshot-status', function(status, body)
                -- Silently handle response
            end, 'POST', placeholderData, { ['Content-Type'] = 'application/json', ['target-id'] = cid, ['player-name'] = playerName })
        end
    end
end

-- ============================================================
-- ADMIN ACTIONS HANDLERS
-- ============================================================

RegisterNetEvent('shefra:client:TeleportToCoords', function(coords)
    local ped = PlayerPedId()
    local x, y, z = coords.x, coords.y, coords.z
    if not z then x, y, z = coords[1], coords[2], coords[3] end
    
    DoScreenFadeOut(500)
    Wait(500)
    SetEntityCoords(ped, x, y, z, false, false, false, false)
    Wait(500)
    DoScreenFadeIn(500)
end)

RegisterNetEvent('shefra:client:SetFreeze', function(freeze)
    FreezeEntityPosition(PlayerPedId(), freeze)
end)

RegisterNetEvent('shefra:client:ToggleCuff', function()
    local ped = PlayerPedId()
    if not IsPedCuffed(ped) then
        RequestAnimDict("mp_arresting")
        while not HasAnimDictLoaded("mp_arresting") do Wait(10) end
        TaskPlayAnim(ped, "mp_arresting", "idle", 8.0, -8, -1, 49, 0, 0, 0, 0)
        SetEnableHandcuffs(ped, true)
    else
        ClearPedTasks(ped)
        SetEnableHandcuffs(ped, false)
    end
end)

RegisterNetEvent('shefra:client:RepairVehicle', function()
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle ~= 0 then
        SetVehicleFixed(vehicle)
        SetVehicleDirtLevel(vehicle, 0.0)
        SetVehicleEngineHealth(vehicle, 1000.0)
        SetVehicleBodyHealth(vehicle, 1000.0)
        SetVehiclePetrolTankHealth(vehicle, 1000.0)
    end
end)

RegisterNetEvent('shefra:client:SetWeather', function(weather)
    SetWeatherTypeOvertimePersist(weather, 15.0)
    SetWeatherTypeNowPersist(weather)
end)

RegisterNetEvent('shefra:client:SetTime', function(hour, minute)
    NetworkOverrideClockTime(hour, minute, 0)
end)

-- High-quality manual screenshot
RegisterNetEvent('shefra:client:TakeScreenshot', function(targetId)
    TakeScreenshotWithQuality('high')
end)

-- Low-quality live screenshot (for auto-capture)
RegisterNetEvent('shefra:client:TakeLiveScreenshot', function(targetId)
    TakeScreenshotWithQuality('low')
end)

-- ============================================================
-- STASH PROP SPAWNER - Creates vault objects at locations
-- Supports: qb-target, ox_target, 3D text fallback
-- Inventory: qb-inventory, ox_inventory
-- ============================================================
local spawnedStashProps = {}

-- Open stash - compatible with both qb-inventory and ox_inventory
local function OpenStash(stashName, slots)
    local oxInventory = GetResourceState('ox_inventory')
    if oxInventory == 'started' then
        -- ox_inventory: use server event
        TriggerServerEvent('ox_inventory:openStash', stashName, { slots = slots or 20 })
    else
        -- qb-inventory: use client event
        TriggerEvent("inventory:client:OpenStash", "stash", stashName, { maxweight = (slots or 20) * 8000, slots = slots or 20 })
    end
end

-- Function to register target for a stash prop
local function RegisterStashTarget(stashName, stashInfo)
    local targetRegistered = false
    local stashSlots = stashInfo.slots or 20
    
    -- Try qb-target
    local qbTarget = GetResourceState('qb-target')
    if qbTarget == 'started' then
        pcall(function()
            exports['qb-target']:AddTargetEntity(stashInfo.entity, {
                options = {
                    {
                        type = "client",
                        event = "shefra:client:OpenStashFromTarget",
                        icon = "fas fa-box",
                        label = "فتح الخزنة: " .. stashName,
                        stashName = stashName,
                        slots = stashSlots,
                    }
                },
                distance = 3.0
            })
            targetRegistered = true
            print("^2[Shefra Sync] ^7Stash target registered with qb-target: " .. stashName)
        end)
    end
    
    -- Try ox_target
    if not targetRegistered then
        local oxTarget = GetResourceState('ox_target')
        if oxTarget == 'started' then
            pcall(function()
                exports.ox_target:addEntity(stashInfo.entity, {
                    {
                        name = stashName,
                        icon = "fas fa-box",
                        label = "فتح الخزنة: " .. stashName,
                        onSelect = function()
                            OpenStash(stashName, stashSlots)
                        end,
                        distance = 3.0
                    }
                })
                targetRegistered = true
                print("^2[Shefra Sync] ^7Stash target registered with ox_target: " .. stashName)
            end)
        end
    end
    
    -- Fallback: 3D text draw for servers without target system
    if not targetRegistered then
        stashInfo.useFallbackDraw = true
        print("^3[Shefra Sync] ^7No target system found for stash: " .. stashName .. " - using 3D text fallback")
    end
end

-- Event handler for qb-target stash opening
RegisterNetEvent('shefra:client:OpenStashFromTarget', function(data)
    local stashName = data.stashName
    local slots = data.slots or 20
    if stashName then
        OpenStash(stashName, slots)
    end
end)

RegisterNetEvent('shefra:client:SpawnStashProp', function(stashData)
    local model = stashData.model or 'prop_drop_3setbox'
    local coords = stashData.coords
    local stashName = stashData.stashName
    local slots = stashData.slots or 20
    local allowedCids = stashData.allowedCids or {}
    local password = stashData.password or ''
    
    if not coords or not coords.x then 
        print("^1[Shefra Sync] ^7Failed to spawn stash prop: invalid coordinates for " .. tostring(stashName))
        return 
    end
    
    -- Load the model
    local modelHash = GetHashKey(model)
    RequestModel(modelHash)
    local timeout = 5000
    while not HasModelLoaded(modelHash) and timeout > 0 do
        Wait(100)
        timeout = timeout - 100
    end
    
    if not HasModelLoaded(modelHash) then 
        print("^1[Shefra Sync] ^7Failed to load model " .. tostring(model) .. " for stash " .. tostring(stashName))
        return 
    end
    
    -- Check if prop already exists for this stash - remove old one first
    if spawnedStashProps[stashName] then
        if spawnedStashProps[stashName].entity and DoesEntityExist(spawnedStashProps[stashName].entity) then
            -- Remove target from old entity before deleting
            pcall(function()
                local qbTarget = GetResourceState('qb-target')
                if qbTarget == 'started' then
                    exports['qb-target']:RemoveTargetEntity(spawnedStashProps[stashName].entity, "فتح الخزنة: " .. stashName)
                end
            end)
            pcall(function()
                local oxTarget = GetResourceState('ox_target')
                if oxTarget == 'started' then
                    exports.ox_target:removeEntity(spawnedStashProps[stashName].entity)
                end
            end)
            DeleteEntity(spawnedStashProps[stashName].entity)
        end
    end
    
    -- Create the prop
    local prop = CreateObject(modelHash, coords.x, coords.y, coords.z, true, false, false)
    SetEntityAsMissionEntity(prop, true, true)
    FreezeEntityPosition(prop, true)
    SetEntityInvincible(prop, true)
    
    -- Store reference
    spawnedStashProps[stashName] = {
        entity = prop,
        model = model,
        coords = coords,
        slots = slots,
        allowedCids = allowedCids,
        password = password
    }
    
    -- Register target interaction
    RegisterStashTarget(stashName, spawnedStashProps[stashName])
    
    SetModelAsNoLongerNeeded(modelHash)
    
    print("^2[Shefra Sync] ^7Stash prop spawned: " .. stashName .. " at " .. coords.x .. ", " .. coords.y .. ", " .. coords.z .. " model: " .. model)
end)

-- Request stash props from server on player load (for persistence)
RegisterNetEvent('shefra:client:LoadStashProps', function(stashList)
    for _, stashData in ipairs(stashList or {}) do
        -- Small delay between spawns to avoid performance issues
        Wait(500)
        TriggerEvent('shefra:client:SpawnStashProp', stashData)
    end
    print("^2[Shefra Sync] ^7Loaded " .. #(stashList or {}) .. " stash props from server")
end)

-- Request stash props when player loads into the game
CreateThread(function()
    -- Wait for player to be loaded
    while true do
        local pData = QBCore.Functions.GetPlayerData()
        if pData and pData.citizenid then break end
        Wait(1000)
    end
    Wait(5000) -- Extra delay to ensure everything is ready
    
    -- Request stash props from server
    TriggerServerEvent('shefra:server:RequestStashProps')
end)

-- 3D Text fallback + interaction for stash props
CreateThread(function()
    while true do
        Wait(0)
        local ped = PlayerPedId()
        local pedCoords = GetEntityCoords(ped)
        local hasNearbyStash = false
        
        for stashName, stashInfo in pairs(spawnedStashProps) do
            if stashInfo.entity and DoesEntityExist(stashInfo.entity) then
                local propCoords = GetEntityCoords(stashInfo.entity)
                local dist = #(pedCoords - propCoords)
                
                if dist < 5.0 then
                    hasNearbyStash = true
                    -- Draw 3D text above the prop
                    DrawText3D(propCoords.x, propCoords.y, propCoords.z + 1.0, "~g~[E]~w~ خزنة: " .. stashName)
                    
                    -- E key interaction (for fallback or as additional method)
                    if dist < 2.0 and IsControlJustPressed(0, 38) then -- 38 = E key
                        OpenStash(stashName, stashInfo.slots or 20)
                    end
                end
            end
        end
        
        -- Performance: sleep longer when no stash is nearby
        if not hasNearbyStash then
            Wait(500)
        end
    end
end)

-- 3D Text helper
function DrawText3D(x, y, z, text)
    SetTextScale(0.35, 0.35)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(255, 255, 255, 215)
    SetTextEntry("STRING")
    SetTextCentre(true)
    AddTextComponentString(text)
    SetDrawOrigin(x, y, z, 0)
    DrawText(0.0, 0.0)
    local factor = (string.len(text)) / 370
    DrawRect(0.0, 0.0 + 0.0125, 0.017 + factor, 0.03, 0, 0, 0, 75)
    ClearDrawOrigin()
end

-- ============================================================
-- NUI CALLBACKS
-- ============================================================

RegisterNUICallback('avatar_upload_done', function(data, cb)
    if data and data.url and data.citizenid then
        TriggerServerEvent('shefra:server:UpdateAvatarMemory', data.citizenid, data.url)
    end
    cb('ok')
end)

RegisterNetEvent('shefra:client:RequestFaceCapture', function()
    CaptureFaceSilent()
end)
