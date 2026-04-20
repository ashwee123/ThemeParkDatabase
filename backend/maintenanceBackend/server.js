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

// ─── HELPERS ───────────────────────────────────────────────
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  return res.end(JSON.stringify(data));
}

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

// ✅ FIX: allow BOTH admin + manager
function requireRole(req, res) {
  const user = verifyToken(req);

  if (!user) {
    sendJson(res, 401, { error: "Missing or invalid token" });
    return null;
  }

  const allowed = [ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER];

  if (!allowed.includes(user.role)) {
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

// ─── SERVER ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  try {
    // ───────── LOGIN ─────────
    if (parsedUrl.pathname === "/login" && req.method === "POST") {
      const { email, password } = await getBody(req);

      const [rows] = await db.query(
        `SELECT ManagerID, ManagerEmail, ManagerPassword, Role
         FROM manager
         WHERE ManagerEmail = ?`,
        [email]
      );

      if (!rows.length) return sendJson(res, 401, { error: "Invalid login" });

      const manager = rows[0];

      let match = manager.ManagerPassword.startsWith("$2b$")
        ? await bcrypt.compare(password, manager.ManagerPassword)
        : password === manager.ManagerPassword;

      if (!match) return sendJson(res, 401, { error: "Invalid login" });

      const token = jwt.sign(
        {
          managerId: manager.ManagerID,
          email: manager.ManagerEmail,
          role: manager.Role
        },
        SECRET,
        { expiresIn: "1h" }
      );

      return sendJson(res, 200, { token, role: manager.Role });
    }

    // ───────── TASKS ─────────
    if (parsedUrl.pathname === "/tasks" && req.method === "GET") {
      const user = requireRole(req, res);
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

      return sendJson(res, 200, rows);
    }

    // ───────── EMPLOYEES ─────────
    if (parsedUrl.pathname === "/employees" && req.method === "GET") {
      const user = requireRole(req, res);
      if (!user) return;

      const [rows] = await db.query(
        `SELECT EmployeeID, Name, Position, Salary FROM employee ORDER BY Name`
      );

      return sendJson(res, 200, rows);
    }

    // ───────── AREAS ─────────
    if (parsedUrl.pathname === "/areas" && req.method === "GET") {
      const user = requireRole(req, res);
      if (!user) return;

      const [rows] = await db.query(
        `SELECT AreaID, AreaName FROM area ORDER BY AreaID`
      );

      return sendJson(res, 200, rows);
    }

    // ───────── ATTRACTIONS ─────────
    if (parsedUrl.pathname === "/attractions" && req.method === "GET") {
      const user = requireRole(req, res);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel,
               a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY att.AttractionName
      `);

      return sendJson(res, 200, rows);
    }

    // ───────── AREA WORKLOAD ─────────
    if (parsedUrl.pathname === "/area-workload" && req.method === "GET") {
      const user = requireRole(req, res);
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

      return sendJson(res, 200, rows);
    }

    // ───────── TASK SUMMARY ─────────
    if (parsedUrl.pathname === "/task-summary" && req.method === "GET") {
      const user = requireRole(req, res);
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

    // ───────── ALERTS ─────────
    if (parsedUrl.pathname === "/alerts" && req.method === "GET") {
      const user = requireRole(req, res);
      if (!user) return;

      const [rows] = await db.query(`
        SELECT AlertID, AlertMessage, SeverityLevel
        FROM alerts
        ORDER BY AlertID DESC
        LIMIT 20
      `);

      return sendJson(res, 200, rows);
    }

    // ───────── NOTIFICATIONS ─────────
    if (parsedUrl.pathname === "/notifications" && req.method === "GET") {
      const user = requireRole(req, res);
      if (!user) return;

      return sendJson(res, 200, {
        notifications: [
          {
            type: "weather",
            severity: "high",
            title: "Weather Alert",
            detail: "Storm warning active"
          }
        ]
      });
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Server error" });
  }
});

const PORT = process.env.PORT || 3008;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);