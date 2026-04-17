import mysql from "mysql2/promise";

function sslOption() {
  const v = String(process.env.MYSQL_SSL || "").toLowerCase();
  if (v === "1" || v === "true") return { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" };
  if (v === "azure" || v === "required") return { rejectUnauthorized: false };
  return undefined;
}

let pool;

export function getPool() {
  if (pool) return pool;
  const ssl = sslOption();
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "themepark6.mysql.database.azure.com",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "newthemepark",
    waitForConnections: true,
    connectionLimit: 10,
    ...(ssl ? { ssl } : {}),
  });
  return pool;
}
