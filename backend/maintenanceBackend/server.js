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


// ─── HELPER ──────────────────────────────────────────────────────────────────
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  return res.end(JSON.stringify(data));
}

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
    sendJson(res, 401, { error: "Missing or invalid token" });
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    sendJson(res, 403, { error: "Forbidden: invalid role" });
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

    if (parsedUrl.pathname === "/employee-performance" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT 
          e.EmployeeID,
          e.Name,
          e.Position,
          a.AreaName,
          COUNT(m.MaintenanceAssignmentID) AS totalTasks,
          SUM(m.Status = 'Completed') AS completed,
          SUM(m.Status = 'In Progress') AS inProgress,
          SUM(m.Status = 'Pending') AS pending,
          SUM(m.DueDate < CURDATE() AND m.Status != 'Completed') AS overdue
        FROM employee e
        LEFT JOIN maintenanceassignment m ON e.EmployeeID = m.EmployeeID
        LEFT JOIN area a ON e.AreaID = a.AreaID
        GROUP BY e.EmployeeID
      `);

      return sendJson(res, 200, rows);
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

    if (parsedUrl.pathname === "/task-summary" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [stats] = await db.query(`
        SELECT Status, COUNT(*) AS count
        FROM maintenanceassignment
        GROUP BY Status
      `);

      const [byArea] = await db.query(`
        SELECT a.AreaName,
              SUM(m.Status='Pending') AS pending,
              SUM(m.Status='In Progress') AS inProgress,
              SUM(m.Status='Completed') AS completed
        FROM maintenanceassignment m
        LEFT JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaID
      `);

      const [overdue] = await db.query(`
        SELECT COUNT(*) AS overdue
        FROM maintenanceassignment
        WHERE DueDate < CURDATE() AND Status != 'Completed'
      `);

      return sendJson(res, 200, {
        stats,
        byArea,
        overdue: overdue[0].overdue
      });
    }

    if (parsedUrl.pathname === "/tasks-filtered" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const { status, areaId, employeeId, from, to } = parsedUrl.query;

      const [rows] = await db.query(`
        SELECT 
          m.*,
          e.Name AS EmployeeName,
          a.AreaName
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area a ON m.AreaID = a.AreaID
        WHERE 1=1
          AND (? IS NULL OR ? = '' OR m.Status = ?)
          AND (? IS NULL OR ? = '' OR m.AreaID = ?)
          AND (? IS NULL OR ? = '' OR m.EmployeeID = ?)
          AND (? IS NULL OR ? = '' OR m.DueDate >= ?)
          AND (? IS NULL OR ? = '' OR m.DueDate <= ?)
      `, [
        status, status, status,
        areaId, areaId, areaId,
        employeeId, employeeId, employeeId,
        from, from, from,
        to, to, to
      ]);

      return sendJson(res, 200, rows);
    }

    // ───────────────────────── ALERTS ─────────────────────────
    if (parsedUrl.pathname === "/alerts" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT AlertID, AlertMessage, SeverityLevel
        FROM alerts
        ORDER BY AlertID DESC
        LIMIT 20
      `);

      return sendJson(res, 200, rows);
    }

    // ───────────────────────── NOTIFICATION ─────────────────────────
    if (parsedUrl.pathname === "/notifications" && req.method === "GET") {
      const user = requireRole(req, res, [ROLES.MAINTENANCE_MANAGER]);
      if (!user) return;

      const notifications = [
        {
          type: "weather",
          severity: "high",
          title: "Weather Alert",
          detail: "Storm warning active"
        }
      ];

      return sendJson(res, 200, { notifications });
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