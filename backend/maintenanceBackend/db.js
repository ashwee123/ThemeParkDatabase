// maintenanceBackend/db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MAINTENANCE_DB_HOST,
  user: process.env.MAINTENANCE_DB_USER,
  password: process.env.MAINTENANCE_DB_PASS,
  database: process.env.MAINTENANCE_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;