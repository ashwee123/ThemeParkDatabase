const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Load local .env file (no external deps) for easier local runs.
// Expected path: backend/visitorbackend/.env
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key && process.env[key] == null) process.env[key] = val;
    }
  }
} catch {
  // If .env can't be read, fallback to defaults/env vars already set.
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  // Default to 3307 since your MySQL port changed.
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "newthemepark",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

