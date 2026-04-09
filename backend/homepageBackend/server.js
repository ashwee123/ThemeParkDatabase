// backend/server.js
const http = require("http");
const url = require("url");
const db = require("./db");
const { generateToken, verifyToken } = require("./auth");

const server = http.createServer(async (req, res) => {
  // CORS & OPTIONS logic here
  // Example login route:
  if (req.url === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      const { email, password } = JSON.parse(body);
      const [rows] = await db.query("SELECT * FROM users WHERE Email = ?", [email]);
      if (rows.length && rows[0].Password === password) {
        const token = generateToken({ id: rows[0].UserID, role: rows[0].Role });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token }));
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "Invalid credentials" }));
      }
    });
  }
});

server.listen(process.env.PORT || 4000, () => console.log("Homepage server running"));