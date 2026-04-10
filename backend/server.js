"use strict";

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";

function poolConfig() {
  const ssl =
    process.env.MYSQL_SSL === "1" || process.env.MYSQL_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined;
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "newthemepark",
    waitForConnections: true,
    connectionLimit: 10,
    ssl,
  };
}

let pool;
function getPool() {
  if (!pool) pool = mysql.createPool(poolConfig());
  return pool;
}

const app = express();
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireEmployee(req, res, next) {
  if (!req.session?.employeeId) {
    return res.status(401).json({ error: "Not signed in" });
  }
  next();
}

app.post("/api/login", async (req, res) => {
  const employeeId = Number(req.body?.employeeId);
  const name = String(req.body?.name || "").trim();
  if (!Number.isInteger(employeeId) || employeeId <= 0 || !name) {
    return res.status(400).json({ error: "Employee ID and name are required" });
  }
  try {
    const [rows] = await getPool().execute(
      "SELECT EmployeeID, Name FROM employee WHERE EmployeeID = ? AND LOWER(TRIM(Name)) = LOWER(?)",
      [employeeId, name]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid employee ID or name" });
    }
    req.session.employeeId = rows[0].EmployeeID;
    res.json({ ok: true, employeeId: rows[0].EmployeeID });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  res.json({ signedIn: !!req.session?.employeeId });
});

async function loadProfile(p, employeeId) {
  const [rows] = await p.execute(
    `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID,
            a.AreaName,
            m.Name AS ManagerName
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     LEFT JOIN employee m ON m.EmployeeID = e.ManagerID
     WHERE e.EmployeeID = ?`,
    [employeeId]
  );
  return rows[0] || null;
}

app.get("/api/me", requireEmployee, async (req, res) => {
  try {
    const profile = await loadProfile(getPool(), req.session.employeeId);
    if (!profile) return res.status(404).json({ error: "Employee not found" });
    res.json(profile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/shifts", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT ShiftID, ShiftDate, StartTime, EndTime
       FROM shift WHERE EmployeeID = ?
       ORDER BY ShiftDate DESC, StartTime DESC`,
      [req.session.employeeId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/timelogs", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT LogID, ClockIn, ClockOut, HoursWorked
       FROM timelog WHERE EmployeeID = ?
       ORDER BY ClockIn DESC`,
      [req.session.employeeId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/performance", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT PerformanceID, ReviewDate, PerformanceScore, WorkloadNotes
       FROM employeeperformance WHERE EmployeeID = ?
       ORDER BY ReviewDate DESC`,
      [req.session.employeeId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/maintenance-assignments", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT m.MaintenanceAssignmentID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
              a.AreaName
       FROM maintenanceassignment m
       LEFT JOIN area a ON a.AreaID = m.AreaID
       WHERE m.EmployeeID = ?
       ORDER BY m.CreatedAt DESC`,
      [req.session.employeeId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/incidents", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT ReportID, ReportType, Description, AttractionID, ItemID, ReportDate
       FROM incidentreport WHERE EmployeeID = ?
       ORDER BY ReportDate DESC`,
      [req.session.employeeId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/incidents", requireEmployee, async (req, res) => {
  const reportType = req.body?.reportType;
  const description = String(req.body?.description || "").trim();
  const allowed = ["Broken Attraction", "Stolen Item"];
  if (!allowed.includes(reportType)) {
    return res.status(400).json({ error: "Invalid report type" });
  }
  if (!description) {
    return res.status(400).json({ error: "Description is required" });
  }
  const attractionId = req.body?.attractionId != null && req.body.attractionId !== ""
    ? Number(req.body.attractionId)
    : null;
  const itemId =
    req.body?.itemId != null && req.body.itemId !== "" ? Number(req.body.itemId) : null;
  if (attractionId != null && !Number.isInteger(attractionId)) {
    return res.status(400).json({ error: "Invalid attraction ID" });
  }
  if (itemId != null && !Number.isInteger(itemId)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }
  try {
    const [result] = await getPool().execute(
      `INSERT INTO incidentreport (EmployeeID, ReportType, Description, AttractionID, ItemID)
       VALUES (?, ?, ?, ?, ?)`,
      [req.session.employeeId, reportType, description, attractionId, itemId]
    );
    res.status(201).json({ reportId: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/lookups/attractions", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      "SELECT AttractionID, AttractionName, AttractionType, Status FROM attraction ORDER BY AttractionName"
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/lookups/retail-items", requireEmployee, async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      "SELECT ItemID, ItemName FROM retailitem WHERE IsActive = 1 ORDER BY ItemName"
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Employee portal http://localhost:${PORT}`);
});
