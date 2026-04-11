import "dotenv/config";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  createIncidentReport,
  getEmployee,
  getMaintenanceAssignments,
  getPerformance,
  getShifts,
  getTimelog,
  listEmployees,
} from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const API_PREFIX = "/api";
const PORT = Number(process.env.PORT || 3000);

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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {number} limit
 */
async function readJsonBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const err = new Error("Payload too large");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {unknown} data
 * @param {Record<string, string>} [extra]
 */
function sendJson(res, status, data, extra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extra,
  });
  res.end(body);
}

/**
 * @param {string} pathname
 * @returns {string[] | null}
 */
function apiSegments(pathname) {
  if (pathname === API_PREFIX) return [];
  if (!pathname.startsWith(`${API_PREFIX}/`)) return null;
  return pathname.slice(API_PREFIX.length + 1).split("/").filter(Boolean);
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {string} pathname
 * @returns {Promise<boolean>} true if handled
 */
async function handleApi(req, res, pathname) {
  const segs = apiSegments(pathname);
  if (segs === null) return false;

  const cors = corsHeaders();

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return true;
  }

  const jsonHeaders = { ...cors };

  try {
    if (req.method === "GET" && segs.length === 1 && segs[0] === "employees") {
      const list = await listEmployees();
      sendJson(res, 200, list, jsonHeaders);
      return true;
    }

    if (req.method === "GET" && segs.length === 2 && segs[0] === "employees" && /^\d+$/.test(segs[1])) {
      const id = parseInt(segs[1], 10);
      const emp = await getEmployee(id);
      if (!emp) {
        sendJson(res, 404, { error: "Employee not found" }, jsonHeaders);
        return true;
      }
      sendJson(res, 200, emp, jsonHeaders);
      return true;
    }

    if (req.method === "GET" && segs.length === 3 && segs[0] === "employees" && /^\d+$/.test(segs[1])) {
      const id = parseInt(segs[1], 10);
      const sub = segs[2];
      if (sub === "shifts") {
        sendJson(res, 200, await getShifts(id), jsonHeaders);
        return true;
      }
      if (sub === "timelog") {
        sendJson(res, 200, await getTimelog(id), jsonHeaders);
        return true;
      }
      if (sub === "performance") {
        sendJson(res, 200, await getPerformance(id), jsonHeaders);
        return true;
      }
      if (sub === "maintenance-assignments") {
        sendJson(res, 200, await getMaintenanceAssignments(id), jsonHeaders);
        return true;
      }
    }

    if (req.method === "POST" && segs.length === 1 && segs[0] === "incident-reports") {
      const body = await readJsonBody(req);
      const out = await createIncidentReport(body);
      sendJson(res, 201, out, jsonHeaders);
      return true;
    }

    sendJson(res, 404, { error: "Not found" }, jsonHeaders);
    return true;
  } catch (e) {
    const status = e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    const message = status === 500 ? "Internal server error" : e.message;
    if (status === 500) console.error(e);
    sendJson(res, status, { error: message }, jsonHeaders);
    return true;
  }
}

function safePublicPath(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p === "/" || p === "") p = "/index.html";
  const normalized = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..")) return null;
  const full = path.join(PUBLIC_DIR, normalized);
  if (!full.startsWith(PUBLIC_DIR)) return null;
  return full;
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
async function handleStatic(req, res, urlPath) {
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
    res.writeHead(404).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname.startsWith(API_PREFIX)) {
    const handled = await handleApi(req, res, pathname);
    if (handled) return;
  }

  await handleStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Employee portal: http://localhost:${PORT}/`);
  console.log(`API base:        http://localhost:${PORT}${API_PREFIX}`);
});
