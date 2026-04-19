import { getPool } from "./db.js";

function rowDate(d) {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function rowDateTime(d) {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 19).replace("T", " ");
  const s = String(d).replace("T", " ");
  return s.length >= 19 ? s.slice(0, 19) : s;
}

export async function getSummary() {
  const p = getPool();
  const [
    [[{ employees }]],
    [[{ visitorsActive }]],
    [[{ attractions }]],
    [[{ rides }]],
    [[{ openAlerts }]],
    [[{ pendingMaint }]],
    [[{ retailItems }]],
    [[{ lowStock }]],
    [[{ incidents30d }]],
  ] = await Promise.all([
    p.execute("SELECT COUNT(*) AS employees FROM employee"),
    p.execute("SELECT COUNT(*) AS visitorsActive FROM visitor WHERE IsActive = 1"),
    p.execute("SELECT COUNT(*) AS attractions FROM attraction"),
    p.execute("SELECT COUNT(*) AS rides FROM attraction WHERE AttractionType = 'Ride'"),
    p.execute("SELECT COUNT(*) AS openAlerts FROM maintenancealert WHERE Handled = 'No'"),
    p.execute(
      `SELECT COUNT(*) AS pendingMaint FROM maintenanceassignment
       WHERE Status IN ('Pending','In Progress','In progress')`
    ),
    p.execute("SELECT COUNT(*) AS retailItems FROM retailitem WHERE IsActive = 1"),
    p.execute(
      "SELECT COUNT(*) AS lowStock FROM retailitem WHERE IsActive = 1 AND Quantity <= LowStockThreshold"
    ),
    p.execute(
      "SELECT COUNT(*) AS incidents30d FROM incidentreport WHERE ReportDate >= (CURRENT_DATE - INTERVAL 30 DAY)"
    ),
  ]);
  return {
    employees,
    visitorsActive,
    attractions,
    rides,
    openAlerts,
    pendingMaint,
    retailItems,
    lowStock,
    incidents30d,
  };
}

export async function listAreas() {
  const [rows] = await getPool().execute("SELECT AreaID, AreaName FROM area ORDER BY AreaID");
  return rows;
}

export async function listAttractions() {
  const [rows] = await getPool().execute(
    `SELECT a.AttractionID, a.AttractionName, a.AttractionType, a.AreaID, ar.AreaName,
            a.Status, a.QueueCount, a.SeverityLevel
     FROM attraction a
     LEFT JOIN area ar ON ar.AreaID = a.AreaID
     ORDER BY ar.AreaID, a.AttractionName`
  );
  return rows.map((r) => ({
    ...r,
    QueueCount: r.QueueCount != null ? Number(r.QueueCount) : 0,
  }));
}

export async function listEmployees() {
  const [rows] = await getPool().execute(
    `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`
  );
  return rows.map((r) => ({
    ...r,
    Salary: r.Salary != null ? Number(r.Salary) : null,
    HireDate: rowDate(r.HireDate),
  }));
}

export async function listActiveAlerts() {
  const [rows] = await getPool().execute(
    `SELECT ma.AlertID, ma.AttractionID, a.AttractionName, a.SeverityLevel AS AttractionSeverity,
            ma.AlertMessage, ma.CreatedAt, ma.Handled
     FROM maintenancealert ma
     JOIN attraction a ON a.AttractionID = ma.AttractionID
     WHERE ma.Handled = 'No'
     ORDER BY ma.CreatedAt DESC`
  );
  return rows.map((r) => ({
    ...r,
    CreatedAt: rowDateTime(r.CreatedAt),
  }));
}

export async function listMaintenanceAssignments() {
  const [rows] = await getPool().execute(
    `SELECT m.MaintenanceAssignmentID, m.EmployeeID, e.Name AS EmployeeName, m.AreaID, ar.AreaName,
            m.TaskDescription, m.Status, m.DueDate, m.CreatedAt
     FROM maintenanceassignment m
     LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
     LEFT JOIN area ar ON ar.AreaID = m.AreaID
     ORDER BY m.CreatedAt DESC
     LIMIT 200`
  );
  return rows.map((r) => ({
    ...r,
    DueDate: rowDate(r.DueDate),
    CreatedAt: rowDateTime(r.CreatedAt),
  }));
}

export async function listRetailItems() {
  const [rows] = await getPool().execute(
    `SELECT ri.ItemID, ri.ItemName, ri.BuyPrice, ri.SellPrice, ri.DiscountPrice, ri.Quantity,
            ri.LowStockThreshold, ri.IsActive, ri.RetailID, rp.RetailName, rp.AreaID, a.AreaName
     FROM retailitem ri
     JOIN retailplace rp ON rp.RetailID = ri.RetailID
     LEFT JOIN area a ON a.AreaID = rp.AreaID
     ORDER BY ri.ItemID`
  );
  return rows.map((r) => ({
    ...r,
    BuyPrice: Number(r.BuyPrice),
    SellPrice: Number(r.SellPrice),
    DiscountPrice: r.DiscountPrice != null ? Number(r.DiscountPrice) : null,
    Quantity: Number(r.Quantity),
    LowStockThreshold: Number(r.LowStockThreshold),
  }));
}

export async function listIncidents(limit = 100) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT i.ReportID, i.EmployeeID, e.Name AS EmployeeName, i.ReportType, i.Description,
            i.AttractionID, i.ItemID, i.ReportDate
     FROM incidentreport i
     LEFT JOIN employee e ON e.EmployeeID = i.EmployeeID
     ORDER BY i.ReportDate DESC
     LIMIT ?`,
    [lim]
  );
  return rows.map((r) => ({
    ...r,
    ReportDate: rowDateTime(r.ReportDate),
  }));
}

export async function listRecentWeather(limit = 30) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));
  const [rows] = await getPool().execute(
    `SELECT WeatherID, WeatherDate, HighTemp, LowTemp, SeverityLevel, AttractionOperationStatus
     FROM weather
     ORDER BY WeatherDate DESC, WeatherID DESC
     LIMIT ?`,
    [lim]
  );
  return rows.map((r) => ({
    ...r,
    WeatherDate: rowDate(r.WeatherDate),
    HighTemp: r.HighTemp != null ? Number(r.HighTemp) : null,
    LowTemp: r.LowTemp != null ? Number(r.LowTemp) : null,
  }));
}

export async function markAlertHandled(alertId) {
  const [result] = await getPool().execute(
    "UPDATE maintenancealert SET Handled = 'Yes' WHERE AlertID = ? AND Handled = 'No'",
    [alertId]
  );
  return result.affectedRows > 0;
}

const ATTRACTION_STATUSES = [
  "Open",
  "Closed",
  "Restricted",
  "NeedsMaintenance",
  "UnderMaintenance",
  "ClosedDueToWeather",
];

/** Visitor directory for admin oversight (no password hash). */
export async function listVisitors({ q = "", limit = 200 } = {}) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 200));
  const pool = getPool();
  const term = `%${String(q || "").trim()}%`;
  const hasTerm = String(q || "").trim().length > 0;
  const cols = "VisitorID, Name, Email, Phone, Gender, Age, IsActive, CreatedAt";
  const colsNoCreated = "VisitorID, Name, Email, Phone, Gender, Age, IsActive";
  const sql = hasTerm
    ? `SELECT ${cols} FROM visitor WHERE Name LIKE ? OR Email LIKE ? OR Phone LIKE ? ORDER BY VisitorID DESC LIMIT ?`
    : `SELECT ${cols} FROM visitor ORDER BY VisitorID DESC LIMIT ?`;
  const params = hasTerm ? [term, term, term, lim] : [lim];
  let rows;
  try {
    [rows] = await pool.execute(sql, params);
  } catch (e) {
    if (!String(e.message || "").includes("Unknown column 'CreatedAt'")) throw e;
    const sql2 = hasTerm
      ? `SELECT ${colsNoCreated} FROM visitor WHERE Name LIKE ? OR Email LIKE ? OR Phone LIKE ? ORDER BY VisitorID DESC LIMIT ?`
      : `SELECT ${colsNoCreated} FROM visitor ORDER BY VisitorID DESC LIMIT ?`;
    [rows] = await pool.execute(sql2, params);
  }
  return rows.map((r) => ({
    ...r,
    CreatedAt: r.CreatedAt != null ? rowDateTime(r.CreatedAt) : null,
  }));
}

export async function setVisitorActive(visitorId, isActive) {
  const id = Number(visitorId);
  if (!Number.isInteger(id) || id < 1) return false;
  const bit = isActive ? 1 : 0;
  const [result] = await getPool().execute("UPDATE visitor SET IsActive = ? WHERE VisitorID = ?", [bit, id]);
  return result.affectedRows > 0;
}

export async function listTicketsAdmin(limit = 250) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 250));
  const pool = getPool();
  const baseSelect = `t.TicketNumber, t.TicketType, t.Price, t.IssueDate, t.ExpiryDate,
       t.VisitorID, t.IsActive, v.Name AS VisitorName, v.Email AS VisitorEmail`;
  const join = `FROM ticket t JOIN visitor v ON v.VisitorID = t.VisitorID`;
  try {
    const [rows] = await pool.execute(
      `SELECT ${baseSelect.replace("t.TicketType", "t.TicketType, t.DiscountFor")} ${join}
       ORDER BY t.TicketNumber DESC LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      IssueDate: rowDate(r.IssueDate),
      ExpiryDate: rowDate(r.ExpiryDate),
      Price: r.Price != null ? Number(r.Price) : null,
    }));
  } catch (e) {
    if (!String(e.message || "").includes("DiscountFor")) throw e;
    const [rows] = await pool.execute(
      `SELECT ${baseSelect} ${join} ORDER BY t.TicketNumber DESC LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      DiscountFor: "None",
      IssueDate: rowDate(r.IssueDate),
      ExpiryDate: rowDate(r.ExpiryDate),
      Price: r.Price != null ? Number(r.Price) : null,
    }));
  }
}

export async function listShiftsAdmin(limit = 200) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 200));
  const [rows] = await getPool().execute(
    `SELECT s.ShiftID, s.EmployeeID, e.Name AS EmployeeName, s.ShiftDate, s.StartTime, s.EndTime
     FROM shift s
     LEFT JOIN employee e ON e.EmployeeID = s.EmployeeID
     ORDER BY s.ShiftDate DESC, s.ShiftID DESC
     LIMIT ?`,
    [lim]
  );
  return rows.map((r) => ({
    ...r,
    ShiftDate: rowDate(r.ShiftDate),
    StartTime: r.StartTime != null ? String(r.StartTime).slice(0, 8) : null,
    EndTime: r.EndTime != null ? String(r.EndTime).slice(0, 8) : null,
  }));
}

export async function listNotificationLog(limit = 100) {
  const lim = Math.min(300, Math.max(1, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT n.NotificationID, n.ManagerID, n.ItemID, n.Message, n.CreatedAt,
            ri.ItemName, rp.RetailName
     FROM notificationlog n
     LEFT JOIN retailitem ri ON ri.ItemID = n.ItemID
     LEFT JOIN retailplace rp ON rp.RetailID = ri.RetailID
     ORDER BY n.CreatedAt DESC
     LIMIT ?`,
    [lim]
  );
  return rows.map((r) => ({
    ...r,
    CreatedAt: rowDateTime(r.CreatedAt),
  }));
}

export async function getReportSnapshot() {
  const p = getPool();
  const [
    [[{ visitorsTotal }]],
    [[{ visitorsActive }]],
    [[{ ticketsTotal }]],
    [[{ ticketsActive }]],
    [[{ retailTxCount }]],
    [[{ retailRevenue }]],
    [[{ incidents90d }]],
  ] = await Promise.all([
    p.execute("SELECT COUNT(*) AS visitorsTotal FROM visitor"),
    p.execute("SELECT COUNT(*) AS visitorsActive FROM visitor WHERE IsActive = 1"),
    p.execute("SELECT COUNT(*) AS ticketsTotal FROM ticket"),
    p.execute("SELECT COUNT(*) AS ticketsActive FROM ticket WHERE IsActive = 1"),
    p.execute("SELECT COUNT(*) AS retailTxCount FROM transactionlog"),
    p.execute("SELECT COALESCE(SUM(TotalCost), 0) AS retailRevenue FROM transactionlog"),
    p.execute(
      "SELECT COUNT(*) AS incidents90d FROM incidentreport WHERE ReportDate >= (CURRENT_DATE - INTERVAL 90 DAY)"
    ),
  ]);
  return {
    visitorsTotal,
    visitorsActive,
    ticketsTotal,
    ticketsActive,
    retailTxCount,
    retailRevenue: retailRevenue != null ? Number(retailRevenue) : 0,
    incidents90d,
  };
}

export async function updateAttractionStatus(attractionId, status) {
  const id = Number(attractionId);
  if (!Number.isInteger(id) || id < 1) return false;
  if (!ATTRACTION_STATUSES.includes(status)) return false;
  const [result] = await getPool().execute("UPDATE attraction SET Status = ? WHERE AttractionID = ?", [status, id]);
  return result.affectedRows > 0;
}
