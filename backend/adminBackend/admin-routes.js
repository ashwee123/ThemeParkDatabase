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

export async function listAreas({ q = "" } = {}) {
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = "SELECT AreaID, AreaName FROM area";
  const params = [];
  if (hasTerm) {
    sql += " WHERE (AreaName LIKE ? OR CAST(AreaID AS CHAR) LIKE ?)";
    params.push(term, term);
  }
  sql += " ORDER BY AreaID";
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function listAttractions({ q = "" } = {}) {
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT a.AttractionID, a.AttractionName, a.AttractionType, a.AreaID, ar.AreaName,
            a.Status, a.QueueCount, a.SeverityLevel
     FROM attraction a
     LEFT JOIN area ar ON ar.AreaID = a.AreaID`;
  const params = [];
  if (hasTerm) {
    sql += ` WHERE (
       a.AttractionName LIKE ? OR a.AttractionType LIKE ? OR IFNULL(a.Status,'') LIKE ?
       OR IFNULL(a.SeverityLevel,'') LIKE ? OR IFNULL(ar.AreaName,'') LIKE ?
       OR CAST(a.AttractionID AS CHAR) LIKE ? OR CAST(IFNULL(a.AreaID,0) AS CHAR) LIKE ?
     )`;
    params.push(term, term, term, term, term, term, term);
  }
  sql += " ORDER BY ar.AreaID, a.AttractionName";
  const [rows] = await pool.execute(sql, params);
  return rows.map((r) => ({
    ...r,
    QueueCount: r.QueueCount != null ? Number(r.QueueCount) : 0,
  }));
}

export async function listEmployees({ q = "" } = {}) {
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID`;
  const params = [];
  if (hasTerm) {
    sql += ` WHERE (
       e.Name LIKE ? OR e.Position LIKE ? OR IFNULL(a.AreaName,'') LIKE ?
       OR CAST(e.EmployeeID AS CHAR) LIKE ? OR CAST(IFNULL(e.ManagerID,0) AS CHAR) LIKE ?
       OR CAST(IFNULL(e.AreaID,0) AS CHAR) LIKE ?
     )`;
    params.push(term, term, term, term, term, term);
  }
  sql += ` ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`;
  const [rows] = await pool.execute(sql, params);
  return rows.map((r) => ({
    ...r,
    Salary: r.Salary != null ? Number(r.Salary) : null,
    HireDate: rowDate(r.HireDate),
  }));
}

async function ensureAdminEmployeeAccessTable() {
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS admin_employee_access (
      EmployeeID INT NOT NULL PRIMARY KEY,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      DefaultAccessRole VARCHAR(20) NOT NULL DEFAULT 'viewer',
      UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

/** Staff directory with optional row in admin_employee_access (defaults: active, viewer). */
export async function listEmployeesWithAccess({ q = "" } = {}) {
  await ensureAdminEmployeeAccessTable();
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName,
            IFNULL(x.IsActive, 1) AS AccessIsActive,
            IFNULL(NULLIF(TRIM(x.DefaultAccessRole), ''), 'viewer') AS AccessRole,
            x.UpdatedAt AS AccessUpdatedAt
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     LEFT JOIN admin_employee_access x ON x.EmployeeID = e.EmployeeID`;
  const params = [];
  if (hasTerm) {
    sql += ` WHERE (
       e.Name LIKE ? OR e.Position LIKE ? OR IFNULL(a.AreaName,'') LIKE ?
       OR CAST(e.EmployeeID AS CHAR) LIKE ? OR CAST(IFNULL(e.ManagerID,0) AS CHAR) LIKE ?
       OR CAST(IFNULL(e.AreaID,0) AS CHAR) LIKE ?
     )`;
    params.push(term, term, term, term, term, term);
  }
  sql += ` ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`;
  const [rows] = await pool.execute(sql, params);
  return rows.map((r) => ({
    ...r,
    Salary: r.Salary != null ? Number(r.Salary) : null,
    HireDate: rowDate(r.HireDate),
    AccessIsActive: Number(r.AccessIsActive) === 1 ? 1 : 0,
    AccessRole: String(r.AccessRole || "viewer"),
    AccessUpdatedAt: r.AccessUpdatedAt != null ? rowDateTime(r.AccessUpdatedAt) : null,
  }));
}

export async function patchEmployeeAccess(employeeId, body) {
  await ensureAdminEmployeeAccessTable();
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id < 1) return false;
  const b = body && typeof body === "object" ? body : {};
  const [empRows] = await getPool().execute("SELECT 1 FROM employee WHERE EmployeeID = ? LIMIT 1", [id]);
  if (!empRows.length) return false;
  const roles = new Set(["viewer", "operator", "admin"]);
  let isActive = undefined;
  if (b.isActive !== undefined && b.isActive !== null) {
    isActive = b.isActive === true || b.isActive === 1 ? 1 : 0;
  }
  let role = undefined;
  if (b.accessRole != null && String(b.accessRole).trim()) {
    const r = String(b.accessRole).trim().toLowerCase();
    if (!roles.has(r)) return false;
    role = r;
  }
  if (isActive === undefined && role === undefined) return false;
  const pool = getPool();
  const [cur] = await pool.execute(
    "SELECT IsActive, DefaultAccessRole FROM admin_employee_access WHERE EmployeeID = ?",
    [id]
  );
  const nextActive = isActive !== undefined ? isActive : cur.length ? Number(cur[0].IsActive) : 1;
  const nextRole =
    role !== undefined ? role : cur.length ? String(cur[0].DefaultAccessRole || "viewer") : "viewer";
  await pool.execute(
    `INSERT INTO admin_employee_access (EmployeeID, IsActive, DefaultAccessRole)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE IsActive = VALUES(IsActive), DefaultAccessRole = VALUES(DefaultAccessRole)`,
    [id, nextActive, nextRole]
  );
  return true;
}

/** HR-designated managers (`hrmanager` + `manager` + optional `area`). */
export async function listHrManagers({ q = "" } = {}) {
  try {
    const pool = getPool();
    const raw = String(q || "").trim();
    const hasTerm = raw.length > 0;
    const term = `%${raw}%`;
    let sql = `SELECT hm.ManagerID, m.ManagerName, hm.AreaID, a.AreaName
       FROM hrmanager hm
       INNER JOIN manager m ON m.ManagerID = hm.ManagerID
       LEFT JOIN area a ON a.AreaID = hm.AreaID`;
    const params = [];
    if (hasTerm) {
      sql += ` WHERE (
         IFNULL(m.ManagerName,'') LIKE ? OR IFNULL(a.AreaName,'') LIKE ?
         OR CAST(hm.ManagerID AS CHAR) LIKE ? OR CAST(IFNULL(hm.AreaID,0) AS CHAR) LIKE ?
       )`;
      params.push(term, term, term, term);
    }
    sql += " ORDER BY hm.ManagerID";
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch {
    return [];
  }
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

export async function listRetailItems({ q = "" } = {}) {
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  const base = `SELECT ri.ItemID, ri.ItemName, ri.BuyPrice, ri.SellPrice, ri.DiscountPrice, ri.Quantity,
            ri.LowStockThreshold, ri.IsActive, ri.RetailID, rp.RetailName, rp.AreaID, a.AreaName
     FROM retailitem ri
     JOIN retailplace rp ON rp.RetailID = ri.RetailID
     LEFT JOIN area a ON a.AreaID = rp.AreaID`;
  const where = hasTerm
    ? ` WHERE (ri.ItemName LIKE ? OR rp.RetailName LIKE ? OR CAST(ri.ItemID AS CHAR) LIKE ? OR CAST(ri.RetailID AS CHAR) LIKE ?)`
    : "";
  const order = " ORDER BY ri.ItemName, ri.ItemID";
  const lim = hasTerm ? " LIMIT 300" : "";
  const sql = base + where + order + lim;
  const params = hasTerm ? [term, term, term, term] : [];
  const [rows] = await pool.execute(sql, params);
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

/** Visitor directory for admin oversight (never returns PasswordHash). */
export async function listVisitors({ q = "", limit, includeCounts = true } = {}) {
  const lim = Math.min(5000, Math.max(1, Number(limit) || 2000));
  const pool = getPool();
  const term = `%${String(q || "").trim()}%`;
  const hasTerm = String(q || "").trim().length > 0;
  const where = hasTerm ? "WHERE (v.Name LIKE ? OR v.Email LIKE ? OR v.Phone LIKE ?)" : "";
  const params = hasTerm ? [term, term, term, lim] : [lim];

  const baseWithCreated =
    "v.VisitorID, v.Name, v.Email, v.Phone, v.Gender, v.Age, v.IsActive, v.CreatedAt";
  const baseNoCreated = "v.VisitorID, v.Name, v.Email, v.Phone, v.Gender, v.Age, v.IsActive";

  if (!includeCounts) {
    let sql = `SELECT ${baseWithCreated} FROM visitor v ${where} ORDER BY v.VisitorID DESC LIMIT ?`;
    try {
      const [rows] = await pool.execute(sql, params);
      return rows.map((r) => ({
        ...r,
        CreatedAt: r.CreatedAt != null ? rowDateTime(r.CreatedAt) : null,
        TicketCount: 0,
        ReviewCount: 0,
        RetailPurchaseCount: 0,
        OrderCount: 0,
        ReservationCount: 0,
        VisitHistoryCount: 0,
        PortalFeedbackCount: 0,
        ItineraryCount: 0,
        OrderSpendTotal: 0,
      }));
    } catch (e) {
      if (!String(e.message || "").includes("Unknown column 'CreatedAt'")) throw e;
      sql = `SELECT ${baseNoCreated} FROM visitor v ${where} ORDER BY v.VisitorID DESC LIMIT ?`;
      const [rows] = await pool.execute(sql, params);
      return rows.map((r) => ({
        ...r,
        CreatedAt: null,
        TicketCount: 0,
        ReviewCount: 0,
        RetailPurchaseCount: 0,
        OrderCount: 0,
        ReservationCount: 0,
        VisitHistoryCount: 0,
        PortalFeedbackCount: 0,
        ItineraryCount: 0,
        OrderSpendTotal: 0,
      }));
    }
  }

  const activityCounts = `
    , (SELECT COUNT(*) FROM ticket t WHERE t.VisitorID = v.VisitorID) AS TicketCount
    , (SELECT COUNT(*) FROM review r WHERE r.VisitorID = v.VisitorID) AS ReviewCount
    , (SELECT COUNT(*) FROM transactionlog tr WHERE tr.VisitorID = v.VisitorID) AS RetailPurchaseCount`;

  const portalCounts = `
    , (SELECT COUNT(*) FROM visitor_order o WHERE o.VisitorID = v.VisitorID) AS OrderCount
    , (SELECT COALESCE(SUM(o.OrderTotal), 0) FROM visitor_order o WHERE o.VisitorID = v.VisitorID) AS OrderSpendTotal
    , (SELECT COUNT(*) FROM visitor_reservation rv WHERE rv.VisitorID = v.VisitorID) AS ReservationCount
    , (SELECT COUNT(*) FROM visitor_visit_history h WHERE h.VisitorID = v.VisitorID) AS VisitHistoryCount
    , (SELECT COUNT(*) FROM visitor_feedback_submission fs WHERE fs.VisitorID = v.VisitorID) AS PortalFeedbackCount
    , (SELECT COUNT(*) FROM visitor_itinerary_item ii WHERE ii.VisitorID = v.VisitorID) AS ItineraryCount`;

  async function executeSelect(selectList) {
    const sql = `SELECT ${selectList} FROM visitor v ${where} ORDER BY v.VisitorID DESC LIMIT ?`;
    const [r] = await pool.execute(sql, params);
    return r;
  }

  const selectVariants = [
    baseWithCreated + activityCounts + portalCounts,
    baseWithCreated + activityCounts,
    baseNoCreated + activityCounts + portalCounts,
    baseNoCreated + activityCounts,
  ];

  let rows = null;
  let lastErr = null;
  for (const sel of selectVariants) {
    try {
      rows = await executeSelect(sel);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (rows == null) throw lastErr;

  function num(v) {
    return v != null && v !== "" ? Number(v) : 0;
  }

  return rows.map((r) => ({
    ...r,
    CreatedAt: r.CreatedAt != null ? rowDateTime(r.CreatedAt) : null,
    TicketCount: num(r.TicketCount),
    ReviewCount: num(r.ReviewCount),
    RetailPurchaseCount: num(r.RetailPurchaseCount),
    OrderCount: num(r.OrderCount),
    OrderSpendTotal:
      r.OrderSpendTotal != null && r.OrderSpendTotal !== ""
        ? Number(r.OrderSpendTotal)
        : 0,
    ReservationCount: num(r.ReservationCount),
    VisitHistoryCount: num(r.VisitHistoryCount),
    PortalFeedbackCount: num(r.PortalFeedbackCount),
    ItineraryCount: num(r.ItineraryCount),
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

export async function listShiftsAdmin({ limit = 500, q = "" } = {}) {
  const lim = Math.min(1000, Math.max(1, Number(limit) || 500));
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT s.ShiftID, s.EmployeeID, e.Name AS EmployeeName, s.ShiftDate, s.StartTime, s.EndTime
     FROM shift s
     LEFT JOIN employee e ON e.EmployeeID = s.EmployeeID`;
  const params = [];
  if (hasTerm) {
    sql += ` WHERE (
       IFNULL(e.Name,'') LIKE ? OR CAST(IFNULL(s.EmployeeID,0) AS CHAR) LIKE ?
       OR CAST(s.ShiftID AS CHAR) LIKE ? OR CAST(s.ShiftDate AS CHAR) LIKE ?
     )`;
    params.push(term, term, term, term);
  }
  sql += " ORDER BY s.ShiftDate DESC, s.ShiftID DESC LIMIT ?";
  params.push(lim);
  const [rows] = await pool.execute(sql, params);
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

function parseOptionalThresholdNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Optional URL-driven thresholds; omitted = no alert for that rule. */
export async function getReportSnapshot({
  incidentsDays = 90,
  reviewsDays = 30,
  periodDays = null,
  kpiMaxIncidents = null,
  kpiMinRetailRevenue = null,
  kpiMaxActiveTickets = null,
} = {}) {
  const p = getPool();
  const hasUnified =
    periodDays != null && String(periodDays).trim() !== "" && !Number.isNaN(Number(periodDays));
  const pUnified = hasUnified
    ? Math.min(3650, Math.max(1, Math.floor(Number(periodDays) || 30)))
    : null;
  const incD = pUnified ?? Math.min(3650, Math.max(1, Math.floor(Number(incidentsDays) || 90)));
  const revD = pUnified ?? Math.min(365, Math.max(1, Math.floor(Number(reviewsDays) || 30)));
  const retD = pUnified ?? revD;
  const maxInc = parseOptionalThresholdNumber(kpiMaxIncidents);
  const minRev = parseOptionalThresholdNumber(kpiMinRetailRevenue);
  const maxTix = parseOptionalThresholdNumber(kpiMaxActiveTickets);

  const [
    [[{ visitorsTotal }]],
    [[{ visitorsActive }]],
    [[{ ticketsTotal }]],
    [[{ ticketsActive }]],
    [[{ retailTxCountAllTime }]],
    [[{ retailRevenueAllTime }]],
    [[{ retailTxCount }]],
    [[{ retailRevenue }]],
    [[{ incidentsInWindow }]],
    [[{ visitorReviewsTotal }]],
    [[{ visitorReviewsInWindow }]],
    [[{ visitorReviewsAvgInWindow }]],
  ] = await Promise.all([
    p.execute("SELECT COUNT(*) AS visitorsTotal FROM visitor"),
    p.execute("SELECT COUNT(*) AS visitorsActive FROM visitor WHERE IsActive = 1"),
    p.execute("SELECT COUNT(*) AS ticketsTotal FROM ticket"),
    p.execute("SELECT COUNT(*) AS ticketsActive FROM ticket WHERE IsActive = 1"),
    p.execute("SELECT COUNT(*) AS retailTxCountAllTime FROM transactionlog"),
    p.execute("SELECT COALESCE(SUM(TotalCost), 0) AS retailRevenueAllTime FROM transactionlog"),
    p.execute(
      `SELECT COUNT(*) AS retailTxCount FROM transactionlog
       WHERE \`Date\` >= DATE_SUB(CURRENT_DATE, INTERVAL ${retD} DAY)`
    ),
    p.execute(
      `SELECT COALESCE(SUM(TotalCost), 0) AS retailRevenue FROM transactionlog
       WHERE \`Date\` >= DATE_SUB(CURRENT_DATE, INTERVAL ${retD} DAY)`
    ),
    p.execute(
      `SELECT COUNT(*) AS incidentsInWindow FROM incidentreport
       WHERE ReportDate >= DATE_SUB(CURRENT_DATE, INTERVAL ${incD} DAY)`
    ),
    p.execute("SELECT COUNT(*) AS visitorReviewsTotal FROM review WHERE IsActive = 1"),
    p.execute(
      `SELECT COUNT(*) AS visitorReviewsInWindow FROM review
       WHERE IsActive = 1 AND DateSubmitted >= DATE_SUB(CURRENT_DATE, INTERVAL ${revD} DAY)`
    ),
    p.execute(
      `SELECT AVG(Feedback) AS visitorReviewsAvgInWindow FROM review
       WHERE IsActive = 1 AND DateSubmitted >= DATE_SUB(CURRENT_DATE, INTERVAL ${revD} DAY)`
    ),
  ]);
  const avgRaw = visitorReviewsAvgInWindow;
  const visitorReviewsAvgWindowNum =
    avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw) : null;
  const revNum = retailRevenue != null ? Number(retailRevenue) : 0;
  const revAllTimeNum = retailRevenueAllTime != null ? Number(retailRevenueAllTime) : 0;
  const incidentsN = Number(incidentsInWindow) || 0;
  const ticketsActN = Number(ticketsActive) || 0;

  const kpiAlerts = [];
  if (maxInc != null && incidentsN > maxInc) {
    kpiAlerts.push({
      id: "incidents_over",
      severity: "crit",
      message: `Incidents in the last ${incD} days (${incidentsN}) exceed your threshold (${maxInc}).`,
      metric: "incidentsInWindow",
      value: incidentsN,
      threshold: maxInc,
    });
  }
  if (minRev != null && revNum < minRev) {
    kpiAlerts.push({
      id: "retail_revenue_below",
      severity: "warn",
      message: `Retail revenue in the last ${retD} days (${revNum.toFixed(2)}) is below your floor (${minRev.toFixed(2)}).`,
      metric: "retailRevenue",
      value: revNum,
      threshold: minRev,
    });
  }
  if (maxTix != null && ticketsActN > maxTix) {
    kpiAlerts.push({
      id: "active_tickets_over",
      severity: "crit",
      message: `Active tickets (${ticketsActN}) exceed your capacity-style cap (${maxTix}).`,
      metric: "ticketsActive",
      value: ticketsActN,
      threshold: maxTix,
    });
  }

  return {
    visitorsTotal,
    visitorsActive,
    ticketsTotal,
    ticketsActive,
    retailTxCount: Number(retailTxCount) || 0,
    retailRevenue: revNum,
    retailTxCountAllTime: Number(retailTxCountAllTime) || 0,
    retailRevenueAllTime: revAllTimeNum,
    retailWindowDays: retD,
    incidentsInWindow,
    incidentsWindowDays: incD,
    visitorReviewsTotal,
    visitorReviewsInWindow,
    visitorReviewsWindowDays: revD,
    visitorReviewsAvgInWindow: visitorReviewsAvgWindowNum,
    periodDaysUnified: pUnified,
    kpiAlerts,
    kpiThresholdsEcho: {
      kpiMaxIncidents: maxInc,
      kpiMinRetailRevenue: minRev,
      kpiMaxActiveTickets: maxTix,
    },
    incidents90d: incidentsInWindow,
    visitorReviewsLast30d: visitorReviewsInWindow,
    visitorReviewsAvgRating30d: visitorReviewsAvgWindowNum,
  };
}

/** Visitor-area reviews (1–10 + comment). Uses LEFT JOINs so rows still appear if area/visitor links are missing. */
export async function listVisitorReviewsReport({ limit = 500, q = "", includeInactive = false } = {}) {
  const p = getPool();
  const lim = Math.min(Math.max(Number(limit) || 500, 1), 10000);
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT r.ReviewID, r.VisitorID, v.Name AS VisitorName, r.AreaID, ar.AreaName,
            r.Feedback AS Rating, r.Comment, r.DateSubmitted, r.IsActive
     FROM review r
     LEFT JOIN visitor v ON v.VisitorID = r.VisitorID
     LEFT JOIN area ar ON ar.AreaID = r.AreaID`;
  const params = [];
  const where = [];
  if (!includeInactive) {
    where.push("r.IsActive = 1");
  }
  if (hasTerm) {
    where.push(`(
       IFNULL(v.Name,'') LIKE ? OR IFNULL(r.Comment,'') LIKE ? OR IFNULL(ar.AreaName,'') LIKE ?
       OR CAST(r.Feedback AS CHAR) LIKE ? OR CAST(r.ReviewID AS CHAR) LIKE ? OR CAST(r.VisitorID AS CHAR) LIKE ?
     )`);
    params.push(term, term, term, term, term, term);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY r.ReviewID DESC LIMIT ?";
  params.push(lim);
  const [rows] = await p.execute(sql, params);
  return rows.map((r) => ({
    ...r,
    DateSubmitted: rowDate(r.DateSubmitted),
    IsActive: r.IsActive != null ? Number(r.IsActive) : 1,
  }));
}

export async function updateAttractionStatus(attractionId, status) {
  const id = Number(attractionId);
  if (!Number.isInteger(id) || id < 1) return false;
  if (!ATTRACTION_STATUSES.includes(status)) return false;
  const [result] = await getPool().execute("UPDATE attraction SET Status = ? WHERE AttractionID = ?", [status, id]);
  return result.affectedRows > 0;
}

const SYSTEM_SETTING_KEYS = new Set([
  "backupsRpoRto",
  "notificationWebhookUrl",
  "notificationNotes",
  "brandingNotes",
  "accessMfaRequired",
  "accessPortalRolesJson",
  "accessPasswordResetNotes",
  "accessSessionNotes",
  "accessSuspiciousIpWatchlist",
]);

const DEFAULT_PORTAL_ROLES = {
  visitor: { viewer: true, operator: true, admin: false },
  retail: { viewer: true, operator: true, admin: false },
  employee: { viewer: true, operator: true, admin: false },
  hr: { viewer: true, operator: true, admin: false },
  maintenance: { viewer: true, operator: true, admin: false },
};

async function ensureAdminAuditLogTable() {
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      AuditLogID BIGINT NOT NULL AUTO_INCREMENT,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Action VARCHAR(120) NOT NULL,
      Actor VARCHAR(160) NULL,
      TargetType VARCHAR(80) NULL,
      TargetId VARCHAR(120) NULL,
      Detail TEXT NULL,
      ClientIp VARCHAR(80) NULL,
      UserAgent VARCHAR(512) NULL,
      PRIMARY KEY (AuditLogID),
      KEY idx_audit_created (CreatedAt),
      KEY idx_audit_action (Action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function insertAdminAuditLog({
  action,
  actor = "admin-ui",
  targetType = null,
  targetId = null,
  detail = null,
  clientIp = null,
  userAgent = null,
} = {}) {
  try {
    await ensureAdminAuditLogTable();
    if (!action) return;
    await getPool().execute(
      `INSERT INTO admin_audit_log (Action, Actor, TargetType, TargetId, Detail, ClientIp, UserAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(action).slice(0, 120),
        actor != null ? String(actor).slice(0, 160) : null,
        targetType != null ? String(targetType).slice(0, 80) : null,
        targetId != null ? String(targetId).slice(0, 120) : null,
        detail != null ? String(detail) : null,
        clientIp != null ? String(clientIp).slice(0, 80) : null,
        userAgent != null ? String(userAgent).slice(0, 512) : null,
      ]
    );
  } catch (e) {
    console.error("insertAdminAuditLog:", e);
  }
}

export async function listAdminAuditLog(limit = 200) {
  try {
    await ensureAdminAuditLogTable();
    const lim = Math.min(500, Math.max(1, Number(limit) || 200));
    const [rows] = await getPool().execute(
      `SELECT AuditLogID, CreatedAt, Action, Actor, TargetType, TargetId, Detail, ClientIp, UserAgent
       FROM admin_audit_log ORDER BY AuditLogID DESC LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      CreatedAt: rowDateTime(r.CreatedAt),
    }));
  } catch {
    return [];
  }
}

async function ensureAdminSessionLogTable() {
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS admin_session_log (
      SessionLogID BIGINT NOT NULL AUTO_INCREMENT,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      EventType VARCHAR(80) NOT NULL,
      Portal VARCHAR(40) NULL,
      Subject VARCHAR(200) NULL,
      TokenId VARCHAR(120) NULL,
      IpAddress VARCHAR(80) NULL,
      UserAgent VARCHAR(512) NULL,
      RevokedAt TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (SessionLogID),
      KEY idx_sess_created (CreatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function listAdminSessionLog(limit = 100) {
  try {
    await ensureAdminSessionLogTable();
    const lim = Math.min(300, Math.max(1, Number(limit) || 100));
    const [rows] = await getPool().execute(
      `SELECT SessionLogID, CreatedAt, EventType, Portal, Subject, TokenId, IpAddress, UserAgent, RevokedAt
       FROM admin_session_log ORDER BY SessionLogID DESC LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      CreatedAt: rowDateTime(r.CreatedAt),
      RevokedAt: r.RevokedAt ? rowDateTime(r.RevokedAt) : null,
    }));
  } catch {
    return [];
  }
}

export async function revokeAdminSessionLog(sessionLogId) {
  await ensureAdminSessionLogTable();
  const id = Number(sessionLogId);
  if (!Number.isInteger(id) || id < 1) return false;
  const [result] = await getPool().execute(
    "UPDATE admin_session_log SET RevokedAt = CURRENT_TIMESTAMP WHERE SessionLogID = ? AND RevokedAt IS NULL",
    [id]
  );
  return result.affectedRows > 0;
}

export function parseAccessPolicyFromSettings(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  let portalRoles = { ...DEFAULT_PORTAL_ROLES };
  try {
    const raw = s.accessPortalRolesJson;
    if (raw && String(raw).trim()) {
      const p = JSON.parse(String(raw));
      if (p && typeof p === "object") {
        for (const portal of Object.keys(DEFAULT_PORTAL_ROLES)) {
          if (p[portal] && typeof p[portal] === "object") {
            portalRoles[portal] = {
              viewer: !!p[portal].viewer,
              operator: !!p[portal].operator,
              admin: !!p[portal].admin,
            };
          }
        }
      }
    }
  } catch {
    /* keep defaults */
  }
  return {
    mfaRequired: s.accessMfaRequired === "1" || s.accessMfaRequired === "true",
    portalRoles,
    passwordResetNotes: s.accessPasswordResetNotes != null ? String(s.accessPasswordResetNotes) : "",
    sessionNotes: s.accessSessionNotes != null ? String(s.accessSessionNotes) : "",
    suspiciousIpWatchlist: s.accessSuspiciousIpWatchlist != null ? String(s.accessSuspiciousIpWatchlist) : "",
  };
}

async function ensureAdminSettingsTable() {
  const pool = getPool();
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS admin_system_settings (
      SettingKey VARCHAR(80) NOT NULL,
      SettingValue MEDIUMTEXT NULL,
      PRIMARY KEY (SettingKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function getSystemSettings() {
  try {
    await ensureAdminSettingsTable();
    const [rows] = await getPool().execute("SELECT SettingKey, SettingValue FROM admin_system_settings");
    const out = {};
    for (const r of rows) out[r.SettingKey] = r.SettingValue;
    return out;
  } catch (e) {
    console.error("getSystemSettings:", e);
    return {};
  }
}

export async function patchSystemSettings(body) {
  await ensureAdminSettingsTable();
  const pool = getPool();
  for (const k of Object.keys(body || {})) {
    if (!SYSTEM_SETTING_KEYS.has(k)) continue;
    const v = body[k] == null ? "" : String(body[k]);
    await pool.execute(
      `INSERT INTO admin_system_settings (SettingKey, SettingValue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)`,
      [k, v]
    );
  }
}

function timeToStr(t) {
  if (t == null) return "";
  const s = String(t);
  return s.length >= 8 ? s.slice(0, 8) : s;
}

/** Rows from visitor_park (empty if table missing). */
export async function listVisitorParks() {
  try {
    const [rows] = await getPool().execute(
      `SELECT ParkID, ParkName, LocationText, OpeningTime, ClosingTime, MapImageUrl, IsActive
       FROM visitor_park ORDER BY ParkID`
    );
    return rows.map((r) => ({
      ...r,
      OpeningTime: timeToStr(r.OpeningTime),
      ClosingTime: timeToStr(r.ClosingTime),
      IsActive: Number(r.IsActive),
    }));
  } catch {
    return [];
  }
}

export async function updateVisitorPark(parkId, body) {
  const id = Number(parkId);
  if (!Number.isInteger(id) || id < 1) return false;
  const b = body && typeof body === "object" ? body : {};
  const sets = [];
  const vals = [];
  if (b.parkName != null) {
    sets.push("ParkName = ?");
    vals.push(String(b.parkName));
  }
  if (b.locationText != null) {
    sets.push("LocationText = ?");
    vals.push(String(b.locationText));
  }
  if (b.openingTime != null) {
    sets.push("OpeningTime = ?");
    vals.push(String(b.openingTime).trim() || null);
  }
  if (b.closingTime != null) {
    sets.push("ClosingTime = ?");
    vals.push(String(b.closingTime).trim() || null);
  }
  if (b.mapImageUrl != null) {
    sets.push("MapImageUrl = ?");
    vals.push(String(b.mapImageUrl));
  }
  if (b.isActive !== undefined && b.isActive !== null) {
    sets.push("IsActive = ?");
    vals.push(b.isActive === true || b.isActive === 1 ? 1 : 0);
  }
  if (!sets.length) return false;
  vals.push(id);
  try {
    const [result] = await getPool().execute(
      `UPDATE visitor_park SET ${sets.join(", ")} WHERE ParkID = ?`,
      vals
    );
    return result.affectedRows > 0;
  } catch {
    return false;
  }
}

export async function listSpecialEvents(limit) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  try {
    const [rows] = await getPool().execute(
      `SELECT e.EventID, e.ParkID, p.ParkName, e.EventName, e.EventDescription, e.EventDate, e.StartTime, e.EndTime
       FROM visitor_special_event e
       LEFT JOIN visitor_park p ON p.ParkID = e.ParkID
       ORDER BY e.EventDate DESC, e.EventID DESC
       LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      EventDate: rowDate(r.EventDate),
      StartTime: timeToStr(r.StartTime),
      EndTime: timeToStr(r.EndTime),
    }));
  } catch {
    return [];
  }
}

export async function createSpecialEvent(body) {
  const b = body && typeof body === "object" ? body : {};
  const name = b.eventName != null ? String(b.eventName).trim() : "";
  const date = b.eventDate != null ? String(b.eventDate).trim() : "";
  if (!name || !date) return null;
  const parkId = b.parkId != null && b.parkId !== "" ? Number(b.parkId) : null;
  const desc = b.eventDescription != null ? String(b.eventDescription) : null;
  const st = b.startTime != null && String(b.startTime).trim() ? String(b.startTime).trim() : null;
  const et = b.endTime != null && String(b.endTime).trim() ? String(b.endTime).trim() : null;
  try {
    const [result] = await getPool().execute(
      `INSERT INTO visitor_special_event (ParkID, EventName, EventDescription, EventDate, StartTime, EndTime)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number.isInteger(parkId) && parkId > 0 ? parkId : null, name, desc, date, st, et]
    );
    return result.insertId;
  } catch {
    return null;
  }
}

const TICKET_TYPES = ["General", "VIP", "Discount"];

export async function getTicketPricingByType() {
  try {
    const [rows] = await getPool().execute(
      `SELECT TicketType,
              COUNT(*) AS ticketsSold,
              MIN(Price) AS minPrice,
              MAX(Price) AS maxPrice,
              AVG(Price) AS avgPrice
       FROM ticket
       GROUP BY TicketType
       ORDER BY FIELD(TicketType,'General','VIP','Discount')`
    );
    return rows.map((r) => ({
      TicketType: r.TicketType,
      ticketsSold: Number(r.ticketsSold),
      minPrice: r.minPrice != null ? Number(r.minPrice) : null,
      maxPrice: r.maxPrice != null ? Number(r.maxPrice) : null,
      avgPrice: r.avgPrice != null ? Number(r.avgPrice) : null,
    }));
  } catch {
    return [];
  }
}

/** Sets Price for all rows of that ticket type (issued tickets in ticket table). */
export async function setTicketTypePrice(ticketType, price) {
  const tt = String(ticketType || "").trim();
  if (!TICKET_TYPES.includes(tt)) return false;
  const p = Number(price);
  if (!Number.isFinite(p) || p < 0) return false;
  try {
    await getPool().execute("UPDATE ticket SET Price = ? WHERE TicketType = ?", [p, tt]);
    return true;
  } catch {
    return false;
  }
}
