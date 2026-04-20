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

function mapEmployeeRow(r, accessDefaults) {
  const {
    AdminPortalAccessRevoked: _revRaw,
    AdminPortalAccessRevokedAt: _revAtRaw,
    ...rest
  } = r;
  const def = accessDefaults || {};
  return {
    ...rest,
    Salary: r.Salary != null ? Number(r.Salary) : null,
    HireDate: rowDate(r.HireDate),
    adminPortalAccessRevoked:
      def.adminPortalAccessRevoked !== undefined
        ? def.adminPortalAccessRevoked
        : Number(r.AdminPortalAccessRevoked) === 1,
    adminPortalAccessRevokedAt:
      def.adminPortalAccessRevokedAt !== undefined
        ? def.adminPortalAccessRevokedAt
        : r.AdminPortalAccessRevokedAt != null
          ? rowDateTime(r.AdminPortalAccessRevokedAt)
          : null,
  };
}

export async function listEmployees() {
  const pool = getPool();
  const qWithAccess = `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName,
            e.AdminPortalAccessRevoked, e.AdminPortalAccessRevokedAt
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`;
  const qBase = `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName
     FROM employee e
     LEFT JOIN area a ON a.AreaID = e.AreaID
     ORDER BY e.AreaID IS NULL, e.AreaID, e.Name`;
  let rows;
  try {
    [rows] = await pool.execute(qWithAccess);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes("Unknown column") && msg.includes("AdminPortal")) {
      [rows] = await pool.execute(qBase);
      return rows.map((r) =>
        mapEmployeeRow(r, { adminPortalAccessRevoked: false, adminPortalAccessRevokedAt: null })
      );
    }
    throw e;
  }
  return rows.map((r) => mapEmployeeRow(r));
}

export async function setEmployeeAdminPortalAccess(employeeId, revoked) {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id < 1) return false;
  const rev = !!revoked;
  const flag = rev ? 1 : 0;
  const [result] = await getPool().execute(
    `UPDATE employee SET AdminPortalAccessRevoked = ?,
         AdminPortalAccessRevokedAt = IF(? = 1, CURRENT_TIMESTAMP, NULL)
     WHERE EmployeeID = ?`,
    [flag, flag, id]
  );
  return result.affectedRows > 0;
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
     LIMIT ${lim}`
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
     LIMIT ${lim}`
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
    ? `SELECT ${cols} FROM visitor WHERE Name LIKE ? OR Email LIKE ? OR Phone LIKE ? ORDER BY VisitorID DESC LIMIT ${lim}`
    : `SELECT ${cols} FROM visitor ORDER BY VisitorID DESC LIMIT ${lim}`;
  const params = hasTerm ? [term, term, term] : [];
  let rows;
  try {
    [rows] = await pool.execute(sql, params);
  } catch (e) {
    if (!String(e.message || "").includes("Unknown column 'CreatedAt'")) throw e;
    const sql2 = hasTerm
      ? `SELECT ${colsNoCreated} FROM visitor WHERE Name LIKE ? OR Email LIKE ? OR Phone LIKE ? ORDER BY VisitorID DESC LIMIT ${lim}`
      : `SELECT ${colsNoCreated} FROM visitor ORDER BY VisitorID DESC LIMIT ${lim}`;
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
       ORDER BY t.TicketNumber DESC LIMIT ${lim}`
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
      `SELECT ${baseSelect} ${join} ORDER BY t.TicketNumber DESC LIMIT ${lim}`
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
     LIMIT ${lim}`
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
     LIMIT ${lim}`
  );
  return rows.map((r) => ({
    ...r,
    CreatedAt: rowDateTime(r.CreatedAt),
  }));
}

export class ReportRangeError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReportRangeError";
  }
}

function sqlDayKey(d) {
  if (d == null) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function eachDayInclusive(from, to) {
  const out = [];
  const [fy, fm, fd] = from.split("-").map((x) => parseInt(x, 10));
  const [ty, tm, td] = to.split("-").map((x) => parseInt(x, 10));
  let cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(sqlDayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function parseReportRange(fromParam, toParam) {
  const parseOne = (s) => {
    if (s == null) return null;
    const t = String(s).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    const [y, m, d] = t.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return t;
  };
  let from = parseOne(fromParam);
  let to = parseOne(toParam);
  if (!from && !to) {
    throw new ReportRangeError("Provide both from and to as YYYY-MM-DD (inclusive).");
  }
  if (!from || !to) {
    throw new ReportRangeError("from and to are both required for range reports (YYYY-MM-DD).");
  }
  if (from > to) throw new ReportRangeError("from must be on or before to.");
  const fp = from.split("-").map((x) => parseInt(x, 10));
  const tp = to.split("-").map((x) => parseInt(x, 10));
  const fromD = new Date(fp[0], fp[1] - 1, fp[2]);
  const toD = new Date(tp[0], tp[1] - 1, tp[2]);
  const days = Math.floor((toD - fromD) / (24 * 60 * 60 * 1000)) + 1;
  if (days > 366) throw new ReportRangeError("Date range cannot exceed 366 days.");
  return { from, to };
}

async function getReportSnapshotLegacy() {
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
    mode: "legacy",
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

async function getReportSnapshotRanged(from, to) {
  const p = getPool();
  const rangeArgs = [from, to];
  const [
    [[{ visitorSignups }]],
    [[{ visitorsActiveNow }]],
    [[{ ticketsIssued }]],
    [[{ ticketsActiveIssued }]],
    [[{ retailTxCount }]],
    [[{ retailRevenue }]],
    [[{ incidentsCount }]],
    [[{ visitorReviewsCount }]],
    [[{ visitorReviewsAvgRating }]],
    [ticketByDay],
    [retailByDay],
    [incidentsByDay],
    [reviewsByDay],
    [ticketsByTypeRows],
    [retailByTypeRows],
  ] = await Promise.all([
    p.execute(
      `SELECT COUNT(*) AS visitorSignups FROM visitor
       WHERE DATE(CreatedAt) >= ? AND DATE(CreatedAt) <= ?`,
      rangeArgs
    ),
    p.execute("SELECT COUNT(*) AS visitorsActiveNow FROM visitor WHERE IsActive = 1"),
    p.execute(
      `SELECT COUNT(*) AS ticketsIssued FROM ticket
       WHERE IssueDate >= ? AND IssueDate <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT COUNT(*) AS ticketsActiveIssued FROM ticket
       WHERE IssueDate >= ? AND IssueDate <= ? AND IsActive = 1`,
      rangeArgs
    ),
    p.execute(
      `SELECT COUNT(*) AS retailTxCount FROM transactionlog
       WHERE Date >= ? AND Date <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT COALESCE(SUM(TotalCost), 0) AS retailRevenue FROM transactionlog
       WHERE Date >= ? AND Date <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT COUNT(*) AS incidentsCount FROM incidentreport
       WHERE DATE(ReportDate) >= ? AND DATE(ReportDate) <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT COUNT(*) AS visitorReviewsCount FROM review
       WHERE IsActive = 1 AND DateSubmitted >= ? AND DateSubmitted <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT AVG(Feedback) AS visitorReviewsAvgRating FROM review
       WHERE IsActive = 1 AND DateSubmitted >= ? AND DateSubmitted <= ?`,
      rangeArgs
    ),
    p.execute(
      `SELECT IssueDate AS d, COUNT(*) AS n FROM ticket
       WHERE IssueDate >= ? AND IssueDate <= ? GROUP BY IssueDate ORDER BY IssueDate`,
      rangeArgs
    ),
    p.execute(
      `SELECT Date AS d, COALESCE(SUM(TotalCost), 0) AS revenue FROM transactionlog
       WHERE Date >= ? AND Date <= ? GROUP BY Date ORDER BY Date`,
      rangeArgs
    ),
    p.execute(
      `SELECT DATE(ReportDate) AS d, COUNT(*) AS n FROM incidentreport
       WHERE DATE(ReportDate) >= ? AND DATE(ReportDate) <= ? GROUP BY DATE(ReportDate) ORDER BY d`,
      rangeArgs
    ),
    p.execute(
      `SELECT DATE(DateSubmitted) AS d, COUNT(*) AS n FROM review
       WHERE IsActive = 1 AND DateSubmitted >= ? AND DateSubmitted <= ? GROUP BY DATE(DateSubmitted) ORDER BY d`,
      rangeArgs
    ),
    p.execute(
      `SELECT TicketType AS ticketType, COUNT(*) AS n FROM ticket
       WHERE IssueDate >= ? AND IssueDate <= ? GROUP BY TicketType ORDER BY n DESC`,
      rangeArgs
    ),
    p.execute(
      `SELECT Type AS txType, COUNT(*) AS n, COALESCE(SUM(TotalCost), 0) AS revenue FROM transactionlog
       WHERE Date >= ? AND Date <= ? GROUP BY Type ORDER BY n DESC`,
      rangeArgs
    ),
  ]);

  const toMap = (rows, keyCol, valCol) => {
    const m = new Map();
    for (const r of rows) {
      const k = sqlDayKey(r[keyCol]);
      if (k) m.set(k, Number(r[valCol]) || 0);
    }
    return m;
  };

  const tMap = toMap(ticketByDay, "d", "n");
  const rMap = toMap(retailByDay, "d", "revenue");
  const iMap = toMap(incidentsByDay, "d", "n");
  const vMap = toMap(reviewsByDay, "d", "n");

  const days = eachDayInclusive(from, to);
  const seriesDaily = days.map((day) => ({
    day,
    ticketsIssued: tMap.get(day) || 0,
    retailRevenue: rMap.get(day) || 0,
    incidents: iMap.get(day) || 0,
    reviews: vMap.get(day) || 0,
  }));

  const avgRaw = visitorReviewsAvgRating;
  const visitorReviewsAvgNum =
    avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw) : null;

  return {
    mode: "range",
    range: { from, to },
    visitorSignups,
    visitorsActiveNow,
    ticketsIssued,
    ticketsActiveIssued,
    retailTxCount,
    retailRevenue: retailRevenue != null ? Number(retailRevenue) : 0,
    incidentsCount,
    visitorReviewsCount,
    visitorReviewsAvgRating: visitorReviewsAvgNum,
    seriesDaily,
    ticketsByType: ticketsByTypeRows.map((r) => ({
      ticketType: String(r.ticketType ?? "—"),
      count: Number(r.n) || 0,
    })),
    retailByType: retailByTypeRows.map((r) => ({
      txType: String(r.txType ?? "—"),
      count: Number(r.n) || 0,
      revenue: r.revenue != null ? Number(r.revenue) : 0,
    })),
  };
}

/** @param {string | null} fromParam @param {string | null} toParam */
export async function getReportSnapshot(fromParam, toParam) {
  const fromRaw = fromParam != null ? String(fromParam).trim() : "";
  const toRaw = toParam != null ? String(toParam).trim() : "";
  if (!fromRaw && !toRaw) return getReportSnapshotLegacy();
  const { from, to } = parseReportRange(fromRaw, toRaw);
  return getReportSnapshotRanged(from, to);
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
     LIMIT ${lim}`
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
