const mysql = require("mysql2");

// Use environment variables on Render (IMPORTANT)
const conn = mysql.createConnection({
  host: process.env.DB_HOST || "themepark6.mysql.database.azure.com",
  user: process.env.DB_USER || "admin1",
  password: process.env.DB_PASSWORD || "uma1uma2uma!",
  database: process.env.DB_NAME || "newthemepark",
  port: process.env.DB_PORT || 3306,

  ssl: {
    // Equivalent to your PHP $ssl_ca
    ca: require("fs").readFileSync(
      process.env.SSL_CA || "./cacert.pem"
    )
  }
});

// Connect to DB
conn.connect((err) => {
  if (err) {
    console.error("❌ Connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL (SSL enabled)");
  }
});

module.exports = conn;