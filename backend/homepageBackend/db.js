const mysql = require("mysql2/promise");
const fs = require("fs");

const conn = mysql.createPool({
  host: process.env.DB_HOST || "themepark6.mysql.database.azure.com",
  user: process.env.DB_USER || "admin1",
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || "newthemepark",
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = conn;