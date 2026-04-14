// maintenanceBackend/server.js
const http = require("http");
const url = require("url");
const db = require("./db");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;

// =========================
// HELPERS
// =========================

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { resolve({}); }
    });
  });
}

// =========================
// SERVER
// =========================

const server = http.createServer(async (req, res) => {
  console.log("REQUEST:", req.method, req.url);

  const parsedUrl = url.parse(req.url, true);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  try {

    // =========================
    // LOGIN (🔴 FIXED - MUST BE HERE)
    // =========================
    if (parsedUrl.pathname === "/login" && req.method === "POST") {
      const body = await getBody(req);
      const { email, password } = body;

      if (email === "maintenance@nightmarenexus.com" && password === "1234") {
        const token = jwt.sign({ email, role: "maintenance" }, SECRET, {
          expiresIn: "1h"
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          message: "LOGIN SUCCESS",
          token
        }));
      }

      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid login" }));
    }

    // =========================
    // ROOT
    // =========================
    if (parsedUrl.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        service: "maintenanceBackend",
        status: "OK"
      }));
    }

    // =========================
    // TASKS (PROTECTED)
    // =========================
    if (parsedUrl.pathname === "/tasks" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) {
        res.writeHead(401);
        return res.end("Unauthorized");
      }

      const [rows] = await db.query(`
        SELECT 
          m.MaintenanceAssignmentID, 
          e.Name AS EmployeeName, 
          a.AreaName, 
          m.TaskDescription, 
          m.Status, 
          m.DueDate 
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area a ON m.AreaID = a.AreaID
        ORDER BY m.CreatedAt DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // ADD TASK
    // =========================
    if (parsedUrl.pathname === "/addTask" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
        VALUES (?, ?, ?, ?, ?)
      `, [
        body.EmployeeID,
        body.AreaID,
        body.TaskDescription,
        body.Status || "Pending",
        body.DueDate
      ]);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Task added" }));
    }

    // =========================
    // UPDATE TASK
    // =========================
    if (parsedUrl.pathname === "/updateTask" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        UPDATE maintenanceassignment 
        SET Status = ? 
        WHERE MaintenanceAssignmentID = ?
      `, [body.Status, body.MaintenanceAssignmentID]);

      res.writeHead(200);
      return res.end("Updated");
    }

    // =========================
    // EMPLOYEES (PROTECTED)
    // =========================
    if (parsedUrl.pathname === "/employees" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) {
        res.writeHead(401);
        return res.end("Unauthorized");
      }

      const [rows] = await db.query(`SELECT * FROM employee`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // REPORTS
    // =========================
    if (parsedUrl.pathname === "/reports" && req.method === "GET") {
      const [taskStats] = await db.query(`
        SELECT Status, COUNT(*) as count 
        FROM maintenanceassignment 
        GROUP BY Status
      `);

      const [overdue] = await db.query(`
        SELECT COUNT(*) as overdueTasks 
        FROM maintenanceassignment 
        WHERE DueDate < CURDATE() AND Status != 'Completed'
      `);

      const [areaLoad] = await db.query(`
        SELECT a.AreaName, COUNT(*) as totalTasks 
        FROM maintenanceassignment m 
        JOIN area a ON m.AreaID = a.AreaID 
        GROUP BY a.AreaName
      `);

      const advice = [];
      if (overdue[0].overdueTasks > 3) {
        advice.push("⚠️ Too many overdue tasks — increase staffing.");
      }
      if (areaLoad.length > 0) {
        const busiest = [...areaLoad].sort((a,b)=>b.totalTasks-a.totalTasks)[0];
        advice.push(`📍 ${busiest.AreaName} has the highest workload.`);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ taskStats, overdue, areaLoad, advice }));
    }

    // =========================
    // 404
    // =========================
    res.writeHead(404);
    res.end("Route not found");

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => console.log("Maintenance server running on port " + PORT));