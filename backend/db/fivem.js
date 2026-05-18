const mysql = require('mysql2/promise')

const pools = {}

/**
 * Create a MySQL connection to the FiveM server database
 * Uses a connection pool cache for SaaS scalability.
 * @param {Object} config - { host, port, user, password, database }
 */
async function createFiveMConnection(config) {
  const host = config?.host || process.env.FIVEM_DB_HOST || 'localhost'
  const port = config?.port || process.env.FIVEM_DB_PORT || 3306
  const user = config?.user || process.env.FIVEM_DB_USER || 'root'
  const password = config?.password || process.env.FIVEM_DB_PASSWORD || ''
  const database = config?.database || process.env.FIVEM_DB_NAME || 'fivem'

  const poolKey = `${host}:${port}:${database}:${user}`

  if (!pools[poolKey]) {
    pools[poolKey] = mysql.createPool({
      host, port, user, password, database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  }

  const conn = await pools[poolKey].getConnection()
  // Monkeypatch end to release so existing finally { conn.end() } logic releases back to pool
  conn.end = async () => conn.release()
  return conn
}

// QBCore queries
const QUERIES = {
  // Get all players (characters)
  getPlayers: `
    SELECT 
      p.citizenid, p.charinfo, p.money, p.job, p.gang,
      p.metadata, p.position, p.license, p.inventory,
      CASE WHEN o.identifier IS NOT NULL THEN 1 ELSE 0 END as online
    FROM players p
    LEFT JOIN (
      SELECT identifier FROM player_whitelist LIMIT 0
    ) o ON o.identifier = p.license
    ORDER BY p.citizenid
    LIMIT 1000
  `,

  // Online players (by license)
  getOnlineByLicense: `
    SELECT citizenid, charinfo, money, job, gang, metadata, license, inventory
    FROM players 
    WHERE citizenid IS NOT NULL
    LIMIT 100
  `,

  // Vehicles
  getVehicles: `
    SELECT 
      plate, vehicle, hash, mods, fuel, engine, body,
      citizenid, garage, garagestate, depotprice, drivingdistance, state
    FROM player_vehicles
    ORDER BY citizenid
    LIMIT 500
  `,

  // Gangs
  getGangs: `
    SELECT 
      g.name, g.label,
      COUNT(gm.citizenid) as member_count,
      g.grades
    FROM gangs g
    LEFT JOIN gang_members gm ON gm.gang = g.name
    GROUP BY g.name
    ORDER BY member_count DESC
  `,

  // Stash list
  getStashes: `SELECT stash as statename, 'QBCore Stash' as label FROM stashitems LIMIT 200`,
  getStashContents: `SELECT items FROM stashitems WHERE stash = ?`,

  // Bans
  getBans: `
    SELECT * FROM bans 
    ORDER BY id DESC 
    LIMIT 200
  `,
}

async function getPlayers(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getOnlineByLicense)
    return rows.map(r => {
      const charinfo = tryParse(r.charinfo)
      const money = tryParse(r.money)
      const job = tryParse(r.job)
      const gang = tryParse(r.gang)
      const inventory = tryParse(r.inventory) || []
      const items = Object.values(inventory).filter(Boolean).map(i => ({ name: i.name, count: i.amount, type: i.type || 'item' }))
      return {
        citizenid: r.citizenid,
        name: charinfo ? `${charinfo.firstname} ${charinfo.lastname}` : 'Unknown',
        job: job?.label || job?.name || '—',
        gang: gang?.label || gang?.name || 'No Gang',
        cash: money?.cash || 0,
        bank: money?.bank || 0,
        license: r.license,
        status: r.online ? 'online' : 'offline',
        inventory: items,
      }
    })
  } finally { if (conn) await conn.end() }
}

async function getVehicles(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getVehicles)
    return rows.map(r => ({
      plate: r.plate,
      model: r.vehicle,
      citizenid: r.citizenid,
      garage: r.garage,
      fuel: r.fuel || 0,
      engine: Math.round((r.engine || 0) * 100 / 1000),
      out: r.state === 1,
    }))
  } finally { if (conn) await conn.end() }
}

async function getGangs(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getGangs)
    return rows.map(r => ({ name: r.label || r.name, members: r.member_count }))
  } finally { if (conn) await conn.end() }
}

async function getStashes(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getStashes).catch(() => [[ ]])
    return rows.map(r => ({ id: r.statename, label: r.label || r.statename }))
  } catch(e) {
    return []
  } finally { if (conn) await conn.end() }
}

async function getStashContents(dbConfig, stashId) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getStashContents, [stashId]).catch(() => [[ ]])
    if (!rows.length) return { items: [] }
    const itemsData = tryParse(rows[0].items) || []
    const items = (Array.isArray(itemsData) ? itemsData : Object.values(itemsData)).filter(Boolean).map(i => ({
      name: i.name, count: i.amount || i.count, type: i.type || 'item',
      label: i.label || i.name, slot: i.slot, image: i.image || (i.name + '.png'),
      info: i.info || {}
    }))
    return { items }
  } catch(e) {
    return { items: [] }
  } finally { if (conn) await conn.end() }
}

async function getBans(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [rows] = await conn.execute(QUERIES.getBans)
    return rows.map(r => ({ id: r.id, name: r.name, reason: r.reason, license: r.license, discord: r.discord, expires: r.expire, active: !r.expire || new Date(r.expire) > new Date() }))
  } finally { if (conn) await conn.end() }
}

async function getStats(dbConfig) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)
    const [[pCount]] = await conn.execute('SELECT COUNT(*) as c FROM players').catch(() => [[{c:0}]])
    const [[vCount]] = await conn.execute('SELECT COUNT(*) as c FROM player_vehicles').catch(() => [[{c:0}]])
    const [[gCount]] = await conn.execute('SELECT COUNT(*) as c FROM gangs').catch(() => [[{c:0}]])
    const [[sCount]] = await conn.execute('SELECT COUNT(*) as c FROM datastore_data').catch(() => [[{c:0}]])
    const [[bCount]] = await conn.execute('SELECT COUNT(*) as c FROM bans').catch(() => [[{c:0}]])
    return { characters: pCount.c, vehicles: vCount.c, gangs: gCount.c, stashes: sCount.c, bans: bCount.c, online: true }
  } finally { if (conn) await conn.end() }
}

function tryParse(val) {
  if (!val) return null
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return null }
}

async function addStashItem(dbConfig, stashId, item) {
  let conn
  try {
    conn = await createFiveMConnection(dbConfig)

    // Check if the stash already exists
    const [rows] = await conn.execute(QUERIES.getStashContents, [stashId])

    if (rows.length > 0) {
      // Stash exists — read current items, add/merge, then update
      const itemsData = tryParse(rows[0].items) || {}
      // Determine if items are stored as array or slot-keyed object
      const isObject = !Array.isArray(itemsData) && typeof itemsData === 'object'

      if (isObject) {
        // QBCore slot-keyed format: {"1": {slot:1, name:..., ...}, "2": {slot:2, ...}}
        const items = itemsData

        // Check if item already exists by name — if so, increase amount
        let found = false
        for (const key of Object.keys(items)) {
          if (items[key] && items[key].name === item.name) {
            items[key].amount = (items[key].amount || 0) + (item.count || 1)
            found = true
            break
          }
        }

        if (!found) {
          // Find the next available slot
          const maxSlot = Object.keys(items).reduce((max, k) => {
            const s = items[k]?.slot || parseInt(k) || 0
            return s > max ? s : max
          }, 0)
          const nextSlot = maxSlot + 1
          items[String(nextSlot)] = {
            slot: nextSlot,
            name: item.name,
            amount: item.count || 1,
            type: item.type || 'item',
            label: item.label || item.name,
            info: item.info || {},
            image: item.image || (item.name + '.png')
          }
        }

        await conn.execute('UPDATE stashitems SET items = ? WHERE stash = ?', [JSON.stringify(items), stashId])
      } else {
        // Array format — less common but some setups use it
        const items = Array.isArray(itemsData) ? itemsData : Object.values(itemsData).filter(Boolean)

        // Check if item already exists by name
        const existing = items.find(i => i.name === item.name)
        if (existing) {
          existing.amount = (existing.amount || 0) + (item.count || 1)
        } else {
          const maxSlot = items.reduce((max, i) => Math.max(max, i.slot || 0), 0)
          items.push({
            name: item.name,
            amount: item.count || 1,
            type: item.type || 'item',
            label: item.label || item.name,
            slot: maxSlot + 1,
            info: item.info || {},
            image: item.image || (item.name + '.png')
          })
        }

        await conn.execute('UPDATE stashitems SET items = ? WHERE stash = ?', [JSON.stringify(items), stashId])
      }
    } else {
      // No row for this stash — insert a new one with QBCore slot-keyed format
      const items = {
        "1": {
          slot: 1,
          name: item.name,
          amount: item.count || 1,
          type: item.type || 'item',
          label: item.label || item.name,
          info: item.info || {},
          image: item.image || (item.name + '.png')
        }
      }
      await conn.execute('INSERT INTO stashitems (stash, items) VALUES (?, ?)', [stashId, JSON.stringify(items)])
    }

    return { success: true }
  } finally {
    if (conn) await conn.end()
  }
}

module.exports = { getPlayers, getVehicles, getGangs, getBans, getStats, createFiveMConnection, getStashes, getStashContents, addStashItem }
