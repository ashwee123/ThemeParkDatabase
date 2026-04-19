const fs = require("fs");
const http = require("http");
const path = require("path");
const { parse: parseUrl, pathToFileURL } = require("url");
const db = require("./db");
const { generateToken } = require("./auth");

const PORT = process.env.PORT || 4000;

/** Lazy-load ESM admin API so Vercel static admin UI can call this Render service at /api/*. */
let adminApiLoad;
function loadAdminApi() {
  if (!adminApiLoad) {
    const adminModulePath = path.join(__dirname, "..", "adminBackend", "admin-api.js");
    if (!fs.existsSync(adminModulePath)) {
      adminApiLoad = Promise.reject(
        new Error(
          `admin-api.js not found at ${adminModulePath}. ` +
            `Set Render Root Directory to the repo (or "backend") so both homepageBackend and adminBackend deploy.`
        )
      );
      return adminApiLoad;
    }
    adminApiLoad = import(pathToFileURL(adminModulePath).href);
  }
  return adminApiLoad;
}

// Helper: read request body safely
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => resolve(body));

    req.on("error", err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = parseUrl(req.url, true);
  const pathname = parsedUrl.pathname || "/";

  // Admin portal JSON API (same DB as login service)
  if (pathname.startsWith("/api")) {
    try {
      const { handleAdminApi } = await loadAdminApi();
      const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      await handleAdminApi(req, res, u);
    } catch (err) {
      console.error("Admin API error:", err);
      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ error: "Admin API failed", detail: String(err && err.message) }));
      }
    }
    return;
  }

  // ✅ CORS (required for Render + frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ======================
    // HEALTH CHECK (Render)
    // ======================
    if (pathname === "/") {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: "OK" }));
    }

    if (pathname === "/health") {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: "healthy" }));
    }

    // ======================
    // LOGIN ROUTE
    // ======================
    if (pathname === "/login" && req.method === "POST") {
      const body = await getBody(req);
      const { email, password } = JSON.parse(body || "{}");

      if (!email || !password) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Missing email or password" }));
      }

      const [rows] = await db.query(
        "SELECT * FROM users WHERE Email = ?",
        [email]
      );

      if (!rows.length) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "No user found" }));
      }

      const user = rows[0];

      if (user.Password !== password) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "Wrong password" }));
      }

      // optional JWT
      const token = generateToken(user);

      res.writeHead(200);
      return res.end(
        JSON.stringify({
          message: "LOGIN SUCCESS",
          token
        })
      );
    }

    // ======================
    // 404 ROUTE
    // ======================
    res.writeHead(404);
    return res.end(JSON.stringify({ error: "Route not found" }));

  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500);
    return res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  loadAdminApi()
    .then(() => console.log("[admin] API module preloaded OK"))
    .catch((e) => console.error("[admin] API module preload failed:", e && e.message, e && e.stack));
});