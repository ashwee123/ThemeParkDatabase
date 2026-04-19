// maintenanceBackend/server.js
const http = require("http");
const url  = require("url");
const db   = require("./db");
const jwt  = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev_secret";

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
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
  const parsedUrl = url.parse(req.url, true);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }

  const json = (data, code = 200) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const auth = () => {
    const user = verifyToken(req);
    if (!user) { json({ error: "Unauthorized" }, 401); }
    return user;
  };

  try {
    const { pathname, query } = parsedUrl;

    // ── LOGIN ─────────────────────────────────────────────────────────────
    if (pathname === "/login" && req.method === "POST") {
      const { email, password } = await getBody(req);
      if (email === "maintenance@nightmarenexus.com" && password === "1234") {
        const token = jwt.sign({ email, role: "maintenance" }, SECRET, { expiresIn: "1h" });
        return json({ message: "LOGIN SUCCESS", token });
      }
      return json({ error: "Invalid login" }, 401);
    }

    // ── ROOT ──────────────────────────────────────────────────────────────
    if (pathname === "/" && req.method === "GET") return json({ service: "maintenanceBackend", status: "OK" });

    // ── TASKS (all, for calendar/schedule/tasks tab) ───────────────────────
    if (pathname === "/tasks" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`
        SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID,
               e.Name AS EmployeeName, a.AreaName,
               m.TaskDescription, m.Status,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        ORDER BY m.CreatedAt DESC
      `);
      return json(rows);
    }

    // ── TASKS FILTERED (task summary report table) ────────────────────────
    // Supports: status, areaId, employeeId, from (DueDate >=), to (DueDate <=)
    if (pathname === "/tasks-filtered" && req.method === "GET") {
      if (!auth()) return;
      const { status, areaId, employeeId, from, to } = query;
      const [rows] = await db.query(`
        SELECT m.MaintenanceAssignmentID,
               e.Name AS EmployeeName,
               a.AreaName,
               m.TaskDescription,
               m.Status,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        WHERE 1=1
          AND (? IS NULL OR ? = '' OR m.Status     = ?)
          AND (? IS NULL OR ? = '' OR m.AreaID     = ?)
          AND (? IS NULL OR ? = '' OR m.EmployeeID = ?)
          AND (? IS NULL OR ? = '' OR m.DueDate   >= ?)
          AND (? IS NULL OR ? = '' OR m.DueDate   <= ?)
        ORDER BY m.CreatedAt DESC
      `, [
        status,     status,     status,
        areaId,     areaId,     areaId,
        employeeId, employeeId, employeeId,
        from,       from,       from,
        to,         to,         to,
      ]);
      return json(rows);
    }

    // ── TASK SUMMARY (stat cards + chart data) ────────────────────────────
    // Returns: stats (counts per Status), overdue count, byArea breakdown
    // This fixes the wrong counting bug — queries maintenanceassignment directly.
    if (pathname === "/task-summary" && req.method === "GET") {
      if (!auth()) return;

      const [stats] = await db.query(`
        SELECT Status, COUNT(*) AS count
        FROM maintenanceassignment
        GROUP BY Status
      `);

      const [[{ overdue }]] = await db.query(`
        SELECT COUNT(*) AS overdue
        FROM maintenanceassignment
        WHERE DueDate < CURDATE() AND Status != 'Completed'
      `);

      const [byArea] = await db.query(`
        SELECT a.AreaName,
               SUM(m.Status = 'Pending')     AS pending,
               SUM(m.Status = 'In Progress') AS inProgress,
               SUM(m.Status = 'Completed')   AS completed
        FROM maintenanceassignment m
        JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY (pending + inProgress + completed) DESC
      `);

      return json({ stats, overdue: Number(overdue), byArea });
    }

    // ── ADD TASK ──────────────────────────────────────────────────────────
    if (pathname === "/addTask" && req.method === "POST") {
      if (!auth()) return;
      const body = await getBody(req);

      // Server-side past-date guard
      const today = new Date().toISOString().split("T")[0];
      if (body.DueDate && body.DueDate < today) {
        return json({ error: "Due date cannot be in the past." }, 400);
      }

      await db.query(
        `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
         VALUES (?, ?, ?, ?, ?)`,
        [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status || "Pending", body.DueDate || null]
      );
      return json({ message: "Task added" });
    }

    // ── UPDATE TASK ───────────────────────────────────────────────────────
    if (pathname === "/updateTask" && req.method === "POST") {
      if (!auth()) return;
      const body = await getBody(req);
      await db.query(
        `UPDATE maintenanceassignment
         SET EmployeeID = ?, AreaID = ?, TaskDescription = ?, Status = ?, DueDate = ?
         WHERE MaintenanceAssignmentID = ?`,
        [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status, body.DueDate || null, body.MaintenanceAssignmentID]
      );
      return json({ message: "Task updated" });
    }

    // ── DELETE TASK ───────────────────────────────────────────────────────
    // Kept for completeness; frontend does NOT call this (soft-delete only).
    if (pathname === "/deleteTask" && req.method === "POST") {
      if (!auth()) return;
      const body = await getBody(req);
      await db.query(`DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID = ?`, [body.MaintenanceAssignmentID]);
      return json({ message: "Task deleted" });
    }

    // ── EMPLOYEES ─────────────────────────────────────────────────────────
    if (pathname === "/employees" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`SELECT EmployeeID, Name, Position, Salary FROM employee ORDER BY Name`);
      return json(rows);
    }

    // ── AREAS ─────────────────────────────────────────────────────────────
    if (pathname === "/areas" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`SELECT AreaID, AreaName FROM area ORDER BY AreaName`);
      return json(rows);
    }

    // ── ATTRACTIONS ───────────────────────────────────────────────────────
    if (pathname === "/attractions" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel, att.QueueCount, a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY att.AttractionName ASC
      `);
      return json(rows);
    }

    // ── EMPLOYEE PERFORMANCE ──────────────────────────────────────────────
    // Per-employee: total tasks, completed, in-progress, pending, overdue
    if (pathname === "/employee-performance" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`
        SELECT
          e.EmployeeID,
          e.Name,
          e.Position,
          a.AreaName,
          COUNT(m.MaintenanceAssignmentID)                            AS totalTasks,
          SUM(m.Status = 'Completed')                                 AS completed,
          SUM(m.Status = 'In Progress')                               AS inProgress,
          SUM(m.Status = 'Pending')                                   AS pending,
          SUM(m.DueDate < CURDATE() AND m.Status != 'Completed')      AS overdue
        FROM employee e
        LEFT JOIN maintenanceassignment m ON e.EmployeeID = m.EmployeeID
        LEFT JOIN area a ON e.AreaID = a.AreaID
        GROUP BY e.EmployeeID, e.Name, e.Position, a.AreaName
        ORDER BY totalTasks DESC
      `);
      return json(rows);
    }

    // ── MAINTENANCE HISTORY REPORT ────────────────────────────────────────
    // Severity on this table is the maintenance.Severity enum (Low/Medium/High),
    // not time-based. Filterable by severity, status, attractionId, date range.
    if (pathname === "/maintenance-report" && req.method === "GET") {
      if (!auth()) return;
      const { startDate, endDate, severity, status, attractionId, employeeId, areaId } = query;
      const [rows] = await db.query(`
        SELECT
          m.MaintenanceID,
          DATE_FORMAT(m.DateStart, '%Y-%m-%d') AS DateStart,
          DATE_FORMAT(m.DateEnd,   '%Y-%m-%d') AS DateEnd,
          m.Severity, m.Status,
          e.Name           AS EmployeeName,
          att.AttractionName,
          att.AttractionType,
          a.AreaName
        FROM maintenance m
        LEFT JOIN employee   e   ON m.EmployeeID   = e.EmployeeID
        LEFT JOIN attraction att ON m.AttractionID = att.AttractionID
        LEFT JOIN area       a   ON att.AreaID     = a.AreaID
        WHERE 1=1
          AND (? IS NULL OR ? = '' OR m.DateStart   >= ?)
          AND (? IS NULL OR ? = '' OR m.DateEnd     <= ?)
          AND (? IS NULL OR ? = '' OR m.Severity     = ?)
          AND (? IS NULL OR ? = '' OR m.Status       = ?)
          AND (? IS NULL OR ? = '' OR att.AttractionID = ?)
          AND (? IS NULL OR ? = '' OR e.EmployeeID   = ?)
          AND (? IS NULL OR ? = '' OR a.AreaID       = ?)
        ORDER BY m.DateStart DESC
      `, [
        startDate,    startDate,    startDate,
        endDate,      endDate,      endDate,
        severity,     severity,     severity,
        status,       status,       status,
        attractionId, attractionId, attractionId,
        employeeId,   employeeId,   employeeId,
        areaId,       areaId,       areaId,
      ]);
      return json(rows);
    }

    // ── AREA WORKLOAD ─────────────────────────────────────────────────────
    // Now includes per-area overdue count
    if (pathname === "/area-workload" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`
        SELECT
          a.AreaName,
          COUNT(m.MaintenanceAssignmentID)                          AS total,
          SUM(m.Status = 'Pending')                                 AS pending,
          SUM(m.Status = 'In Progress')                             AS inProgress,
          SUM(m.Status = 'Completed')                               AS completed,
          SUM(m.DueDate < CURDATE() AND m.Status != 'Completed')    AS overdue
        FROM maintenanceassignment m
        JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY total DESC
      `);
      return json(rows);
    }

    // ── TRANSACTIONS ──────────────────────────────────────────────────────
    // From transactionlog joined with retailitem.
    // Filterable by type (Normal/Discount/Damaged/Stolen) and date range.
    if (pathname === "/transactions" && req.method === "GET") {
      if (!auth()) return;
      const { type, from, to } = query;
      const [rows] = await db.query(`
        SELECT
          t.TransactionID,
          ri.ItemName,
          t.Type,
          t.Quantity,
          t.Price,
          t.TotalCost,
          DATE_FORMAT(t.Date, '%Y-%m-%d') AS Date
        FROM transactionlog t
        JOIN retailitem ri ON t.ItemID = ri.ItemID
        WHERE 1=1
          AND (? IS NULL OR ? = '' OR t.Type   = ?)
          AND (? IS NULL OR ? = '' OR t.Date  >= ?)
          AND (? IS NULL OR ? = '' OR t.Date  <= ?)
        ORDER BY t.Date DESC, t.Time DESC
        LIMIT 200
      `, [
        type, type, type,
        from, from, from,
        to,   to,   to,
      ]);
      return json(rows);
    }

    // ── ALERTS (toast polling — trg_ride_maintenance output) ─────────────
    if (pathname === "/alerts" && req.method === "GET") {
      if (!auth()) return;
      const [rows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts
        ORDER BY CreatedAt DESC LIMIT 10
      `);
      return json(rows);
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────
    if (pathname === "/notifications" && req.method === "GET") {
      if (!auth()) return;
      const notifications = [];

      // 1. trg_ride_maintenance → maintenancealert → activemaintenancealerts view
      const [alertRows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts ORDER BY CreatedAt DESC LIMIT 20
      `);
      alertRows.forEach((r) => notifications.push({
        type: "inspection",
        severity: r.SeverityLevel === "Severe" ? "critical" : "high",
        title:  `Maintenance Alert: ${r.AttractionName}`,
        detail: `${r.AlertMessage} — flagged at ${r.CreatedAt}`,
      }));

      // 2. trg_weather_shutdown → attraction.Status = 'ClosedDueToWeather'
      const [weatherClosures] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, a.AreaName
        FROM attraction att LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status = 'ClosedDueToWeather'
      `);
      weatherClosures.forEach((r) => notifications.push({
        type: "weather", severity: "critical",
        title:  `Weather Closure: ${r.AttractionName}`,
        detail: `${r.AttractionType} in ${r.AreaName || "unknown"} shut down by weather trigger.`,
      }));

      // 3. NeedsMaintenance / UnderMaintenance / Closed
      const [shutdownRides] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, att.Status, att.SeverityLevel, a.AreaName
        FROM attraction att LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status IN ('NeedsMaintenance','UnderMaintenance','Closed')
        ORDER BY FIELD(att.SeverityLevel,'Severe','Low','None'), att.AttractionName
      `);
      shutdownRides.forEach((r) => {
        const label = { NeedsMaintenance: "requires immediate maintenance", UnderMaintenance: "is under maintenance", Closed: "is closed" }[r.Status] || r.Status;
        notifications.push({
          type: "shutdown",
          severity: r.SeverityLevel === "Severe" ? "critical" : "high",
          title:  `Ride Status: ${r.AttractionName}`,
          detail: `${r.AttractionType} in ${r.AreaName || "unknown"} ${label}. Severity: ${r.SeverityLevel || "None"}.`,
        });
      });

      // 4. Overdue assignments
      const [overdueTasks] = await db.query(`
        SELECT m.MaintenanceAssignmentID, e.Name AS EmployeeName,
               a.AreaName, m.TaskDescription,
               DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate
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
          title:  `Overdue Task: ${t.AreaName || "Unknown Area"}`,
          detail: `Task #${t.MaintenanceAssignmentID} · ${t.EmployeeName} · due ${t.DueDate}. "${desc}"`,
        });
      });

      const order = { critical: 0, high: 1, medium: 2 };
      notifications.sort((a, b) => order[a.severity] - order[b.severity]);
      return json({ notifications });
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    res.writeHead(404); res.end("Route not found");

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT || 3008;
server.listen(PORT, () => console.log(`Maintenance server running on port ${PORT}`));