const express = require('express')
const router = express.Router()
const db = require('../db/panel')

let axios
try { axios = require('axios') } catch(e) {}

/**
 * FiveM Resource Bridge
 * The Echo-panel FiveM script calls these endpoints to:
 * 1. Verify license on server startup
 * 2. Send live player data (heartbeat)
 * 3. Sync jobs/gangs/items
 * 4. Retrieve pending commands
 */

// Middleware: verify FiveM bridge token
function bridgeAuth(req, res, next) {
  const token = req.headers['x-bridge-token'] || req.params.token
  if (!token) return res.status(401).json({ error: 'No bridge token' })
  const server = db.prepare(`SELECT * FROM servers WHERE fivem_token = ?`).get(token)
  if (!server) return res.status(401).json({ error: 'Invalid bridge token' })
  req.server = server
  next()
}

// POST /api/bridge/verify  — Called by FiveM resource on startup
router.post('/verify', (req, res) => {
  const { licenseKey, serverIp, dbConnectionString } = req.body
  if (!licenseKey || !serverIp) return res.status(400).json({ status: 'error', reason: 'Missing fields' })

  const license = db.prepare(`SELECT * FROM licenses WHERE key = ? AND active = 1`).get(licenseKey)
  if (!license) return res.json({ status: 'rejected', reason: 'License not found' })
  if (new Date(license.expires_at) < new Date()) return res.json({ status: 'rejected', reason: 'License expired' })

  const requestIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(requestIp) || serverIp === '127.0.0.1' || serverIp === '0.0.0.0'
  const ipMatch = license.server_ip === serverIp || license.server_ip === '*' || (license.server_ip === '127.0.0.1' && isLocal)

  if (!ipMatch) return res.json({ status: 'rejected', reason: `IP mismatch. Expected: ${license.server_ip}` })

  // Generate/get bridge token for this server
  let server = db.prepare(`SELECT * FROM servers WHERE license_key = ?`).get(licenseKey)
  if (!server) {
    const token = require('crypto').randomBytes(32).toString('hex')
    db.prepare(`INSERT INTO servers (license_key, discord_id, name, fivem_token) VALUES (?,?,?,?)`).run(
      licenseKey, license.discord_id, license.server_name || 'My Server', token
    )
    server = db.prepare(`SELECT * FROM servers WHERE license_key = ?`).get(licenseKey)
  }

  // Parse dbConnectionString
  let dbConf = { host: '', port: 3306, user: '', password: '', database: '' }
  if (dbConnectionString) {
    if (dbConnectionString.startsWith('mysql://')) {
      try {
        const u = new URL(dbConnectionString)
        dbConf.host = u.hostname
        dbConf.port = u.port || 3306
        dbConf.user = u.username
        dbConf.password = u.password
        dbConf.database = u.pathname.replace('/', '')
      } catch (e) {}
    } else {
      const pairs = dbConnectionString.split(';')
      pairs.forEach(p => {
        const parts = p.split('=')
        if (parts.length < 2) return
        const key = parts[0].toLowerCase().trim()
        const val = parts.slice(1).join('=').trim()
        if (key === 'server' || key === 'host') dbConf.host = val
        if (key === 'uid' || key === 'user' || key === 'userid') dbConf.user = val
        if (key === 'password' || key === 'pwd') dbConf.password = val
        if (key === 'database') dbConf.database = val
        if (key === 'port') dbConf.port = parseInt(val) || 3306
      })
    }
  }

  db.prepare(`UPDATE servers SET last_ping = datetime('now'), online = 1, db_host=?, db_user=?, db_password=?, db_name=?, db_port=? WHERE id = ?`)
    .run(dbConf.host, dbConf.user, dbConf.password, dbConf.database, dbConf.port, server.id)

  res.json({ status: 'approved', reason: 'Access approved.', bridgeToken: server.fivem_token, plan: license.plan })
})

// POST /api/bridge/sync  — Called once after verification to sync QBCore shared data
router.post('/sync', bridgeAuth, (req, res) => {
  const { jobs, gangs, items } = req.body
  db.prepare(`UPDATE servers SET server_data = ? WHERE id = ?`).run(
    JSON.stringify({ jobs: jobs || [], gangs: gangs || [], items: items || [] }), req.server.id
  )
  console.log(`[Bridge] Synced data for server ${req.server.id}: ${(jobs||[]).length} jobs, ${(gangs||[]).length} gangs, ${(items||[]).length} items`)
  res.json({ ok: true })
})

// POST /api/bridge/heartbeat  — Called every N seconds by FiveM resource
router.post('/heartbeat', bridgeAuth, (req, res) => {
  const { players, playerCount, maxPlayers } = req.body
  db.prepare(`UPDATE servers SET last_ping = datetime('now'), online = 1, online_cache = ? WHERE id = ?`).run(
    JSON.stringify({ players: players || [], playerCount: playerCount || 0, maxPlayers: maxPlayers || 0 }), req.server.id
  )
  res.json({ ok: true })
})

// GET /api/bridge/commands/:token  — Called by FiveM resource to fetch pending commands
// NOTE: bridgeAuth reads token from req.params.token automatically
router.get('/commands/:token', bridgeAuth, (req, res) => {
  const commands = db.prepare(`SELECT * FROM pending_commands WHERE server_id = ? ORDER BY created_at ASC LIMIT 50`).all(req.server.id)

  if (commands.length > 0) {
    const ids = commands.map(c => c.id).join(',')
    db.prepare(`DELETE FROM pending_commands WHERE id IN (${ids})`).run()
  }

  res.json({
    commands: commands.map(c => ({
      id: c.id,
      type: c.command_type,
      target: c.target,
      payload: (() => { try { return JSON.parse(c.payload || '{}') } catch(e) { return {} } })()
    }))
  })
})

// POST /api/bridge/offline  — Called when FiveM server shuts down
router.post('/offline', bridgeAuth, (req, res) => {
  db.prepare(`UPDATE servers SET online = 0 WHERE id = ?`).run(req.server.id)
  res.json({ ok: true })
})

// POST /api/bridge/screenshot  — Receive screenshot (Base64) from FiveM
router.post('/screenshot', bridgeAuth, (req, res) => {
  const { citizenid, name, image, imageUrl } = req.body
  const imgData = image || imageUrl || null
  if (!imgData) return res.status(400).json({ error: 'No image data' })

  const serverId = req.server.id
  if (!global.screenshotsCache) global.screenshotsCache = {}
  if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = []

  // Remove old screenshot for this player and add new one
  global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== citizenid)
  global.screenshotsCache[serverId].push({
    citizenid,
    name: name || citizenid,
    screenshotUrl: imgData,
    ts: new Date().toLocaleTimeString('ar-SA')
  })

  // Keep only latest 100 screenshots per server
  if (global.screenshotsCache[serverId].length > 100) {
    global.screenshotsCache[serverId] = global.screenshotsCache[serverId].slice(-100)
  }

  res.json({ success: true })
})

// POST /api/bridge/screenshot_upload  — Receive multipart file upload
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/screenshot_upload', bridgeAuth, upload.single('image'), (req, res) => {
  const citizenid = req.query.citizenid || 'unknown'
  const name = req.query.name || 'Unknown'

  if (!req.file) return res.status(400).json({ error: 'No image uploaded' })

  const image = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`

  const serverId = req.server.id
  if (!global.screenshotsCache) global.screenshotsCache = {}
  if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = []

  global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== citizenid)
  global.screenshotsCache[serverId].push({ citizenid, name, screenshotUrl: image, ts: new Date().toLocaleTimeString('ar-SA') })

  res.json({ success: true })
})

// GET /api/bridge/screenshots  — Retrieve cached screenshots for this server
router.get('/screenshots', bridgeAuth, (req, res) => {
  const serverId = req.server.id
  res.json(global.screenshotsCache?.[serverId] || [])
})

// POST /api/bridge/log  — Receive events from FiveM and trigger Discord webhooks
router.post('/log', bridgeAuth, async (req, res) => {
  const { eventType, payload } = req.body
  try {
    const row = db.prepare(`SELECT webhooks FROM server_webhooks WHERE server_id = ?`).get(req.server.id)
    if (!row) return res.json({ success: true, ignored: true })
    const webhooks = JSON.parse(row.webhooks || '{}')
    const hookUrl = webhooks[eventType]
    if (!hookUrl) return res.json({ success: true, ignored: true })

    if (axios) {
      await axios.post(hookUrl, payload)
    }
    res.json({ success: true })
  } catch (err) {
    console.error(`[Bridge] Webhook error for event ${eventType}:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
