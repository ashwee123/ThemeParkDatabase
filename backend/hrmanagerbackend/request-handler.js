import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getPool } from "./db.js";
import { handleApi } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public/frontend");

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
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

export function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

/**
 * Vercel rewrites send `?orig=/employees/1`; merge other query params into the logical URL for handleApi.
 */
export function buildLogicalUrl(req) {
  const host = req.headers.host || "localhost";
  const incoming = new URL(req.url || "/", `http://${host}`);
  const orig = incoming.searchParams.get("orig");
  if (!orig || !orig.startsWith("/")) {
    return incoming;
  }
  const q = orig.indexOf("?");
  const pathOnly = q === -1 ? orig : orig.slice(0, q);
  const qsFromOrig = q === -1 ? "" : orig.slice(q + 1);
  const logical = new URL(pathOnly + (qsFromOrig ? `?${qsFromOrig}` : ""), `http://${host}`);
  for (const [k, v] of incoming.searchParams) {
    if (k === "orig") continue;
    logical.searchParams.set(k, v);
  }
  return logical;
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {{ vercel?: boolean }} [opts]
 */
export async function handleRequest(req, res, opts = {}) {
  try {
    setCORS(res);

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    const host = req.headers.host || "localhost";
    const incoming = new URL(req.url || "/", `http://${host}`);
    const url = opts.vercel ? buildLogicalUrl(req) : incoming;
    const pathOnly = url.pathname;

    if (pathOnly === "/login" && req.method === "POST") {
      const body = await readBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJSON(res, 400, { error: "Missing email or password" });
      }

      try {
        const pool = getPool();
        const [results] = await pool.execute(
          "SELECT * FROM Users WHERE email = ? AND password = ?",
          [email, password]
        );

        if (!results.length) {
          return sendJSON(res, 401, { error: "Invalid credentials" });
        }

        const user = results[0];
        return sendJSON(res, 200, {
          message: "Login successful",
          role: user.role,
        });
      } catch (err) {
        console.error(err);
        return sendJSON(res, 500, { error: "DB error" });
      }
    }

    const apiPrefixes = [
      "/managers",
      "/employees",
      "/assign-manager",
      "/maintenance",
      "/performance",
      "/report",
    ];

    const looksLikeApi = apiPrefixes.some(
      (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
    );

    if (looksLikeApi) {
      const handled = await handleApi(req, res, url);
      if (handled) return;

      return sendJSON(res, 404, { error: "Not found", path: pathOnly });
    }

    if (pathOnly === "/" && req.method === "GET" && !opts.vercel) {
      res.writeHead(302, { Location: "/login.html" });
      return res.end();
    }

    await serveStatic(res, pathOnly);
  } catch (err) {
    console.error("handleRequest:", err);
    const body = JSON.stringify({ error: "Internal server error" });
    res.writeHead(500, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  }
}
