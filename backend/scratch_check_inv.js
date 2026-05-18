const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkInv() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ipxv3'
  });

  try {
    const [rows] = await connection.execute('SELECT citizenid, charinfo, inventory FROM players');
    console.log(`Scanning ${rows.length} players...`);
    
    for (const p of rows) {
      if (!p.charinfo || !p.inventory) continue;
      const char = JSON.parse(p.charinfo);
      if (char.firstname === 'Saeda' || char.lastname === 'Abda' || p.inventory.includes('compactrifle')) {
        console.log(`\nFound target player: ${char.firstname} ${char.lastname} (${p.citizenid})`);
        
        const inv = JSON.parse(p.inventory);
        const list = Array.isArray(inv) ? inv : Object.values(inv);
        for (const item of list) {
          if (item && item.name && item.name.includes('rifle')) {
            console.log('Found Rifle Item:', JSON.stringify(item, null, 2));
          }
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
}

checkInv();
