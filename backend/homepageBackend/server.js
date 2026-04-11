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
        try {
          const { email, password } = JSON.parse(body);

          console.log("EMAIL RECEIVED:", email);
          console.log("PASSWORD RECEIVED:", password);

          const [rows] = await db.query(
            "SELECT * FROM users WHERE Email = ?",
            [email]
          );

          console.log("DB ROWS:", rows);

          if (!rows.length) {
            res.writeHead(401);
            return res.end(JSON.stringify({ error: "No user found" }));
          }

          if (rows[0].Password !== password) {
            res.writeHead(401);
            return res.end(JSON.stringify({ error: "Wrong password" }));
          }

          res.writeHead(200);
          return res.end(JSON.stringify({ message: "LOGIN SUCCESS" }));

        } catch (err) {
          console.error(err);
          res.writeHead(500);
          return res.end(JSON.stringify({ error: "Server error" }));
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