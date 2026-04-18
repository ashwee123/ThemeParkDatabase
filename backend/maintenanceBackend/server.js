// maintenanceBackend/server.js
const http = require("http");
const url  = require("url");
const db   = require("./db");
const jwt  = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev_secret";

// =========================
// HELPERS
// =========================

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
    req.on("data", (chunk) => (body += chunk.toString()));
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

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }

  try {

    // =========================
    // LOGIN
    // =========================
    if (parsedUrl.pathname === "/login" && req.method === "POST") {
      const body = await getBody(req);
      const { email, password } = body;

      if (email === "maintenance@nightmarenexus.com" && password === "1234") {
        const token = jwt.sign({ email, role: "maintenance" }, SECRET, { expiresIn: "1h" });
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "LOGIN SUCCESS", token }));
      }

      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid login" }));
    }

    // =========================
    // ROOT
    // =========================
    if (parsedUrl.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ service: "maintenanceBackend", status: "OK" }));
    }

    // =========================
    // TASKS
    // =========================
    if (parsedUrl.pathname === "/tasks" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`
        SELECT
          m.MaintenanceAssignmentID,
          e.Name  AS EmployeeName,
          a.AreaName,
          m.TaskDescription,
          m.Status,
          DATE_FORMAT(m.DueDate, '%Y-%m-%d') AS DueDate
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area     a ON m.AreaID     = a.AreaID
        ORDER BY m.CreatedAt DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // ADD TASK
    // =========================
    if (parsedUrl.pathname === "/addTask" && req.method === "POST") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const body = await getBody(req);
      await db.query(
        `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
         VALUES (?, ?, ?, ?, ?)`,
        [body.EmployeeID, body.AreaID || null, body.TaskDescription, body.Status || "Pending", body.DueDate || null]
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Task added" }));
    }

    // =========================
    // UPDATE TASK
    // =========================
    if (parsedUrl.pathname === "/updateTask" && req.method === "POST") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const body = await getBody(req);
      await db.query(
        `UPDATE maintenanceassignment
         SET EmployeeID = ?, AreaID = ?, TaskDescription = ?, Status = ?, DueDate = ?
         WHERE MaintenanceAssignmentID = ?`,
        [body.EmployeeID, body.AreaID, body.TaskDescription, body.Status, body.DueDate, body.MaintenanceAssignmentID]
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Task updated" }));
    }

    // =========================
    // DELETE TASK
    // =========================
    if (parsedUrl.pathname === "/deleteTask" && req.method === "POST") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const body = await getBody(req);
      await db.query(
        `DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID = ?`,
        [body.MaintenanceAssignmentID]
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Task deleted" }));
    }

    // =========================
    // EMPLOYEES
    // =========================
    if (parsedUrl.pathname === "/employees" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`SELECT * FROM employee`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // ATTRACTIONS
    // =========================
    if (parsedUrl.pathname === "/attractions" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`
        SELECT att.AttractionID, att.AttractionName, att.AttractionType,
               att.Status, att.SeverityLevel, att.QueueCount, a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        ORDER BY att.AttractionName ASC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // REPORTS — STAT CARDS
    // =========================
    if (parsedUrl.pathname === "/reports" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [taskStats] = await db.query(`
        SELECT Status, COUNT(*) AS count FROM maintenanceassignment GROUP BY Status
      `);

      const [overdue] = await db.query(`
        SELECT COUNT(*) AS overdueTasks
        FROM maintenanceassignment
        WHERE DueDate < CURDATE() AND Status != 'Completed'
      `);

      const [areaLoad] = await db.query(`
        SELECT a.AreaName, COUNT(*) AS totalTasks
        FROM maintenanceassignment m
        JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaName
      `);

      const advice = [];
      if (overdue[0].overdueTasks > 3) advice.push("⚠️ Too many overdue tasks — increase staffing.");
      if (areaLoad.length > 0) {
        const busiest = [...areaLoad].sort((a, b) => b.totalTasks - a.totalTasks)[0];
        advice.push(`📍 ${busiest.AreaName} has the highest workload.`);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ taskStats, overdue, areaLoad, advice }));
    }

    // =========================
    // MAINTENANCE HISTORY REPORT
    // Filterable by severity, date range, employeeId, areaId
    // Joins: maintenance → employee, attraction, area
    // =========================
    if (parsedUrl.pathname === "/maintenance-report" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const { startDate, endDate, severity, employeeId, areaId } = parsedUrl.query;

      const [rows] = await db.query(`
        SELECT
          m.MaintenanceID,
          DATE_FORMAT(m.DateStart, '%Y-%m-%d') AS DateStart,
          DATE_FORMAT(m.DateEnd,   '%Y-%m-%d') AS DateEnd,
          m.Severity,
          m.Status,
          e.Name          AS EmployeeName,
          att.AttractionName,
          att.AttractionType,
          a.AreaName
        FROM maintenance m
        LEFT JOIN employee  e   ON m.EmployeeID   = e.EmployeeID
        LEFT JOIN attraction att ON m.AttractionID = att.AttractionID
        LEFT JOIN area       a   ON att.AreaID     = a.AreaID
        WHERE 1=1
          AND (? IS NULL OR ? = '' OR m.DateStart >= ?)
          AND (? IS NULL OR ? = '' OR m.DateEnd   <= ?)
          AND (? IS NULL OR ? = '' OR m.Severity   = ?)
          AND (? IS NULL OR ? = '' OR e.EmployeeID = ?)
          AND (? IS NULL OR ? = '' OR a.AreaID     = ?)
        ORDER BY m.DateStart DESC
      `, [
        startDate,  startDate,  startDate,
        endDate,    endDate,    endDate,
        severity,   severity,   severity,
        employeeId, employeeId, employeeId,
        areaId,     areaId,     areaId,
      ]);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // ALERT REPORT
    // Full history from maintenancealert table (what trg_ride_maintenance inserts into)
    // Joined with attraction for name + severity.
    // Used for the Reports tab table — not the polling toast alerts.
    // =========================
    if (parsedUrl.pathname === "/alert-report" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`
        SELECT
          ma.AlertID,
          att.AttractionName,
          att.SeverityLevel,
          ma.AlertMessage,
          DATE_FORMAT(ma.CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt,
          ma.Handled
        FROM maintenancealert ma
        JOIN attraction att ON ma.AttractionID = att.AttractionID
        ORDER BY ma.CreatedAt DESC
        LIMIT 50
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // ALERTS — TOAST POLLING
    // Returns only unhandled alerts with their AlertID so the frontend
    // can deduplicate using seenAlertIds.
    // This is what trg_ride_maintenance writes to via maintenancealert table,
    // surfaced through the activemaintenancealerts view (Handled = 'No').
    // =========================
    if (parsedUrl.pathname === "/alerts" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      // activemaintenancealerts view already filters Handled = 'No'
      const [rows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts
        ORDER BY CreatedAt DESC
        LIMIT 10
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // WEATHER REPORT
    // Full weather table for the Reports tab.
    // trg_weather_shutdown fires AFTER INSERT here and updates attraction statuses.
    // =========================
    if (parsedUrl.pathname === "/weather-report" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`
        SELECT
          DATE_FORMAT(WeatherDate, '%Y-%m-%d') AS WeatherDate,
          SeverityLevel,
          HighTemp,
          LowTemp,
          AttractionOperationStatus
        FROM weather
        ORDER BY WeatherDate DESC
        LIMIT 30
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // AREA WORKLOAD
    // Breakdown of tasks per area by status — used in Reports tab.
    // =========================
    if (parsedUrl.pathname === "/area-workload" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const [rows] = await db.query(`
        SELECT
          a.AreaName,
          COUNT(*)                                                  AS total,
          SUM(m.Status = 'Pending')                                 AS pending,
          SUM(m.Status = 'In Progress')                             AS inProgress,
          SUM(m.Status = 'Completed')                               AS completed
        FROM maintenanceassignment m
        JOIN area a ON m.AreaID = a.AreaID
        GROUP BY a.AreaID, a.AreaName
        ORDER BY total DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows));
    }

    // =========================
    // NOTIFICATIONS
    // Five live sources — see inline comments for which trigger each maps to.
    // =========================
    if (parsedUrl.pathname === "/notifications" && req.method === "GET") {
      const user = verifyToken(req);
      if (!user) { res.writeHead(401); return res.end("Unauthorized"); }

      const notifications = [];

      // 1. DB trigger alerts: trg_ride_maintenance → maintenancealert → activemaintenancealerts view
      const [alertRows] = await db.query(`
        SELECT AlertID, AttractionName, SeverityLevel, AlertMessage,
               DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt
        FROM activemaintenancealerts
        ORDER BY CreatedAt DESC LIMIT 20
      `);
      alertRows.forEach((row) => {
        notifications.push({
          type:     "inspection",
          severity: row.SeverityLevel === "Severe" ? "critical" : "high",
          title:    `Maintenance Alert: ${row.AttractionName}`,
          detail:   `${row.AlertMessage} — flagged at ${row.CreatedAt}`,
        });
      });

      // 2. Weather closures: trg_weather_shutdown → attraction.Status = 'ClosedDueToWeather'
      const [weatherClosures] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status = 'ClosedDueToWeather'
        ORDER BY att.AttractionName ASC
      `);
      weatherClosures.forEach((row) => {
        notifications.push({
          type:     "weather",
          severity: "critical",
          title:    `Weather Closure: ${row.AttractionName}`,
          detail:   `${row.AttractionType} in ${row.AreaName || "unknown area"} shut down by weather trigger. Inspect before reopening.`,
        });
      });

      // 3. General maintenance status — NeedsMaintenance, UnderMaintenance, Closed
      const [shutdownRides] = await db.query(`
        SELECT att.AttractionName, att.AttractionType, att.Status, att.SeverityLevel, a.AreaName
        FROM attraction att
        LEFT JOIN area a ON att.AreaID = a.AreaID
        WHERE att.Status IN ('NeedsMaintenance', 'UnderMaintenance', 'Closed')
        ORDER BY FIELD(att.SeverityLevel, 'Severe', 'Low', 'None'), att.AttractionName ASC
      `);
      shutdownRides.forEach((row) => {
        const statusLabel = {
          NeedsMaintenance: "requires immediate maintenance",
          UnderMaintenance: "is currently under maintenance",
          Closed:           "is closed",
        }[row.Status] || row.Status;
        notifications.push({
          type:     "shutdown",
          severity: row.SeverityLevel === "Severe" ? "critical" : "high",
          title:    `Ride Status: ${row.AttractionName}`,
          detail:   `${row.AttractionType} in ${row.AreaName || "unknown area"} ${statusLabel}. Severity: ${row.SeverityLevel || "None"}.`,
        });
      });

      // 4. Overdue assignments — past DueDate, not Completed
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
        const desc = t.TaskDescription.length > 70
          ? t.TaskDescription.substring(0, 70) + "..." : t.TaskDescription;
        notifications.push({
          type:     "overdue",
          severity: "high",
          title:    `Overdue Task: ${t.AreaName || "Unknown Area"}`,
          detail:   `Task #${t.MaintenanceAssignmentID} assigned to ${t.EmployeeName} — due ${t.DueDate}. "${desc}"`,
        });
      });

      // 5. Recent high/medium weather (last 3 days) — trg_weather_shutdown source
      const [recentWeather] = await db.query(`
        SELECT DATE_FORMAT(WeatherDate, '%Y-%m-%d') AS WeatherDate,
               HighTemp, LowTemp, SeverityLevel, AttractionOperationStatus
        FROM weather
        WHERE SeverityLevel IN ('High', 'Medium')
          AND WeatherDate >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        ORDER BY WeatherDate DESC LIMIT 1
      `);
      if (recentWeather.length > 0) {
        const w = recentWeather[0];
        notifications.push({
          type:     "weather",
          severity: w.SeverityLevel === "High" ? "critical" : "medium",
          title:    `Weather Warning — ${w.WeatherDate}`,
          detail:   `Severity: ${w.SeverityLevel}. Temp ${w.LowTemp}°–${w.HighTemp}°. Park status: ${w.AttractionOperationStatus}.`,
        });
      }

      // Sort critical → high → medium
      const order = { critical: 0, high: 1, medium: 2 };
      notifications.sort((a, b) => order[a.severity] - order[b.severity]);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ notifications }));
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

const PORT = process.env.PORT || 3008;
server.listen(PORT, () => console.log(`Maintenance server running on port ${PORT}`));