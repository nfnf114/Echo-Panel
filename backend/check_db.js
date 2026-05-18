const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const pool = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'echo_panel'
  });

  try {
    const [rows] = await pool.execute('SELECT db_connection FROM servers WHERE id = 1');
    if (rows[0]?.db_connection) {
        const connStr = rows[0].db_connection;
        const gameDbName = connStr.split('/').pop().split('?')[0];
        const gamePool = await mysql.createConnection({
            host: 'localhost', user: 'root', password: '', database: gameDbName
        });
        
        console.log('--- ULTIMATE DISCOVERY TEST ---');
        const [columns] = await gamePool.execute(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME IN ('stash', 'plate', 'house', 'citizenid', 'cid', 'id')
            AND TABLE_NAME IN (
                SELECT DISTINCT TABLE_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE COLUMN_NAME IN ('items', 'data', 'inventory', 'inventory_data')
            )
            AND TABLE_SCHEMA = '${gameDbName}'
        `);

        for (const col of columns) {
            const [data] = await gamePool.execute(`SELECT DISTINCT ${col.COLUMN_NAME} as id FROM ${col.TABLE_NAME} LIMIT 10`);
            console.log(`Table: ${col.TABLE_NAME} | Column: ${col.COLUMN_NAME} | Found IDs:`, data.map(d => d.id));
        }
    }
  } catch (e) { console.error('Error:', e.message); }
  finally { process.exit(); }
}
check();
