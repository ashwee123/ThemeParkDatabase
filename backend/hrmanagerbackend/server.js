import "dotenv/config";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2";
import { handleApi } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public/frontend");
const PORT = Number(process.env.PORT) || 3001;

/* ================= DB ================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "uma1uma2uma!",
  database: process.env.DB_NAME || "newthemepark"
});

/* ================= MIME ================= */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

/* ================= HELPERS ================= */

// Read JSON body (IMPORTANT for login)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// CORS (needed for frontend)
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Secure static path
function safePublicPath(urlPath) {
  let raw;
  try {
    raw = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  let p = raw;
  if (p === "/" || p === "") p = "/index.html";
  const rel = p.replace(/^[/\\]+/, "");
  if (!rel || rel.includes("\0")) return null;
  const resolvedRoot = path.resolve(PUBLIC_DIR);
  const full = path.resolve(path.join(PUBLIC_DIR, rel));
  const relFromRoot = path.relative(resolvedRoot, full);
  if (relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) return null;
  return full;
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function serveStatic(res, urlPath) {
  const full = safePublicPath(urlPath);
  if (!full) {
    res.writeHead(403).end();
    return;
  }

  try {
    const stat = await fs.stat(full);
    const filePath = stat.isDirectory() ? path.join(full, "index.html") : full;
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

/* ================= SERVER ================= */

const server = http.createServer(async (req, res) => {
  try {
    setCORS(res);

    // Handle preflight (CORS)
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const pathOnly = url.pathname;

    /* ================= LOGIN ROUTE ================= */
    if (pathOnly === "/login" && req.method === "POST") {
      const body = await readBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJSON(res, 400, { error: "Missing email or password" });
      }

      const sql = `
        SELECT * FROM Users 
        WHERE email = ? AND password = ?
      `;

      db.query(sql, [email, password], (err, results) => {
        if (err) {
          console.error(err);
          return sendJSON(res, 500, { error: "DB error" });
        }

        if (results.length === 0) {
          return sendJSON(res, 401, { error: "Invalid credentials" });
        }

        const user = results[0];

        return sendJSON(res, 200, {
          message: "Login successful",
          role: user.role
        });
      });

      return;
    }

    /* ================= EXISTING API ================= */
    const apiPrefixes = [
      "/managers",
      "/employees",
      "/assign-manager",
      "/maintenance",
      "/performance",
      "/report",
    ];

    const looksLikeApi =
      apiPrefixes.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));

    if (looksLikeApi) {
      const handled = await handleApi(req, res, url);
      if (handled) return;

      return sendJSON(res, 404, { error: "Not found", path: pathOnly });
    }

    /* ================= STATIC FILES ================= */
    await serveStatic(res, pathOnly);

  } catch (err) {
    console.error("server.js:", err);
    sendJSON(res, 500, { error: "Internal server error" });
  }
});

/* ================= START ================= */
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
