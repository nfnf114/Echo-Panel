const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugStashes() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ipxv3'
  });

  try {
    const [stashes] = await connection.execute('SELECT stash, items FROM stashitems');
    console.log(`Checking ${stashes.length} stashes...`);
    for (const s of stashes) {
      if (!s.items) continue;
      const inv = JSON.parse(s.items);
      const list = Array.isArray(inv) ? inv : Object.values(inv);
      for (const item of list) {
        if (item && item.name && item.name.toLowerCase().startsWith('weapon_')) {
          console.log(`\n[Stash ${s.stash}] Found Weapon: ${item.name}`);
          console.log('Info Content:', JSON.stringify(item.info));
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
}

debugStashes();
