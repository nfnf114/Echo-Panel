const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../panel.db'))

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    is_owner INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    discord_id TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    server_ip TEXT NOT NULL,
    server_name TEXT,
    plan TEXT DEFAULT 'Premium',
    expires_at TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    name TEXT DEFAULT 'My Server',
    db_host TEXT,
    db_port INTEGER DEFAULT 3306,
    db_user TEXT,
    db_password TEXT,
    db_name TEXT,
    fivem_token TEXT,
    last_ping TEXT,
    online INTEGER DEFAULT 0,
    online_cache TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (license_key) REFERENCES licenses(key)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER,
    admin_discord_id TEXT,
    admin_username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pending_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    command_type TEXT NOT NULL,
    target TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS teleport_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    z REAL NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS server_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (server_id) REFERENCES servers(id)
  );

  CREATE TABLE IF NOT EXISTS server_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    discord_id TEXT NOT NULL,
    rank_id INTEGER NOT NULL,
    added_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (server_id) REFERENCES servers(id),
    FOREIGN KEY (rank_id) REFERENCES server_ranks(id)
  );
`)

// Handle schema migrations for existing DB
try {
  db.exec(`ALTER TABLE licenses ADD COLUMN server_name TEXT;`)
} catch (e) {}
try {
  db.exec(`ALTER TABLE servers ADD COLUMN online_cache TEXT;`)
} catch (e) {}
try {
  db.exec(`ALTER TABLE servers ADD COLUMN server_data TEXT;`)
} catch (e) {}

// Create server_webhooks table if it doesn't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      webhooks TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );
  `)
} catch (e) {}

module.exports = db
