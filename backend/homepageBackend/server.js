const http = require("http");
const url = require("url");
const db = require("./db");
const { generateToken } = require("./auth");

const server = http.createServer(async (req, res) => {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  try {
    if (req.url === "/login" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk.toString());

      req.on("end", async () => {
        const { email, password } = JSON.parse(body);

        const [rows] = await db.query(
          "SELECT * FROM users WHERE Email = ?",
          [email]
        );

        if (rows.length && rows[0].Password === password) {
          const token = generateToken({
            id: rows[0].UserID,
            role: rows[0].Role
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ token }));
        } else {
          res.writeHead(401);
          return res.end(JSON.stringify({ error: "Invalid credentials" }));
        }
      });
    }

    else {
      res.writeHead(404);
      res.end("Route not found");
    }

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Homepage server running on port " + PORT));