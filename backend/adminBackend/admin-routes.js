import { getPool } from "./db.js";
import { pbkdf2Hash } from "./password-hash.js";

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
    [[{ visitorReviewsTotal }]],
    [[{ visitorReviewsLast30d }]],
    [[{ visitorReviewsAvgRating30d }]],
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
    p.execute("SELECT COUNT(*) AS visitorReviewsTotal FROM review WHERE IsActive = 1"),
    p.execute(
      `SELECT COUNT(*) AS visitorReviewsLast30d FROM review
       WHERE IsActive = 1 AND DateSubmitted >= (CURRENT_DATE - INTERVAL 30 DAY)`
    ),
    p.execute(
      `SELECT AVG(Feedback) AS visitorReviewsAvgRating30d FROM review
       WHERE IsActive = 1 AND DateSubmitted >= (CURRENT_DATE - INTERVAL 30 DAY)`
    ),
  ]);
  const avgRaw = visitorReviewsAvgRating30d;
  const visitorReviewsAvg30dNum =
    avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw) : null;
  return {
    visitorsTotal,
    visitorsActive,
    ticketsTotal,
    ticketsActive,
    retailTxCount,
    retailRevenue: retailRevenue != null ? Number(retailRevenue) : 0,
    incidents90d,
    visitorReviewsTotal,
    visitorReviewsLast30d,
    visitorReviewsAvgRating30d: visitorReviewsAvg30dNum,
  };
}

/** Visitor-area reviews (1–10 + comment), including rows synced from the visitor portal feedback form — for HR / reporting. */
export async function listVisitorReviewsReport(limit) {
  const p = getPool();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 10000);
  const [rows] = await p.execute(
    `SELECT r.ReviewID, r.VisitorID, v.Name AS VisitorName, r.AreaID, ar.AreaName,
            r.Feedback AS Rating, r.Comment, r.DateSubmitted
     FROM review r
     INNER JOIN area ar ON ar.AreaID = r.AreaID
     LEFT JOIN visitor v ON v.VisitorID = r.VisitorID
     WHERE r.IsActive = 1
     ORDER BY r.ReviewID DESC
     LIMIT ?`,
    [lim]
  );
  return rows.map((r) => ({
    ...r,
    DateSubmitted: rowDate(r.DateSubmitted),
  }));
}

export async function updateAttractionStatus(attractionId, status) {
  const id = Number(attractionId);
  if (!Number.isInteger(id) || id < 1) return false;
  if (!ATTRACTION_STATUSES.includes(status)) return false;
  const [result] = await getPool().execute("UPDATE attraction SET Status = ? WHERE AttractionID = ?", [status, id]);
  return result.affectedRows > 0;
}

const VISITOR_GENDERS = new Set(["Male", "Female", "Other", "Prefer not to say"]);

export async function listHrManagers() {
  const [rows] = await getPool().execute(
    `SELECT hm.ManagerID, m.ManagerName, hm.AreaID, a.AreaName
     FROM hrmanager hm
     INNER JOIN manager m ON m.ManagerID = hm.ManagerID
     LEFT JOIN area a ON a.AreaID = hm.AreaID
     ORDER BY hm.ManagerID`
  );
  return rows;
}

/**
 * Adds a row to `manager` and `hrmanager`. Each area may appear at most once in `hrmanager`.
 */
export async function createHrManager({ managerName, areaId }) {
  const name = String(managerName || "").trim();
  const aid = Number(areaId);
  if (!name) {
    const err = new Error("Manager name is required");
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(aid) || aid < 1) {
    const err = new Error("Valid numeric AreaID is required");
    err.statusCode = 400;
    throw err;
  }
  const pool = getPool();
  const [areaRows] = await pool.execute("SELECT 1 AS ok FROM area WHERE AreaID = ? LIMIT 1", [aid]);
  if (!areaRows.length) {
    const err = new Error("AreaID not found in area");
    err.statusCode = 400;
    throw err;
  }
  const [takenRows] = await pool.execute("SELECT COUNT(*) AS taken FROM hrmanager WHERE AreaID = ?", [aid]);
  const taken = Number(takenRows[0].taken);
  if (taken > 0) {
    const err = new Error("That area already has an HR manager assigned");
    err.statusCode = 400;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [nextRows] = await conn.execute("SELECT COALESCE(MAX(ManagerID), 0) + 1 AS nextId FROM manager");
    const nextId = Number(nextRows[0].nextId);
    await conn.execute("INSERT INTO manager (ManagerID, ManagerName) VALUES (?, ?)", [nextId, name]);
    await conn.execute("INSERT INTO hrmanager (ManagerID, AreaID) VALUES (?, ?)", [nextId, aid]);
    await conn.commit();
    const [sel] = await pool.execute(
      `SELECT hm.ManagerID, m.ManagerName, hm.AreaID, a.AreaName
       FROM hrmanager hm
       INNER JOIN manager m ON m.ManagerID = hm.ManagerID
       LEFT JOIN area a ON a.AreaID = hm.AreaID
       WHERE hm.ManagerID = ?`,
      [nextId]
    );
    return sel[0];
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function createEmployee({ name, position, salary, hireDate, managerId, areaId }) {
  const n = String(name || "").trim();
  if (!n) {
    const err = new Error("Employee name is required");
    err.statusCode = 400;
    throw err;
  }
  const pos = String(position || "").trim() || null;
  let sal = null;
  if (salary !== "" && salary != null) {
    sal = Number(salary);
    if (!Number.isFinite(sal)) {
      const err = new Error("Invalid salary");
      err.statusCode = 400;
      throw err;
    }
  }
  const hireRaw = hireDate != null ? String(hireDate).trim() : "";
  const hire = hireRaw ? hireRaw.slice(0, 10) : null;
  let mid = null;
  if (managerId !== "" && managerId != null) {
    mid = Number(managerId);
    if (!Number.isInteger(mid) || mid < 1) {
      const err = new Error("Invalid ManagerID");
      err.statusCode = 400;
      throw err;
    }
  }
  let aid = null;
  if (areaId !== "" && areaId != null) {
    aid = Number(areaId);
    if (!Number.isInteger(aid) || aid < 1) {
      const err = new Error("Invalid AreaID");
      err.statusCode = 400;
      throw err;
    }
  }
  const pool = getPool();
  if (mid != null) {
    const [mRows] = await pool.execute("SELECT 1 AS ok FROM manager WHERE ManagerID = ? LIMIT 1", [mid]);
    if (!mRows.length) {
      const err = new Error("ManagerID not found (add an HR/retail manager row first)");
      err.statusCode = 400;
      throw err;
    }
  }
  if (aid != null) {
    const [aRows] = await pool.execute("SELECT 1 AS ok FROM area WHERE AreaID = ? LIMIT 1", [aid]);
    if (!aRows.length) {
      const err = new Error("AreaID not found");
      err.statusCode = 400;
      throw err;
    }
  }
  const [res] = await pool.execute(
    `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [n, pos, sal, hire || null, mid, aid]
  );
  const id = res.insertId;
  const [rows] = await pool.execute(
    `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     WHERE e.EmployeeID = ?`,
    [id]
  );
  const r = rows[0];
  return {
    ...r,
    Salary: r.Salary != null ? Number(r.Salary) : null,
    HireDate: rowDate(r.HireDate),
  };
}

export async function createVisitor({ name, phone, email, password, gender, age }) {
  const n = String(name || "").trim();
  const em = String(email || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!n || !em) {
    const err = new Error("Name and email are required");
    err.statusCode = 400;
    throw err;
  }
  if (pw.length < 6) {
    const err = new Error("Password must be at least 6 characters");
    err.statusCode = 400;
    throw err;
  }
  let g = null;
  if (gender != null && String(gender).trim() !== "") {
    g = String(gender).trim();
    if (!VISITOR_GENDERS.has(g)) {
      const err = new Error("Gender must be Male, Female, Other, or Prefer not to say");
      err.statusCode = 400;
      throw err;
    }
  }
  let ag = null;
  if (age !== "" && age != null) {
    ag = Number(age);
    if (!Number.isInteger(ag) || ag < 0 || ag > 120) {
      const err = new Error("Age must be an integer from 0 to 120");
      err.statusCode = 400;
      throw err;
    }
  }
  const ph = phone != null && String(phone).trim() !== "" ? String(phone).trim() : null;
  const PasswordHash = pbkdf2Hash(pw);
  const pool = getPool();
  try {
    const [ins] = await pool.execute(
      `INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [n, ph, em, PasswordHash, g, ag]
    );
    const vid = ins.insertId;
    const [rows] = await pool.execute(
      "SELECT VisitorID, Name, Email, Phone, Gender, Age, IsActive, CreatedAt FROM visitor WHERE VisitorID = ?",
      [vid]
    );
    const r = rows[0];
    return {
      ...r,
      CreatedAt: r.CreatedAt != null ? rowDateTime(r.CreatedAt) : null,
    };
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      const err = new Error("That email is already registered");
      err.statusCode = 400;
      throw err;
    }
    throw e;
  }
}
