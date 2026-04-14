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
  const host = process.env.MYSQL_HOST || "localhost";
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD ?? "";
  const database = process.env.MYSQL_DATABASE || "newthemepark";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const ssl = sslOption();

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    ...(ssl ? { ssl } : {}),
  });
  return pool;
}

export async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}
