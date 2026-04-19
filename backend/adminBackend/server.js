import "dotenv/config";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { handleAdminApi } from "./admin-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3002;

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

function sendError(res, status, message) {
  if (res.headersSent) return;
  const body = JSON.stringify({ error: message });
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function serveStatic(res, urlPath) {
  if (res.headersSent) return;
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
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(data);
  } catch {
    if (!res.headersSent) res.writeHead(404).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname.startsWith("/api")) {
      await handleAdminApi(req, res, url);
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (err) {
    console.error("server.js:", err);
    sendError(res, 500, "Internal server error");
  }
});

server.listen(PORT, () => {
  console.log(`Admin portal: http://localhost:${PORT}/`);
  console.log(`Start with:   npm start`);
});
