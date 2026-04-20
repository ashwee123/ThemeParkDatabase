import { randomUUID } from "crypto";
import { getPool } from "./db.js";
import { runAdminSchemaUpgrades } from "./admin-schema-upgrades.js";

let adminAccessSchemaReady = false;

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
  await ensureAdminAccessSchema();
  const pool = getPool();
  const raw = String(q || "").trim();
  const hasTerm = raw.length > 0;
  const term = `%${raw}%`;
  let sql = `SELECT e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, e.ManagerID, e.AreaID, a.AreaName,
            IFNULL(x.IsActive, 1) AS AccessIsActive,
            IFNULL(NULLIF(TRIM(x.DefaultAccessRole), ''), 'viewer') AS AccessRole,
            x.UpdatedAt AS AccessUpdatedAt,
            x.DeactivationReason,
            x.ApprovedByEmployeeID,
            x.RoleExpiresAt,
            x.HrAccessLevel,
            x.ScopeAreaIdsJson,
            x.OffboardingWebhookUrl
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
    RoleExpiresAt: r.RoleExpiresAt != null ? rowDate(r.RoleExpiresAt) : null,
    HrAccessLevel: r.HrAccessLevel != null ? String(r.HrAccessLevel) : "none",
    ScopeAreaIdsJson: r.ScopeAreaIdsJson != null ? String(r.ScopeAreaIdsJson) : null,
  }));
}

export async function patchEmployeeAccess(employeeId, body) {
  await ensureAdminAccessSchema();
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id < 1) return false;
  const b = body && typeof body === "object" ? body : {};
  const [empRows] = await getPool().execute("SELECT 1 FROM employee WHERE EmployeeID = ? LIMIT 1", [id]);
  if (!empRows.length) return false;
  const roles = new Set(["viewer", "operator", "admin", "auditor"]);
  const hrLevels = new Set(["none", "hr_manager", "hr_admin"]);
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
  const hasExt =
    b.deactivationReason !== undefined ||
    b.approvedByEmployeeId !== undefined ||
    b.roleExpiresAt !== undefined ||
    b.hrAccessLevel !== undefined ||
    b.scopeAreaIds !== undefined ||
    b.offboardingWebhookUrl !== undefined;
  if (isActive === undefined && role === undefined && !hasExt) return false;
  const pool = getPool();
  const [cur] = await pool.execute(
    "SELECT IsActive, DefaultAccessRole FROM admin_employee_access WHERE EmployeeID = ?",
    [id]
  );
  const prevActive = cur.length ? Number(cur[0].IsActive) : 1;
  const nextActive = isActive !== undefined ? isActive : prevActive;
  const nextRole =
    role !== undefined ? role : cur.length ? String(cur[0].DefaultAccessRole || "viewer") : "viewer";
  await pool.execute(
    `INSERT INTO admin_employee_access (EmployeeID, IsActive, DefaultAccessRole)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE IsActive = VALUES(IsActive), DefaultAccessRole = VALUES(DefaultAccessRole)`,
    [id, nextActive, nextRole]
  );

  const sets = [];
  const vals = [];
  if (b.deactivationReason !== undefined) {
    sets.push("DeactivationReason = ?");
    vals.push(b.deactivationReason != null ? String(b.deactivationReason).slice(0, 600) : null);
  }
  if (b.approvedByEmployeeId !== undefined) {
    const aid = Number(b.approvedByEmployeeId);
    sets.push("ApprovedByEmployeeID = ?");
    vals.push(Number.isInteger(aid) && aid > 0 ? aid : null);
  }
  if (b.roleExpiresAt !== undefined) {
    const d = String(b.roleExpiresAt || "").trim();
    sets.push("RoleExpiresAt = ?");
    vals.push(d ? d.slice(0, 32) : null);
  }
  if (b.hrAccessLevel !== undefined) {
    const hl = String(b.hrAccessLevel || "none").trim().toLowerCase();
    if (!hrLevels.has(hl)) return false;
    sets.push("HrAccessLevel = ?");
    vals.push(hl);
  }
  if (b.scopeAreaIds !== undefined) {
    let j = null;
    if (b.scopeAreaIds === null) {
      j = null;
    } else if (Array.isArray(b.scopeAreaIds)) {
      j = JSON.stringify(b.scopeAreaIds.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0));
    } else if (typeof b.scopeAreaIds === "string" && b.scopeAreaIds.trim()) {
      j = b.scopeAreaIds.trim().slice(0, 4000);
    }
    sets.push("ScopeAreaIdsJson = ?");
    vals.push(j);
  }
  if (b.offboardingWebhookUrl !== undefined) {
    sets.push("OffboardingWebhookUrl = ?");
    vals.push(b.offboardingWebhookUrl != null ? String(b.offboardingWebhookUrl).slice(0, 500) : null);
  }
  if (sets.length) {
    vals.push(id);
    await pool.execute(`UPDATE admin_employee_access SET ${sets.join(", ")} WHERE EmployeeID = ?`, vals);
  }

  if (prevActive === 1 && nextActive === 0) {
    let hook = null;
    if (b.offboardingWebhookUrl != null && String(b.offboardingWebhookUrl).trim()) {
      hook = String(b.offboardingWebhookUrl).trim();
    } else {
      const [[row]] = await pool.execute(
        "SELECT OffboardingWebhookUrl FROM admin_employee_access WHERE EmployeeID = ?",
        [id]
      );
      if (row && row.OffboardingWebhookUrl) hook = String(row.OffboardingWebhookUrl).trim();
    }
    if (hook && /^https?:\/\//i.test(hook)) {
      try {
        const payload = JSON.stringify({
          event: "employee_deactivated",
          employeeId: id,
          at: new Date().toISOString(),
          reason: b.deactivationReason != null ? String(b.deactivationReason) : null,
        });
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 8000);
        try {
          await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: ac.signal,
          });
        } finally {
          clearTimeout(to);
        }
      } catch (e) {
        console.warn("offboarding webhook:", e && e.message ? e.message : e);
      }
    }
  }
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
  await ensureAdminAccessSchema();
  const pool = getPool();
  const sqlExt = `SELECT n.NotificationID, n.ManagerID, n.ItemID, n.Message, n.CreatedAt,
            n.ReadAt, n.Severity, n.LinkedAuditLogID,
            ri.ItemName, rp.RetailName
     FROM notificationlog n
     LEFT JOIN retailitem ri ON ri.ItemID = n.ItemID
     LEFT JOIN retailplace rp ON rp.RetailID = ri.RetailID
     ORDER BY n.CreatedAt DESC
     LIMIT ?`;
  const sqlBase = `SELECT n.NotificationID, n.ManagerID, n.ItemID, n.Message, n.CreatedAt,
            ri.ItemName, rp.RetailName
     FROM notificationlog n
     LEFT JOIN retailitem ri ON ri.ItemID = n.ItemID
     LEFT JOIN retailplace rp ON rp.RetailID = ri.RetailID
     ORDER BY n.CreatedAt DESC
     LIMIT ?`;
  let rows;
  try {
    ;[rows] = await pool.execute(sqlExt, [lim]);
  } catch {
    ;[rows] = await pool.execute(sqlBase, [lim]);
  }
  return rows.map((r) => ({
    ...r,
    CreatedAt: rowDateTime(r.CreatedAt),
    ReadAt: r.ReadAt != null ? rowDateTime(r.ReadAt) : null,
    Severity: r.Severity != null ? String(r.Severity) : "info",
    LinkedAuditLogID: r.LinkedAuditLogID != null ? Number(r.LinkedAuditLogID) : null,
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
  "accessMfaTierJson",
  "accessTokenTtlPolicyJson",
  "retentionAuditLogDays",
  "retentionSessionLogDays",
  "breakGlassProcedureNotes",
]);

const DEFAULT_PORTAL_ROLES = {
  visitor: { viewer: true, operator: true, admin: false, auditor: false },
  retail: { viewer: true, operator: true, admin: false, auditor: false },
  employee: { viewer: true, operator: true, admin: false, auditor: false },
  hr: { viewer: true, operator: true, admin: false, auditor: false },
  maintenance: { viewer: true, operator: true, admin: false, auditor: false },
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
  sessionLogId = null,
  actionResult = null,
  detailJson = null,
} = {}) {
  try {
    await ensureAdminAccessSchema();
    if (!action) return;
    let detailStr = null;
    let detailJsonStr = null;
    if (detailJson != null && typeof detailJson === "object") {
      detailJsonStr = JSON.stringify(detailJson);
      detailStr = detailJsonStr;
    } else if (detail != null) {
      detailStr = typeof detail === "string" ? detail : JSON.stringify(detail);
      if (typeof detail === "object") detailJsonStr = detailStr;
    }
    const sid =
      sessionLogId != null && Number.isInteger(Number(sessionLogId)) && Number(sessionLogId) > 0
        ? Number(sessionLogId)
        : null;
    const ar = actionResult != null ? String(actionResult).slice(0, 24) : null;
    await getPool().execute(
      `INSERT INTO admin_audit_log (Action, Actor, TargetType, TargetId, Detail, ClientIp, UserAgent, SessionLogID, DetailJson, ActionResult)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(action).slice(0, 120),
        actor != null ? String(actor).slice(0, 160) : null,
        targetType != null ? String(targetType).slice(0, 80) : null,
        targetId != null ? String(targetId).slice(0, 120) : null,
        detailStr,
        clientIp != null ? String(clientIp).slice(0, 80) : null,
        userAgent != null ? String(userAgent).slice(0, 512) : null,
        sid,
        detailJsonStr,
        ar,
      ]
    );
  } catch (e) {
    console.error("insertAdminAuditLog:", e);
  }
}

export async function listAdminAuditLog(limit = 200) {
  try {
    await ensureAdminAccessSchema();
    const lim = Math.min(500, Math.max(1, Number(limit) || 200));
    const [rows] = await getPool().execute(
      `SELECT AuditLogID, CreatedAt, Action, Actor, TargetType, TargetId, Detail, ClientIp, UserAgent,
              SessionLogID, DetailJson, ActionResult
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
    await ensureAdminAccessSchema();
    const lim = Math.min(300, Math.max(1, Number(limit) || 100));
    const [rows] = await getPool().execute(
      `SELECT SessionLogID, CreatedAt, EventType, Portal, Subject, TokenId, IpAddress, UserAgent, RevokedAt,
              MfaVerifiedAt, MfaMethod, RiskScore, IdleTtlSeconds
       FROM admin_session_log ORDER BY SessionLogID DESC LIMIT ?`,
      [lim]
    );
    return rows.map((r) => ({
      ...r,
      CreatedAt: rowDateTime(r.CreatedAt),
      RevokedAt: r.RevokedAt ? rowDateTime(r.RevokedAt) : null,
      MfaVerifiedAt: r.MfaVerifiedAt ? rowDateTime(r.MfaVerifiedAt) : null,
      RiskScore: r.RiskScore != null ? Number(r.RiskScore) : null,
      IdleTtlSeconds: r.IdleTtlSeconds != null ? Number(r.IdleTtlSeconds) : null,
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

export async function ensureAdminAccessSchema() {
  if (adminAccessSchemaReady) return;
  await ensureAdminEmployeeAccessTable();
  await ensureAdminAuditLogTable();
  await ensureAdminSessionLogTable();
  await ensureAdminSettingsTable();
  await runAdminSchemaUpgrades();
  adminAccessSchemaReady = true;
}

function computeSessionRiskScore(clientIp, policy) {
  const ip = String(clientIp || "").trim();
  let score = 12;
  const watch = String(policy.suspiciousIpWatchlist || "");
  if (ip && (watch.includes(ip) || watch.split(/[\s,]+/).some((p) => p && ip.startsWith(p.replace(/\/.*$/, ""))))) {
    score += 55;
  }
  return Math.min(100, score);
}

export function resolveSessionTtlSeconds(sessionRow, policy) {
  const envTtl = Number(process.env.ADMIN_SESSION_TTL_SEC);
  if (Number.isFinite(envTtl) && envTtl > 0) return Math.floor(envTtl);
  if (sessionRow && sessionRow.IdleTtlSeconds != null && Number(sessionRow.IdleTtlSeconds) > 0) {
    return Number(sessionRow.IdleTtlSeconds);
  }
  const portal = String((sessionRow && sessionRow.Portal) || "admin").toLowerCase();
  const map = policy.tokenTtlByPortal || {};
  const sec = map[portal] ?? map.default;
  if (sec != null && Number(sec) > 0) return Number(sec);
  if (portal === "visitor" || portal === "retail") return 7200;
  return 1800;
}

export async function validateAdminSessionRequest(req, { requireMfa } = {}) {
  await ensureAdminAccessSchema();
  const h = req.headers || {};
  const sidRaw = h["x-admin-session-id"] || h["X-Admin-Session-Id"];
  if (!sidRaw || !String(sidRaw).trim()) {
    return { ok: false, code: "no_session", reason: "Missing X-Admin-Session-Id" };
  }
  const sid = Number(sidRaw);
  if (!Number.isInteger(sid) || sid < 1) {
    return { ok: false, code: "invalid_session", reason: "Invalid session id" };
  }
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT SessionLogID, CreatedAt, RevokedAt, Portal, MfaVerifiedAt, MfaMethod, IdleTtlSeconds
     FROM admin_session_log WHERE SessionLogID = ?`,
    [sid]
  );
  if (!rows.length) return { ok: false, code: "unknown_session", reason: "Session not found" };
  const row = rows[0];
  if (row.RevokedAt) return { ok: false, code: "revoked", reason: "Session revoked" };
  const settings = await getSystemSettings();
  const policy = parseAccessPolicyFromSettings(settings);
  const ttlSec = resolveSessionTtlSeconds(row, policy);
  const ageMs = Date.now() - new Date(row.CreatedAt).getTime();
  if (ageMs > ttlSec * 1000) return { ok: false, code: "expired", reason: "Session past TTL" };
  const mfaNeeded = !!requireMfa || policy.mfaRequired;
  if (mfaNeeded) {
    if (!row.MfaVerifiedAt) {
      return { ok: false, code: "mfa_required", reason: "MFA not recorded on session (set MfaVerifiedAt via /api/access/sessions/:id/mfa)" };
    }
    const mfaAge = Date.now() - new Date(row.MfaVerifiedAt).getTime();
    if (mfaAge > ttlSec * 1000) {
      return { ok: false, code: "mfa_stale", reason: "MFA verification older than session TTL" };
    }
  }
  return { ok: true, row, sessionLogId: sid, ttlSeconds: ttlSec };
}

export async function insertAdminSessionRow(body, meta = {}) {
  await ensureAdminAccessSchema();
  const b = body && typeof body === "object" ? body : {};
  const eventType = String(b.eventType || "login").slice(0, 80);
  const portal = b.portal != null ? String(b.portal).slice(0, 40) : null;
  const subject = b.subject != null ? String(b.subject).slice(0, 200) : null;
  const tokenId = b.tokenId != null ? String(b.tokenId).slice(0, 120) : null;
  const clientIp = meta.clientIp != null ? String(meta.clientIp).slice(0, 80) : null;
  const userAgent = meta.userAgent != null ? String(meta.userAgent).slice(0, 512) : null;
  const settings = await getSystemSettings();
  const policy = parseAccessPolicyFromSettings(settings);
  const risk = computeSessionRiskScore(clientIp, policy);
  const fakeRow = { Portal: portal, IdleTtlSeconds: b.idleTtlSeconds != null ? Number(b.idleTtlSeconds) : null };
  const idleTtl = Number.isFinite(fakeRow.IdleTtlSeconds) && fakeRow.IdleTtlSeconds > 0
    ? Math.floor(fakeRow.IdleTtlSeconds)
    : resolveSessionTtlSeconds(fakeRow, policy);
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO admin_session_log (EventType, Portal, Subject, TokenId, IpAddress, UserAgent, RiskScore, IdleTtlSeconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [eventType, portal, subject, tokenId, clientIp, userAgent, risk, idleTtl]
  );
  return result.insertId;
}

export async function updateSessionMfaVerified(sessionLogId, method) {
  await ensureAdminAccessSchema();
  const id = Number(sessionLogId);
  if (!Number.isInteger(id) || id < 1) return false;
  const m = String(method || "unknown").slice(0, 40);
  const pool = getPool();
  const [r] = await pool.execute(
    `UPDATE admin_session_log SET MfaVerifiedAt = CURRENT_TIMESTAMP, MfaMethod = ?
     WHERE SessionLogID = ? AND RevokedAt IS NULL`,
    [m, id]
  );
  return r.affectedRows > 0;
}

export async function listIpBlocklist() {
  await ensureAdminAccessSchema();
  try {
    const [rows] = await getPool().execute(
      `SELECT BlockID, Cidr, Reason, AddedBy, ExpiresAt, BlockMode, CreatedAt
       FROM admin_ip_blocklist
       ORDER BY BlockID DESC
       LIMIT 500`
    );
    return rows.map((r) => ({
      ...r,
      CreatedAt: rowDateTime(r.CreatedAt),
      ExpiresAt: r.ExpiresAt ? rowDateTime(r.ExpiresAt) : null,
    }));
  } catch {
    return [];
  }
}

export async function insertIpBlocklistRow(body) {
  await ensureAdminAccessSchema();
  const b = body && typeof body === "object" ? body : {};
  const cidr = b.cidr != null ? String(b.cidr).trim().slice(0, 80) : "";
  if (!cidr) return null;
  const reason = b.reason != null ? String(b.reason).slice(0, 600) : null;
  const addedBy = b.addedBy != null ? String(b.addedBy).slice(0, 160) : null;
  const blockMode = b.blockMode === "block" ? "block" : "flag";
  let expiresAt = null;
  if (b.expiresAt != null && String(b.expiresAt).trim()) {
    const d = new Date(String(b.expiresAt));
    if (!Number.isNaN(d.getTime())) expiresAt = d;
  }
  const [r] = await getPool().execute(
    `INSERT INTO admin_ip_blocklist (Cidr, Reason, AddedBy, ExpiresAt, BlockMode) VALUES (?, ?, ?, ?, ?)`,
    [cidr, reason, addedBy, expiresAt, blockMode]
  );
  return r.insertId;
}

export async function deleteIpBlocklistRow(blockId) {
  await ensureAdminAccessSchema();
  const id = Number(blockId);
  if (!Number.isInteger(id) || id < 1) return false;
  const [r] = await getPool().execute("DELETE FROM admin_ip_blocklist WHERE BlockID = ?", [id]);
  return r.affectedRows > 0;
}

export async function runLogRetentionPurge() {
  await ensureAdminAccessSchema();
  const settings = await getSystemSettings();
  const policy = parseAccessPolicyFromSettings(settings);
  const auditDays = Number(policy.retentionAuditLogDays);
  const sessDays = Number(policy.retentionSessionLogDays);
  const pool = getPool();
  let auditDeleted = 0;
  let sessDeleted = 0;
  if (Number.isFinite(auditDays) && auditDays > 0) {
    const [r] = await pool.execute(
      `DELETE FROM admin_audit_log WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [Math.floor(auditDays)]
    );
    auditDeleted = r.affectedRows || 0;
  }
  if (Number.isFinite(sessDays) && sessDays > 0) {
    const [r2] = await pool.execute(
      `DELETE FROM admin_session_log WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [Math.floor(sessDays)]
    );
    sessDeleted = r2.affectedRows || 0;
  }
  return { auditDeleted, sessDeleted };
}

export async function markNotificationRead(notificationId, linkedAuditLogId = null) {
  await ensureAdminAccessSchema();
  const nid = Number(notificationId);
  if (!Number.isInteger(nid) || nid < 1) return false;
  const aid = linkedAuditLogId != null ? Number(linkedAuditLogId) : null;
  const pool = getPool();
  try {
    const [r] = await pool.execute(
      `UPDATE notificationlog SET ReadAt = CURRENT_TIMESTAMP, LinkedAuditLogID = ?
       WHERE NotificationID = ?`,
      [Number.isInteger(aid) && aid > 0 ? aid : null, nid]
    );
    return r.affectedRows > 0;
  } catch {
    return false;
  }
}

export async function createCrossPortalIncidentLink(body) {
  await ensureAdminAccessSchema();
  const b = body && typeof body === "object" ? body : {};
  const groupKey = b.groupKey != null && String(b.groupKey).trim()
    ? String(b.groupKey).trim().slice(0, 64)
    : randomUUID().replace(/-/g, "").slice(0, 32);
  const sourceTable = b.sourceTable != null ? String(b.sourceTable).slice(0, 80) : "";
  const sourceId = b.sourceId != null ? String(b.sourceId).slice(0, 64) : "";
  if (!sourceTable || !sourceId) return null;
  const note = b.note != null ? String(b.note).slice(0, 500) : null;
  const [r] = await getPool().execute(
    `INSERT INTO admin_cross_incident_link (GroupKey, SourceTable, SourceId, Note) VALUES (?, ?, ?, ?)`,
    [groupKey, sourceTable, sourceId, note]
  );
  return { linkId: r.insertId, groupKey };
}

export async function insertBreakGlassEvent(body) {
  await ensureAdminAccessSchema();
  const b = body && typeof body === "object" ? body : {};
  const requestedBy = b.requestedBy != null ? String(b.requestedBy).slice(0, 160) : null;
  const reason = b.reason != null ? String(b.reason).slice(0, 600) : null;
  let elevatedUntil = null;
  if (b.elevatedUntil != null && String(b.elevatedUntil).trim()) {
    const d = new Date(String(b.elevatedUntil));
    if (!Number.isNaN(d.getTime())) elevatedUntil = d;
  }
  const [r] = await getPool().execute(
    `INSERT INTO admin_break_glass_log (RequestedBy, Reason, ElevatedUntil) VALUES (?, ?, ?)`,
    [requestedBy, reason, elevatedUntil]
  );
  return r.insertId;
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
              auditor: !!p[portal].auditor,
            };
          }
        }
      }
    }
  } catch {
    /* keep defaults */
  }
  let mfaTiers = {
    admin: ["totp", "webauthn"],
    hr: ["totp", "webauthn", "sms"],
    maintenance: ["totp", "webauthn", "sms"],
    retail: ["totp", "sms", "email_otp"],
    employee: ["totp", "sms"],
    visitor: ["email_otp", "sms"],
  };
  try {
    const t = s.accessMfaTierJson;
    if (t && String(t).trim()) {
      const o = JSON.parse(String(t));
      if (o && typeof o === "object") mfaTiers = { ...mfaTiers, ...o };
    }
  } catch {
    /* keep defaults */
  }
  let tokenTtlByPortal = { default: 1800, admin: 1800, hr: 1800, maintenance: 3600, retail: 7200, employee: 7200, visitor: 14400 };
  try {
    const t = s.accessTokenTtlPolicyJson;
    if (t && String(t).trim()) {
      const o = JSON.parse(String(t));
      if (o && typeof o === "object") tokenTtlByPortal = { ...tokenTtlByPortal, ...o };
    }
  } catch {
    /* keep defaults */
  }
  const retentionAuditLogDays =
    s.retentionAuditLogDays != null && String(s.retentionAuditLogDays).trim() !== ""
      ? Number(s.retentionAuditLogDays)
      : null;
  const retentionSessionLogDays =
    s.retentionSessionLogDays != null && String(s.retentionSessionLogDays).trim() !== ""
      ? Number(s.retentionSessionLogDays)
      : null;
  return {
    mfaRequired: s.accessMfaRequired === "1" || s.accessMfaRequired === "true",
    portalRoles,
    mfaTiers,
    tokenTtlByPortal,
    retentionAuditLogDays: Number.isFinite(retentionAuditLogDays) ? retentionAuditLogDays : null,
    retentionSessionLogDays: Number.isFinite(retentionSessionLogDays) ? retentionSessionLogDays : null,
    passwordResetNotes: s.accessPasswordResetNotes != null ? String(s.accessPasswordResetNotes) : "",
    sessionNotes: s.accessSessionNotes != null ? String(s.accessSessionNotes) : "",
    suspiciousIpWatchlist: s.accessSuspiciousIpWatchlist != null ? String(s.accessSuspiciousIpWatchlist) : "",
    breakGlassProcedureNotes: s.breakGlassProcedureNotes != null ? String(s.breakGlassProcedureNotes) : "",
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
