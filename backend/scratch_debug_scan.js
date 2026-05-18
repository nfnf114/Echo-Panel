const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugScan() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ipxv3'
  });

  try {
    const [players] = await connection.execute('SELECT citizenid, inventory FROM players');
    console.log(`Checking ${players.length} players...`);
    for (const p of players) {
      if (!p.inventory) continue;
      const inv = JSON.parse(p.inventory);
      const list = Array.isArray(inv) ? inv : Object.values(inv);
      for (const item of list) {
        if (item && item.name && item.name.toLowerCase().startsWith('weapon_')) {
          console.log(`\n[Player ${p.citizenid}] Found Weapon: ${item.name}`);
          console.log('Item Keys:', Object.keys(item));
          console.log('Info Keys:', item.info ? Object.keys(item.info) : 'No Info');
          if (item.info) console.log('Info Content:', JSON.stringify(item.info));
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
}

debugScan();
