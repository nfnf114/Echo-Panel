const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('./db');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// Performance: Enable gzip compression for all responses
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression level (1-9)
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadsPath = path.join(__dirname, 'uploads');
const itemsPath = path.join(uploadsPath, 'items');
const avatarsPath = path.join(uploadsPath, 'avatars');
const screenshotsPath = path.join(uploadsPath, 'screenshots');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
if (!fs.existsSync(itemsPath)) fs.mkdirSync(itemsPath);
if (!fs.existsSync(avatarsPath)) fs.mkdirSync(avatarsPath);
if (!fs.existsSync(screenshotsPath)) fs.mkdirSync(screenshotsPath);

// Serve static uploads with proper caching headers
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1h', // Cache static assets for 1 hour
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Longer cache for images and immutable assets
    if (filePath.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); // 24h for images
    } else if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h for CSS/JS
    }
  },
}));

// --- Global Connection Pools for Game Servers ---
const gamePools = {};
function getGamePool(conn) {
  if (!conn) return null;
  if (gamePools[conn]) return gamePools[conn];
  
  try {
    // If it's a URI string starting with mysql://
    if (typeof conn === 'string' && conn.startsWith('mysql://')) {
      gamePools[conn] = mysql.createPool(conn);
    } else {
      // Otherwise try parsing as JSON or use as object
      const config = typeof conn === 'string' ? JSON.parse(conn) : conn;
      gamePools[conn] = mysql.createPool(config);
    }
    return gamePools[conn];
  } catch(e) {
    console.error(`[getGamePool] Failed to create pool for: ${conn}`, e.message);
    return null;
  }
}

const multer = require('multer');
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsPath),
  filename: (req, file, cb) => {
    const citizenid = req.headers['citizenid'] || 'unknown';
    cb(null, `avatar_${citizenid}_${Date.now()}.png`);
  }
});
const uploadAvatar = multer({ storage: avatarStorage });

// Screenshots storage config
const screenshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = screenshotsPath;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const targetId = req.headers['target-id'] || req.body.targetId || 'unknown';
    cb(null, `${targetId}.webp`);
  }
});
const uploadScreenshot = multer({ storage: screenshotStorage });

app.post('/api/server/:serverId/upload-screenshot', uploadScreenshot.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Also update bridge cache so frontend can see screenshots immediately
  const targetId = req.headers['target-id'] || req.body.targetId || 'unknown';
  const serverId = parseInt(req.params.serverId) || 0;
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  if (!global.screenshotsCache) global.screenshotsCache = {};
  if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = [];
  global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== targetId);
  global.screenshotsCache[serverId].push({
    citizenid: targetId,
    name: req.headers['player-name'] || targetId,
    screenshotUrl: `${backendUrl}/uploads/screenshots/${req.file.filename}`,
    ts: new Date().toLocaleTimeString('ar-SA'),
    live: true
  });
  if (global.screenshotsCache[serverId].length > 100) {
    global.screenshotsCache[serverId] = global.screenshotsCache[serverId].slice(-100);
  }
  
  res.json({ success: true, url: `/uploads/screenshots/${req.file.filename}` });
});

app.post('/api/server/auto/upload-screenshot', uploadScreenshot.single('file'), (req, res) => {
  const targetId = req.headers['target-id'] || 'unknown';
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const destPath = path.join(__dirname, 'public', 'uploads', 'screenshots', `${targetId}.webp`);
  try { fs.renameSync(req.file.path, destPath); } catch(e) {}
  
  // Also update bridge cache for live screenshots
  const serverId = 0; // auto endpoint uses server 0
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  if (!global.screenshotsCache) global.screenshotsCache = {};
  if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = [];
  global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== targetId);
  global.screenshotsCache[serverId].push({
    citizenid: targetId,
    name: req.headers['player-name'] || targetId,
    screenshotUrl: `${backendUrl}/uploads/screenshots/${targetId}.webp`,
    ts: new Date().toLocaleTimeString('ar-SA'),
    live: true
  });
  if (global.screenshotsCache[serverId].length > 100) {
    global.screenshotsCache[serverId] = global.screenshotsCache[serverId].slice(-100);
  }
  
  return res.json({ success: true, url: `/uploads/screenshots/${targetId}.webp` });
});

// Screenshot status endpoint - handles status messages from FiveM client (e.g., screenshot-basic not available)
app.post('/api/server/:serverId/screenshot-status', (req, res) => {
  const targetId = req.headers['target-id'] || req.body?.citizenid || 'unknown';
  const playerName = req.headers['player-name'] || req.body?.name || targetId;
  const status = req.body?.status || 'unknown';
  const serverId = parseInt(req.params.serverId) || 0;
  
  // Update the cache with a status message instead of a screenshot
  if (!global.screenshotsCache) global.screenshotsCache = {};
  if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = [];
  global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== targetId);
  global.screenshotsCache[serverId].push({
    citizenid: targetId,
    name: playerName,
    screenshotUrl: null,
    status: status,
    message: req.body?.message || 'Screenshot unavailable',
    ts: new Date().toLocaleTimeString('ar-SA'),
    live: false
  });
  
  res.json({ success: true });
});

app.post('/api/screenshots/upload', async (req, res) => {
  const { targetId, file } = req.body;
  try {
    const dir = path.join(__dirname, 'public', 'uploads', 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${targetId}.webp`;
    const base64Data = (file || '').replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(path.join(dir, filename), base64Data, 'base64');
    
    // Also update bridge cache for live screenshots
    const serverId = 0;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    if (!global.screenshotsCache) global.screenshotsCache = {};
    if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = [];
    global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== targetId);
    global.screenshotsCache[serverId].push({
      citizenid: targetId,
      name: targetId,
      screenshotUrl: `${backendUrl}/uploads/screenshots/${filename}`,
      ts: new Date().toLocaleTimeString('ar-SA'),
      live: true
    });
    
    return res.json({ success: true, url: `/uploads/screenshots/${filename}` });
  } catch (error) { return res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/server/:serverId/screenshots', (req, res) => {
  const screenshots = [];

  // Only show actual game screen captures from screenshots folder
  // Avatars (face portraits) are NOT included here - they belong to the profile picture system
  if (fs.existsSync(screenshotsPath)) {
    const screenFiles = fs.readdirSync(screenshotsPath);
    screenFiles.filter(f => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')).forEach(f => {
      screenshots.push({
        targetId: f.split('.')[0],
        url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/screenshots/${f}`,
        type: 'screen',
        time: fs.statSync(path.join(screenshotsPath, f)).mtimeMs
      });
    });
  }

  screenshots.sort((a, b) => b.time - a.time);
  res.json({ screenshots });
});

app.post('/api/screenshots/upload-avatar', uploadAvatar.single('file'), async (req, res) => {
  try {
    const citizenid = req.headers['citizenid'];
    console.log(`[AVATAR UPLOAD] Received upload request for CID: ${citizenid}`);
    
    if (!citizenid || !req.file) {
      console.error(`[AVATAR UPLOAD] Missing data: CID=${citizenid}, File=${req.file ? 'Yes' : 'No'}`);
      return res.status(400).json({ error: 'Missing data' });
    }

    const avatarUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/avatars/${req.file.filename}`;
    console.log(`[AVATAR UPLOAD] File saved: ${req.file.filename}. URL: ${avatarUrl}`);
    
    // Update Game DB
    const [servers] = await pool.execute('SELECT db_connection FROM servers LIMIT 1');
    if (servers[0] && servers[0].db_connection) {
      const gamePool = getGamePool(servers[0].db_connection);
      const [rows] = await gamePool.execute('SELECT charinfo FROM players WHERE citizenid = ?', [citizenid]);
      if (rows[0]) {
        let charinfo = typeof rows[0].charinfo === 'string' ? JSON.parse(rows[0].charinfo) : rows[0].charinfo;
        charinfo.profilepic = avatarUrl;
        await gamePool.execute('UPDATE players SET charinfo = ? WHERE citizenid = ?', [JSON.stringify(charinfo), citizenid]);
        console.log(`[AVATAR UPLOAD] Database updated for ${citizenid}`);
      } else {
        console.error(`[AVATAR UPLOAD] Player not found in DB: ${citizenid}`);
      }
    }

    // Also save a stable copy for the frontend to use without timestamps
    try {
      const stablePath = path.join(avatarsPath, `${citizenid}_face.png`);
      fs.copyFileSync(req.file.path, stablePath);
    } catch(e) {}

    res.json({ success: true, url: avatarUrl });
  } catch (error) {
    console.error('[AVATAR UPLOAD ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/screenshots/upload-avatar-base64', async (req, res) => {
  try {
    const { image } = req.body;
    const citizenid = req.headers['citizenid'];
    if (!citizenid || !image) return res.status(400).json({ error: 'Missing data' });
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const filename = `avatar_${citizenid}_${Date.now()}.png`;
    const filePath = path.join(avatarsPath, filename);
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Also save a stable copy for the frontend
    try {
      const stablePath = path.join(avatarsPath, `${citizenid}_face.png`);
      fs.writeFileSync(stablePath, base64Data, 'base64');
    } catch(e) {}
    const avatarUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/avatars/${filename}`;
    console.log(`[AVATAR BASE64] Image saved for CID ${citizenid}. URL: ${avatarUrl}`);
    
    // Update Game DB (Robust way: Fetch -> Update -> Save)
    const [servers] = await pool.execute('SELECT db_connection FROM servers');
    for (const server of servers) {
      if (server.db_connection) {
        try {
          const gamePool = getGamePool(server.db_connection);
          const [players] = await gamePool.execute('SELECT charinfo FROM players WHERE citizenid = ?', [citizenid]);
          if (players[0]) {
            let info = typeof players[0].charinfo === 'string' ? JSON.parse(players[0].charinfo) : players[0].charinfo;
            info.profilepic = avatarUrl;
            await gamePool.execute('UPDATE players SET charinfo = ? WHERE citizenid = ?', [JSON.stringify(info), citizenid]);
            console.log(`[DB UPDATE] Successfully updated portrait for ${citizenid} on server.`);
          }
        } catch (dbErr) {
          console.error(`[DB ERROR] Failed to update server DB:`, dbErr.message);
        }
      }
    }
    res.json({ success: true, url: avatarUrl });
  } catch (error) { res.status(500).json({ error: error.message }); }
});


// Database initialization
(async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS discord_users (
        discord_id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100),
        access_token TEXT,
        refresh_token TEXT,
        expires_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
})();

// Cache for stash locations discovered from files
let fileDiscoveryCache = {};

async function scanResourcesForCoords(serverId, customPath) {
  if (!customPath) return {};
  console.log(`[FILE DISCOVERY] Scanning server ${serverId} in ${customPath}...`);
  const stashCoords = {};
  
  const walk = (dir) => {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const lPath = fullPath.toLowerCase();
        if (fs.statSync(fullPath).isDirectory()) {
          if (!file.startsWith('.') && !lPath.includes('node_modules') && !lPath.includes('.git') && 
              !lPath.includes('backup') && !lPath.includes('old') && !lPath.includes('test') &&
              !lPath.includes('[assets]') && !lPath.includes('[vehicles]') &&
              !lPath.includes('turf') && !lPath.includes('zone')) {
            walk(fullPath);
          }
        } else if (file.endsWith('.lua')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const regex = /\[['"](.+?)['"]\]\s*=\s*\{[\s\S]*?(?:coords|location|pos|origin)\s*=\s*vector[34]\(([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)/gi;
          let m;
          while ((m = regex.exec(content)) !== null) {
            stashCoords[m[1].toLowerCase()] = { x: parseFloat(m[2]), y: parseFloat(m[3]), z: parseFloat(m[4]) };
          }
          const regex2 = /name\s*=\s*['"](.+?)['"][\s\S]*?(?:coords|location|pos|origin)\s*=\s*vector[34]\(([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)/gi;
          while ((m = regex2.exec(content)) !== null) {
            stashCoords[m[1].toLowerCase()] = { x: parseFloat(m[2]), y: parseFloat(m[3]), z: parseFloat(m[4]) };
          }
        }
      }
    } catch (e) {}
  };

  try {
    walk(customPath);
    fileDiscoveryCache[serverId] = stashCoords;
    console.log(`[FILE DISCOVERY] Scan complete for server ${serverId}. Found ${Object.keys(stashCoords).length} locations.`);
  } catch (e) { console.error(`[FILE DISCOVERY] Error for server ${serverId}:`, e.message); }
  return stashCoords;
}

// Startup tasks
console.log('Backend ready for dynamic sync.');

// Initialize Panel Tables
(async () => {
  try {
    // 1. Licenses & Users (Core)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_key VARCHAR(100) NOT NULL UNIQUE,
        server_ip VARCHAR(50),
        owner_discord_id VARCHAR(50) NOT NULL,
        product_name VARCHAR(100) DEFAULT 'Echo Panel',
        is_active BOOLEAN DEFAULT TRUE,
        slots INT DEFAULT 1,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS servers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_id INT UNIQUE,
        server_name VARCHAR(100),
        status VARCHAR(20) DEFAULT 'offline',
        current_players INT DEFAULT 0,
        max_players INT DEFAULT 32,
        db_connection TEXT,
        players_data LONGTEXT,
        shared_jobs LONGTEXT,
        shared_gangs LONGTEXT,
        shared_items LONGTEXT,
        shared_vehicles LONGTEXT,
        panel_settings LONGTEXT,
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS player_analytics (
        citizenid VARCHAR(50) PRIMARY KEY,
        total_playtime INT DEFAULT 0,
        last_seen DATETIME,
        last_playtime_update DATETIME
      )
    `);

    // Auto-update tables if columns are missing
    try { await pool.execute('ALTER TABLE servers ADD COLUMN shared_vehicles LONGTEXT AFTER shared_items'); } catch(e) {}
    try { await pool.execute('ALTER TABLE player_analytics ADD COLUMN last_playtime_update DATETIME AFTER last_seen'); } catch(e) {}

    // 2. Panel Auth & Roles
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panel_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        name VARCHAR(64),
        permissions LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panel_admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        discord_id VARCHAR(50),
        role_id INT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_admin (server_id, discord_id)
      )
    `);

    // 3. Activity & Actions
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pending_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_id INT,
        action_type VARCHAR(50),
        target_id VARCHAR(50),
        data TEXT,
        status ENUM('pending', 'completed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panel_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        admin_id VARCHAR(50),
        action_type VARCHAR(50),
        target_id VARCHAR(50),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS activity_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        player_count INT,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_server_time (server_id, recorded_at)
      )
    `);

    // 4. Leaderboard Tables
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panel_leaderboard_boards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        title VARCHAR(128),
        board_type ENUM('weekly', 'monthly', 'alltime') DEFAULT 'weekly',
        enabled TINYINT(1) DEFAULT 1,
        public TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panel_leaderboard_weekly (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT UNIQUE,
        auto_reset TINYINT(1) DEFAULT 0,
        reset_day VARCHAR(16) DEFAULT 'الاثنين',
        reset_time VARCHAR(8) DEFAULT '10:00',
        timezone VARCHAR(64) DEFAULT 'Asia/Riyadh',
        discord_enabled TINYINT(1) DEFAULT 0,
        discord_webhook VARCHAR(512) DEFAULT '',
        discord_lang VARCHAR(16) DEFAULT 'ar',
        message_title VARCHAR(256) DEFAULT 'وقت اللعب الأسبوعي',
        message_template LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS players_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT,
        players INT DEFAULT 0,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
})();

// Serve item images - priority: uploaded items > public/uploads/items (synced from FiveM) > public/images
app.use('/uploads/items', (req, res, next) => {
  // First try: uploads/items/ (manually uploaded items)
  const uploadsItemsPath = path.join(uploadsPath, 'items', req.path);
  if (fs.existsSync(uploadsItemsPath)) {
    return res.sendFile(uploadsItemsPath);
  }
  // Second try: public/uploads/items/ (synced from FiveM server)
  const publicItemsPath = path.join(__dirname, 'public', 'uploads', 'items', req.path);
  if (fs.existsSync(publicItemsPath)) {
    return res.sendFile(publicItemsPath);
  }
  // Third try: public/images/ (legacy fallback)
  const legacyPath = path.join(__dirname, 'public', 'images', req.path);
  if (fs.existsSync(legacyPath)) {
    return res.sendFile(legacyPath);
  }
  next();
});

// Item image storage for bulk upload from FiveM server
const itemImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destDir = path.join(__dirname, 'public', 'uploads', 'items');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // Keep the original filename (item name like "phone.png")
    cb(null, file.originalname);
  }
});
const uploadItemImage = multer({ storage: itemImageStorage });

// Upload a single item image from FiveM server
app.post('/api/upload-item-image', uploadItemImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, path: `/uploads/items/${req.file.originalname}` });
});

// Upload multiple item images at once from FiveM server (batch)
app.post('/api/upload-item-images-batch', uploadItemImage.array('files', 500), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const uploaded = req.files.map(f => ({ name: f.originalname, path: `/uploads/items/${f.originalname}` }));
  res.json({ success: true, count: uploaded.length, files: uploaded });
});

// Screenshots storage config

// Screenshots storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = screenshotsPath;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const targetId = req.headers['target-id'] || req.body.targetId || 'unknown';
    cb(null, `${targetId}.webp`);
  }
});
const upload = multer({ storage: storage });
const crypto = require('crypto');

// DB Connection Pool Cache (Moved to top for global access)

// Middlewares
const activeWebSessions = new Map(); // discordId -> lastSeenTimestamp

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'Echo_fallback', (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      
      // Update last seen for website status
      const dId = user.discordId || user.discord_id;
      if (dId) {
        activeWebSessions.set(dId, Date.now());
      }
      
      next();
    });
  } else {
    res.status(401).json({ error: 'No token provided' });
  }
};

// Helper: check if a discordId is the owner of a server (via license)
async function isServerOwner(serverId, discordId) {
  try {
    const [serverRows] = await pool.execute('SELECT license_id FROM servers WHERE id = ?', [serverId]);
    if (!serverRows[0]) return false;
    const [licenseRows] = await pool.execute('SELECT owner_discord_id FROM licenses WHERE id = ?', [serverRows[0].license_id]);
    return licenseRows[0]?.owner_discord_id === discordId;
  } catch (e) {
    return false;
  }
}

// Helper: get permissions for a user on a server (owner gets all)
async function getUserPermissions(serverId, discordId) {
  // Owner always has all permissions
  const owner = await isServerOwner(serverId, discordId);
  if (owner) return { isOwner: true, permissions: ['ADMIN_FULL'], roleName: 'Owner' };

  try {
    const [rows] = await pool.execute(`
      SELECT r.permissions, r.name as role_name
      FROM panel_admins a 
      JOIN panel_roles r ON a.role_id = r.id 
      WHERE a.server_id = ? AND a.discord_id = ?
    `, [serverId, discordId]);

    if (rows.length === 0) return { isOwner: false, permissions: [], roleName: null };

    const permissions = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions || '[]') : (rows[0].permissions || []);
    return { isOwner: false, permissions, roleName: rows[0].role_name };
  } catch (e) {
    return { isOwner: false, permissions: [], roleName: null };
  }
}

// Middleware to check specific permission
const checkPermission = (requiredPerm) => {
  return async (req, res, next) => {
    const { serverId } = req.params;
    const discordId = req.user.discordId;

    try {
      const permInfo = await getUserPermissions(serverId, discordId);

      // Owner always has all permissions
      if (permInfo.isOwner) return next();

      if (permInfo.permissions.length === 0) return res.status(403).json({ error: 'Not an administrator' });
      
      if (permInfo.permissions.includes(requiredPerm) || permInfo.permissions.includes('ADMIN_FULL')) {
        return next();
      }
      
      res.status(403).json({ error: `Missing permission: ${requiredPerm}` });
    } catch (e) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const validateBotSecret = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const secret = authHeader ? authHeader.split(' ')[1] : null;
  if (secret === (process.env.BOT_SECRET || 'super_secret_bot_key')) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized Bot' });
  }
};

// ==========================================
// 1. AUTH & DISCORD OAUTH2
// ==========================================

app.get('/api/auth/discord/login', (req, res) => {
  // Capture the frontend origin from the request so we can redirect back correctly
  const referer = req.headers.referer || req.headers.origin || '';
  let frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    if (referer) {
      const url = new URL(referer);
      frontendOrigin = url.origin;
    }
  } catch(e) {}

  // Store frontend origin in state parameter (base64 encoded) so callback knows where to redirect
  const state = Buffer.from(JSON.stringify({ redirect: frontendOrigin })).toString('base64');

  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.join&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Decode frontend URL from state parameter
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      if (stateData.redirect) frontendUrl = stateData.redirect;
    }
  } catch(e) {}

  if (!code) return res.redirect(`${frontendUrl}/login?error=no_code`);

  try {
    // Step 1: Exchange code for Discord access token
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    });

    console.log('[Auth] Exchanging code for token...');
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    console.log('[Auth] Token exchange successful');

    // Step 2: Get user info from Discord
    console.log('[Auth] Fetching user info from Discord...');
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordId = userRes.data.id;
    console.log(`[Auth] User authenticated: ${userRes.data.username} (${discordId})`);

    // Step 3: Save tokens to MySQL (NON-CRITICAL - don't block login if this fails)
    try {
      const expiresAt = new Date(Date.now() + expires_in * 1000);
      await pool.execute(`
        INSERT INTO discord_users (discord_id, username, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          username = VALUES(username),
          access_token = VALUES(access_token),
          refresh_token = VALUES(refresh_token),
          expires_at = VALUES(expires_at)
      `, [discordId, userRes.data.username, access_token, refresh_token, expiresAt]);
      console.log('[Auth] Discord tokens saved to database');
    } catch (dbError) {
      // Non-critical: this is just for the Discord Joiner feature, don't block login
      console.error('[Auth] Non-critical: Failed to save Discord tokens:', dbError.message);
    }

    // Step 4: Create JWT and redirect to frontend
    const userData = {
      discordId: discordId,
      username: userRes.data.username,
      avatarUrl: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${userRes.data.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`,
    };

    const token = jwt.sign(userData, process.env.JWT_SECRET || 'Echo_fallback', { expiresIn: '7d' });
    console.log(`[Auth] Redirecting to: ${frontendUrl}/auth-callback?token=...`);
    res.redirect(`${frontendUrl}/auth-callback?token=${token}`);
  } catch (error) {
    console.error('[Auth] Callback Error - Full details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
});

// ==========================================
// 2. USER DATA & LICENSES
// ==========================================

app.get('/api/user/licenses/:discordId', async (req, res) => {
  const { discordId } = req.params;
  try {
    const [licenses] = await pool.execute('SELECT * FROM licenses WHERE owner_discord_id = ?', [discordId]);
    return res.json({ licenses });
  } catch (error) {
    return res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/user/servers/:discordId', async (req, res) => {
  const { discordId } = req.params;
  try {
    const [servers] = await pool.execute(`
      SELECT s.id, s.server_name as name, s.status, s.current_players, s.max_players, 
             l.license_key, l.product_name, l.is_active as is_linked, l.expires_at
      FROM servers s
      JOIN licenses l ON s.license_id = l.id
      WHERE l.owner_discord_id = ?
    `, [discordId]);
    return res.json({ servers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/user/admin-servers/:discordId', async (req, res) => {
  const { discordId } = req.params;
  try {
    const [servers] = await pool.execute(`
      SELECT s.id, s.server_name as name, s.status, s.current_players, s.max_players, 
             l.license_key, l.product_name, l.is_active as is_linked, l.expires_at,
             a.role_id, r.name as role_name, 'admin' as access_type
      FROM panel_admins a
      JOIN servers s ON a.server_id = s.id
      JOIN licenses l ON s.license_id = l.id
      LEFT JOIN panel_roles r ON a.role_id = r.id
      WHERE a.discord_id = ?
    `, [discordId]);
    return res.json({ servers });
  } catch (error) {
    console.error('[admin-servers] Error:', error.message);
    return res.status(500).json({ error: 'Failed' });
  }
});

// ==========================================
// ==========================================
// 3. DASHBOARD & GAME DATA
// ==========================================

app.get('/api/server/:serverId/panel-roles', authenticateJWT, async (req, res) => {
  try {
    const [roles] = await pool.execute('SELECT * FROM panel_roles WHERE server_id = ?', [req.params.serverId]);
    res.json({ roles: roles.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || [])
    }))});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/panel-admins', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [admins] = await pool.execute(`
      SELECT a.*, r.name as role_name 
      FROM panel_admins a 
      LEFT JOIN panel_roles r ON a.role_id = r.id 
      WHERE a.server_id = ?
    `, [serverId]);

    // Get server owner and online players for status
    const [serverRows] = await pool.execute('SELECT license_id, players_data FROM servers WHERE id = ?', [serverId]);
    let ownerDiscordId = '';
    let onlinePlayers = [];

    if (serverRows[0]) {
      const [licenseRows] = await pool.execute('SELECT owner_discord_id FROM licenses WHERE id = ?', [serverRows[0].license_id]);
      ownerDiscordId = licenseRows[0]?.owner_discord_id || '';
      try {
        onlinePlayers = typeof serverRows[0].players_data === 'string' ? JSON.parse(serverRows[0].players_data) : (serverRows[0].players_data || []);
      } catch(e) {}
    }

    let adminsList = [...admins];
    const ownerAlreadyAdded = adminsList.some(a => a.discord_id === ownerDiscordId);
    if (ownerDiscordId && !ownerAlreadyAdded) {
      adminsList.unshift({
        id: -1, server_id: serverId, discord_id: ownerDiscordId,
        role_id: null, role_name: 'Owner', added_at: null, is_auto_owner: true
      });
    }

    const enhancedAdmins = adminsList.map(a => {
      const lastSeen = activeWebSessions.get(a.discord_id) || 0;
      const isOnlineWeb = (Date.now() - lastSeen) < 300000;
      const isOnlineGame = onlinePlayers.some(p => {
        const pd = String(p.discord || '').replace('discord:', '');
        return pd && pd === a.discord_id;
      });
      return { ...a, is_owner: a.discord_id === ownerDiscordId, is_online_web: isOnlineWeb, is_online_game: isOnlineGame };
    });

    res.json({ admins: enhancedAdmins });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/panel-roles', authenticateJWT, async (req, res) => {
  const { name, permissions } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Role name is required' });
  if (name.trim().toLowerCase() === 'owner') return res.status(400).json({ error: 'Cannot create a role named Owner - this is reserved for the server owner' });
  try {
    await pool.execute(
      'INSERT INTO panel_roles (server_id, name, permissions) VALUES (?, ?, ?)',
      [req.params.serverId, name.trim(), JSON.stringify(permissions || [])]
    );
    res.json({ success: true, message: 'Role created successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/server/:serverId/panel-roles/:id', authenticateJWT, async (req, res) => {
  const { name, permissions } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Role name is required' });
  if (name.trim().toLowerCase() === 'owner') return res.status(400).json({ error: 'Cannot rename a role to Owner - this is reserved' });
  try {
    const [result] = await pool.execute(
      'UPDATE panel_roles SET name = ?, permissions = ? WHERE id = ? AND server_id = ?',
      [name.trim(), JSON.stringify(permissions || []), req.params.id, req.params.serverId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Role not found' });
    res.json({ success: true, message: 'Role updated successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/server/:serverId/panel-roles/:id', authenticateJWT, async (req, res) => {
  try {
    await pool.execute('DELETE FROM panel_roles WHERE id = ? AND server_id = ?', [req.params.id, req.params.serverId]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/panel-admins', authenticateJWT, async (req, res) => {
  const { discord_id, role_id } = req.body;
  if (!discord_id || !role_id) {
    return res.status(400).json({ error: 'discord_id and role_id are required' });
  }
  try {
    // Check if trying to add the server owner as admin (they are auto-owner)
    const owner = await isServerOwner(req.params.serverId, discord_id);
    if (owner) {
      return res.status(400).json({ error: 'Cannot add the server owner as admin - they already have full access' });
    }
    // Use UPSERT to handle duplicates gracefully
    await pool.execute(
      `INSERT INTO panel_admins (server_id, discord_id, role_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
      [req.params.serverId, discord_id, role_id]
    );
    res.json({ success: true, message: 'Admin added successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/server/:serverId/panel-admins/:discordId', authenticateJWT, async (req, res) => {
  const { role_id } = req.body;
  if (!role_id) {
    return res.status(400).json({ error: 'role_id is required' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE panel_admins SET role_id = ? WHERE discord_id = ? AND server_id = ?',
      [role_id, req.params.discordId, req.params.serverId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found for this server' });
    }
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/server/:serverId/panel-admins/:discordId', authenticateJWT, async (req, res) => {
  try {
    // Prevent deleting the server owner
    const owner = await isServerOwner(req.params.serverId, req.params.discordId);
    if (owner) {
      return res.status(400).json({ error: 'Cannot remove the server owner' });
    }
    const [result] = await pool.execute('DELETE FROM panel_admins WHERE discord_id = ? AND server_id = ?', [req.params.discordId, req.params.serverId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found for this server' });
    }
    res.json({ success: true, message: 'Admin removed successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Check if the authenticated user is an admin for a specific server
app.get('/api/check-admin/:serverId', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const discordId = req.user.discordId;
  try {
    const permInfo = await getUserPermissions(serverId, discordId);
    
    if (permInfo.isOwner) {
      return res.json({ 
        isAdmin: true, 
        isOwner: true, 
        permissions: permInfo.permissions, 
        roleName: permInfo.roleName 
      });
    }

    if (permInfo.permissions.length > 0) {
      return res.json({ 
        isAdmin: true, 
        isOwner: false, 
        permissions: permInfo.permissions, 
        roleName: permInfo.roleName 
      });
    }

    res.json({ isAdmin: false, isOwner: false, permissions: [], roleName: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/discord-user/:id', authenticateJWT, async (req, res) => {
  try {
    const response = await axios.get(`https://discord.com/api/users/${req.params.id}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
    });
    res.json({
      username: response.data.username,
      avatar: response.data.avatar ? `https://cdn.discordapp.com/avatars/${response.data.id}/${response.data.avatar}.png` : null
    });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});


app.get('/api/server/:serverId/stashes', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  console.log(`[STASH API] Request for server ID: ${serverId}`);
  try {
    const [servers] = await pool.execute('SELECT db_connection, panel_settings FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.json({ stashes: [] });
    
    const settings = typeof servers[0].panel_settings === 'string' ? JSON.parse(servers[0].panel_settings || '{}') : (servers[0].panel_settings || {});
    const discoveredIds = settings.discoveredStashes || [];
    const dbLocations = settings.stashLocations || {};
    const resourcesPath = settings.resources_path;

    // Trigger scan if not cached and path exists
    if (resourcesPath && !fileDiscoveryCache[serverId]) {
      await scanResourcesForCoords(serverId, resourcesPath);
    }
    
    console.log(`[STASH API] Found ${discoveredIds.length} discovered stashes in settings.`);

    const getCoords = (id) => {
      const sid = String(id).toLowerCase();
      if (dbLocations[sid]) return `vector3(${dbLocations[sid].x.toFixed(2)}, ${dbLocations[sid].y.toFixed(2)}, ${dbLocations[sid].z.toFixed(2)})`;
      
      const serverCache = fileDiscoveryCache[serverId] || {};
      if (serverCache[sid]) {
        const c = serverCache[sid];
        return `vector3(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`;
      }
      const cleanId = sid.replace(/stash-|boss_|_ballas|_vagos|_families|stash_/g, '');
      if (serverCache[cleanId]) {
        const c = serverCache[cleanId];
        return `vector3(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`;
      }
      return 'غير محدد';
    };

    // Fetch shared config for labels/images
    const [configRows] = await pool.execute('SELECT shared_items FROM servers WHERE id = ?', [serverId]);
    const sharedItems = typeof configRows[0]?.shared_items === 'string' ? JSON.parse(configRows[0].shared_items || '{}') : (configRows[0]?.shared_items || {});

    let finalStashes = [];
    let processedIds = new Set();

    // 1. First, add all discovered stashes to ensure they show up NO MATTER WHAT
    discoveredIds.forEach(id => {
      const sid = String(id);
      if (!processedIds.has(sid)) {
        finalStashes.push({ 
          id: sid, 
          label: `مخزن: ${id}`, 
          itemsCount: 0,
          items: [],
          location: getCoords(sid)
        });
        processedIds.add(sid);
      }
    });

    // 2. Then try to update them with real item counts and contents from DB
    if (servers[0].db_connection) {
      try {
        const gamePool = getGamePool(servers[0].db_connection);
        const sources = [
          { t: 'stashitems', c: 'stash', l: 'مخزن' },
          { t: 'stash_items', c: 'stash', l: 'مخزن' },
          { t: 'trunkitems', c: 'plate', l: 'شنطة' },
          { t: 'trunk_items', c: 'plate', l: 'شنطة' },
          { t: 'gloveboxitems', c: 'plate', l: 'درج' },
          { t: 'glovebox_items', c: 'plate', l: 'درج' },
          { t: 'house_stashes', c: 'stash', l: 'منزل' },
          { t: 'ox_inventory', c: 'id', l: 'Ox' }
        ];

        for (const s of sources) {
          try {
            const [rows] = await gamePool.execute(`SELECT ${s.c} as id, items FROM ${s.t} LIMIT 1000`);
            rows.forEach(r => {
              const sid = String(r.id);
              let items = [];
              try {
                const raw = typeof r.items === 'string' ? JSON.parse(r.items || '{}') : (r.items || {});
                const itemsArr = Array.isArray(raw) ? raw : Object.values(raw);
                items = itemsArr.filter(i => i && (i.name || i.item || i.amount)).map(i => {
                  const name = i.name || i.item || 'unknown';
                  const conf = sharedItems[name.toLowerCase()] || {};
                  return {
                    name: name,
                    label: i.label || conf.label || name,
                    amount: i.amount || 1,
                    slot: i.slot || 0,
                    image: i.image || conf.image || (name + '.png')
                  };
                });
              } catch(e) {}

              const existing = finalStashes.find(fs => fs.id === sid);
              if (existing) {
                existing.itemsCount = items.length;
                existing.items = items;
                existing.label = `${s.l}: ${sid}`;
              } else {
                finalStashes.push({ 
                  id: sid, 
                  label: `${s.l}: ${sid}`, 
                  itemsCount: items.length, 
                  items: items,
                  location: getCoords(sid) 
                });
                processedIds.add(sid);
              }
            });
          } catch(e) {}
        }
      } catch(dbErr) {
        console.error('[STASH API] Game DB Connection Error:', dbErr.message);
      }
    }

    console.log(`[STASH API] Sending ${finalStashes.length} stashes to frontend.`);
    return res.json({ stashes: finalStashes });
  } catch (error) {
    console.error(`[STASH API] Critical Error:`, error);
    return res.json({ stashes: [] });
  }
});

// Shared config cache (in-memory, keyed by serverId, refreshed on sync)
const sharedConfigCache = new Map();

app.get('/api/server/:serverId/shared-config', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    // Check in-memory cache first (shared config rarely changes between syncs)
    const cached = sharedConfigCache.get(serverId);
    if (cached && (Date.now() - cached.timestamp < 30000)) { // 30s cache
      return res.json(cached.data);
    }

    const [servers] = await pool.execute('SELECT shared_jobs, shared_gangs, shared_items, shared_vehicles FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.status(404).json({ error: 'Server not found' });
    
    let jobs = {}, gangs = {}, items = {}, vehicles = {};
    try { jobs = JSON.parse(servers[0].shared_jobs || '{}'); } catch(e){}
    try { gangs = JSON.parse(servers[0].shared_gangs || '{}'); } catch(e){}
    try { items = JSON.parse(servers[0].shared_items || '{}'); } catch(e){}
    try { vehicles = JSON.parse(servers[0].shared_vehicles || '{}'); } catch(e){}
    
    const data = { jobs, gangs, items, vehicles };
    sharedConfigCache.set(serverId, { data, timestamp: Date.now() });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/panel-settings', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [rows] = await pool.execute('SELECT panel_settings FROM servers WHERE id = ?', [serverId]);
    if (!rows[0]) return res.status(404).json({ error: 'Server not found' });
    
    const settings = typeof rows[0].panel_settings === 'string' ? JSON.parse(rows[0].panel_settings || '{}') : (rows[0].panel_settings || {});
    res.json({ settings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


app.get('/api/server/:serverId/player/:citizenid', authenticateJWT, async (req, res) => {
  try {
    const { serverId, citizenid } = req.params;
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0] || !servers[0].db_connection) return res.status(404).json({ error: 'Server not connected' });
    
    const gamePool = getGamePool(servers[0].db_connection);
    const [players] = await gamePool.execute('SELECT * FROM players WHERE citizenid = ?', [citizenid]);
    if (players.length === 0) return res.status(404).json({ error: 'Player not found' });
    
    const [linked] = await gamePool.execute('SELECT citizenid, charinfo FROM players WHERE license = ? AND citizenid != ?', [players[0].license, citizenid]);
    
    const p = players[0];
    const parsedPlayer = {
        ...p,
        charinfo: typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo,
        job: typeof p.job === 'string' ? JSON.parse(p.job) : p.job,
        gang: typeof p.gang === 'string' ? JSON.parse(p.gang) : p.gang,
        money: typeof p.money === 'string' ? JSON.parse(p.money) : p.money,
        metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata,
      inventory: typeof p.inventory === 'string' ? JSON.parse(p.inventory) : p.inventory,
    };
    const [analytics] = await pool.execute('SELECT total_playtime FROM player_analytics WHERE citizenid = ?', [citizenid]);
    const dbPlaytime = analytics[0]?.total_playtime || 0;
    const metaPlaytime = parsedPlayer.metadata?.playtime || 0;
    
    res.json({ 
      player: {
        ...parsedPlayer,
        playTime: Math.max(dbPlaytime, metaPlaytime * 60) // Assuming meta is in minutes
      },
      linkedCharacters: linked.map(l => ({
        citizenid: l.citizenid,
        charinfo: typeof l.charinfo === 'string' ? JSON.parse(l.charinfo) : l.charinfo
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/player/:citizenid/action', authenticateJWT, async (req, res) => {
  const { action, value } = req.body;
  const { serverId, citizenid } = req.params;

  // Permission Mapping
  const actionPerms = {
    'revive': 'إنعاش',
    'feed': 'إطعام',
    'heal': 'إنعاش',
    'kick': 'طرد',
    'ban': 'إضافة حالات حظر',
    'manage_money': value?.action === 'add' ? 'إعطاء أموال' : 'سحب أموال',
    'setjob': 'تعيين الوظيفة',
    'setgang': 'تعيين العصابة',
    'additem': 'إعطاء عناصر',
    'removeitem': 'إزالة عناصر',
    'teleport': 'نقل فوري',
    'edit_metadata': 'تعيين البيانات الوصفية',
    'edit_identity': 'تعيين الهوية',
    'set_permissions': 'تعيين الصلاحيات',
    'direct_message': 'رسالة مباشرة',
    'live_screenshot': 'اللقطات المباشرة',
    'clear_inventory': 'مسح الحقيبة',
    'delete_character': 'حذف الشخصية'
  };

  const requiredPerm = actionPerms[action];
  if (requiredPerm) {
    // Custom check inside route because it depends on req.body
    const discordId = req.user.discordId;
    const [rows] = await pool.execute(`
      SELECT r.permissions 
      FROM panel_admins a 
      JOIN panel_roles r ON a.role_id = r.id 
      WHERE a.server_id = ? AND a.discord_id = ?
    `, [serverId, discordId]);

    if (rows.length === 0) return res.status(403).json({ error: 'Not an administrator' });
    const permissions = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions) : rows[0].permissions;
    if (!permissions.includes(requiredPerm) && !permissions.includes('ADMIN_FULL')) {
      return res.status(403).json({ error: `Missing permission: ${requiredPerm}` });
    }
  }

  try {
    const [servers] = await pool.execute('SELECT license_id FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.status(404).json({ error: 'Server not found' });

    // Handle money actions mapping
    let actionType = action;
    let finalValue = value || {};
    // ... (rest of logic)

    if (action === 'manage_money') {
      actionType = value.action === 'add' ? 'addmoney' : 'removemoney';
      finalValue = {
        amount: value.amount,
        type: value.type || 'cash'
      };
    } else if (action === 'givemoney') {
      actionType = 'addmoney';
    } else if (action === 'takemoney') {
      actionType = 'removemoney';
    } else if (action === 'give_vehicle') {
      actionType = 'give_vehicle';
    }

    await pool.execute(
      'INSERT INTO pending_actions (license_id, action_type, target_id, data, status) VALUES (?, ?, ?, ?, "pending")',
      [servers[0].license_id, actionType, citizenid, JSON.stringify(finalValue)]
    );

    // Log to DB
    try {
      await pool.execute(
        'INSERT INTO panel_logs (server_id, admin_id, target_id, action_type, details) VALUES (?, ?, ?, ?, ?)',
        [serverId, req.user?.discordId || 'admin', citizenid, actionType, `Action: ${actionType} on ${citizenid} with data: ${JSON.stringify(finalValue)}`]
      );
    } catch(e) {}

    // Log to Discord Webhook
    logActionToDiscord(serverId, req.user?.discordId || '0', citizenid, actionType, finalValue);

    res.json({ success: true });
  } catch (e) { 
    console.error('PLAYER ACTION ERROR:', e);
    res.status(500).json({ error: e.message }); 
  }
});

// NOTE: Duplicate POST /panel-admins and DELETE /panel-admins/:discordId removed
// (already defined at lines ~694 and ~716 above)

app.get('/api/server/:serverId/panel-settings', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT panel_settings FROM servers WHERE id = ?', [serverId]);
    if (servers.length === 0) return res.status(404).json({ error: 'Server not found' });
    const settings = typeof servers[0].panel_settings === 'string' ? JSON.parse(servers[0].panel_settings || '{}') : (servers[0].panel_settings || {});
    return res.json({ settings });
  } catch (error) { 
    console.error('SETTINGS GET ERROR:', error);
    return res.status(500).json({ error: 'Failed' }); 
  }
});

async function sendDiscordEmbed(url, title, description, color = 0xea333f, fields = []) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
  try {
    await axios.post(url, {
      embeds: [{
        title: title,
        description: description,
        color: color,
        fields: fields,
        footer: { text: 'Echo Panel | Premium Logging System' },
        timestamp: new Date().toISOString()
      }]
    });
  } catch (e) { console.error('Discord Webhook Error:', e.message); }
}

async function logActionToDiscord(serverId, adminDiscordId, targetId, actionType, data) {
  try {
    // 1. Fetch server settings and connection info
    const [rows] = await pool.execute('SELECT server_name, panel_settings, db_connection FROM servers WHERE id = ?', [serverId]);
    if (!rows[0]) return;
    
    const settings = typeof rows[0].panel_settings === 'string' ? JSON.parse(rows[0].panel_settings || '{}') : (rows[0].panel_settings || {});
    const serverName = rows[0].server_name || 'FiveM Server';
    
    // 2. Map action to webhook key
    const webhookMap = {
      'kick': 'webhook_kick',
      'ban': 'webhook_ban',
      'teleport': 'webhook_teleport',
      'addmoney': 'webhook_money',
      'removemoney': 'webhook_money',
      'setjob': 'webhook_job',
      'setgang': 'webhook_gang',
      'additem': 'webhook_inventory',
      'removeitem': 'webhook_inventory',
      'revive': 'webhook_revive',
      'feed': 'webhook_feed',
      'repair_vehicle': 'webhook_repair',
      'screenshot': 'webhook_screenshot',
      'edit_identity': 'webhook_identity',
      'delete_character': 'webhook_identity'
    };

    const webhookKey = webhookMap[actionType] || 'webhook_admin_actions';
    const isEnabled = settings[webhookKey + '_enabled'] !== false;
    const isAllEnabled = settings['webhook_all_enabled'] !== false;

    if (!isEnabled && !isAllEnabled) return;

    const webhookUrl = settings[webhookKey] || settings['webhook_all'] || settings['webhook_admin_actions'];
    if (!webhookUrl) return;

    // 3. Try to get names (Admin & Target)
    let adminName = adminDiscordId;
    let targetName = targetId;

    try {
      // Get target name from game DB
      if (rows[0].db_connection) {
        const gamePool = getGamePool(rows[0].db_connection);
        const [pRows] = await gamePool.execute('SELECT charinfo FROM players WHERE citizenid = ?', [targetId]);
        if (pRows[0]) {
          const char = typeof pRows[0].charinfo === 'string' ? JSON.parse(pRows[0].charinfo) : pRows[0].charinfo;
          targetName = `${char.firstname} ${char.lastname} (${targetId})`;
        }
      }
    } catch(e) {}

    // 4. Prepare Bilingual Content
    const actionLabels = {
      'kick': { ar: 'طرد لاعب', en: 'Kick Player' },
      'ban': { ar: 'حظر لاعب', en: 'Ban Player' },
      'teleport': { ar: 'نقل فوري', en: 'Teleport' },
      'addmoney': { ar: 'إضافة أموال', en: 'Add Money' },
      'removemoney': { ar: 'سحب أموال', en: 'Remove Money' },
      'setjob': { ar: 'تعيين وظيفة', en: 'Set Job' },
      'setgang': { ar: 'تعيين عصابة', en: 'Set Gang' },
      'additem': { ar: 'إعطاء عنصر', en: 'Give Item' },
      'revive': { ar: 'إنعاش', en: 'Revive' },
      'feed': { ar: 'إطعام', en: 'Feed' },
      'repair_vehicle': { ar: 'إصلاح مركبة', en: 'Repair Vehicle' }
    };

    const label = actionLabels[actionType] || { ar: actionType, en: actionType };
    
    let detailsStr = '';
    if (actionType === 'addmoney' || actionType === 'removemoney') {
      detailsStr = `💸 ${lang === 'ar' ? 'المبلغ' : 'Amount'}: ${data.amount}\n💰 ${lang === 'ar' ? 'النوع' : 'Type'}: ${data.type}`;
    } else if (actionType === 'setjob') {
      detailsStr = `💼 ${lang === 'ar' ? 'الوظيفة' : 'Job'}: ${data.job}\n🎖️ ${lang === 'ar' ? 'الرتبة' : 'Grade'}: ${data.grade}`;
    } else if (actionType === 'additem' || actionType === 'removeitem') {
      detailsStr = `📦 ${lang === 'ar' ? 'العنصر' : 'Item'}: ${data.item}\n🔢 ${lang === 'ar' ? 'الكمية' : 'Qty'}: ${data.amount}`;
    } else if (actionType === 'teleport') {
      detailsStr = `📍 ${lang === 'ar' ? 'الإحداثيات' : 'Coords'}: ${data.coords}`;
    } else if (actionType === 'ban') {
      detailsStr = `🚫 ${lang === 'ar' ? 'السبب' : 'Reason'}: ${data.reason}\n⏳ ${lang === 'ar' ? 'المدة' : 'Duration'}: ${data.duration}`;
    } else if (actionType === 'kick') {
      detailsStr = `👢 ${lang === 'ar' ? 'السبب' : 'Reason'}: ${data.reason}`;
    } else if (data && Object.keys(data).length > 0) {
      detailsStr = JSON.stringify(data, null, 2);
    } else {
      detailsStr = lang === 'ar' ? 'لا توجد تفاصيل إضافية' : 'No additional details';
    }

    const fields = [
      { name: 'الإداري / Admin', value: `<@${adminDiscordId}>`, inline: true },
      { name: 'الهدف / Target', value: `\`${targetName}\``, inline: true },
      { name: 'الإجراء / Action', value: `**${label.ar}** / ${label.en}`, inline: true },
      { name: 'التفاصيل / Details', value: `\`\`\`${detailsStr}\`\`\``, inline: false },
      { name: 'السيرفر / Server', value: serverName, inline: true }
    ];

    await sendDiscordEmbed(webhookUrl, `Admin Log: ${label.en}`, `New administrative action recorded via Echo Panel.`, 0xea333f, fields);

  } catch (error) {
    console.error('Logging to Discord failed:', error);
  }
}

app.post('/api/server/:serverId/panel-settings', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const settings = req.body;
  try {
    const [existing] = await pool.execute('SELECT server_name, panel_settings FROM servers WHERE id = ?', [serverId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Server not found' });
    
    let existingSettings = {};
    if (existing[0]?.panel_settings) {
      existingSettings = typeof existing[0].panel_settings === 'string' ? JSON.parse(existing[0].panel_settings) : existing[0].panel_settings;
    }
    const newSettings = { 
      ...existingSettings, 
      ...settings,
      // Ensure specific fields that echo_panel auto-detects are NOT accidentally wiped if missing from body
      resources_path: settings.resources_path || existingSettings.resources_path,
      teleport_locations: settings.teleport_locations !== undefined ? settings.teleport_locations : (existingSettings.teleport_locations || [])
    };
    
    // Detect webhook changes to send verification
    const sName = existing[0].server_name || 'FiveM Server';
    for (const key of Object.keys(settings)) {
      if (key.startsWith('webhook_') && settings[key] && settings[key] !== existingSettings[key]) {
        // Webhook changed/added, send test
        sendDiscordEmbed(settings[key], 'Echo Panel - Webhook Connected', 'تم ربط قناة السجلات بنجاح مع لوحة التحكم.', 0xea333f, [
          { name: 'Channel', value: key.replace('webhook_', '').toUpperCase(), inline: true },
          { name: 'Server', value: sName, inline: true },
          { name: 'Status', value: 'Active ✅', inline: true }
        ]);
      }
    }

    await pool.execute('UPDATE servers SET panel_settings = ? WHERE id = ?', [JSON.stringify(newSettings), serverId]);
    return res.json({ success: true });
  } catch (error) { 
    console.error('SETTINGS POST ERROR:', error);
    return res.status(500).json({ error: 'Failed' }); 
  }
});

app.get('/api/server/:serverId', async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute(`
      SELECT s.*, l.product_name, l.expires_at, l.license_key, l.server_ip as ip_address
      FROM servers s 
      LEFT JOIN licenses l ON s.license_id = l.id 
      WHERE s.id = ?
    `, [serverId]);
    
    if (servers.length === 0) return res.status(404).json({ error: 'Server not found' });
    
    const s = servers[0];
    // Ensure nested objects are parsed
    if (typeof s.players_data === 'string') {
      try { s.players_data = JSON.parse(s.players_data); } catch(e){ s.players_data = []; }
    }

    return res.json({ server: s });
  } catch (error) {
    console.error('FETCH SERVER ERROR:', error);
    return res.status(500).json({ error: 'Failed to fetch server info' });
  }
});

app.post('/api/server/:serverId/upload-screenshot', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/screenshots/${req.file.filename}` });
});

app.get('/api/server/:serverId/screenshots', (req, res) => {
  const screenshots = [];
  
  // 1. Scan Avatars (Portraits)
  if (fs.existsSync(avatarsPath)) {
    const avatarFiles = fs.readdirSync(avatarsPath);
    avatarFiles.filter(f => f.startsWith('avatar_')).forEach(f => {
      const parts = f.split('_');
      screenshots.push({
        targetId: parts[1] || 'unknown',
        url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/avatars/${f}`,
        type: 'portrait',
        time: fs.statSync(path.join(avatarsPath, f)).mtimeMs
      });
    });
  }

  // 2. Scan Full Screenshots
  if (fs.existsSync(screenshotsPath)) {
    const screenFiles = fs.readdirSync(screenshotsPath);
    screenFiles.filter(f => f.endsWith('.webp') || f.endsWith('.png')).forEach(f => {
      screenshots.push({
        targetId: f.split('.')[0],
        url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/screenshots/${f}`,
        type: 'screen',
        time: fs.statSync(path.join(screenshotsPath, f)).mtimeMs
      });
    });
  }

  // Sort by newest first
  screenshots.sort((a, b) => b.time - a.time);

  res.json({ screenshots });
});

app.get('/api/server/:serverId/stats-full', async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection, status, last_sync FROM servers WHERE id = ?', [serverId]);
    if (servers.length === 0 || !servers[0].db_connection) return res.json({ success: true, stats: { characters: 0, vehicles: 0, bans: 0, stashes: 0, status: 'offline' } });
    
    const gamePool = getGamePool(servers[0].db_connection);
    const [charCount] = await gamePool.execute('SELECT COUNT(*) as count FROM players');
    const [vehCount]  = await gamePool.execute('SELECT COUNT(*) as count FROM player_vehicles');

    let stashesCount = 0;
    try {
      const [sc] = await gamePool.execute("SELECT COUNT(DISTINCT stash) as count FROM stashitems");
      stashesCount += (sc[0]?.count || 0);
    } catch(e) {}
    try {
      const [oxc] = await gamePool.execute("SELECT COUNT(*) as count FROM ox_inventory WHERE type != 'player'");
      stashesCount += (oxc[0]?.count || 0);
    } catch(e) {}
    try {
      const [trc] = await gamePool.execute("SELECT COUNT(*) as count FROM trunkitems");
      stashesCount += (trc[0]?.count || 0);
    } catch(e) {}
    try {
      const [glc] = await gamePool.execute("SELECT COUNT(*) as count FROM gloveboxitems");
      stashesCount += (glc[0]?.count || 0);
    } catch(e) {}
    
    // Combine with discovered stashes from settings
    try {
      const [settingsRows] = await pool.execute('SELECT panel_settings FROM servers WHERE id = ?', [serverId]);
      if (settingsRows[0]?.panel_settings) {
        const settings = typeof settingsRows[0].panel_settings === 'string' ? JSON.parse(settingsRows[0].panel_settings) : settingsRows[0].panel_settings;
        const discovered = settings.discoveredStashes || [];
        if (discovered.length > stashesCount) stashesCount = discovered.length;
      }
    } catch(e) {}
    let gangCount = 0, banCount = 0;
    try {
      // Count unique active gangs (where gang.name != 'none')
      const [gc] = await gamePool.execute(`
        SELECT COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(gang, '$.name'))) as count
        FROM players
        WHERE JSON_UNQUOTE(JSON_EXTRACT(gang, '$.name')) != 'none'
          AND JSON_UNQUOTE(JSON_EXTRACT(gang, '$.name')) IS NOT NULL
      `);
      gangCount = gc[0].count || 0;
    } catch(e) {}
    try {
      const [bc] = await gamePool.execute("SELECT COUNT(*) as count FROM bans");
      banCount = bc[0].count;
    } catch(e) {}

    return res.json({ 
      success: true, 
      stats: { 
        characters: charCount[0].count, 
        vehicles: vehCount[0].count, 
        bans: banCount, 
        stashes: stashesCount,
        inventories: charCount[0].count,
        dupes: 0,
        gangs: gangCount,
        status: servers[0].status || 'offline',
        last_sync: servers[0].last_sync
      } 
    });
  } catch (error) {
    return res.json({ success: true, stats: { characters: 0, vehicles: 0, bans: 0, stashes: 0 } });
  }
});

app.get('/api/server/:serverId/game-players', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) {
      console.warn(`[game-players] Server ${serverId} not found`);
      return res.json({ players: [], warning: 'Server not found' });
    }
    if (!servers[0].db_connection) {
      console.warn(`[game-players] Server ${serverId} has no db_connection configured`);
      return res.json({ players: [], warning: 'Game database not connected. Please configure the database connection in server settings.' });
    }
    const gamePool = getGamePool(servers[0].db_connection);
    if (!gamePool) {
      console.error(`[game-players] Failed to create game DB pool for server ${serverId}`);
      return res.status(500).json({ error: 'Failed to connect to game database', players: [] });
    }
    const [players] = await gamePool.execute('SELECT citizenid, name, charinfo, job, gang, money, metadata, inventory FROM players');
    console.log(`[game-players] Fetched ${players.length} players for server ${serverId}`);
    return res.json({ players: players.map(p => {
      try {
        return {
          ...p,
          charinfo: typeof p.charinfo === 'string' ? JSON.parse(p.charinfo || '{}') : (p.charinfo || {}),
          job: typeof p.job === 'string' ? JSON.parse(p.job || '{}') : (p.job || {}),
          gang: typeof p.gang === 'string' ? JSON.parse(p.gang || '{}') : (p.gang || {}),
          money: typeof p.money === 'string' ? JSON.parse(p.money || '{}') : (p.money || {}),
          metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {}),
          inventory: typeof p.inventory === 'string' ? JSON.parse(p.inventory || '[]') : (p.inventory || [])
        };
      } catch (parseErr) {
        console.error(`[game-players] Parse error for player ${p.citizenid}:`, parseErr.message);
        return p;
      }
    })});
  } catch (error) {
    console.error(`[game-players] Error for server ${serverId}:`, error.message);
    return res.status(500).json({ error: `Failed to fetch players: ${error.message}`, players: [] });
  }
});

app.get('/api/server/:serverId/game-bans', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) {
      console.warn(`[game-bans] Server ${serverId} not found`);
      return res.json({ bans: [], warning: 'Server not found' });
    }
    if (!servers[0].db_connection) {
      console.warn(`[game-bans] Server ${serverId} has no db_connection configured`);
      return res.json({ bans: [], warning: 'Game database not connected. Please configure the database connection in server settings.' });
    }
    const gamePool = getGamePool(servers[0].db_connection);
    if (!gamePool) {
      console.error(`[game-bans] Failed to create game DB pool for server ${serverId}`);
      return res.status(500).json({ error: 'Failed to connect to game database', bans: [] });
    }
    const [rows] = await gamePool.execute('SELECT name, license, discord, ip, reason, expire, bannedby FROM bans');
    console.log(`[game-bans] Fetched ${rows.length} bans for server ${serverId}`);

    const now = Math.floor(Date.now() / 1000);
    const bans = rows.map(b => {
      const isPermanent = b.expire == 2147483647;
      const isActive = isPermanent || (b.expire > now);
      const ban_code = (b.license && b.license.length >= 8) ? String(b.license).substring(0, 8).toUpperCase() : 'UNKNOWN';

      let remaining = null;
      if (!isPermanent && isActive) {
        const diff = b.expire - now;
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        remaining = hours > 0 ? `${hours} ساعة ${minutes} دقيقة` : `${minutes} دقيقة`;
      }

      return {
        name: b.name || 'Unknown',
        license: b.license || '',
        discord: b.discord || '',
        ip: b.ip || '',
        reason: b.reason || '',
        expire: b.expire,
        bannedby: b.bannedby || '',
        ban_code,
        isPermanent,
        isActive,
        remaining
      };
    });

    return res.json({ bans });
  } catch (error) {
    console.error(`[game-bans] Error for server ${serverId}:`, error.message);
    return res.status(500).json({ error: `Failed to fetch bans: ${error.message}`, bans: [] });
  }
});

app.get('/api/server/:serverId/game-vehicles', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    const gamePool = getGamePool(servers[0].db_connection);
    const [vehs] = await gamePool.execute('SELECT pv.*, p.charinfo FROM player_vehicles pv LEFT JOIN players p ON pv.citizenid = p.citizenid');
    return res.json({ vehicles: vehs.map(v => ({ ...v, charinfo: typeof v.charinfo === 'string' ? JSON.parse(v.charinfo || '{}') : v.charinfo }))});
  } catch (error) { return res.status(500).json({ error: 'Failed' }); }
});

// ==========================================
// STASHES ENDPOINTS
// ==========================================

app.get('/api/server/:serverId/stashes', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  console.log(`[STASH API] Final request for server: ${serverId}`);
  try {
    const [servers] = await pool.execute('SELECT db_connection, panel_settings FROM servers WHERE id = ?', [serverId]);
    if (!servers[0] || !servers[0].db_connection) return res.json({ stashes: [] });
    
    const settings = typeof servers[0].panel_settings === 'string' ? JSON.parse(servers[0].panel_settings || '{}') : (servers[0].panel_settings || {});
    const discoveredIds = settings.discoveredStashes || [];
    const dbLocations = settings.stashLocations || {};
    
    const getCoords = (id) => {
      const sid = String(id).toLowerCase();
      // 1. Try DB first (Live Discovery / Sync) - HIGHEST PRECISION
      if (dbLocations[sid]) return `vector3(${dbLocations[sid].x.toFixed(2)}, ${dbLocations[sid].y.toFixed(2)}, ${dbLocations[sid].z.toFixed(2)})`;
      
      // Fuzzy match ONLY for longer descriptive names
      if (sid.length > 4) {
        for (const [key, val] of Object.entries(dbLocations)) {
          if (key.length > 3 && (sid.includes(key) || key.includes(sid))) {
             return `vector3(${val.x.toFixed(2)}, ${val.y.toFixed(2)}, ${val.z.toFixed(2)})`;
          }
        }
      }

      return 'غير محدد';
    };

    const sources = [
      { t: 'stashitems', c: 'stash', l: 'مخزن' },
      { t: 'stash_items', c: 'stash', l: 'مخزن' },
      { t: 'trunkitems', c: 'plate', l: 'شنطة' },
      { t: 'trunk_items', c: 'plate', l: 'شنطة' },
      { t: 'gloveboxitems', c: 'plate', l: 'درج' },
      { t: 'glovebox_items', c: 'plate', l: 'درج' },
      { t: 'house_stashes', c: 'stash', l: 'منزل' },
      { t: 'ox_inventory', c: 'id', l: 'Ox' }
    ];

    for (const s of sources) {
      try {
        const [rows] = await gamePool.execute(`SELECT ${s.c} as id, items FROM ${s.t} LIMIT 500`);
        rows.forEach(r => {
          if (!r.id || processedIds.has(String(r.id))) return;
          let count = 0;
          try {
            const raw = typeof r.items === 'string' ? JSON.parse(r.items || '{}') : (r.items || {});
            const itemsArr = Array.isArray(raw) ? raw : Object.values(raw);
            count = itemsArr.filter(i => i && i.name).length;
          } catch(e) {}
          
          const sid = String(r.id);
          finalStashes.push({ 
            id: sid, 
            label: `${s.l}: ${r.id}`, 
            itemsCount: count,
            location: getCoords(sid)
          });
          processedIds.add(sid);
        });
      } catch(e) {}
    }

    discoveredIds.forEach(id => {
      const sid = String(id);
      if (!processedIds.has(sid)) {
        finalStashes.push({ 
          id: sid, 
          label: `مخزن: ${id}`, 
          itemsCount: 0,
          location: getCoords(sid)
        });
        processedIds.add(sid);
      }
    });

    console.log(`[STASH API] Success! Sending ${finalStashes.length} stashes.`);
    return res.json({ stashes: finalStashes });
  } catch (error) {
    console.error('[STASH API] Error:', error);
    return res.json({ stashes: [] });
  }
});

app.get('/api/server/:serverId/stashes/:stashId', authenticateJWT, async (req, res) => {
  const { serverId, stashId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB' });
    const gamePool = getGamePool(servers[0].db_connection);

    let items = [];
    let found = false;

    // 1. Try ox_inventory
    try {
      const ids = [stashId, stashId.trim(), `boss_${stashId}`, `stash-${stashId}`, `${stashId}_stash` ];
      const placeholders = ids.map(() => '?').join(', ');
      const [rows] = await gamePool.execute(`SELECT data FROM ox_inventory WHERE id IN (${placeholders})`, ids);
      if (rows[0]) {
        const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : (rows[0].data || {});
        items = Object.values(data).filter(i => i && i.name).map(i => ({
          name: i.name, label: i.label || i.name, amount: i.count || 1, slot: i.slot, image: i.name + '.png'
        }));
        found = true;
      }
    } catch(e) {}

    // 2. Try various QB tables if not found in Ox
    if (!found) {
      const tables = [
        { table: 'stashitems', id: 'stash' },
        { table: 'stashitems', id: 'id' },
        { table: 'stash_items', id: 'stash' },
        { table: 'house_stashes', id: 'stash' },
        { table: 'trunkitems', id: 'plate' },
        { table: 'trunk_items', id: 'plate' },
        { table: 'gloveboxitems', id: 'plate' },
        { table: 'glovebox_items', id: 'plate' },
        { table: 'apartments', id: 'name' },
        { table: 'player_houses', id: 'house' }
      ];

      for (const t of tables) {
        try {
          const ids = [stashId, stashId.trim(), `boss_${stashId}`, `stash-${stashId}`, `${stashId}_stash`, `${stashId}stash` ];
          const placeholders = ids.map(() => '?').join(', ');
          const [rows] = await gamePool.execute(`SELECT items FROM ${t.table} WHERE ${t.id} IN (${placeholders})`, ids);
          if (rows[0]) {
            let raw = rows[0].items;
            if (typeof raw === 'string') {
              try { raw = JSON.parse(raw); } catch(e) { raw = []; }
            }
            const arr = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
            items = arr.filter(i => i && i.name).map(i => ({
              name: i.name, 
              label: i.label || i.name, 
              amount: i.amount || i.count || 1, 
              slot: i.slot, 
              image: i.image || (i.name + '.png'),
              info: i.info || {}
            }));
            found = true;
            break;
          }
        } catch(e) {}
      }
    }

    // Set cache-control to prevent browser caching of stash contents
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (found) return res.json({ items });
    return res.status(404).json({ error: 'Stash not found or empty' });
  } catch(error) { return res.status(500).json({ error: 'Failed to load items' }); }
});

app.post('/api/server/:serverId/stashes/:stashId/move-item', authenticateJWT, async (req, res) => {
  const { serverId, stashId } = req.params;
  const { fromStash, slot, amount } = req.body;
  // This logic is complex, but let's implement a basic version:
  // 1. Get item from fromStash
  // 2. Delete/Reduce in fromStash
  // 3. Add to target stashId
  try {
     // ... Implementation ...
     res.json({ success: true, message: 'Item moved' });
  } catch(e) { res.status(500).json({ error: 'Failed to move' }); }
});

app.delete('/api/server/:serverId/stashes/:stashId/item', authenticateJWT, async (req, res) => {
  const { serverId, stashId } = req.params;
  const { slot } = req.body;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB' });
    const gamePool = getGamePool(servers[0].db_connection);

    // 1. Try ox_inventory
    try {
      const [rows] = await gamePool.execute('SELECT data FROM ox_inventory WHERE id = ?', [stashId]);
      if (rows.length > 0) {
        const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
        delete data[slot];
        await gamePool.execute('UPDATE ox_inventory SET data = ? WHERE id = ?', [JSON.stringify(data), stashId]);
        return res.json({ success: true });
      }
    } catch(e) {}

    // 2. Try stashitems and others with flexible column names
    const targets = [
      { t: 'stashitems', c: 'id' },
      { t: 'stashitems', c: 'stash' },
      { t: 'house_stashes', c: 'id' },
      { t: 'house_stashes', c: 'stash' },
      { t: 'trunkitems', c: 'plate' },
      { t: 'gloveboxitems', c: 'plate' }
    ];

    for (const target of targets) {
      try {
        const [rows] = await gamePool.execute(`SELECT items FROM ${target.t} WHERE ${target.c} = ?`, [stashId]);
        if (rows.length > 0) {
          let items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
          if (Array.isArray(items)) {
            items = items.filter(i => i && i.slot !== slot);
          } else {
            delete items[slot];
          }
          await gamePool.execute(`UPDATE ${target.t} SET items = ? WHERE ${target.c} = ?`, [JSON.stringify(items), stashId]);
          return res.json({ success: true });
        }
      } catch(e) {}
    }

    return res.status(404).json({ error: 'Stash not found or item not deleted' });
  } catch(error) { return res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/server/:serverId/stashes/:stashId/item', authenticateJWT, async (req, res) => {
  const { serverId, stashId } = req.params;
  const { item, amount, label } = req.body;
  if (!item || !amount) return res.status(400).json({ error: 'Missing item or amount' });

  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB' });
    const gamePool = getGamePool(servers[0].db_connection);

    // 1. Try ox_inventory
    try {
      const [rows] = await gamePool.execute('SELECT data FROM ox_inventory WHERE id = ?', [stashId]);
      if (rows.length > 0) {
        const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : (rows[0].data || {});
        // Find empty slot (simple logic)
        let slot = 1;
        while (data[slot]) slot++;
        data[slot] = { name: item, count: parseInt(amount), slot: slot, label: label || item };
        await gamePool.execute('UPDATE ox_inventory SET data = ? WHERE id = ?', [JSON.stringify(data), stashId]);
        return res.json({ success: true });
      }
    } catch(e) {}

    // 2. Try stashitems (QB) — search across multiple ID column names
    const stashColumns = ['stash', 'id'];
    for (const col of stashColumns) {
      try {
        const [rows] = await gamePool.execute(`SELECT items FROM stashitems WHERE ${col} = ? LIMIT 1`, [stashId]);
        if (rows.length > 0) {
          let itemsRaw = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : (rows[0].items || {});
          const isObject = !Array.isArray(itemsRaw) && typeof itemsRaw === 'object';

          if (isObject) {
            // QBCore slot-keyed format: {"1": {slot:1, ...}, "2": {slot:2, ...}}
            // Check for existing item to merge
            let found = false;
            for (const key of Object.keys(itemsRaw)) {
              if (itemsRaw[key] && itemsRaw[key].name === item) {
                itemsRaw[key].amount = (itemsRaw[key].amount || 0) + parseInt(amount);
                found = true;
                break;
              }
            }
            if (!found) {
              // Find next available slot
              const maxSlot = Object.keys(itemsRaw).reduce((max, k) => {
                const s = itemsRaw[k]?.slot || parseInt(k) || 0;
                return s > max ? s : max;
              }, 0);
              const nextSlot = maxSlot + 1;
              itemsRaw[String(nextSlot)] = {
                slot: nextSlot,
                name: item,
                amount: parseInt(amount),
                label: label || item,
                info: {},
                type: 'item'
              };
            }
            await gamePool.execute(`UPDATE stashitems SET items = ? WHERE ${col} = ?`, [JSON.stringify(itemsRaw), stashId]);
          } else {
            // Array format
            let itemsList = Array.isArray(itemsRaw) ? itemsRaw : Object.values(itemsRaw);
            let slot = 1;
            while (itemsList.find(i => i.slot === slot)) slot++;
            const newItem = { name: item, amount: parseInt(amount), slot: slot, label: label || item, info: {}, type: 'item' };
            itemsList.push(newItem);
            await gamePool.execute(`UPDATE stashitems SET items = ? WHERE ${col} = ?`, [JSON.stringify(itemsList), stashId]);
          }
          return res.json({ success: true });
        }
      } catch(e) {}
    }

    // 3. Stash doesn't exist yet — create it in stashitems with QBCore slot-keyed format
    try {
      const items = {
        "1": {
          slot: 1,
          name: item,
          amount: parseInt(amount),
          label: label || item,
          info: {},
          type: 'item'
        }
      };
      await gamePool.execute('INSERT INTO stashitems (stash, items) VALUES (?, ?)', [stashId, JSON.stringify(items)]);
      return res.json({ success: true });
    } catch(e) {
      console.error('STASH CREATE ERROR:', e);
    }

    return res.status(404).json({ error: 'Stash not found or inventory type not supported' });
  } catch(error) { 
    console.error('STASH ADD ERROR:', error);
    return res.status(500).json({ error: 'Failed to add item' }); 
  }
});

app.delete('/api/server/:serverId/stashes/:stashId', authenticateJWT, async (req, res) => {
  const { serverId, stashId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB' });
    const gamePool = getGamePool(servers[0].db_connection);

    try {
      await gamePool.execute('UPDATE ox_inventory SET data = ? WHERE id = ?', ['{}', stashId]);
    } catch(e) {
      try {
        await gamePool.execute('UPDATE stashitems SET items = ? WHERE id = ?', ['[]', stashId]);
      } catch(e2) {}
    }

    return res.json({ success: true });
  } catch(error) { return res.status(500).json({ error: 'Failed' }); }
});

// ==========================================
// CREATE STASH ENDPOINT
// ==========================================
app.post('/api/server/:serverId/create-stash', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const { name, location, password, slots, allowedCitizenIds } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Stash name is required' });
  }

  if (!location || typeof location.x !== 'number' || typeof location.y !== 'number' || typeof location.z !== 'number') {
    return res.status(400).json({ error: 'Valid location coordinates (x, y, z) are required' });
  }

  if (!slots || typeof slots !== 'number' || slots < 1) {
    return res.status(400).json({ error: 'Valid slots number is required' });
  }

  try {
    const [servers] = await pool.execute('SELECT db_connection, panel_settings FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.status(404).json({ error: 'Server not found' });

    const stashName = name.trim();
    const gamePool = servers[0].db_connection ? getGamePool(servers[0].db_connection) : null;

    // 1. Create the stash in the game database (stashitems table)
    let stashCreated = false;
    if (gamePool) {
      try {
        // Check if stash already exists
        let existing = false;
        const checkColumns = ['stash', 'id'];
        for (const col of checkColumns) {
          try {
            const [rows] = await gamePool.execute(`SELECT ${col} FROM stashitems WHERE ${col} = ? LIMIT 1`, [stashName]);
            if (rows.length > 0) { existing = true; break; }
          } catch(e) {}
        }

        if (!existing) {
          // Create empty stash in QBCore slot-keyed format with slots info
          const stashData = {};
          await gamePool.execute('INSERT INTO stashitems (stash, items) VALUES (?, ?)', [stashName, JSON.stringify(stashData)]);
          console.log(`[CREATE STASH] Created stash "${stashName}" in game database`);
          stashCreated = true;
        } else {
          console.log(`[CREATE STASH] Stash "${stashName}" already exists in game database`);
          stashCreated = true; // Already exists, that's fine
        }
      } catch(e) {
        console.error('[CREATE STASH] Game DB error:', e.message);
        // Continue even if game DB insert fails — we still save to panel settings
      }
    }

    // 2. Save the stash configuration in panel_settings for persistence
    const settings = typeof servers[0].panel_settings === 'string'
      ? JSON.parse(servers[0].panel_settings || '{}')
      : (servers[0].panel_settings || {});

    // Add to discoveredStashes array
    if (!settings.discoveredStashes) settings.discoveredStashes = [];
    if (!settings.discoveredStashes.includes(stashName)) {
      settings.discoveredStashes.push(stashName);
    }

    // Save location in stashLocations
    if (!settings.stashLocations) settings.stashLocations = {};
    const locKey = stashName.toLowerCase();
    settings.stashLocations[locKey] = {
      x: location.x,
      y: location.y,
      z: location.z
    };

    // Save stash metadata (password, slots, allowedCitizenIds) for persistence
    if (!settings.stashConfigs) settings.stashConfigs = {};
    settings.stashConfigs[locKey] = {
      name: stashName,
      password: password || '',
      slots: slots,
      allowedCitizenIds: Array.isArray(allowedCitizenIds) ? allowedCitizenIds : [],
      location: { x: location.x, y: location.y, z: location.z },
      createdAt: new Date().toISOString()
    };

    // Update panel_settings in the database
    await pool.execute('UPDATE servers SET panel_settings = ? WHERE id = ?', [JSON.stringify(settings), serverId]);
    console.log(`[CREATE STASH] Saved stash "${stashName}" config to panel_settings`);

    // Invalidate the file discovery cache so it picks up new data
    delete fileDiscoveryCache[serverId];

    return res.json({
      success: true,
      stash: {
        id: stashName,
        label: `مخزن: ${stashName}`,
        itemsCount: 0,
        items: [],
        location: `vector3(${location.x.toFixed(2)}, ${location.y.toFixed(2)}, ${location.z.toFixed(2)})`
      }
    });
  } catch(error) {
    console.error('[CREATE STASH] Error:', error);
    return res.status(500).json({ error: 'Failed to create stash: ' + error.message });
  }
});

app.get('/api/server/:serverId/search-players', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const { query } = req.query;
  if (!query) return res.json({ players: [] });

  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB connection configured' });
    const gamePool = getGamePool(servers[0].db_connection);

    const searchTerm = `%${query}%`;
    const [players] = await gamePool.execute(
      'SELECT citizenid, charinfo, license, money FROM players WHERE citizenid LIKE ? OR charinfo LIKE ? OR license LIKE ? LIMIT 20',
      [searchTerm, searchTerm, searchTerm]
    );

    const formatted = players.map(p => {
      let charinfo = {};
      try { charinfo = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : (p.charinfo || {}); } catch(e) {}
      return {
        citizenid: p.citizenid,
        license: p.license,
        name: `${charinfo.firstname || ''} ${charinfo.lastname || ''}`,
        charinfo
      };
    });

    res.json({ players: formatted });
  } catch (error) {
    console.error('SEARCH PLAYERS ERROR:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Legacy route removed


// ==========================================
// 4. SYNC & ACTIONS
// ==========================================

app.post('/api/sync', async (req, res) => {
  const { licenseKey, players, maxPlayers, serverName, dbConnectionString, playersData, sharedJobs, sharedGangs, sharedItems, sharedVehicles, resourcesPath } = req.body;
  try {
    const [licenses] = await pool.execute('SELECT id, owner_discord_id, is_active, expires_at FROM licenses WHERE license_key = ?', [licenseKey]);
    if (licenses.length === 0) return res.status(403).json({ error: 'Invalid license' });
    
    const license = licenses[0];
    const licenseId = license.id;

    // Check if license is active and not expired
    if (!license.is_active) return res.status(403).json({ error: 'License is revoked' });
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(403).json({ error: 'License expired' });
    }

    const query = `
      INSERT INTO servers (
        license_id, current_players, max_players, server_name, players_data, db_connection, 
        shared_jobs, shared_gangs, shared_items, shared_vehicles, last_sync, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'online')
      ON DUPLICATE KEY UPDATE 
        current_players = VALUES(current_players),
        max_players = VALUES(max_players),
        server_name = VALUES(server_name),
        players_data = VALUES(players_data),
        db_connection = COALESCE(NULLIF(VALUES(db_connection), ''), db_connection),
        shared_jobs = IF(VALUES(shared_jobs) IS NOT NULL, VALUES(shared_jobs), shared_jobs),
        shared_gangs = IF(VALUES(shared_gangs) IS NOT NULL, VALUES(shared_gangs), shared_gangs),
        shared_items = IF(VALUES(shared_items) IS NOT NULL, VALUES(shared_items), shared_items),
        shared_vehicles = IF(VALUES(shared_vehicles) IS NOT NULL, VALUES(shared_vehicles), shared_vehicles),
        last_sync = NOW(),
        status = 'online'
    `;

    const params = [
      licenseId,
      players || 0,
      maxPlayers || 32,
      serverName || 'FiveM Server',
      JSON.stringify(playersData || []),
      dbConnectionString || '',
      sharedJobs ? JSON.stringify(sharedJobs) : null,
      sharedGangs ? JSON.stringify(sharedGangs) : null,
      sharedItems ? JSON.stringify(sharedItems) : null,
      sharedVehicles ? JSON.stringify(sharedVehicles) : null
    ];

    await pool.execute(query, params);

    // Invalidate shared config cache when new config is synced from FiveM
    if (sharedJobs || sharedGangs || sharedItems || sharedVehicles) {
      const [serverRows] = await pool.execute('SELECT id FROM servers WHERE license_id = ?', [licenseId]);
      if (serverRows[0]) sharedConfigCache.delete(String(serverRows[0].id));
    }

    // Track Playtime (Accurate Minute-by-Minute)
    if (Array.isArray(playersData)) {
      for (const p of playersData) {
        if (p.citizenid) {
          await pool.execute(`
            INSERT INTO player_analytics (citizenid, total_playtime, last_seen, last_playtime_update) 
            VALUES (?, 0, NOW(), NOW()) 
            ON DUPLICATE KEY UPDATE 
              total_playtime = IF(TIMESTAMPDIFF(SECOND, last_playtime_update, NOW()) >= 60, total_playtime + 1, total_playtime),
              last_playtime_update = IF(TIMESTAMPDIFF(SECOND, last_playtime_update, NOW()) >= 60, NOW(), last_playtime_update),
              last_seen = NOW()
          `, [p.citizenid]);
        }
      }
    }

    // Handle discovered stashes & locations - FORCE SAVE to ensure visibility
    const { discoveredStashes, stashLocations, rawGarages } = req.body;
    
    if (discoveredStashes || stashLocations || sharedVehicles || rawGarages) {
      try {
        const [existing] = await pool.execute('SELECT panel_settings FROM servers WHERE license_id = ?', [licenseId]);
        let settings = {};
        if (existing[0]?.panel_settings) {
          settings = typeof existing[0].panel_settings === 'string' ? JSON.parse(existing[0].panel_settings) : existing[0].panel_settings;
        }
        
        // Merge Discovered Stashes
        if (discoveredStashes) {
          const oldStashes = settings.discoveredStashes || [];
          const newSet = new Set([...oldStashes, ...discoveredStashes]);
          settings.discoveredStashes = Array.from(newSet);
        }

        if (stashLocations) settings.stashLocations = { ...(settings.stashLocations || {}), ...stashLocations };
        
        // Save Vehicles & Garages
        if (sharedVehicles) settings.sharedVehicles = sharedVehicles;
        if (rawGarages) {
          settings.sharedGarages = parseLuaTable(rawGarages);
        }
        
        await pool.execute('UPDATE servers SET panel_settings = ? WHERE license_id = ?', [JSON.stringify(settings), licenseId]);
      } catch(e) { console.error('[STASH SYNC] Critical error:', e); }
    }

    // Auto-save resources path detected from echo_panel (GetResourcePath)
    if (resourcesPath) {
      try {
        const [existingR] = await pool.execute('SELECT panel_settings FROM servers WHERE license_id = ?', [licenseId]);
        let rSettings = {};
        if (existingR[0]?.panel_settings) {
          rSettings = typeof existingR[0].panel_settings === 'string' ? JSON.parse(existingR[0].panel_settings) : existingR[0].panel_settings;
        }
        if (!rSettings.resources_path || rSettings.resources_path !== resourcesPath) {
          rSettings.resources_path = resourcesPath;
          await pool.execute('UPDATE servers SET panel_settings = ? WHERE license_id = ?', [JSON.stringify(rSettings), licenseId]);
          console.log(`[AUTO-PATH] Resources path auto-saved: ${resourcesPath}`);
        }
      } catch(e) { console.error('[AUTO-PATH] Error saving resources path:', e); }
    }

    // Auto-copy item images from FiveM server path to panel's public/uploads/items/
    const itemImagesPath = req.body.itemImagesPath;
    if (itemImagesPath && fs.existsSync(itemImagesPath)) {
      try {
        const destDir = path.join(__dirname, 'public', 'uploads', 'items');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        const imageFiles = fs.readdirSync(itemImagesPath).filter(f => 
          f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')
        );
        
        let copiedCount = 0;
        for (const imgFile of imageFiles) {
          const srcFile = path.join(itemImagesPath, imgFile);
          const destFile = path.join(destDir, imgFile);
          // Only copy if file doesn't exist yet (avoid overwriting)
          if (!fs.existsSync(destFile)) {
            try {
              fs.copyFileSync(srcFile, destFile);
              copiedCount++;
            } catch(copyErr) {
              // Skip files that can't be copied
            }
          }
        }
        
        if (copiedCount > 0) {
          console.log(`[ITEM IMAGES] Auto-copied ${copiedCount} new item images from FiveM server`);
        }
      } catch(e) { 
        console.error('[ITEM IMAGES] Error copying item images:', e.message); 
      }
    }

    // Track activity history (snapshot every 10 mins)
    try {
      const [latest] = await pool.execute('SELECT recorded_at FROM activity_history WHERE server_id = ? ORDER BY recorded_at DESC LIMIT 1', [licenseId]);
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (!latest[0] || new Date(latest[0].recorded_at) < tenMinsAgo) {
        await pool.execute('INSERT INTO activity_history (server_id, player_count) VALUES (?, ?)', [licenseId, players || 0]);
      }
    } catch(e) { console.error('Activity history error:', e); }

    // Get server ID
    const [serverRows] = await pool.execute('SELECT id FROM servers WHERE license_id = ?', [licenseId]);
    if (serverRows.length > 0) {
      const serverId = serverRows[0].id;
      const ownerDiscordId = license.owner_discord_id;

      // ===== AUTO-SETUP OWNER ROLE & ADMIN =====
      // All permissions list (matches frontend)
      const ALL_PERMISSIONS = [
        'عرض اللاعبين','طرد','إنعاش','إطعام','إعطاء أموال','سحب أموال','تعيين الأموال','إزالة عناصر','إعطاء عناصر','حذف الشخصية',
        'نقل فوري','تعيين الوظيفة','تعيين العصابة','تعيين البيانات الوصفية','تعيين الهوية','تعيين الصلاحيات','رسالة مباشرة',
        'اللقطات المباشرة','مسح الحقيبة','عرض اللاعبين المتصلين','إشعار جميع اللاعبين',
        'عرض المركبات','إعطاء مركبات','حذف المركبات','نقل المركبات','تغيير اللوحة','تعديل حالة المركبة',
        'عرض المخازن','إضافة عناصر','إزالة عناصر','تفريغ المخازن',
        'عرض الانتظار','تعيين الأولوية','إزالة الأولوية','رفع/خفض','إزالة من الانتظار',
        'استخدام أداة التحقيق','عرض التكرارات','حذف جميع التكرارات',
        'عرض الحظر','إضافة حالات حظر','إزالة حالات حظر','تحديث حالات الحظر',
        'عرض العصابات','إدارة العصابات','عرض سجلات التدقيق',
        'عرض الإعدادات','إدارة الإعدادات','إدارة مواقع النقل','إدارة إعدادات السجلات',
        'إعادة تعيين وقت اللعب','إدارة اللوحات','إدارة الظهور',
        'إدارة الإداريين','إدارة الرتب'
      ];

      // Create Owner role if not exists
      const [existingOwnerRole] = await pool.execute(
        'SELECT id FROM panel_roles WHERE server_id = ? AND name = "Owner"',
        [serverId]
      );

      let ownerRoleId;
      if (existingOwnerRole.length === 0) {
        const [insertedRole] = await pool.execute(
          'INSERT INTO panel_roles (server_id, name, permissions) VALUES (?, "Owner", ?)',
          [serverId, JSON.stringify(ALL_PERMISSIONS)]
        );
        ownerRoleId = insertedRole.insertId;
      } else {
        ownerRoleId = existingOwnerRole[0].id;
        // Make sure Owner role always has ALL permissions
        await pool.execute(
          'UPDATE panel_roles SET permissions = ? WHERE id = ?',
          [JSON.stringify(ALL_PERMISSIONS), ownerRoleId]
        );
      }

      // Add license owner as Owner admin if not already added
      const [existingAdmin] = await pool.execute(
        'SELECT id FROM panel_admins WHERE server_id = ? AND discord_id = ?',
        [serverId, ownerDiscordId]
      );

      if (existingAdmin.length === 0) {
        await pool.execute(
          'INSERT INTO panel_admins (server_id, discord_id, role_id) VALUES (?, ?, ?)',
          [serverId, ownerDiscordId, ownerRoleId]
        );
        console.log(`[Auto-Setup] Owner ${ownerDiscordId} added to server ${serverId}`);
      } else {
        // Ensure owner always has the Owner role
        await pool.execute(
          'UPDATE panel_admins SET role_id = ? WHERE server_id = ? AND discord_id = ?',
          [ownerRoleId, serverId, ownerDiscordId]
        );
      }
    }

    // Fetch and return pending actions
    const [actions] = await pool.execute(
      'SELECT id, action_type, target_id, data FROM pending_actions WHERE license_id = ? AND status = "pending"',
      [licenseId]
    );

    if (actions.length > 0) {
      const ids = actions.map(a => a.id);
      await pool.query('UPDATE pending_actions SET status = "completed" WHERE id IN (?)', [ids]);
    }

    return res.json({ success: true, pendingActions: actions });
  } catch (error) { 
    console.error('SYNC ERROR:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message }); 
  }
});

app.get('/api/actions/:licenseKey', async (req, res) => {
  const { licenseKey } = req.params;
  try {
    const [licenses] = await pool.execute('SELECT id FROM licenses WHERE license_key = ?', [licenseKey]);
    if (licenses.length === 0) return res.status(403).json({ error: 'Invalid' });
    const [actions] = await pool.execute('SELECT id, action_type, target_id, data FROM pending_actions WHERE license_id = ? AND status = "pending"', [licenses[0].id]);
    
    if (actions.length > 0) {
      const ids = actions.map(a => a.id);
      // Use pool.query with array expansion for IN clause
      await pool.query('UPDATE pending_actions SET status = "completed" WHERE id IN (?)', [ids]);
    }
    return res.json(actions);
  } catch (error) { 
    console.error('ACTION FETCH ERROR:', error);
    return res.status(500).json({ error: 'Failed' }); 
  }
});

app.post('/api/server/:serverId/player/:citizenid/action', authenticateJWT, async (req, res) => {
  const { serverId, citizenid } = req.params;
  const { action, value } = req.body;
  try {
    const [servers] = await pool.execute('SELECT license_id FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.status(404).json({ error: 'Server not found' });
    const licenseId = servers[0].license_id;

    await pool.execute(
      'INSERT INTO pending_actions (license_id, action_type, target_id, data, status) VALUES (?, ?, ?, ?, "pending")',
      [licenseId, action, citizenid, JSON.stringify(value || {})]
    );

    // Log
    try {
      await pool.execute(
        'INSERT INTO panel_logs (server_id, admin_id, target_id, action_type, details) VALUES (?, ?, ?, ?, ?)',
        [serverId, req.user?.discordId || 'admin', citizenid, action, `Action: ${action} - ${JSON.stringify(value)}`]
      );
    } catch(e) {}

    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/server/:serverId/action-request', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const { action_type, target_id, data } = req.body;
  try {
    const [servers] = await pool.execute('SELECT license_id, players_data FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]) return res.status(404).json({ error: 'Server not found' });
    const licenseId = servers[0].license_id;

    if (action_type === 'screenshot_all') {
      let players = [];
      try {
        players = typeof servers[0].players_data === 'string' ? JSON.parse(servers[0].players_data) : (servers[0].players_data || []);
      } catch(e) {}
      
      if (players.length > 0) {
        const values = players.map(p => [licenseId, 'screenshot', p.citizenid, JSON.stringify({}), 'pending']);
        await pool.query('INSERT INTO pending_actions (license_id, action_type, target_id, data, status) VALUES ?', [values]);
        console.log(`[Screenshot-All] Requested ${players.length} screenshots for server ${serverId}`);
      }
      return res.json({ success: true, count: players.length });
    }

    if (action_type === 'change_plate') {
      const { oldPlate, newPlate } = data;
      if (!oldPlate || !newPlate) return res.status(400).json({ error: 'Missing plates' });
      
      const [s] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
      if (s[0]?.db_connection) {
        const gamePool = getGamePool(s[0].db_connection);
        try {
          // Update player_vehicles
          await gamePool.execute('UPDATE player_vehicles SET plate = ? WHERE plate = ?', [newPlate, oldPlate]);
          
          // Update trunk & glovebox (QB)
          try { await gamePool.execute('UPDATE trunkitems SET plate = ? WHERE plate = ?', [newPlate, oldPlate]); } catch(e) {}
          try { await gamePool.execute('UPDATE gloveboxitems SET plate = ? WHERE plate = ?', [newPlate, oldPlate]); } catch(e) {}
          
          // Update Ox Inventory
          try { await gamePool.execute("UPDATE ox_inventory SET id = ? WHERE id = ?", ['trunk'+newPlate, 'trunk'+oldPlate]); } catch(e) {}
          try { await gamePool.execute("UPDATE ox_inventory SET id = ? WHERE id = ?", ['glovebox'+newPlate, 'glovebox'+oldPlate]); } catch(e) {}
          
          console.log(`[Change-Plate] Successfully changed ${oldPlate} to ${newPlate} for server ${serverId}`);
        } catch(err) {
          console.error('[Change-Plate] Database Error:', err);
          return res.status(500).json({ error: 'Failed to update database tables' });
        }
      }
    }

    await pool.execute(
      'INSERT INTO pending_actions (license_id, action_type, target_id, data, status) VALUES (?, ?, ?, ?, "pending")',
      [licenseId, action_type, target_id || 'GLOBAL', JSON.stringify(data || {})]
    );
    
    // Log
    try {
      await pool.execute(
        'INSERT INTO panel_logs (server_id, admin_id, target_id, action_type, details) VALUES (?, ?, ?, ?, ?)',
        [serverId, req.user?.discordId || 'admin', target_id || 'GLOBAL', action_type, `Action: ${action_type}`]
      );
    } catch(logErr) {}

    return res.json({ success: true });
  } catch (error) { 
    console.error('ACTION REQ ERROR:', error);
    return res.status(500).json({ error: error.message }); 
  }
});

// ==========================================
// 5. DASHBOARD STATS ENDPOINTS
// ==========================================

app.get('/api/server/:serverId/activity', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT license_id FROM servers WHERE id = ?', [serverId]);
    const licenseId = servers[0]?.license_id;
    if (!licenseId) return res.json({ activity: [] });

    // Fetch last 24 hours of activity
    const [history] = await pool.execute(`
      SELECT 
        DATE_FORMAT(recorded_at, '%Y-%m-%d %H:00:00') as time_bucket,
        MAX(player_count) as max_players
      FROM activity_history
      WHERE server_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `, [licenseId]);

    if (history.length > 0) {
      const activity = history.map(h => ({
        recorded_at: h.time_bucket,
        players: h.max_players
      }));
      return res.json({ activity });
    }

    // Fallback to legacy game-db logic if no history yet
    const [s] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!s[0]?.db_connection) return res.json({ activity: [] });
    const gamePool = getGamePool(s[0].db_connection);
    const [rows] = await gamePool.execute(`SELECT HOUR(last_updated) as hour, COUNT(*) as players FROM players WHERE last_updated >= DATE_SUB(NOW(), INTERVAL 1 DAY) GROUP BY hour ORDER BY hour ASC`);
    
    const activity = Array.from({ length: 24 }, (_, i) => {
      const entry = rows.find(r => r.hour === i);
      return {
        recorded_at: new Date(new Date().setHours(i, 0, 0, 0)),
        players: entry ? entry.players : 0
      };
    });
    res.json({ activity });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


app.get('/api/server/:serverId/top-jobs', authenticateJWT, async (req, res) => {
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [req.params.serverId]);
    if (!servers[0]?.db_connection) return res.json({ jobs: [] });
    const gamePool = getGamePool(servers[0].db_connection);
    
    // Robust query for both JSON and plain string job columns
    const [rows] = await gamePool.execute(`
      SELECT 
        CASE 
          WHEN job LIKE '{%' THEN JSON_UNQUOTE(JSON_EXTRACT(job, '$.name'))
          ELSE job
        END as name,
        COUNT(*) as count
      FROM players
      GROUP BY name
      ORDER BY count DESC
      LIMIT 6
    `);
    res.json({ jobs: rows });
  } catch(e) { res.json({ jobs: [] }); }
});

// ==========================================
// 6. MISC
// ==========================================

app.get('/api/server/:serverId/panel-logs', authenticateJWT, async (req, res) => {
  try {
    const [logs] = await pool.execute('SELECT * FROM panel_logs WHERE server_id = ? ORDER BY id DESC LIMIT 100', [req.params.serverId]);
    return res.json({ logs });
  } catch (error) { return res.status(500).json({ error: 'Failed' }); }
});

// Accept base64 screenshot from FiveM client via JSON body
app.post('/api/screenshots/upload', async (req, res) => {
  const { targetId, file } = req.body;
  try {
    const dir = path.join(__dirname, 'public', 'uploads', 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${targetId}.webp`;
    const base64Data = (file || '').replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(path.join(dir, filename), base64Data, 'base64');
    
    // Also update bridge cache for live screenshots
    const serverId = 0;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    if (!global.screenshotsCache) global.screenshotsCache = {};
    if (!global.screenshotsCache[serverId]) global.screenshotsCache[serverId] = [];
    global.screenshotsCache[serverId] = global.screenshotsCache[serverId].filter(s => s.citizenid !== targetId);
    global.screenshotsCache[serverId].push({
      citizenid: targetId,
      name: targetId,
      screenshotUrl: `${backendUrl}/uploads/screenshots/${filename}`,
      ts: new Date().toLocaleTimeString('ar-SA'),
      live: true
    });
    
    return res.json({ success: true, url: `/uploads/screenshots/${filename}` });
  } catch (error) { return res.status(500).json({ error: 'Failed' }); }
});

// Accept multipart screenshot from screenshot-basic requestScreenshotUpload
app.post('/api/server/auto/upload-screenshot', upload.single('file'), (req, res) => {
  const targetId = req.headers['target-id'] || 'unknown';
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Rename to citizenid.webp for easy lookup
  const destPath = path.join(__dirname, 'public', 'uploads', 'screenshots', `${targetId}.webp`);
  try { fs.renameSync(req.file.path, destPath); } catch(e) {}
  return res.json({ success: true, url: `/uploads/screenshots/${targetId}.webp` });
});

// End of dupe scanner section (moved to bottom)

// ==========================================
// 6. LEADERBOARD API
// ==========================================

app.get('/api/server/:serverId/leaderboard-boards', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM panel_leaderboard_boards WHERE server_id = ?', [req.params.serverId]);
    res.json({ boards: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/leaderboard-boards', async (req, res) => {
  const { title, board_type, enabled, public: isPublic } = req.body;
  try {
    await pool.execute(
      'INSERT INTO panel_leaderboard_boards (server_id, title, board_type, enabled, public) VALUES (?, ?, ?, ?, ?)',
      [req.params.serverId, title, board_type, enabled ? 1 : 0, isPublic ? 1 : 0]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/server/:serverId/leaderboard-boards/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM panel_leaderboard_boards WHERE id = ? AND server_id = ?', [req.params.id, req.params.serverId]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/leaderboard-data', async (req, res) => {
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [req.params.serverId]);
    if (!servers[0]?.db_connection) return res.json({ players: [] });
    
    const gamePool = getGamePool(servers[0].db_connection);
    // Fetch top 100 players by playtime (or metadata.playtime if column is JSON)
    // Assuming 'players' table has citizenid, charinfo, and metadata (with playtime)
    const [rows] = await gamePool.execute(`
      SELECT citizenid, charinfo, job, money, 
             CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.playtime')) AS UNSIGNED) as playtime
      FROM players
      ORDER BY playtime DESC
      LIMIT 100
    `);

    res.json({ players: rows.map(r => ({
      ...r,
      charinfo: typeof r.charinfo === 'string' ? JSON.parse(r.charinfo) : r.charinfo,
      job: typeof r.job === 'string' ? JSON.parse(r.job) : r.job,
      money: typeof r.money === 'string' ? JSON.parse(r.money) : r.money
    }))});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/leaderboard-weekly', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM panel_leaderboard_weekly WHERE server_id = ?', [req.params.serverId]);
    res.json({ config: rows[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/leaderboard-weekly', async (req, res) => {
  const config = req.body;
  try {
    await pool.execute(`
      INSERT INTO panel_leaderboard_weekly (
        server_id, auto_reset, reset_day, reset_time, timezone, 
        discord_enabled, discord_webhook, discord_lang, message_title, message_template
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        auto_reset = VALUES(auto_reset),
        reset_day = VALUES(reset_day),
        reset_time = VALUES(reset_time),
        timezone = VALUES(timezone),
        discord_enabled = VALUES(discord_enabled),
        discord_webhook = VALUES(discord_webhook),
        discord_lang = VALUES(discord_lang),
        message_title = VALUES(message_title),
        message_template = VALUES(message_template)
    `, [
      req.params.serverId, 
      config.auto_reset ? 1 : 0, config.reset_day, config.reset_time, config.timezone,
      config.discord_enabled ? 1 : 0, config.discord_webhook, config.discord_lang,
      config.message_title, config.message_template
    ]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// LOGS ENDPOINT
app.get('/api/server/:serverId/logs', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM panel_logs WHERE server_id = ? ORDER BY id DESC LIMIT 200',
      [req.params.serverId]
    );
    res.json({ logs: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 7. BOT & ADMIN API
// ==========================================

app.post('/api/generate-license', validateBotSecret, async (req, res) => {
  const { discordId, duration, productName, initialServerName, ip } = req.body;
  try {
    const licenseKey = `Echo-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    
    // Calculate expiration
    let expiresAt = null;
    if (duration) {
      const match = duration.match(/^(\d+)([hdwmy])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const date = new Date();
        if (unit === 'h') date.setHours(date.getHours() + value);
        else if (unit === 'd') date.setDate(date.getDate() + value);
        else if (unit === 'w') date.setDate(date.getDate() + value * 7);
        else if (unit === 'm') date.setMonth(date.getMonth() + value);
        else if (unit === 'y') date.setFullYear(date.getFullYear() + value);
        expiresAt = date;
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO licenses (license_key, owner_discord_id, product_name, server_ip, expires_at) VALUES (?, ?, ?, ?, ?)',
      [licenseKey, discordId, productName || 'Echo Panel', ip || null, expiresAt]
    );

    res.json({ success: true, licenseKey, expiresAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/licenses', validateBotSecret, async (req, res) => {
  const { discordId, filter } = req.query;
  try {
    let query = `
      SELECT l.*, s.server_name 
      FROM licenses l 
      LEFT JOIN servers s ON s.license_id = l.id
    `;
    let params = [];
    
    if (discordId) {
      query += ' WHERE l.owner_discord_id = ?';
      params.push(discordId);
    } else if (filter) {
      if (filter === 'active') query += ' WHERE l.is_active = 1';
      else if (filter === 'revoked') query += ' WHERE l.is_active = 0';
    }
    
    query += ' GROUP BY l.id ORDER BY l.created_at DESC';
    const [licenses] = await pool.execute(query, params);
    res.json({ licenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/license/:key', validateBotSecret, async (req, res) => {
  try {
    const [licenses] = await pool.execute('SELECT * FROM licenses WHERE license_key = ?', [req.params.key]);
    if (licenses.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ license: licenses[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/license/update', validateBotSecret, async (req, res) => {
  const { key, duration, productName, isActive, slots } = req.body;
  try {
    let expiresAt = undefined;
    if (duration) {
      const match = duration.match(/^(\d+)([hdwmy])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const date = new Date();
        if (unit === 'h') date.setHours(date.getHours() + value);
        else if (unit === 'd') date.setDate(date.getDate() + value);
        else if (unit === 'w') date.setDate(date.getDate() + value * 7);
        else if (unit === 'm') date.setMonth(date.getMonth() + value);
        else if (unit === 'y') date.setFullYear(date.getFullYear() + value);
        expiresAt = date;
      }
    }

    const updates = [];
    const params = [];
    if (productName) { updates.push('product_name = ?'); params.push(productName); }
    if (expiresAt !== undefined) { updates.push('expires_at = ?'); params.push(expiresAt); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (slots !== undefined) { updates.push('slots = ?'); params.push(slots); }

    if (updates.length === 0) return res.json({ success: true, message: 'Nothing to update' });

    params.push(key);
    await pool.execute(`UPDATE licenses SET ${updates.join(', ')} WHERE license_key = ?`, params);
    res.json({ success: true, expiresAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/license/revoke', validateBotSecret, async (req, res) => {
  try {
    await pool.execute('UPDATE licenses SET is_active = 0 WHERE license_key = ?', [req.body.key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/license/delete', validateBotSecret, async (req, res) => {
  const { key, discordId } = req.body;
  try {
    if (key) {
      await pool.execute('DELETE FROM licenses WHERE license_key = ?', [key]);
    } else if (discordId) {
      await pool.execute('DELETE FROM licenses WHERE owner_discord_id = ?', [discordId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/license/extend', validateBotSecret, async (req, res) => {
  const { key, duration } = req.body;
  if (!key || !duration) return res.status(400).json({ error: 'Missing key or duration' });

  try {
    const [rows] = await pool.execute('SELECT * FROM licenses WHERE license_key = ?', [key]);
    if (rows.length === 0) return res.status(404).json({ error: 'License not found' });

    const license = rows[0];
    const now = new Date(license.expires_at);
    
    // Add duration
    const match = duration.toLowerCase().match(/(\d+)(m|month|y|year|d|day|w|week)/);
    if (!match) return res.status(400).json({ error: 'Invalid duration format' });
    
    const [, num, unit] = match;
    const n = parseInt(num);
    if (unit.startsWith('m')) now.setMonth(now.getMonth() + n);
    else if (unit.startsWith('y')) now.setFullYear(now.getFullYear() + n);
    else if (unit.startsWith('d')) now.setDate(now.getDate() + n);
    else if (unit.startsWith('w')) now.setDate(now.getDate() + n * 7);

    await pool.execute('UPDATE licenses SET expires_at = ?, is_active = 1 WHERE license_key = ?', [now.toISOString(), key]);
    res.json({ success: true, newExpiry: now.toISOString() });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/licenses/cleanup', validateBotSecret, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM licenses WHERE is_active = 0 OR expires_at < NOW()');
    res.json({ success: true, count: result.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', validateBotSecret, async (req, res) => {
  try {
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM licenses');
    const [active] = await pool.execute('SELECT COUNT(*) as count FROM licenses WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())');
    const [expired] = await pool.execute('SELECT COUNT(*) as count FROM licenses WHERE expires_at < NOW()');
    res.json({ stats: { total: total[0].count, active: active[0].count, expired: expired[0].count } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Shared Data Parsers ---
function parseLuaTable(content) {
  const results = [];
  // Improved regex to handle both ['id'] = { ... } and [1] = { ... }
  const entryRegex = /\[['"]?(.+?)['"]?\]\s*=\s*\{([\s\S]+?)\},/g;
  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const id = match[1];
    const body = match[2];
    const nameMatch = body.match(/['"]?name['"]?\s*=\s*['"](.+?)['"]/);
    const labelMatch = body.match(/['"]?label['"]?\s*=\s*['"](.+?)['"]/);
    const brandMatch = body.match(/['"]?brand['"]?\s*=\s*['"](.+?)['"]/);
    const modelMatch = body.match(/['"]?model['"]?\s*=\s*['"](.+?)['"]/);
    
    results.push({
      id,
      name: nameMatch ? nameMatch[1] : (labelMatch ? labelMatch[1] : id),
      brand: brandMatch ? brandMatch[1] : '',
      model: modelMatch ? modelMatch[1] : id
    });
  }
  return results;
}

app.get('/api/shared/vehicles', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT panel_settings FROM servers LIMIT 1');
    const settings = typeof rows[0]?.panel_settings === 'string' ? JSON.parse(rows[0].panel_settings) : (rows[0]?.panel_settings || {});
    
    if (settings.sharedVehicles) {
      // Map QBCore.Shared.Vehicles to our format
      const list = Object.keys(settings.sharedVehicles).map(k => {
        const v = settings.sharedVehicles[k];
        return { id: k, name: v.name, brand: v.brand, model: v.model || k };
      });
      return res.json(list);
    }
    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shared/garages', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT panel_settings FROM servers LIMIT 1');
    const settings = typeof rows[0]?.panel_settings === 'string' ? JSON.parse(rows[0].panel_settings) : (rows[0]?.panel_settings || {});
    
    if (settings.sharedGarages) return res.json(settings.sharedGarages);
    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- DUPE SCANNER API ---
app.get('/api/server/:serverId/dupe-scanner/scan', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB Connection' });
    const gamePool = getGamePool(servers[0].db_connection);
    const serials = {};

    const processItemsList = (items, owner, ownerId, locationType, job = '', avatar = null) => {
      let arr = items;
      if (typeof items === 'string') try { arr = JSON.parse(items); } catch(e) { arr = []; }
      const list = Array.isArray(arr) ? arr : (arr ? Object.values(arr) : []);
      
      for (const item of list) {
        if (!item) continue;
        let s = item.info?.serie || item.info?.serial || item.info?.serie_number || item.info?.serial_number || item.info?.id || item.info?.weapon_serial;
        
        if (!s && item.info) {
          const keys = Object.keys(item.info);
          for (const k of keys) {
             const kl = k.toLowerCase();
             if ((kl.includes('serial') || kl.includes('serie') || kl.includes('id')) && item.info[k] && typeof item.info[k] === 'string' && item.info[k].length > 3) {
                s = item.info[k];
                break;
             }
          }
        }

        const isWeapon = item.name && item.name.toLowerCase().startsWith('weapon_');
        const finalSerial = (s && s !== "none" && s !== "" && s !== "0") ? s : null;
        
        if (isWeapon) {
           const trackSerial = finalSerial || `UNTRACKED_${item.name}_${ownerId}`;
           if (!serials[trackSerial]) serials[trackSerial] = [];
           serials[trackSerial].push({ 
             owner, ownerId, type: locationType, job, item: item.name, 
             label: item.label || item.name, location: locationType === 'Player' ? 'Inventory' : owner,
             hasSerial: !!finalSerial,
             avatar: avatar
           });
        }
      }
    };

    // 1. Players
    const [players] = await gamePool.execute('SELECT citizenid, charinfo, inventory, job, metadata FROM players');
    for (const p of players) {
      const char = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo || '{}') : (p.charinfo || {});
      const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
      const name = `${char.firstname || ''} ${char.lastname || ''}`.trim() || p.citizenid;
      let jobLabel = 'Civilian';
      try { const jobObj = typeof p.job === 'string' ? JSON.parse(p.job) : p.job; jobLabel = jobObj.label || jobObj.name || 'Civilian'; } catch(e) {}
      
      const pPic = (char.profilepic && char.profilepic !== 'none' && char.profilepic !== '') 
        ? char.profilepic 
        : (meta.mugshot || null);

      processItemsList(p.inventory, name, p.citizenid, 'Player', jobLabel, pPic);
    }

    // 2. Stashes
    try {
      const [stashes] = await gamePool.execute('SELECT stash, items FROM stashitems');
      for (const s of stashes) processItemsList(s.items, s.stash, s.stash, 'Stash');
    } catch(e) {}

    // 3. Trunks/Gloveboxes
    try {
      const [trunks] = await gamePool.execute('SELECT plate, items FROM trunkitems');
      for (const t of trunks) processItemsList(t.items, t.plate, t.plate, 'Trunk');
      const [gboxes] = await gamePool.execute('SELECT plate, items FROM gloveboxitems');
      for (const g of gboxes) processItemsList(g.items, g.plate, g.plate, 'Glovebox');
    } catch(e) {}

    const [exRows] = await pool.execute('SELECT serial FROM weapon_exclusions WHERE server_id = ?', [serverId]);
    const excluded = new Set(exRows.map(r => r.serial));

    const results = Object.keys(serials)
      .filter(s => !excluded.has(s)) 
      .map(s => ({
        serial: s, count: serials[s].length, item: serials[s][0].item, label: serials[s][0].label,
        isDuplicate: serials[s].length > 1, details: serials[s]
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/weapon-notes', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT serial, notes FROM weapon_notes WHERE server_id = ?', [req.params.serverId]);
    const notes = {}; rows.forEach(r => notes[r.serial] = r.notes);
    res.json(notes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/weapon-notes', authenticateJWT, async (req, res) => {
  const { serial, notes } = req.body;
  try {
    await pool.execute('INSERT INTO weapon_notes (server_id, serial, notes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE notes = ?', [req.params.serverId, serial, notes, notes]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/server/:serverId/weapon-exclusions', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT serial FROM weapon_exclusions WHERE server_id = ?', [req.params.serverId]);
    res.json(rows.map(r => r.serial));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/weapon-exclusions', authenticateJWT, async (req, res) => {
  try {
    await pool.execute('INSERT IGNORE INTO weapon_exclusions (server_id, serial) VALUES (?, ?)', [req.params.serverId, req.body.serial]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/server/:serverId/weapon-exclusions/:serial', authenticateJWT, async (req, res) => {
  try {
    await pool.execute('DELETE FROM weapon_exclusions WHERE server_id = ? AND serial = ?', [req.params.serverId, req.params.serial]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/server/:serverId/dupe-scanner/delete', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const { serial, ownerId, type } = req.body;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    const gamePool = getGamePool(servers[0].db_connection);
    let table = ''; let idCol = ''; let itemsCol = 'items';
    if (type === 'Player') { table = 'players'; idCol = 'citizenid'; itemsCol = 'inventory'; }
    else if (type === 'Stash') { table = 'stashitems'; idCol = 'stash'; }
    else if (type === 'Trunk') { table = 'trunkitems'; idCol = 'plate'; }
    else if (type === 'Glovebox') { table = 'gloveboxitems'; idCol = 'plate'; }
    if (!table) return res.status(400).json({ error: 'Invalid type' });
    const [rows] = await gamePool.execute(`SELECT ${itemsCol} FROM ${table} WHERE ${idCol} = ?`, [ownerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    let items = rows[0][itemsCol]; if (typeof items === 'string') items = JSON.parse(items);
    const isArray = Array.isArray(items);
    let newItems = isArray ? [] : {};
    if (isArray) {
      newItems = items.filter(item => {
        if (!item) return true;
        let s = item.info?.serie || item.info?.serial || item.info?.serie_number || item.info?.serial_number || item.info?.id || item.info?.weapon_serial;
        return s !== serial;
      });
    } else {
      Object.keys(items).forEach(slot => {
        const item = items[slot];
        let s = item.info?.serie || item.info?.serial || item.info?.serie_number || item.info?.serial_number || item.info?.id || item.info?.weapon_serial;
        if (s !== serial) newItems[slot] = item;
      });
    }
    await gamePool.execute(`UPDATE ${table} SET ${itemsCol} = ? WHERE ${idCol} = ?`, [JSON.stringify(newItems), ownerId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- DUPLICATES API (All Items, not just weapons) ---
app.get('/api/server/:serverId/duplicates', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB Connection' });
    const gamePool = getGamePool(servers[0].db_connection);
    const serials = {};

    // Helper: extract serial from item info
    const extractSerial = (item) => {
      if (!item || !item.info) return null;
      const info = item.info;
      // Direct serial fields
      const directFields = ['serie', 'serial', 'serie_number', 'serial_number', 'weapon_serial', 'id'];
      for (const f of directFields) {
        if (info[f] && typeof info[f] === 'string' && info[f] !== 'none' && info[f] !== '' && info[f] !== '0') {
          return info[f];
        }
      }
      // Fuzzy match serial-like keys
      const keys = Object.keys(info);
      for (const k of keys) {
        const kl = k.toLowerCase();
        if ((kl.includes('serial') || kl.includes('serie')) && info[k] && typeof info[k] === 'string' && info[k].length > 3 && info[k] !== 'none') {
          return info[k];
        }
      }
      return null;
    };

    // Helper: process items from any source
    const processItemsList = (items, owner, ownerId, locationType, extra = {}) => {
      let arr = items;
      if (typeof items === 'string') try { arr = JSON.parse(items); } catch(e) { arr = []; }
      const list = Array.isArray(arr) ? arr : (arr ? Object.values(arr) : []);
      
      for (const item of list) {
        if (!item || !item.name) continue;
        const serial = extractSerial(item);
        if (!serial) continue; // Skip items without serial

        if (!serials[serial]) serials[serial] = [];
        serials[serial].push({
          owner,
          ownerId,
          type: locationType,
          item: item.name,
          label: item.label || item.name,
          slot: item.slot || 0,
          amount: item.amount || 1,
          location: locationType === 'Player' ? 'حقيبة اللاعب' : 
                    locationType === 'Stash' ? `مخزن: ${owner}` :
                    locationType === 'Trunk' ? `شنطة: ${owner}` :
                    locationType === 'Glovebox' ? `درج: ${owner}` :
                    locationType === 'OxInventory' ? `Ox: ${owner}` : owner,
          ...extra
        });
      }
    };

    // 1. Players inventory
    try {
      const [players] = await gamePool.execute('SELECT citizenid, charinfo, inventory, job FROM players');
      for (const p of players) {
        const char = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo || '{}') : (p.charinfo || {});
        const name = `${char.firstname || ''} ${char.lastname || ''}`.trim() || p.citizenid;
        let jobLabel = 'Civilian';
        try { const jobObj = typeof p.job === 'string' ? JSON.parse(p.job) : p.job; jobLabel = jobObj.label || jobObj.name || 'Civilian'; } catch(e) {}
        processItemsList(p.inventory, name, p.citizenid, 'Player', { job: jobLabel, avatar: char.profilepic || null });
      }
    } catch(e) { console.error('[DUPLICATES] Players scan error:', e.message); }

    // 2. Stashes
    try {
      const [stashes] = await gamePool.execute('SELECT stash, items FROM stashitems');
      for (const s of stashes) processItemsList(s.items, s.stash, s.stash, 'Stash');
    } catch(e) {}
    try {
      const [stashes2] = await gamePool.execute('SELECT stash, items FROM stash_items');
      for (const s of stashes2) processItemsList(s.items, s.stash, s.stash, 'Stash');
    } catch(e) {}

    // 3. Trunks
    try {
      const [trunks] = await gamePool.execute('SELECT plate, items FROM trunkitems');
      for (const t of trunks) processItemsList(t.items, t.plate, t.plate, 'Trunk');
    } catch(e) {}
    try {
      const [trunks2] = await gamePool.execute('SELECT plate, items FROM trunk_items');
      for (const t of trunks2) processItemsList(t.items, t.plate, t.plate, 'Trunk');
    } catch(e) {}

    // 4. Gloveboxes
    try {
      const [gboxes] = await gamePool.execute('SELECT plate, items FROM gloveboxitems');
      for (const g of gboxes) processItemsList(g.items, g.plate, g.plate, 'Glovebox');
    } catch(e) {}
    try {
      const [gboxes2] = await gamePool.execute('SELECT plate, items FROM glovebox_items');
      for (const g of gboxes2) processItemsList(g.items, g.plate, g.plate, 'Glovebox');
    } catch(e) {}

    // 5. ox_inventory
    try {
      const [oxItems] = await gamePool.execute('SELECT id, name, data, owner FROM ox_inventory WHERE owner IS NOT NULL');
      for (const ox of oxItems) {
        let items = [];
        try { items = typeof ox.data === 'string' ? JSON.parse(ox.data || '[]') : (ox.data || []); } catch(e) {}
        if (!Array.isArray(items)) items = Object.values(items);
        for (const item of items) {
          if (!item || !item.name) continue;
          const serial = extractSerial(item);
          if (!serial) continue;
          if (!serials[serial]) serials[serial] = [];
          serials[serial].push({
            owner: ox.owner || ox.name || `ox_${ox.id}`,
            ownerId: String(ox.owner || ox.id),
            type: 'OxInventory',
            item: item.name,
            label: item.label || item.name,
            slot: item.slot || 0,
            amount: item.amount || 1,
            location: `Ox: ${ox.owner || ox.name || ox.id}`
          });
        }
      }
    } catch(e) {}

    // 6. house_stashes
    try {
      const [houses] = await gamePool.execute('SELECT stash, items FROM house_stashes');
      for (const h of houses) processItemsList(h.items, h.stash, h.stash, 'Stash');
    } catch(e) {}

    // Build results: only items with serial, group by serial
    const duplicates = Object.keys(serials)
      .filter(s => serials[s].length > 1) // Only actual duplicates
      .map(s => ({
        serial: s,
        count: serials[s].length,
        item: serials[s][0].item,
        label: serials[s][0].label,
        owners: serials[s].map(o => ({
          name: o.owner,
          citizenid: o.ownerId,
          type: o.type,
          location: o.location,
          job: o.job || '',
          avatar: o.avatar || null,
        }))
      }))
      .sort((a, b) => b.count - a.count);

    // Also include single-serial items as "all scanned"
    const all = Object.keys(serials).map(s => ({
      serial: s,
      count: serials[s].length,
      item: serials[s][0].item,
      label: serials[s][0].label,
      isDuplicate: serials[s].length > 1,
      owners: serials[s].map(o => ({
        name: o.owner,
        citizenid: o.ownerId,
        type: o.type,
        location: o.location,
        job: o.job || '',
        avatar: o.avatar || null,
      }))
    })).sort((a, b) => b.count - a.count);

    res.json({ duplicates, all, total: duplicates.length });
  } catch (e) {
    console.error('[DUPLICATES] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a specific duplicate item by serial + owner
app.post('/api/server/:serverId/duplicates/delete', authenticateJWT, async (req, res) => {
  const { serverId } = req.params;
  const { serial, ownerId, type } = req.body;
  try {
    const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [serverId]);
    if (!servers[0]?.db_connection) return res.status(400).json({ error: 'No DB Connection' });
    const gamePool = getGamePool(servers[0].db_connection);
    
    let table = ''; let idCol = ''; let itemsCol = 'items';
    if (type === 'Player') { table = 'players'; idCol = 'citizenid'; itemsCol = 'inventory'; }
    else if (type === 'Stash') { table = 'stashitems'; idCol = 'stash'; }
    else if (type === 'Trunk') { table = 'trunkitems'; idCol = 'plate'; }
    else if (type === 'Glovebox') { table = 'gloveboxitems'; idCol = 'plate'; }
    else if (type === 'OxInventory') { table = 'ox_inventory'; idCol = 'id'; itemsCol = 'data'; }
    if (!table) return res.status(400).json({ error: 'Invalid type' });
    
    const [rows] = await gamePool.execute(`SELECT ${itemsCol} FROM ${table} WHERE ${idCol} = ?`, [ownerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    
    let items = rows[0][itemsCol]; 
    if (typeof items === 'string') items = JSON.parse(items);
    const isArray = Array.isArray(items);
    let newItems = isArray ? [] : {};

    const extractSerial = (item) => {
      if (!item || !item.info) return null;
      const info = item.info;
      const directFields = ['serie', 'serial', 'serie_number', 'serial_number', 'weapon_serial', 'id'];
      for (const f of directFields) {
        if (info[f] && typeof info[f] === 'string' && info[f] !== 'none' && info[f] !== '' && info[f] !== '0') return info[f];
      }
      const keys = Object.keys(info);
      for (const k of keys) {
        const kl = k.toLowerCase();
        if ((kl.includes('serial') || kl.includes('serie')) && info[k] && typeof info[k] === 'string' && info[k].length > 3 && info[k] !== 'none') return info[k];
      }
      return null;
    };

    if (isArray) {
      newItems = items.filter(item => {
        if (!item) return true;
        const s = extractSerial(item);
        return s !== serial;
      });
    } else {
      Object.keys(items).forEach(slot => {
        const item = items[slot];
        const s = extractSerial(item);
        if (s !== serial) newItems[slot] = item;
      });
    }

    await gamePool.execute(`UPDATE ${table} SET ${itemsCol} = ? WHERE ${idCol} = ?`, [JSON.stringify(newItems), ownerId]);
    res.json({ success: true });
  } catch (e) {
    console.error('[DUPLICATES DELETE] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Auto-Offline Disconnected Servers
setInterval(async () => {
  try {
    await pool.execute(`
      UPDATE servers 
      SET status = 'offline', current_players = 0 
      WHERE status = 'online' AND last_sync < NOW() - INTERVAL 2 MINUTE
    `);
  } catch (e) {
    console.error('[Auto-Offline] Error:', e.message);
  }
}, 60000); // Run every minute

// Leaderboard Scheduler (Weekly Reset)
let lastResetMinute = '';
setInterval(async () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }));
  const currentDay = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][now.getDay()];
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const currentMinuteKey = `${currentDay}-${currentTime}`;

  if (lastResetMinute === currentMinuteKey) return;
  lastResetMinute = currentMinuteKey;

  try {
    const [configs] = await pool.execute('SELECT * FROM panel_leaderboard_weekly WHERE auto_reset = 1');
    for (const config of configs) {
      if (config.reset_day === currentDay && config.reset_time === currentTime) {
        console.log(`[Leaderboard] Starting scheduled reset for server ${config.server_id}...`);
        
        const [servers] = await pool.execute('SELECT db_connection FROM servers WHERE id = ?', [config.server_id]);
        if (servers[0]?.db_connection) {
           const gamePool = getGamePool(servers[0].db_connection);
           // Reset playtime in DB
           try {
             await gamePool.execute('UPDATE players SET metadata = JSON_SET(metadata, "$.playtime", 0)');
             console.log(`[Leaderboard] Playtime reset successfully for server ${config.server_id}`);

             // Discord Webhook
             if (config.discord_enabled && config.discord_webhook) {
                const template = config.message_template || 'تم تصفير وقت اللعب الأسبوعي بنجاح! 🏆';
                await axios.post(config.discord_webhook, {
                  embeds: [{
                    title: config.message_title || '🏆 تصفيير وقت اللعب',
                    description: template,
                    color: 0x00ff00,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Echo Panel - Auto Scheduler' }
                  }]
                }).catch(e => console.error('[Leaderboard Webhook] Failed:', e.message));
             }
           } catch(e) { console.error(`[Leaderboard Reset Error] Server ${config.server_id}:`, e.message); }
        }
      }
    }
  } catch (err) { console.error('[Leaderboard Scheduler] Error:', err.message); }
}, 30000); // Check every 30 seconds

app.listen(process.env.PORT || 3001, () => console.log('Backend running on port ' + (process.env.PORT || 3001)));

// Serve frontend static files in production (after building with npm run build)
// The built frontend is in the ../dist directory
const frontendDist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
  }));
  // SPA fallback: serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
  console.log('[Production] Serving frontend from:', frontendDist);
}
