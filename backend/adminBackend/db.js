import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Render often runs `npm install` only in homepageBackend, so `mysql2` lives in
 * ../homepageBackend/node_modules — not visible to normal resolution from this folder.
 * Load from adminBackend first, then fall back to sibling homepageBackend.
 */
function loadMysqlPromise() {
  const adminPkg = path.join(__dirname, "package.json");
  const hbPkg = path.join(__dirname, "..", "homepageBackend", "package.json");
  try {
    return createRequire(adminPkg)("mysql2/promise");
  } catch (e1) {
    try {
      return createRequire(hbPkg)("mysql2/promise");
    } catch (e2) {
      const msg = `mysql2 not resolvable from adminBackend or homepageBackend. ` +
        `Admin: ${e1 && e1.message}; Homepage: ${e2 && e2.message}`;
      throw new Error(msg);
    }
  }
}

const mysql = loadMysqlPromise();

/** Match homepageBackend/db.js (Render) and local MYSQL_* overrides. */
function sslOption() {
  const host = String(process.env.DB_HOST || process.env.MYSQL_HOST || "").toLowerCase();
  if (host.includes("azure") || host.includes("mysql.database")) {
    return { rejectUnauthorized: true };
  }
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
  const host = process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1";
  const ssl = sslOption();
  pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
    user: process.env.MYSQL_USER || process.env.DB_USER || "root",
    password: process.env.MYSQL_PASSWORD ?? process.env.DB_PASS ?? "",
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "newthemepark",
    waitForConnections: true,
    connectionLimit: 10,
    ...(ssl ? { ssl } : {}),
  });
  return pool;
}
