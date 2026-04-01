const mysql = require("mysql2");

const db = mysql.createConnection({
    host:     "themepark6.mysql.database.azure.com",
    port:     3306,
    user:     "admin1",
    password: "uma1uma2uma!",
    database: "newthemepark",
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("Connected to database successfully");
});

module.exports = db;