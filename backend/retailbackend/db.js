const mysql = require("mysql2");

const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
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
