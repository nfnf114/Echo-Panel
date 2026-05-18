Config = Config or {}

-- ============================================================
-- Shefra Store License Settings
-- ============================================================

-- [1] Put your license key here (obtained from the bot)
Config.LicenseKey = "SHEFRA-1C4B247256580E0F"

-- [2] Data auto-update interval (in minutes)
Config.UpdateInterval = 1

-- [3] Server name (optional - if left empty it will use SV_HOSTNAME)
Config.ServerName = ""

-- [4] Backend URL for the control panel (important for uploading player images)
Config.BackendURL = "http://localhost:3001"

-- [5] Require players to have Discord running
-- The script automatically fetches Discord ID from FiveM without a bot or external linking
Config.RequireDiscord = true  -- Requires Discord to be running to join

-- [6] Screenshot settings for live streaming
-- Interval between auto-screenshots per player (in seconds)
Config.ScreenshotInterval = 1

-- JPEG quality for live screenshots (1-100, lower = smaller file = faster upload)
Config.ScreenshotQuality = 40

-- ============================================================
-- Note:
-- You can only modify the options above. Any modifications to server files
-- may break the connection with the control panel.
-- ============================================================
