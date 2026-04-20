// maintenanceBackend/server.js
const http = require("http");
const url = require("url");
const db = require("./db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SECRET = process.env.JWT_SECRET || "dev_secret";

const ROLES = {
  ADMIN: "admin",
  MAINTENANCE_MANAGER: "maintenance_manager"
};

// ─────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireRole(req, res, allowedRoles) {
  const user = verifyToken(req);

  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid token" }));
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized role" }));
    return null;
  }

  return user;
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────────────────────

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

    // ───────────────────────── LOGIN ─────────────────────────
    if (parsedUrl.pathname === "/login" && req.method === "POST") {
      const { email, password } = await getBody(req);

      const [rows] = await db.query(
        `SELECT ManagerID, ManagerEmail, ManagerPassword, Role
         FROM manager
         WHERE ManagerEmail = ?`,
        [email]
      );

      if (!rows.length) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "Invalid login" }));
      }

      const manager = rows[0];

      let match = false;

      if (manager.ManagerPassword.startsWith("$2b$")) {
        match = await bcrypt.compare(password, manager.ManagerPassword);
      } else {
        match = password === manager.ManagerPassword;
      }

      if (!match) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "Invalid login" }));
      }

      const token = jwt.sign(
        {
          managerId: manager.ManagerID,
          email: manager.ManagerEmail,
          role: manager.Role
        },
        SECRET,
        { expiresIn: "1h" }
      );

      return res.end(JSON.stringify({ token, role: manager.Role }));
    }

    // ───────────────────────── ROOT ─────────────────────────
    if (parsedUrl.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "OK" }));
    }

    // ───────────────────────── TASKS ─────────────────────────
    if (parsedUrl.pathname === "/tasks" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID,
               e.Name AS EmployeeName,
               a.AreaName,
               m.TaskDescription,
               m.Status,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area a ON m.AreaID = a.AreaID
        ORDER BY m.CreatedAt DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // ───────────────────────── ADD TASK ─────────────────────────
    if (parsedUrl.pathname === "/addTask" && req.method === "POST") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const body = await getBody(req);

      if (!body.EmployeeID || !body.TaskDescription) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Missing required fields" }));
      }

      await db.query(
        `INSERT INTO maintenanceassignment
         (EmployeeID, AreaID, TaskDescription, Status, DueDate)
         VALUES (?, ?, ?, ?, ?)`,
        [
          body.EmployeeID,
          body.AreaID || null,
          body.TaskDescription,
          body.Status || "Pending",
          body.DueDate || null
        ]
      );

      return res.end(JSON.stringify({ message: "Task added" }));
    }

    // ───────────────────────── UPDATE TASK ─────────────────────────
    if (parsedUrl.pathname === "/updateTask" && req.method === "POST") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const body = await getBody(req);

      await db.query(
        `UPDATE maintenanceassignment
         SET EmployeeID = ?, AreaID = ?, TaskDescription = ?, Status = ?, DueDate = ?
         WHERE MaintenanceAssignmentID = ?`,
        [
          body.EmployeeID,
          body.AreaID || null,
          body.TaskDescription,
          body.Status,
          body.DueDate || null,
          body.MaintenanceAssignmentID
        ]
      );

      return res.end(JSON.stringify({ message: "Task updated" }));
    }

    // ───────────────────────── EMPLOYEES ─────────────────────────
    if (parsedUrl.pathname === "/employees" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(
        `SELECT EmployeeID, Name, Position, Salary FROM employee ORDER BY Name`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // ───────────────────────── AREAS (ALL 6 ALWAYS) ─────────────────────────
    if (parsedUrl.pathname === "/areas" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(
        `SELECT AreaID, AreaName FROM area ORDER BY AreaID`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // ───────────────────────── ATTRACTIONS ─────────────────────────
    if (parsedUrl.pathname === "/attractions" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel,
               a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY att.AttractionName
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // ───────────────────────── AREA WORKLOAD ─────────────────────────
    if (parsedUrl.pathname === "/area-workload" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT a.AreaName,
               COUNT(*) AS total,
               SUM(m.Status='Pending') AS pending,
               SUM(m.Status='In Progress') AS inProgress,
               SUM(m.Status='Completed') AS completed
        FROM maintenanceassignment m
        JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaID
        ORDER BY total DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // ───────────────────────── DEFAULT 404 ─────────────────────────
    res.writeHead(404);
    return res.end("Not found");

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Server error" }));
  }
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3008;
server.listen(PORT, () =>
  console.log(`Maintenance server running on port ${PORT}`)
);