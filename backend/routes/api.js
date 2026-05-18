const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const fivem = require('../db/fivem')
const db = require('../db/panel')
const archiver = require('archiver')
const path = require('path')
const fs = require('fs')

// Middleware: verify JWT and attach DB Config
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    req.user = user
    
    // Check for specific server
    const serverId = req.headers['x-server-id']
    if (serverId) {
      // User must own this server, or be the owner
      let server = db.prepare(`SELECT * FROM servers WHERE id = ?`).get(serverId)
      if (server) {
        if (!user.isOwner && server.discord_id !== user.id) {
          // Check if user is an admin
          const admin = db.prepare(`SELECT a.*, r.permissions FROM server_admins a JOIN server_ranks r ON a.rank_id = r.id WHERE a.server_id = ? AND a.discord_id = ?`).get(serverId, user.id)
          if (!admin) server = null
          else req.user.permissions = JSON.parse(admin.permissions || '[]')
        } else {
          req.user.permissions = ['*'] // Owner gets everything
        }
      }
      if (server) {
        req.server = server
        req.dbConfig = {
          host: server.db_host,
          port: server.db_port,
          user: server.db_user,
          password: server.db_password,
          database: server.db_name,
        }
      }
    } else if (user.isOwner) {
      // Fallback for owner
      req.dbConfig = {
        host: process.env.FIVEM_DB_HOST,
        port: process.env.FIVEM_DB_PORT,
        user: process.env.FIVEM_DB_USER,
        password: process.env.FIVEM_DB_PASSWORD,
        database: process.env.FIVEM_DB_NAME,
      }
    }

    if (!req.dbConfig && req.path !== '/my-servers') {
      return res.status(400).json({ error: 'No server selected' })
    }

    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function getDbConfig(user, req) {
  return req?.dbConfig
}

// GET /api/plans — Returns available plan features
router.get('/plans', (req, res) => {
  try {
    const { PLANS } = require('../bot/index')
    res.json(PLANS)
  } catch (e) {
    res.json({
      'Echo Trial': { navBlocked: [] },
      'Echo Lite': { navBlocked: ['gangs', 'stashes', 'investigate', 'dupe-scanner', 'screenshots', 'online', 'queue'] },
      'Echo Pro': { navBlocked: ['screenshots', 'online', 'queue'] },
      'Echo Max': { navBlocked: [] },
    })
  }
})

// GET /api/global-stats
router.get('/global-stats', (req, res) => {
  try {
    const servers = db.prepare('SELECT COUNT(*) as c FROM servers WHERE online = 1').get().c || 0
    const licenses = db.prepare('SELECT COUNT(*) as c FROM licenses').get().c || 0
    const users = db.prepare('SELECT COUNT(DISTINCT discord_id) as c FROM licenses').get().c || 0
    res.json({ servers, licenses, users })
  } catch(e) {
    res.json({ servers: 0, licenses: 0, users: 0 })
  }
})

// GET /api/my-servers
router.get('/my-servers', auth, (req, res) => {
  if (req.user.isOwner) {
    const data = db.prepare(`
      SELECT l.*, l.server_name as lic_name, s.id as server_id, s.online, s.last_ping, s.name as server_display_name, s.fivem_token
      FROM licenses l
      LEFT JOIN servers s ON l.key = s.license_key
    `).all()
    res.json(data.map(d => ({ ...d, id: d.server_id || ('lic_' + d.id), permissions: ['*'] })))
  } else {
    // For normal users, fetch their own licenses AND any server they are an admin of
    const owned = db.prepare(`
      SELECT l.*, l.server_name as lic_name, s.id as server_id, s.online, s.last_ping, s.name as server_display_name, s.fivem_token
      FROM licenses l
      LEFT JOIN servers s ON l.key = s.license_key
      WHERE l.discord_id = ?
    `).all(req.user.id)
    
    const adminOf = db.prepare(`
      SELECT s.*, l.plan, l.server_name as lic_name, r.permissions, s.id as server_id, s.name as server_display_name, s.fivem_token
      FROM server_admins a
      JOIN servers s ON a.server_id = s.id
      JOIN licenses l ON s.license_key = l.key
      JOIN server_ranks r ON a.rank_id = r.id
      WHERE a.discord_id = ? AND l.discord_id != ?
    `).all(req.user.id, req.user.id)

    const combined = [
      ...owned.map(d => ({ ...d, id: d.server_id || ('lic_' + d.id), permissions: ['*'] })),
      ...adminOf.map(d => ({ ...d, id: d.server_id, permissions: JSON.parse(d.permissions||'[]') }))
    ]
    res.json(combined)
  }
})

// GET /api/server-data
router.get('/server-data', auth, (req, res) => {
  if (!req.server) return res.json({ jobs: [], gangs: [], items: [] })
  try {
    const data = JSON.parse(req.server.server_data || '{"jobs":[],"gangs":[],"items":[]}')
    res.json(data)
  } catch (e) {
    res.json({ jobs: [], gangs: [], items: [] })
  }
})

// GET /api/global-stats
router.get('/global-stats', auth, (req, res) => {
  try {
    const onlineServers = db.prepare('SELECT COUNT(*) as count FROM servers WHERE online = 1').get().count
    const totalUsers = db.prepare(`SELECT COUNT(DISTINCT discord_id) as count FROM (SELECT discord_id FROM licenses UNION SELECT discord_id FROM server_admins)`).get().count
    res.json({ onlineServers, totalUsers })
  } catch (e) {
    res.json({ onlineServers: 0, totalUsers: 0 })
  }
})

// GET /api/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await fivem.getStats(getDbConfig(req.user, req))
    // Augment with maxPlayers/playerCount from bridge cache
    if (req.server) {
      try {
        const onlineCache = JSON.parse(req.server.online_cache || '{}')
        stats.maxPlayers = onlineCache.maxPlayers || stats.maxPlayers || 0
        stats.playerCount = onlineCache.playerCount || onlineCache.players?.length || stats.playerCount || 0
      } catch(e) {}
    }
    res.json(stats)
  } catch (e) {
    res.json({ online: false, players: 0, vehicles: 0, gangs: 0, stashes: 0, bans: 0, error: e.message })
  }
})

// GET /api/players
router.get('/players', auth, async (req, res) => {
  try {
    const players = await fivem.getPlayers(getDbConfig(req.user, req))
    if (req.server) {
      try {
        const cache = JSON.parse(req.server.online_cache || '{}')
        const onlineCids = new Set((cache.players || []).map(p => p.citizenid))
        players.forEach(p => {
          if (onlineCids.has(p.citizenid)) p.online = true
          else p.online = false
        })
      } catch(e) {}
    }
    res.json(players)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/online
router.get('/online', auth, async (req, res) => {
  try {
    // Use bridge cache from active server
    if (req.server) {
      try {
        const cache = JSON.parse(req.server.online_cache || '{}')
        return res.json(cache.players || [])
      } catch(e) { return res.json([]) }
    }
    const players = await fivem.getPlayers(getDbConfig(req.user, req))
    res.json(players.filter(p => p.status === 'online').slice(0, 50))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// NOTE: /server-data is defined above at line ~131 using req.server.server_data (the correct definition)

// GET /api/vehicles
router.get('/vehicles', auth, async (req, res) => {
  try {
    const vehicles = await fivem.getVehicles(getDbConfig(req.user, req))
    res.json(vehicles)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/gangs
router.get('/gangs', auth, async (req, res) => {
  try {
    const gangs = await fivem.getGangs(getDbConfig(req.user, req))
    res.json(gangs)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/stashes
router.get('/stashes', auth, async (req, res) => {
  try {
    const stashes = await fivem.getStashes(getDbConfig(req.user, req))
    res.json(stashes)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/stashes/:id
router.get('/stashes/:id', auth, async (req, res) => {
  try {
    const contents = await fivem.getStashContents(getDbConfig(req.user, req), req.params.id)
    res.json(contents)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/stashes/:id/items — Add an item to a specific stash
router.post('/stashes/:id/items', auth, async (req, res) => {
  try {
    const { name, count, type, label } = req.body
    if (!name) return res.status(400).json({ error: 'Item name is required' })
    const result = await fivem.addStashItem(getDbConfig(req.user, req), req.params.id, { name, count: count || 1, type: type || 'item', label: label || name })
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/bans
router.get('/bans', auth, async (req, res) => {
  try {
    const bans = await fivem.getBans(getDbConfig(req.user, req))
    res.json(bans)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/investigate
router.get('/investigate', auth, async (req, res) => {
  const { q } = req.query
  if (!q) return res.json({ players: [], vehicles: [] })
  try {
    const dbConfig = getDbConfig(req.user, req)
    const conn = await fivem.createFiveMConnection(dbConfig)
    const like = `%${q}%`
    const [players] = await conn.execute(
      `SELECT citizenid, charinfo FROM players WHERE citizenid LIKE ? OR license LIKE ? LIMIT 20`, [like, like]
    )
    const [vehicles] = await conn.execute(
      `SELECT plate, vehicle, citizenid FROM player_vehicles WHERE plate LIKE ? OR citizenid LIKE ? LIMIT 20`, [like, like]
    )
    await conn.end()
    res.json({
      players: players.map(p => {
        const c = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo
        return { citizenid: p.citizenid, name: c ? `${c.firstname} ${c.lastname}` : 'Unknown' }
      }),
      vehicles: vehicles.map(v => ({ plate: v.plate, model: v.vehicle, citizenid: v.citizenid }))
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/server/:serverId/dupe-scanner/scan
router.get('/server/:serverId/dupe-scanner/scan', auth, async (req, res) => {
  try {
    const dbConfig = getDbConfig(req.user, req);
    const conn = await fivem.createFiveMConnection(dbConfig);
    
    // We scan player inventories first (most common for QBCore)
    const [players] = await conn.execute('SELECT citizenid, charinfo, inventory FROM players');
    
    const serialMap = {};
    
    players.forEach(p => {
      let inv = [];
      try {
        inv = typeof p.inventory === 'string' ? JSON.parse(p.inventory) : (p.inventory || []);
      } catch(e) {
        // Fallback to charinfo if inventory is there
        try {
          const char = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo;
          inv = char.inventory || [];
        } catch(e2) {}
      }

      if (Array.isArray(inv)) {
        inv.forEach(item => {
          if (item && item.info && item.info.serial) {
            const s = item.info.serial;
            if (!serialMap[s]) serialMap[s] = { serial: s, item: item.label || item.name, count: 0, details: [] };
            serialMap[s].count++;
            
            let ownerName = "Unknown";
            try {
              const c = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo;
              ownerName = `${c.firstname} ${c.lastname}`;
            } catch(e) {}
            
            serialMap[s].details.push({
              ownerId: p.citizenid,
              owner: ownerName,
              type: 'Player',
              location: 'Inventory',
              job: 'Unknown'
            });
          }
        });
      }
    });

    // Convert map to list and filter for duplicates (count > 1)
    const results = Object.values(serialMap).filter(s => s.count > 1);
    
    await conn.end();
    res.json({ results, itemCount: results.length, groupCount: results.length });
  } catch (e) {
    console.error('[DUPE SCAN ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/server/:serverId/dupe-scanner/delete
router.post('/server/:serverId/dupe-scanner/delete', auth, async (req, res) => {
  try {
    const { serial, ownerId, type } = req.body;
    if (!serial || !ownerId) return res.status(400).json({ error: 'Missing data' });
    
    const dbConfig = getDbConfig(req.user, req);
    const conn = await fivem.createFiveMConnection(dbConfig);
    
    if (type === 'Player') {
      const [rows] = await conn.execute('SELECT inventory FROM players WHERE citizenid = ?', [ownerId]);
      if (rows[0]) {
        let inv = typeof rows[0].inventory === 'string' ? JSON.parse(rows[0].inventory) : (rows[0].inventory || []);
        const newInv = inv.filter(item => !(item.info && item.info.serial === serial));
        await conn.execute('UPDATE players SET inventory = ? WHERE citizenid = ?', [JSON.stringify(newInv), ownerId]);
      }
    }
    
    await conn.end();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/logs
router.get('/logs', auth, async (req, res) => {
  try {
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE 1=1 ORDER BY created_at DESC LIMIT 100`).all()
    res.json(logs.map(l => ({
      admin: l.admin_username,
      action: l.action,
      target: l.target,
      details: l.details,
      date: new Date(l.created_at).toLocaleDateString('ar-SA'),
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/players/:citizenid/message  (requires FiveM bridge)
router.post('/players/:citizenid/message', auth, async (req, res) => {
  const { message } = req.body
  // Log action
  db.prepare(`INSERT INTO audit_logs (admin_discord_id, admin_username, action, target, details) VALUES (?,?,?,?,?)`).run(
    req.user.id, req.user.username, 'رسالة مباشرة', req.params.citizenid, message
  )
  // TODO: Forward to FiveM bridge
  res.json({ success: true, note: 'Message logged. Install fivem-resource for in-game delivery.' })
})

// POST /api/issue-command
router.post('/issue-command', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  const { type, target, payload } = req.body
  
  db.prepare(`INSERT INTO pending_commands (server_id, command_type, target, payload) VALUES (?,?,?,?)`).run(
    req.server.id, type, target, JSON.stringify(payload || {})
  )

  db.prepare(`INSERT INTO audit_logs (server_id, admin_discord_id, admin_username, action, target, details) VALUES (?,?,?,?,?,?)`).run(
    req.server.id, req.user.id, req.user.username, `أمر إداري: ${type}`, target, JSON.stringify(payload)
  )

  res.json({ success: true })
})

// POST /api/screenshots/all  (requires FiveM bridge)
router.post('/screenshots/all', auth, async (req, res) => {
  res.json([])
})

// GET /api/download-script  (Download FiveM Resource)
router.get('/download-script', auth, (req, res) => {
  if (process.env.SCRIPT_DOWNLOAD_URL) {
    return res.redirect(process.env.SCRIPT_DOWNLOAD_URL)
  }

  const scriptPath = path.join(__dirname, '../../fivem-resource')
  if (!fs.existsSync(scriptPath)) return res.status(404).send('Script folder not found')
  
  res.attachment('Echo-panel.zip')
  const archive = archiver('zip', { zlib: { level: 9 } })
  
  archive.on('error', (err) => res.status(500).send({ error: err.message }))
  archive.pipe(res)
  
  // We want to pack the folder itself so it extracts to `Echo-panel/`
  archive.directory(scriptPath, 'Echo-panel')
  archive.finalize()
})


// GET /api/players/:citizenid — single player full profile
router.get('/players/:citizenid', auth, async (req, res) => {
  try {
    const conn = await fivem.createFiveMConnection(getDbConfig(req.user, req))
    const [rows] = await conn.execute(`SELECT * FROM players WHERE citizenid = ? LIMIT 1`, [req.params.citizenid])
    if (!rows.length) {
      await conn.end()
      return res.status(404).json({ error: 'Player not found' })
    }
    const player = rows[0]
    // Get vehicles
    const [veh] = await conn.execute(`SELECT plate, vehicle, garage, state FROM player_vehicles WHERE citizenid = ?`, [req.params.citizenid])
    // Get related characters
    const [related] = await conn.execute(`SELECT citizenid, charinfo FROM players WHERE license = ? AND citizenid != ?`, [player.license, player.citizenid])
    await conn.end()
    res.json({ ...player, vehicles: veh, relatedCharacters: related })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/teleport-locations
router.get('/teleport-locations', auth, (req, res) => {
  const locs = db.prepare(`SELECT * FROM teleport_locations ORDER BY created_at DESC`).all()
  res.json(locs)
})

// POST /api/teleport-locations
router.post('/teleport-locations', auth, (req, res) => {
  const { name, x, y, z } = req.body
  if (!name || x == null || y == null || z == null) return res.status(400).json({ error: 'Missing fields' })
  db.prepare(`INSERT INTO teleport_locations (name, x, y, z, created_by) VALUES (?,?,?,?,?)`).run(name, x, y, z, req.user.username)
  res.json({ success: true })
})

// DELETE /api/teleport-locations/:id
router.delete('/teleport-locations/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM teleport_locations WHERE id = ?`).run(req.params.id)
  res.json({ success: true })
})

// /server-data — defined above, this duplicate removed

// GET /api/webhooks
router.get('/webhooks', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  try {
    const row = db.prepare(`SELECT webhooks FROM server_webhooks WHERE server_id = ?`).get(req.server.id)
    res.json(row ? JSON.parse(row.webhooks) : {})
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/webhooks
router.post('/webhooks', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  try {
    const webhooks = JSON.stringify(req.body || {})
    db.prepare(`
      INSERT INTO server_webhooks (server_id, webhooks) VALUES (?, ?)
      ON CONFLICT(server_id) DO UPDATE SET webhooks=excluded.webhooks
    `).run(req.server.id, webhooks)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── ADMINS & RANKS ───
router.get('/ranks', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  try {
    const ranks = db.prepare(`SELECT * FROM server_ranks WHERE server_id = ?`).all(req.server.id)
    res.json(ranks.map(r => ({ ...r, permissions: JSON.parse(r.permissions) })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/ranks', auth, (req, res) => {
  // Only owner can create ranks
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  if (!req.user.isOwner && req.server.discord_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can manage ranks' })
  try {
    const { name, permissions } = req.body
    if (!name || !permissions) return res.status(400).json({ error: 'Missing data' })
    const info = db.prepare(`INSERT INTO server_ranks (server_id, name, permissions) VALUES (?, ?, ?)`).run(req.server.id, name, JSON.stringify(permissions))
    res.json({ id: info.lastInsertRowid })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/ranks/:id', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  if (!req.user.isOwner && req.server.discord_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can manage ranks' })
  try {
    db.prepare(`DELETE FROM server_ranks WHERE id = ? AND server_id = ?`).run(req.params.id, req.server.id)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/admins', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  try {
    const admins = db.prepare(`SELECT a.*, r.name as rank_name FROM server_admins a JOIN server_ranks r ON a.rank_id = r.id WHERE a.server_id = ?`).all(req.server.id)
    res.json(admins)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/admins', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  if (!req.user.isOwner && req.server.discord_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can manage admins' })
  try {
    const { discord_id, rank_id } = req.body
    if (!discord_id || !rank_id) return res.status(400).json({ error: 'Missing data' })
    const info = db.prepare(`INSERT INTO server_admins (server_id, discord_id, rank_id, added_by) VALUES (?, ?, ?, ?)`).run(req.server.id, discord_id, rank_id, req.user.username)
    res.json({ id: info.lastInsertRowid })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/admins/:id', auth, (req, res) => {
  if (!req.server) return res.status(400).json({ error: 'No server selected' })
  if (!req.user.isOwner && req.server.discord_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can manage admins' })
  try {
    db.prepare(`DELETE FROM server_admins WHERE id = ? AND server_id = ?`).run(req.params.id, req.server.id)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/licenses/:key — Hard delete a license (owner only)
router.delete('/licenses/:key', auth, (req, res) => {
  if (!req.user.isOwner) return res.status(403).json({ error: 'Owner only' })
  try {
    const key = req.params.key
    db.prepare(`DELETE FROM licenses WHERE \`key\` = ?`).run(key)
    db.prepare(`DELETE FROM servers WHERE license_key = ?`).run(key)
    db.prepare(`DELETE FROM server_admins WHERE server_id IN (SELECT id FROM servers WHERE license_key = ?)`).run(key)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
