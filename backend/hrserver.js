"use strict";

require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const PORT = Number(process.env.PORT) || 3001;

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

function dbHint(err) {
  if (err.code === "ECONNREFUSED") {
    return "Check MySQL is running and MYSQL_* env vars. On Windows, start the MySQL service (not only Workbench).";
  }
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return "Verify MYSQL_USER and MYSQL_PASSWORD.";
  }
  return undefined;
}

function sendDbError(res, err, status = 500) {
  console.error(err);
  const body = {
    error: "Database error",
    sqlMessage: err.sqlMessage,
    code: err.code,
  };
  const hint = dbHint(err);
  if (hint) body.hint = hint;
  res.status(status).json(body);
}

const app = express();
app.use(express.json());

app.get("/managers", async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT h.ManagerID, m.ManagerName, a.AreaName
       FROM hrmanager h
       INNER JOIN manager m ON m.ManagerID = h.ManagerID
       LEFT JOIN area a ON a.AreaID = h.AreaID
       ORDER BY h.ManagerID`
    );
    res.json(rows);
  } catch (e) {
    sendDbError(res, e);
  }
});

app.get("/employees", async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
       FROM employee
       ORDER BY EmployeeID`
    );
    res.json(rows);
  } catch (e) {
    sendDbError(res, e);
  }
});

app.get("/employees/by-area", async (req, res) => {
  try {
    const p = getPool();
    const [areas] = await p.execute(
      `SELECT AreaID, AreaName FROM area ORDER BY AreaID`
    );
    const [emps] = await p.execute(
      `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
       FROM employee
       ORDER BY EmployeeID`
    );
    const groups = areas.map((a) => ({
      AreaID: a.AreaID,
      AreaName: a.AreaName,
      employees: emps.filter((e) => e.AreaID === a.AreaID),
    }));
    const unassigned = emps.filter((e) => e.AreaID == null);
    if (unassigned.length) {
      groups.push({
        AreaID: null,
        AreaName: "Unassigned",
        employees: unassigned,
      });
    }
    res.json(groups);
  } catch (e) {
    sendDbError(res, e);
  }
});

app.post("/employees", async (req, res) => {
  const Name = String(req.body?.Name ?? "").trim();
  const Position = String(req.body?.Position ?? "").trim();
  const Salary = req.body?.Salary;
  const HireDate = req.body?.HireDate;
  const ManagerID =
    req.body?.ManagerID === "" || req.body?.ManagerID == null
      ? null
      : Number(req.body.ManagerID);
  const AreaID =
    req.body?.AreaID === "" || req.body?.AreaID == null
      ? null
      : Number(req.body.AreaID);

  if (!Name || !Position) {
    return res.status(400).json({ error: "Name and Position are required" });
  }
  const sal = Number(Salary);
  if (!Number.isFinite(sal) || sal < 0) {
    return res.status(400).json({ error: "Invalid salary" });
  }
  if (!HireDate) {
    return res.status(400).json({ error: "HireDate is required" });
  }
  if (ManagerID != null && !Number.isInteger(ManagerID)) {
    return res.status(400).json({ error: "Invalid ManagerID" });
  }
  if (AreaID != null && !Number.isInteger(AreaID)) {
    return res.status(400).json({ error: "Invalid AreaID" });
  }

  try {
    const [result] = await getPool().execute(
      `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Name, Position, sal, HireDate, ManagerID, AreaID]
    );
    res.status(201).json({ EmployeeID: result.insertId });
  } catch (e) {
    if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({
        error: "Invalid reference",
        sqlMessage: e.sqlMessage,
        hint: "ManagerID must exist in manager; AreaID must exist in area.",
      });
    }
    sendDbError(res, e);
  }
});

app.put("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid employee id" });
  }
  const Name = String(req.body?.Name ?? "").trim();
  const Position = String(req.body?.Position ?? "").trim();
  const Salary = req.body?.Salary;
  const HireDate = req.body?.HireDate;
  const ManagerID =
    req.body?.ManagerID === "" || req.body?.ManagerID == null
      ? null
      : Number(req.body.ManagerID);
  const AreaID =
    req.body?.AreaID === "" || req.body?.AreaID == null
      ? null
      : Number(req.body.AreaID);

  if (!Name || !Position) {
    return res.status(400).json({ error: "Name and Position are required" });
  }
  const sal = Number(Salary);
  if (!Number.isFinite(sal) || sal < 0) {
    return res.status(400).json({ error: "Invalid salary" });
  }
  if (!HireDate) {
    return res.status(400).json({ error: "HireDate is required" });
  }
  if (ManagerID != null && !Number.isInteger(ManagerID)) {
    return res.status(400).json({ error: "Invalid ManagerID" });
  }
  if (AreaID != null && !Number.isInteger(AreaID)) {
    return res.status(400).json({ error: "Invalid AreaID" });
  }

  try {
    const [result] = await getPool().execute(
      `UPDATE employee SET Name = ?, Position = ?, Salary = ?, HireDate = ?, ManagerID = ?, AreaID = ?
       WHERE EmployeeID = ?`,
      [Name, Position, sal, HireDate, ManagerID, AreaID, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({
        error: "Invalid reference",
        sqlMessage: e.sqlMessage,
      });
    }
    sendDbError(res, e);
  }
});

app.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid employee id" });
  }
  try {
    const [result] = await getPool().execute(
      "DELETE FROM employee WHERE EmployeeID = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_ROW_IS_REFERENCED_2" || e.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        error: "Cannot delete employee: referenced by other rows.",
        sqlMessage: e.sqlMessage,
        hint: "Remove related shifts, time logs, incidents, or maintenance rows first.",
      });
    }
    sendDbError(res, e);
  }
});

app.put("/assign-manager", async (req, res) => {
  const EmployeeID = Number(req.body?.EmployeeID);
  const ManagerID =
    req.body?.ManagerID === "" || req.body?.ManagerID == null
      ? null
      : Number(req.body.ManagerID);

  if (!Number.isInteger(EmployeeID) || EmployeeID <= 0) {
    return res.status(400).json({ error: "Valid EmployeeID is required" });
  }
  if (ManagerID != null && !Number.isInteger(ManagerID)) {
    return res.status(400).json({ error: "Invalid ManagerID" });
  }

  try {
    const [result] = await getPool().execute(
      "UPDATE employee SET ManagerID = ? WHERE EmployeeID = ?",
      [ManagerID, EmployeeID]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({ error: "ManagerID must exist in manager table.", sqlMessage: e.sqlMessage });
    }
    sendDbError(res, e);
  }
});

app.get("/maintenance", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const allowed = ["Pending", "In Progress", "Completed"];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  try {
    let sql = `SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
        e.Name AS EmployeeName, a.AreaName
      FROM maintenanceassignment m
      LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
      LEFT JOIN area a ON a.AreaID = m.AreaID`;
    const params = [];
    if (status) {
      sql += " WHERE m.Status = ?";
      params.push(status);
    }
    sql += " ORDER BY m.CreatedAt DESC";
    const [rows] = await getPool().execute(sql, params);
    res.json(rows);
  } catch (e) {
    sendDbError(res, e);
  }
});

app.post("/maintenance", async (req, res) => {
  const EmployeeID = Number(req.body?.EmployeeID);
  const AreaID =
    req.body?.AreaID === "" || req.body?.AreaID == null
      ? null
      : Number(req.body.AreaID);
  const TaskDescription = String(req.body?.TaskDescription ?? "").trim();
  const Status = String(req.body?.Status ?? "Pending");
  const DueDate =
    req.body?.DueDate === "" || req.body?.DueDate == null
      ? null
      : String(req.body.DueDate);

  const allowed = ["Pending", "In Progress", "Completed"];
  if (!Number.isInteger(EmployeeID) || EmployeeID <= 0) {
    return res.status(400).json({ error: "Valid EmployeeID is required" });
  }
  if (!TaskDescription) {
    return res.status(400).json({ error: "TaskDescription is required" });
  }
  if (!allowed.includes(Status)) {
    return res.status(400).json({ error: "Invalid Status" });
  }
  if (AreaID != null && !Number.isInteger(AreaID)) {
    return res.status(400).json({ error: "Invalid AreaID" });
  }

  try {
    const [result] = await getPool().execute(
      `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
       VALUES (?, ?, ?, ?, ?)`,
      [EmployeeID, AreaID, TaskDescription, Status, DueDate]
    );
    res.status(201).json({ MaintenanceAssignmentID: result.insertId });
  } catch (e) {
    if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({ error: "Invalid EmployeeID or AreaID", sqlMessage: e.sqlMessage });
    }
    sendDbError(res, e);
  }
});

app.put("/maintenance/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const Status = String(req.body?.Status ?? "");
  const allowed = ["Pending", "In Progress", "Completed"];
  if (!allowed.includes(Status)) {
    return res.status(400).json({ error: "Invalid Status" });
  }
  try {
    const [result] = await getPool().execute(
      "UPDATE maintenanceassignment SET Status = ? WHERE MaintenanceAssignmentID = ?",
      [Status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    sendDbError(res, e);
  }
});

app.delete("/maintenance/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }
  try {
    const [result] = await getPool().execute(
      "DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    sendDbError(res, e);
  }
});

app.get("/performance", async (req, res) => {
  try {
    const [rows] = await getPool().execute(
      `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes,
              e.Name AS EmployeeName
       FROM employeeperformance p
       LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
       ORDER BY p.ReviewDate DESC, p.PerformanceID DESC`
    );
    res.json(rows);
  } catch (e) {
    sendDbError(res, e);
  }
});

async function loadReportPayload() {
  const p = getPool();
  const [managers] = await p.execute(
    `SELECT h.ManagerID, m.ManagerName, a.AreaName
     FROM hrmanager h
     INNER JOIN manager m ON m.ManagerID = h.ManagerID
     LEFT JOIN area a ON a.AreaID = h.AreaID
     ORDER BY h.ManagerID`
  );
  const [employees] = await p.execute(
    `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID FROM employee ORDER BY EmployeeID`
  );
  const [areas] = await p.execute(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  const employeesByArea = areas.map((a) => ({
    AreaID: a.AreaID,
    AreaName: a.AreaName,
    employees: employees.filter((e) => e.AreaID === a.AreaID),
  }));
  const unassigned = employees.filter((e) => e.AreaID == null);
  if (unassigned.length) {
    employeesByArea.push({
      AreaID: null,
      AreaName: "Unassigned",
      employees: unassigned,
    });
  }
  const [maintenance] = await p.execute(
    `SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
            e.Name AS EmployeeName, a.AreaName
     FROM maintenanceassignment m
     LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
     LEFT JOIN area a ON a.AreaID = m.AreaID
     ORDER BY m.CreatedAt DESC`
  );
  const [performance] = await p.execute(
    `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes, e.Name AS EmployeeName
     FROM employeeperformance p
     LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
     ORDER BY p.ReviewDate DESC`
  );
  return {
    generatedAt: new Date().toISOString(),
    managers,
    employees,
    employeesByArea,
    maintenance,
    performance,
  };
}

app.get("/report", async (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  try {
    const data = await loadReportPayload();
    if (format === "json") {
      const download = req.query.download === "1" || req.query.download === "true";
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (download) {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="hr-data-report.json"'
        );
      }
      return res.send(JSON.stringify(data, null, 2));
    }
    if (format === "md" || format === "markdown") {
      let md = `# HR data report\n\n_Generated: ${data.generatedAt}_\n\n`;
      md += `## Managers (HR)\n\n`;
      for (const m of data.managers) {
        md += `- **${m.ManagerID}** — ${m.ManagerName ?? "—"} (${m.AreaName ?? "no area"})\n`;
      }
      md += `\n## Employees\n\n`;
      md += `| ID | Name | Position | Salary | Hire | Mgr | Area |\n`;
      md += `|---:|---|---|---|---:|---:|---:|\n`;
      for (const e of data.employees) {
        md += `| ${e.EmployeeID} | ${e.Name} | ${e.Position} | ${e.Salary} | ${String(e.HireDate).slice(0, 10)} | ${e.ManagerID ?? "—"} | ${e.AreaID ?? "—"} |\n`;
      }
      md += `\n## By area\n\n`;
      for (const g of data.employeesByArea) {
        md += `### ${g.AreaName} (AreaID: ${g.AreaID ?? "null"})\n\n`;
        if (!g.employees.length) {
          md += `_No employees._\n\n`;
          continue;
        }
        for (const e of g.employees) {
          md += `- ${e.EmployeeID}: **${e.Name}** — ${e.Position}\n`;
        }
        md += `\n`;
      }
      md += `## Maintenance assignments\n\n`;
      for (const m of data.maintenance) {
        md += `- **${m.MaintenanceAssignmentID}** [${m.Status}] ${m.TaskDescription} — ${m.EmployeeName ?? m.EmployeeID} / ${m.AreaName ?? "—"} (due ${m.DueDate ? String(m.DueDate).slice(0, 10) : "—"})\n`;
      }
      md += `\n## Performance\n\n`;
      for (const p of data.performance) {
        md += `- **${p.PerformanceID}** ${p.EmployeeName ?? p.EmployeeID} @ ${String(p.ReviewDate).slice(0, 10)} — score **${p.PerformanceScore}**${p.WorkloadNotes ? ` — _${p.WorkloadNotes}_` : ""}\n`;
      }
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="hr-data-report.md"'
      );
      return res.send(md);
    }
    return res.status(400).json({ error: "Unknown format", hint: "Use format=json or format=md" });
  } catch (e) {
    sendDbError(res, e);
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`HR Manager portal http://localhost:${PORT}`);
});
