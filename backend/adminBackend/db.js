import mysql from "mysql2/promise";

function sslOption() {
  const v = String(process.env.MYSQL_SSL || "").toLowerCase();
  if (v === "true" || v === "1") {
    return { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" };
  }
  if (v === "azure" || v === "required") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

let pool;

export function getPool() {
  if (pool) return pool;
  const ssl = sslOption();
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE || "newthemepark",
    waitForConnections: true,
    connectionLimit: 10,
    ...(ssl ? { ssl } : {}),
  });
  return pool;
}
