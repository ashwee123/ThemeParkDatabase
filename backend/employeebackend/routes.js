import { query } from "./db.js";
import { formatDateOnly, formatDateTime, formatTime, num } from "./format.js";

const REPORT_TYPES = new Set(["Broken Attraction", "Stolen Item"]);

export async function listEmployees() {
  const rows = await query(
    `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate,
            e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON e.AreaID = a.AreaID
     ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`
  );
  return rows.map(normalizeEmployee);
}

export async function getEmployee(employeeId) {
  const rows = await query(
    `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate,
            e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON e.AreaID = a.AreaID
     WHERE e.EmployeeID = ?
     LIMIT 1`,
    [employeeId]
  );
  const row = rows[0];
  return row ? normalizeEmployee(row) : null;
}

function normalizeEmployee(row) {
  return {
    EmployeeID: row.EmployeeID,
    Name: row.Name,
    Position: row.Position,
    Salary: num(row.Salary),
    HireDate: formatDateOnly(row.HireDate),
    ManagerID: row.ManagerID != null ? row.ManagerID : null,
    AreaID: row.AreaID != null ? row.AreaID : null,
    AreaName: row.AreaName != null ? row.AreaName : null,
  };
}

export async function getShifts(employeeId) {
  const rows = await query(
    `SELECT ShiftID, EmployeeID, ShiftDate, StartTime, EndTime
     FROM shift
     WHERE EmployeeID = ?
     ORDER BY ShiftDate, StartTime`,
    [employeeId]
  );
  return rows.map((r) => ({
    ShiftID: r.ShiftID,
    EmployeeID: r.EmployeeID,
    ShiftDate: formatDateOnly(r.ShiftDate),
    StartTime: formatTime(r.StartTime),
    EndTime: formatTime(r.EndTime),
  }));
}

export async function getTimelog(employeeId) {
  const rows = await query(
    `SELECT LogID, EmployeeID, ClockIn, ClockOut, HoursWorked
     FROM timelog
     WHERE EmployeeID = ?
     ORDER BY ClockIn DESC`,
    [employeeId]
  );
  return rows.map((r) => ({
    LogID: r.LogID,
    EmployeeID: r.EmployeeID,
    ClockIn: formatDateTime(r.ClockIn),
    ClockOut: formatDateTime(r.ClockOut),
    HoursWorked: num(r.HoursWorked),
  }));
}

export async function getPerformance(employeeId) {
  const rows = await query(
    `SELECT PerformanceID, EmployeeID, ReviewDate, PerformanceScore, WorkloadNotes
     FROM employeeperformance
     WHERE EmployeeID = ?
     ORDER BY ReviewDate DESC`,
    [employeeId]
  );
  return rows.map((r) => ({
    PerformanceID: r.PerformanceID,
    EmployeeID: r.EmployeeID,
    ReviewDate: formatDateOnly(r.ReviewDate),
    PerformanceScore: num(r.PerformanceScore),
    WorkloadNotes: r.WorkloadNotes ?? null,
  }));
}

export async function getMaintenanceAssignments(employeeId) {
  const rows = await query(
    `SELECT MaintenanceAssignmentID, EmployeeID, AreaID, TaskDescription, Status, DueDate, CreatedAt
     FROM maintenanceassignment
     WHERE EmployeeID = ?
     ORDER BY CreatedAt DESC`,
    [employeeId]
  );
  return rows.map((r) => ({
    MaintenanceAssignmentID: r.MaintenanceAssignmentID,
    EmployeeID: r.EmployeeID,
    AreaID: r.AreaID != null ? r.AreaID : null,
    TaskDescription: r.TaskDescription,
    Status: r.Status,
    DueDate: formatDateOnly(r.DueDate),
    CreatedAt: formatDateTime(r.CreatedAt),
  }));
}

export async function createIncidentReport(body) {
  const employeeId = Number(body.EmployeeID);
  if (!Number.isInteger(employeeId) || employeeId < 1) {
    const err = new Error("EmployeeID must be a positive integer");
    err.statusCode = 400;
    throw err;
  }
  const reportType = body.ReportType;
  if (!reportType || !REPORT_TYPES.has(String(reportType))) {
    const err = new Error("ReportType must be 'Broken Attraction' or 'Stolen Item'");
    err.statusCode = 400;
    throw err;
  }
  const description = body.Description != null ? String(body.Description).trim() : "";
  if (!description) {
    const err = new Error("Description is required");
    err.statusCode = 400;
    throw err;
  }

  let attractionId = body.AttractionID;
  let itemId = body.ItemID;
  if (attractionId === "" || attractionId === undefined) attractionId = null;
  if (itemId === "" || itemId === undefined) itemId = null;
  if (attractionId != null) attractionId = Number(attractionId);
  if (itemId != null) itemId = Number(itemId);
  if (attractionId != null && !Number.isInteger(attractionId)) {
    const err = new Error("AttractionID must be an integer or null");
    err.statusCode = 400;
    throw err;
  }
  if (itemId != null && !Number.isInteger(itemId)) {
    const err = new Error("ItemID must be an integer or null");
    err.statusCode = 400;
    throw err;
  }

  const result = await query(
    `INSERT INTO incidentreport (EmployeeID, ReportType, Description, AttractionID, ItemID)
     VALUES (?, ?, ?, ?, ?)`,
    [employeeId, reportType, description, attractionId, itemId]
  );

  const insertId = result.insertId != null ? Number(result.insertId) : null;
  return { ReportID: insertId, ok: true };
}
