// maintenanceBackend/server.js
const http = require("http");
const url  = require("url");
const db   = require("./db");
const jwt  = require("jsonwebtoken");

let bcrypt;
try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }

const SECRET = process.env.JWT_SECRET || "dev_secret";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  if (statusCode < 400) res.end(JSON.stringify({ success: true, data: payload }));
  else                  res.end(JSON.stringify({ success: false, error: payload }));
}

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

function requireAuth(req, res, allowedRoles = ["admin", "maintenance_manager", "maintenance"]) {
  const user = verifyToken(req);
  if (!user)                             { sendJson(res, 401, "Missing or invalid token"); return null; }
  if (!allowedRoles.includes(user.role)) { sendJson(res, 403, "Forbidden: insufficient role"); return null; }
  return user;
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  console.log("REQUEST:", req.method, req.url);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }

  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  try {

    // ── ROOT ─────────────────────────────────────────────────────────────
    if (pathname === "/" && req.method === "GET")
      return sendJson(res, 200, { service: "maintenanceBackend", status: "OK" });

    // ── LOGIN ─────────────────────────────────────────────────────────────
    if (pathname === "/login" && req.method === "POST") {
      const { email, password } = await getBody(req);
      if (!email || !password) return sendJson(res, 400, "Email and password are required.");
      const [rows] = await db.query(
        `SELECT ManagerID, ManagerEmail, ManagerPassword, Role FROM manager WHERE ManagerEmail = ?`, [email]
      );
      if (!rows.length) return sendJson(res, 401, "Invalid email or password.");
      const manager = rows[0];
      const storedPassword = manager.ManagerPassword || "";
      let match = false;
      if (bcrypt && storedPassword.startsWith("$2b$")) match = await bcrypt.compare(password, storedPassword);
      else match = password === storedPassword;
      if (!match) return sendJson(res, 401, "Invalid email or password.");
      const role = (manager.Role || "maintenance_manager").trim().toLowerCase();
      const token = jwt.sign({ managerId: manager.ManagerID, email: manager.ManagerEmail, role }, SECRET, { expiresIn: "1h" });
      return sendJson(res, 200, { token, role });
    }

    // ── TASKS (all) ───────────────────────────────────────────────────────
    if (pathname === "/tasks" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID,
               e.Name AS EmployeeName, e.Position, a.AreaName,
               m.TaskDescription, m.Status,
               COALESCE(m.Severity, '') AS Severity,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate,
               CASE WHEN m.DueDate < CURDATE() AND m.Status != 'Completed' THEN 1 ELSE 0 END AS IsOverdue
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        ORDER BY m.CreatedAt DESC
      `);
      return sendJson(res, 200, rows);
    }

    // ── TASKS FILTERED ────────────────────────────────────────────────────
    if (pathname === "/tasks-filtered" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const { status, severity, areaId, employeeId, from, to, overdue, keyword } = query;
      const conditions = ["1=1"], params = [];
      if (status)          { conditions.push("m.Status = ?");     params.push(status); }
      if (severity)        { conditions.push("m.Severity = ?");   params.push(severity); }
      if (areaId)          { conditions.push("m.AreaID = ?");     params.push(areaId); }
      if (employeeId)      { conditions.push("m.EmployeeID = ?"); params.push(employeeId); }
      if (from)            { conditions.push("m.DueDate >= ?");   params.push(from); }
      if (to)              { conditions.push("m.DueDate <= ?");   params.push(to); }
      if (overdue === "1") { conditions.push("m.DueDate < CURDATE() AND m.Status != 'Completed'"); }
      if (keyword)         { conditions.push("m.TaskDescription LIKE ?"); params.push("%" + keyword + "%"); }
      if (query.excludeStatus) {
        conditions.push("m.Status != ?");
        params.push(query.excludeStatus);
      }
      const [rows] = await db.query(`
        SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID,
               e.Name AS EmployeeName, e.Position, a.AreaName,
               m.TaskDescription, m.Status,
               COALESCE(m.Severity, '') AS Severity,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate,
               CASE WHEN m.DueDate < CURDATE() AND m.Status != 'Completed' THEN 1 ELSE 0 END AS IsOverdue
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        WHERE ${conditions.join(" AND ")}
        ORDER BY m.DueDate ASC, m.CreatedAt DESC
      `, params);
      return sendJson(res, 200, rows);
    }

    // ── TASK SUMMARY ──────────────────────────────────────────────────────
    if (pathname === "/task-summary" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [stats] = await db.query(`SELECT Status, COUNT(*) AS count FROM maintenanceassignment GROUP BY Status`);
      const [[overdueRow]] = await db.query(`SELECT COUNT(*) AS overdue FROM maintenanceassignment WHERE DueDate < CURDATE() AND Status != 'Completed'`);

      // Deduplicate areas by AreaID before returning byArea
      // so duplicate area name entries in the DB don't split the bar chart
      const [byAreaRaw] = await db.query(`
        SELECT a.AreaID, a.AreaName,
               COALESCE(SUM(m.Status = 'Pending'),     0) AS pending,
               COALESCE(SUM(m.Status = 'In Progress'), 0) AS inProgress,
               COALESCE(SUM(m.Status = 'Completed'),   0) AS completed,
               COALESCE(SUM(m.DueDate < CURDATE() AND m.Status != 'Completed'), 0) AS overdue
        FROM area a
        LEFT JOIN maintenanceassignment m ON m.AreaID = a.AreaID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY (COALESCE(SUM(m.Status='Pending'),0)+COALESCE(SUM(m.Status='In Progress'),0)+COALESCE(SUM(m.Status='Completed'),0)) DESC
      `);

      // Merge rows with the same AreaName (duplicate area names with different IDs)
      const areaMap = new Map();
      byAreaRaw.forEach((row) => {
        const key = (row.AreaName || "").trim().toLowerCase();
        if (areaMap.has(key)) {
          const existing = areaMap.get(key);
          existing.pending    += Number(row.pending);
          existing.inProgress += Number(row.inProgress);
          existing.completed  += Number(row.completed);
          existing.overdue    += Number(row.overdue);
        } else {
          areaMap.set(key, {
            AreaName:   row.AreaName,
            pending:    Number(row.pending),
            inProgress: Number(row.inProgress),
            completed:  Number(row.completed),
            overdue:    Number(row.overdue),
          });
        }
      });
      const byArea = Array.from(areaMap.values())
        .sort((a, b) => (b.pending + b.inProgress + b.completed) - (a.pending + a.inProgress + a.completed));

      return sendJson(res, 200, { stats, overdue: Number(overdueRow.overdue), byArea });
    }

    // ── ADD TASK ──────────────────────────────────────────────────────────
    if (pathname === "/addTask" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = await getBody(req);
      const today = new Date().toISOString().split("T")[0];
      if (body.DueDate && body.DueDate < today) return sendJson(res, 400, "Due date cannot be in the past.");

      // Check if maintenanceassignment has a Severity column; if not, skip it
      let hasSeverityCol = false;
      try {
        const [cols] = await db.query(`SHOW COLUMNS FROM maintenanceassignment LIKE 'Severity'`);
        hasSeverityCol = cols.length > 0;
      } catch { /* ignore */ }

      if (hasSeverityCol) {
        await db.query(
          `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, Severity, DueDate) VALUES (?,?,?,?,?,?)`,
          [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status || "Pending", body.Severity || null, body.DueDate || null]
        );
      } else {
        await db.query(
          `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate) VALUES (?,?,?,?,?)`,
          [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status || "Pending", body.DueDate || null]
        );
      }
      return sendJson(res, 200, { message: "Task added" });
    }

    // ── UPDATE TASK ───────────────────────────────────────────────────────
    if (pathname === "/updateTask" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = await getBody(req);

      let hasSeverityCol = false;
      try {
        const [cols] = await db.query(`SHOW COLUMNS FROM maintenanceassignment LIKE 'Severity'`);
        hasSeverityCol = cols.length > 0;
      } catch { /* ignore */ }

      if (hasSeverityCol) {
        await db.query(
          `UPDATE maintenanceassignment SET EmployeeID=?, AreaID=?, TaskDescription=?, Status=?, Severity=?, DueDate=? WHERE MaintenanceAssignmentID=?`,
          [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status, body.Severity || null, body.DueDate || null, body.MaintenanceAssignmentID]
        );
      } else {
        await db.query(
          `UPDATE maintenanceassignment SET EmployeeID=?, AreaID=?, TaskDescription=?, Status=?, DueDate=? WHERE MaintenanceAssignmentID=?`,
          [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status, body.DueDate || null, body.MaintenanceAssignmentID]
        );
      }
      return sendJson(res, 200, { message: "Task updated" });
    }

    // ── DELETE TASK ───────────────────────────────────────────────────────
    if (pathname === "/deleteTask" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = await getBody(req);
      await db.query(`DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID=?`, [body.MaintenanceAssignmentID]);
      return sendJson(res, 200, { message: "Task deleted" });
    }

    // ── UPDATE MAINTENANCE RECORD ─────────────────────────────────────────
    if (pathname === "/updateMaintenance" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = await getBody(req);
      await db.query(
        `UPDATE maintenance SET EmployeeID=?, Severity=?, Status=?, DateStart=?, DateEnd=? WHERE MaintenanceID=?`,
        [body.EmployeeID || null, body.Severity || "Low", body.Status || "Pending", body.DateStart || null, body.DateEnd || null, body.MaintenanceID]
      );
      return sendJson(res, 200, { message: "Maintenance record updated" });
    }

    // ── DELETE MAINTENANCE RECORD ─────────────────────────────────────────
    if (pathname === "/deleteMaintenance" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = await getBody(req);
      await db.query(`DELETE FROM maintenance WHERE MaintenanceID=?`, [body.MaintenanceID]);
      return sendJson(res, 200, { message: "Maintenance record deleted" });
    }

    // ── EMPLOYEES ─────────────────────────────────────────────────────────
    if (pathname === "/employees" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT e.EmployeeID, e.Name, e.Position, a.AreaName, e.AreaID
        FROM employee e LEFT JOIN area a ON e.AreaID = a.AreaID ORDER BY e.Name ASC
      `);
      return sendJson(res, 200, rows);
    }

    // ── EMPLOYEE PERFORMANCE (all) ────────────────────────────────────────
    if (pathname === "/employee-performance-all" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT e.EmployeeID, e.Name, e.Position, a.AreaName, e.AreaID,
               COUNT(m.MaintenanceAssignmentID)                                   AS totalTasks,
               COALESCE(SUM(m.Status='Completed'),   0)                           AS completed,
               COALESCE(SUM(m.Status='In Progress'), 0)                           AS inProgress,
               COALESCE(SUM(m.Status='Pending'),     0)                           AS pending,
               COALESCE(SUM(m.DueDate < CURDATE() AND m.Status!='Completed'), 0)  AS overdue
        FROM employee e
        LEFT JOIN maintenanceassignment m ON e.EmployeeID = m.EmployeeID
        LEFT JOIN area a ON e.AreaID = a.AreaID
        GROUP BY e.EmployeeID, e.Name, e.Position, a.AreaName, e.AreaID
        ORDER BY totalTasks DESC
      `);
      return sendJson(res, 200, rows);
    }

    // ── EMPLOYEE PERFORMANCE (legacy) ─────────────────────────────────────
    if (pathname === "/employee-performance" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const { areaId } = query;
      const conditions = ["1=1"], params = [];
      if (areaId) { conditions.push("e.AreaID = ?"); params.push(areaId); }
      const [rows] = await db.query(`
        SELECT e.EmployeeID, e.Name, e.Position, a.AreaName, e.AreaID,
               COUNT(m.MaintenanceAssignmentID)                                   AS totalTasks,
               COALESCE(SUM(m.Status='Completed'),   0)                           AS completed,
               COALESCE(SUM(m.Status='In Progress'), 0)                           AS inProgress,
               COALESCE(SUM(m.Status='Pending'),     0)                           AS pending,
               COALESCE(SUM(m.DueDate < CURDATE() AND m.Status!='Completed'), 0)  AS overdue
        FROM employee e
        LEFT JOIN maintenanceassignment m ON e.EmployeeID = m.EmployeeID
        LEFT JOIN area a ON e.AreaID = a.AreaID
        WHERE ${conditions.join(" AND ")}
        GROUP BY e.EmployeeID, e.Name, e.Position, a.AreaName, e.AreaID
        ORDER BY totalTasks DESC
      `, params);
      return sendJson(res, 200, rows);
    }

    // ── AREAS ─────────────────────────────────────────────────────────────
    if (pathname === "/areas" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`SELECT AreaID, AreaName FROM area ORDER BY AreaName`);
      return sendJson(res, 200, rows);
    }

    // ── ATTRACTIONS ───────────────────────────────────────────────────────
    if (pathname === "/attractions" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel, att.QueueCount, a.AreaName, a.AreaID
        FROM attraction att LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY att.AttractionName ASC
      `);
      return sendJson(res, 200, rows);
    }

    // ── RIDE OPERATIONS ───────────────────────────────────────────────────
    // Uses the same data sources as the alerts/notifications tab —
    // attractions table (live status), maintenancealert (trigger alerts),
    // and maintenance table (active records). No new data sources.
    if (pathname === "/ride-operations" && req.method === "GET") {
      if (!requireAuth(req, res)) return;

      const [attractions] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel, att.QueueCount,
               a.AreaName, a.AreaID
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY a.AreaName ASC, att.AttractionName ASC
      `);

      // Same unhandled alerts as the notifications/alerts tab
      const [alerts] = await db.query(`
        SELECT ma.AttractionID, ma.SeverityLevel, ma.AlertMessage,
              DATE_FORMAT(ma.CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts ma
      `);

      // Active maintenance (same source as notifications shutdown list)
      const [activeMaintenance] = await db.query(`
        SELECT m.AttractionID, m.Severity, m.Status,
               e.Name AS AssignedEmployee,
               DATE_FORMAT(m.DateStart, '%Y-%m-%d') AS DateStart
        FROM maintenance m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        WHERE m.DateEnd IS NULL OR m.DateEnd >= CURDATE()
      `);

      const alertMap = {}, maintMap = {};
      alerts.forEach((a) => {
        if (!alertMap[a.AttractionID]) alertMap[a.AttractionID] = [];
        alertMap[a.AttractionID].push(a);
      });
      activeMaintenance.forEach((m) => {
        if (!maintMap[m.AttractionID]) maintMap[m.AttractionID] = [];
        maintMap[m.AttractionID].push(m);
      });

      const result = attractions.map((att) => ({
        ...att,
        alerts:            alertMap[att.AttractionID] || [],
        activeMaintenance: maintMap[att.AttractionID] || [],
      }));

      return sendJson(res, 200, result);
    }

    // ── MAINTENANCE HISTORY REPORT ────────────────────────────────────────
    if (pathname === "/maintenance-report" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const { startDate, endDate, severity, status, attractionId, employeeId, areaId, keyword } = query;
      const conditions = ["1=1"], params = [];
      if (startDate)    { conditions.push("m.DateStart >= ?");     params.push(startDate); }
      if (endDate)      { conditions.push("m.DateEnd <= ?");       params.push(endDate); }
      if (severity)     { conditions.push("m.Severity = ?");       params.push(severity); }
      if (status)       { conditions.push("m.Status = ?");         params.push(status); }
      if (attractionId) { conditions.push("att.AttractionID = ?"); params.push(attractionId); }
      if (employeeId)   { conditions.push("e.EmployeeID = ?");     params.push(employeeId); }
      if (areaId)       { conditions.push("a.AreaID = ?");         params.push(areaId); }
      if (keyword)      { conditions.push("(att.AttractionName LIKE ? OR m.Status LIKE ?)"); params.push("%" + keyword + "%", "%" + keyword + "%"); }
      const [rows] = await db.query(`
        SELECT m.MaintenanceID, m.EmployeeID,
               DATE_FORMAT(m.DateStart, '%Y-%m-%d') AS DateStart,
               DATE_FORMAT(m.DateEnd,   '%Y-%m-%d') AS DateEnd,
               m.Severity, m.Status,
               e.Name AS EmployeeName, att.AttractionName, att.AttractionType,
               a.AreaName, a.AreaID
        FROM maintenance m
        LEFT JOIN employee   e   ON m.EmployeeID   = e.EmployeeID
        LEFT JOIN attraction att ON m.AttractionID = att.AttractionID
        LEFT JOIN area       a   ON att.AreaID     = a.AreaID
        WHERE ${conditions.join(" AND ")}
        ORDER BY m.DateStart DESC
      `, params);
      return sendJson(res, 200, rows);
    }

    // ── AREA FREQUENCY BREAKDOWN ──────────────────────────────────────────
    // Groups by AreaID (primary key) to avoid duplicate area name rows.
    // Uses the maintenance table (historical records), not maintenanceassignment (tasks).
    if (pathname === "/area-frequency" && req.method === "GET") {
      if (!requireAuth(req, res)) return;

      const [rows] = await db.query(`
        SELECT
          a.AreaID,
          a.AreaName,
          COUNT(m.MaintenanceID)                 AS total,
          COALESCE(SUM(m.Severity='High'),   0)  AS highSeverity,
          COALESCE(SUM(m.Severity='Medium'), 0)  AS mediumSeverity,
          COALESCE(SUM(m.Severity='Low'),    0)  AS lowSeverity,
          (
            SELECT att2.AttractionName
            FROM maintenance m2
            JOIN attraction att2 ON m2.AttractionID = att2.AttractionID
            WHERE att2.AreaID = a.AreaID
            GROUP BY att2.AttractionID
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS mostAffectedAttraction
        FROM area a
        LEFT JOIN attraction att ON att.AreaID     = a.AreaID
        LEFT JOIN maintenance m  ON m.AttractionID = att.AttractionID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY total DESC
      `);

      // Merge rows with the same area name (duplicate area name entries in DB)
      const areaMap = new Map();
      rows.forEach((row) => {
        const key = (row.AreaName || "").trim().toLowerCase();
        if (areaMap.has(key)) {
          const e = areaMap.get(key);
          e.total          += Number(row.total);
          e.highSeverity   += Number(row.highSeverity);
          e.mediumSeverity += Number(row.mediumSeverity);
          e.lowSeverity    += Number(row.lowSeverity);
          if (!e.mostAffectedAttraction && row.mostAffectedAttraction)
            e.mostAffectedAttraction = row.mostAffectedAttraction;
        } else {
          areaMap.set(key, {
            AreaID: row.AreaID, AreaName: row.AreaName,
            total: Number(row.total),
            highSeverity:   Number(row.highSeverity),
            mediumSeverity: Number(row.mediumSeverity),
            lowSeverity:    Number(row.lowSeverity),
            mostAffectedAttraction: row.mostAffectedAttraction,
          });
        }
      });

      const deduped = Array.from(areaMap.values()).sort((a, b) => b.total - a.total);
      return sendJson(res, 200, deduped);
    }

    // ── AREA WORKLOAD ─────────────────────────────────────────────────────
    if (pathname === "/area-workload" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT a.AreaName,
               COALESCE(COUNT(m.MaintenanceAssignmentID), 0)                      AS total,
               COALESCE(SUM(m.Status='Pending'),          0)                      AS pending,
               COALESCE(SUM(m.Status='In Progress'),      0)                      AS inProgress,
               COALESCE(SUM(m.Status='Completed'),        0)                      AS completed,
               COALESCE(SUM(m.DueDate < CURDATE() AND m.Status!='Completed'), 0)  AS overdue
        FROM area a
        LEFT JOIN maintenanceassignment m ON m.AreaID = a.AreaID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY total DESC
      `);
      return sendJson(res, 200, rows);
    }

    // ── ALERTS (toast polling) ────────────────────────────────────────────
    if (pathname === "/alerts" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const [rows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts ORDER BY CreatedAt DESC LIMIT 10
      `);
      return sendJson(res, 200, rows);
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────
    if (pathname === "/notifications" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const notifications = [];

      const [alertRows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts ORDER BY CreatedAt DESC LIMIT 20
      `);
      alertRows.forEach((r) => notifications.push({
        type: "inspection", severity: r.SeverityLevel === "Severe" ? "critical" : "high",
        title: `Maintenance Alert: ${r.AttractionName}`,
        detail: `${r.AlertMessage} — flagged at ${r.CreatedAt}`,
      }));

      const [weatherClosures] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, a.AreaName
        FROM attraction att LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status = 'ClosedDueToWeather'
      `);
      weatherClosures.forEach((r) => notifications.push({
        type: "weather", severity: "critical",
        title: `Weather Closure: ${r.AttractionName}`,
        detail: `${r.AttractionType} in ${r.AreaName || "unknown"} shut down by weather trigger.`,
      }));

      const [shutdownRides] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, att.Status, att.SeverityLevel, a.AreaName
        FROM attraction att LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status IN ('NeedsMaintenance','UnderMaintenance','Closed')
        ORDER BY FIELD(att.SeverityLevel,'Severe','Low','None'), att.AttractionName
      `);
      shutdownRides.forEach((r) => {
        const label = { NeedsMaintenance: "requires immediate maintenance", UnderMaintenance: "is under maintenance", Closed: "is closed" }[r.Status] || r.Status;
        notifications.push({
          type: "shutdown", severity: r.SeverityLevel === "Severe" ? "critical" : "high",
          title: `Ride Status: ${r.AttractionName}`,
          detail: `${r.AttractionType} in ${r.AreaName || "unknown"} ${label}. Severity: ${r.SeverityLevel || "None"}.`,
        });
      });

      const [overdueTasks] = await db.query(`
        SELECT m.MaintenanceAssignmentID, e.Name AS EmployeeName, a.AreaName,
               m.TaskDescription, DATE_FORMAT(m.DueDate,'%Y-%m-%d') AS DueDate
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        WHERE m.DueDate < CURDATE() AND m.Status != 'Completed'
        ORDER BY m.DueDate ASC LIMIT 10
      `);
      overdueTasks.forEach((t) => {
        const desc = t.TaskDescription.length > 70 ? t.TaskDescription.substring(0, 70) + "…" : t.TaskDescription;
        notifications.push({
          type: "overdue", severity: "high",
          title: `Overdue Task: ${t.AreaName || "Unknown Area"}`,
          detail: `Task #${t.MaintenanceAssignmentID} · ${t.EmployeeName} · due ${t.DueDate}. "${desc}"`,
        });
      });

      const order = { critical: 0, high: 1, medium: 2 };
      notifications.sort((a, b) => order[a.severity] - order[b.severity]);
      return sendJson(res, 200, { notifications });
    }

    return sendJson(res, 404, "Route not found");

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return sendJson(res, 500, err.message);
  }
});

const PORT = process.env.PORT || 3008;
server.listen(PORT, () => console.log(`Maintenance server running on port ${PORT}`));