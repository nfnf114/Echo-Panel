const mysql = require('mysql2/promise');
require('dotenv').config();

async function findDB() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'echo_panel'
  });

  try {
    const [rows] = await connection.execute('SELECT db_connection FROM servers');
    console.log('DB Connections:', rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
}

findDB();
