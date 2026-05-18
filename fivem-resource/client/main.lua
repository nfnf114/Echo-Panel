-- Echo Panel Client Script

local QBCore = nil

-- محاولة الحصول على QBCore بشكل آمن
CreateThread(function()
    Wait(1000)
    local ok, core = pcall(function() return exports['qb-core']:GetCoreObject() end)
    if ok and core then
        QBCore = core
    end
end)

local function notify(msg, ntype)
    if QBCore then
        pcall(function() QBCore.Functions.Notify(msg, ntype or 'primary', 5000) end)
    else
        BeginTextCommandDisplayHelp('STRING')
        AddTextComponentSubstringPlayerName('Echo: ' .. msg)
        EndTextCommandDisplayHelp(0, false, true, 5000)
    end
end

-- ─── رسالة مباشرة من البانل ───────────────────────────────────
RegisterNetEvent('Echopanel:sendMessage', function(message)
    SendNUIMessage({
        action = "showDM",
        message = message
    })
end)

RegisterNUICallback('playSound', function(data, cb)
    PlaySoundFrontend(-1, "CONFIRM_BEEP", "HUD_MINI_GAME_SOUNDSET", true)
    cb('ok')
end)

-- ─── إطعام اللاعب ──────────────────────────────────────────────
RegisterNetEvent('Echopanel:feed', function()
    local ped = PlayerPedId()

    -- صحة كاملة
    SetEntityHealth(ped, 200)
    SetPedMaxHealth(ped, 200)
    ClearPedBloodDamage(ped)

    -- تحديث الجوع والعطش عبر QBCore
    if QBCore then
        -- طريقة 1: TriggerEvent لتحديث الـ HUD (يعمل مع qb-hud و ps-hud)
        pcall(function()
            TriggerEvent('hud:client:UpdateNeeds', 100, 100)
        end)

        -- طريقة 2: LocalPlayer state (يعمل مع ps-hud الحديث)
        pcall(function()
            LocalPlayer.state:set('hunger', 100, true)
            LocalPlayer.state:set('thirst', 100, true)
        end)

        -- طريقة 3: طلب من السيرفر تحديث الـ metadata في QBCore
        pcall(function()
            TriggerServerEvent('Echopanel:updateNeeds', 100, 100)
        end)
    end

    notify('تمت معالجتك وإطعامك من قِبل الإدارة.', 'success')
end)


-- ─── نقل اللاعب ────────────────────────────────────────────────
RegisterNetEvent('Echopanel:teleport', function(coords)
    local ped = PlayerPedId()
    SetEntityCoords(ped, coords.x, coords.y, coords.z, false, false, false, true)
    notify('تم نقلك من قِبل الإدارة.', 'primary')
end)

-- ─── قتل اللاعب ────────────────────────────────────────────────
RegisterNetEvent('Echopanel:kill', function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, 0)
    notify('تم إنهاء شخصيتك من قِبل الإدارة.', 'error')
end)

-- ─── شفاء اللاعب ───────────────────────────────────────────────
RegisterNetEvent('Echopanel:heal', function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, 200)
    SetPedMaxHealth(ped, 200)
    ClearPedBloodDamage(ped)
    if QBCore then
        pcall(function() TriggerEvent('hud:client:UpdateNeeds', 100, 100) end)
        pcall(function()
            LocalPlayer.state:set('hunger', 100, true)
            LocalPlayer.state:set('thirst', 100, true)
        end)
    end
    notify('تم علاجك من قِبل الإدارة.', 'success')
end)


-- ─── تصليح المركبة ─────────────────────────────────────────────
RegisterNetEvent('Echopanel:fixVehicle', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    if DoesEntityExist(veh) then
        SetVehicleEngineHealth(veh, 1000.0)
        SetVehicleBodyHealth(veh, 1000.0)
        SetVehicleFixed(veh)
        SetVehicleDeformationFixed(veh)
        SetVehicleFuelLevel(veh, 100.0)
        notify('تم تصليح مركبتك.', 'success')
    else
        notify('أنت لست في مركبة.', 'error')
    end
end)

-- ─── كلبشة / فك الكلبشة ────────────────────────────────────────
RegisterNetEvent('Echopanel:handcuff', function(cuff)
    -- نحاول عدة ريسورسات
    if GetResourceState('qb-policejob') == 'started' then
        TriggerEvent('qb-policejob:client:Cuff', cuff)
    elseif GetResourceState('ps-policejob') == 'started' then
        TriggerEvent('ps-policejob:client:Cuff', cuff)
    elseif GetResourceState('qs-policejob') == 'started' then
        TriggerEvent('qs-policejob:client:Cuff', cuff)
    else
        -- Generic fallback: تجميد اللاعب
        local ped = PlayerPedId()
        FreezeEntityPosition(ped, cuff)
        SetPedCanRagdoll(ped, not cuff)
        if cuff then
            TaskClearLookAt(ped)
            SetPedCurrentWeaponVisible(ped, false, true, true, true)
        end
    end
    notify(cuff and 'تم تكبيلك.' or 'تم فك الكلبشة.', 'primary')
end)

-- ─── إنعاش اللاعب في مكانه ──────────────────────────────────
RegisterNetEvent('Echopanel:revive', function()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    -- دائماً نُنعش في نفس المكان (NetworkResurrectLocalPlayer يمنع النقل للمستشفى)
    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z + 0.1, heading, true, false, false)
    SetEntityHealth(ped, 200)
    SetPedMaxHealth(ped, 200)
    ClearPedBloodDamage(ped)
    SetPedCoordsKeepVehicle(ped, coords.x, coords.y, coords.z + 0.1)

    -- إخبار أنظمة الطوارئ بأن الشخص أُنعش (حتى لا تعيد فتح قائمة المستشفى)
    if GetResourceState('qb-ambulancejob') == 'started' then
        pcall(function() TriggerEvent('hospital:client:SetDead', false) end)
    end
    if GetResourceState('ps-ambulance') == 'started' then
        pcall(function() TriggerEvent('ps-ambulance:client:setDead', false) end)
    end

    notify('تم إنعاشك من قِبل الإدارة.', 'success')
end)


-- ─── طلب لقطة شاشة ─────────────────────────────────────────────
RegisterNetEvent('Echopanel:requestScreenshot', function()
    if GetResourceState('screenshot-basic') ~= 'started' then
        TriggerServerEvent('Echopanel:screenshotError', 'screenshot-basic resource not running')
        return
    end

    exports['screenshot-basic']:requestScreenshot(function(data)
        if not data then
            TriggerServerEvent('Echopanel:screenshotError', 'No data received')
            return
        end

        local citizenid = 'unknown'
        local name = GetPlayerName(PlayerId())

        if QBCore then
            local ok, pData = pcall(function() return QBCore.Functions.GetPlayerData() end)
            if ok and pData then
                citizenid = pData.citizenid or citizenid
                local ci = pData.charinfo
                if ci and ci.firstname then
                    name = ci.firstname .. ' ' .. (ci.lastname or '')
                end
            end
        end

        TriggerServerEvent('Echopanel:submitScreenshot', citizenid, name, data)
    end)
end)
