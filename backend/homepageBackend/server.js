const http = require("http");
const url = require("url");
const db = require("./db");
const { generateToken } = require("./auth");

const PORT = process.env.PORT || 4000;

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
  // ✅ CORS (required for Render + frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

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
});