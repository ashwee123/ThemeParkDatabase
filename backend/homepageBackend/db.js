const mysql = require("mysql2/promise");
const fs = require("fs");

const conn = mysql.createPool({
  host: process.env.DB_HOST || "themepark6.mysql.database.azure.com",
  user: process.env.DB_USER || "admin1",
  password: process.env.DB_PASSWORD || "uma1uma2uma!",
  database: process.env.DB_NAME || "newthemepark",
  port: process.env.DB_PORT || 3306,
  ssl: {
    ca: fs.readFileSync(process.env.SSL_CA || "./cacert.pem")
  },
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = conn;