/**
 * HTTP handlers for /api/* — imported by server.js
 * Path: theme-park-admin-portal/admin-api.js (same folder as server.js)
 */
import {
  getSummary,
  listActiveAlerts,
  listAreas,
  listAttractions,
  listIncidents,
  listMaintenanceAssignments,
  listRecentWeather,
  listRetailItems,
  markAlertHandled,
  listVisitors,
  setVisitorActive,
  listTicketsAdmin,
  listShiftsAdmin,
  listNotificationLog,
  getReportSnapshot,
  listVisitorReviewsReport,
  listHrManagers,
  updateAttractionStatus,
  listVisitorParks,
  updateVisitorPark,
  listSpecialEvents,
  createSpecialEvent,
  getTicketPricingByType,
  setTicketTypePrice,
  getSystemSettings,
  patchSystemSettings,
  listEmployeesWithAccess,
  patchEmployeeAccess,
  insertAdminAuditLog,
  listAdminAuditLog,
  listAdminSessionLog,
  revokeAdminSessionLog,
  parseAccessPolicyFromSettings,
} from "./admin-routes.js";
import { getPool } from "./db.js";
import { buildSnapshotPdf } from "./report-pdf.js";

function reqMeta(req) {
  const h = req.headers || {};
  const xf = h["x-forwarded-for"] || h["X-Forwarded-For"];
  const ip = xf ? String(xf).split(",")[0].trim() : req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : "";
  const ua = h["user-agent"] || h["User-Agent"] || "";
  return { clientIp: ip.slice(0, 80), userAgent: String(ua).slice(0, 512) };
}

function sendJson(res, status, data, extra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extra,
  });
  res.end(body);
}

function getCorsHeaders(req) {
  const configured = String(process.env.CORS_ORIGIN || "").trim();
  const allowMethods = "GET, POST, PATCH, OPTIONS";
  const allowHeaders = "Content-Type, Authorization";
  if (!configured) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": allowMethods,
      "Access-Control-Allow-Headers": allowHeaders,
    };
  }
  const origin = (req.headers && req.headers.origin ? String(req.headers.origin) : "").trim();
  const allowed = configured
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const wildcard = allowed.includes("*");
  const match = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": wildcard
      ? "*"
      : match
        ? origin
        : allowed[0],
    "Access-Control-Allow-Methods": allowMethods,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export async function handleAdminApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || "GET";
  const cors = getCorsHeaders(req);

  if (method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  const h = { ...cors };

  try {
    if (method === "GET" && pathname === "/api/summary") {
      sendJson(res, 200, await getSummary(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/areas") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listAreas({ q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/attractions") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listAttractions({ q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/employees") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listEmployeesWithAccess({ q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/access/policy") {
      sendJson(res, 200, parseAccessPolicyFromSettings(await getSystemSettings()), h);
      return;
    }
    if (method === "PATCH" && pathname === "/api/access/policy") {
      const body = await readJsonBody(req);
      const patch = {};
      if (body.mfaRequired !== undefined) patch.accessMfaRequired = body.mfaRequired ? "1" : "0";
      if (body.portalRoles !== undefined) {
        patch.accessPortalRolesJson = JSON.stringify(body.portalRoles);
      }
      if (body.passwordResetNotes !== undefined) patch.accessPasswordResetNotes = String(body.passwordResetNotes ?? "");
      if (body.sessionNotes !== undefined) patch.accessSessionNotes = String(body.sessionNotes ?? "");
      if (body.suspiciousIpWatchlist !== undefined) {
        patch.accessSuspiciousIpWatchlist = String(body.suspiciousIpWatchlist ?? "");
      }
      await patchSystemSettings(patch);
      await insertAdminAuditLog({
        action: "access_policy_updated",
        targetType: "policy",
        detail: JSON.stringify(Object.keys(patch)),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, policy: parseAccessPolicyFromSettings(await getSystemSettings()) }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/audit-log") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listAdminAuditLog(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/access/sessions") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listAdminSessionLog(limit), h);
      return;
    }
    if (method === "POST" && pathname === "/api/access/sessions/revoke") {
      const body = await readJsonBody(req);
      const sid = body && body.sessionLogId != null ? Number(body.sessionLogId) : NaN;
      if (!Number.isInteger(sid) || sid < 1) {
        sendJson(res, 400, { error: "Body must include sessionLogId" }, h);
        return;
      }
      const ok = await revokeAdminSessionLog(sid);
      await insertAdminAuditLog({
        action: ok ? "session_revoked" : "session_revoke_failed",
        targetType: "session",
        targetId: String(sid),
        ...reqMeta(req),
      });
      if (!ok) {
        sendJson(res, 404, { error: "Session not found or already revoked" }, h);
        return;
      }
      sendJson(res, 200, { ok: true, SessionLogID: sid }, h);
      return;
    }
    const empAccessPatch = pathname.match(/^\/api\/access\/employees\/(\d+)$/);
    if (empAccessPatch && method === "PATCH") {
      const id = parseInt(empAccessPatch[1], 10);
      const body = await readJsonBody(req);
      const ok = await patchEmployeeAccess(id, body);
      if (!ok) {
        sendJson(res, 400, { error: "Invalid employee or fields" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "employee_access_updated",
        targetType: "employee",
        targetId: String(id),
        detail: JSON.stringify({ isActive: body.isActive, accessRole: body.accessRole }),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, EmployeeID: id }, h);
      return;
    }
    const empPwdReset = pathname.match(/^\/api\/access\/employees\/(\d+)\/password-reset-request$/);
    if (empPwdReset && method === "POST") {
      const id = parseInt(empPwdReset[1], 10);
      const [rows] = await getPool().execute("SELECT EmployeeID FROM employee WHERE EmployeeID = ? LIMIT 1", [id]);
      if (!rows.length) {
        sendJson(res, 404, { error: "Employee not found" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "password_reset_flow_requested",
        targetType: "employee",
        targetId: String(id),
        detail: "Centralized reset — hook your IdP / auth backend to deliver email/SMS.",
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, EmployeeID: id, message: "Reset logged; integrate mailer in auth service." }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/hr-managers") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listHrManagers({ q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/alerts") {
      sendJson(res, 200, await listActiveAlerts(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/maintenance-assignments") {
      sendJson(res, 200, await listMaintenanceAssignments(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/retail/items") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listRetailItems({ q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/incidents") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listIncidents(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/weather") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listRecentWeather(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/visitors") {
      const q = url.searchParams.get("q") || "";
      const limit = url.searchParams.get("limit");
      const countsParam = url.searchParams.get("counts");
      const includeCounts = countsParam !== "0";
      sendJson(res, 200, await listVisitors({ q, limit, includeCounts }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/tickets/admin") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listTicketsAdmin(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/shifts") {
      const limit = url.searchParams.get("limit");
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listShiftsAdmin({ limit, q }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/notifications") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listNotificationLog(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/reports/snapshot") {
      const sp = url.searchParams;
      const incidentsDays = sp.get("incidentsDays");
      const reviewsDays = sp.get("reviewsDays");
      const kpiMaxIncidents = sp.get("kpiMaxIncidents");
      const kpiMinRetailRevenue = sp.get("kpiMinRetailRevenue");
      const kpiMaxActiveTickets = sp.get("kpiMaxActiveTickets");
      sendJson(
        res,
        200,
        await getReportSnapshot({
          incidentsDays: incidentsDays != null && incidentsDays !== "" ? incidentsDays : undefined,
          reviewsDays: reviewsDays != null && reviewsDays !== "" ? reviewsDays : undefined,
          kpiMaxIncidents: kpiMaxIncidents != null && kpiMaxIncidents !== "" ? kpiMaxIncidents : undefined,
          kpiMinRetailRevenue:
            kpiMinRetailRevenue != null && kpiMinRetailRevenue !== "" ? kpiMinRetailRevenue : undefined,
          kpiMaxActiveTickets:
            kpiMaxActiveTickets != null && kpiMaxActiveTickets !== "" ? kpiMaxActiveTickets : undefined,
        }),
        h
      );
      return;
    }
    if (method === "GET" && pathname === "/api/reports/pdf") {
      const sp = url.searchParams;
      const incidentsDays = sp.get("incidentsDays");
      const reviewsDays = sp.get("reviewsDays");
      const kpiMaxIncidents = sp.get("kpiMaxIncidents");
      const kpiMinRetailRevenue = sp.get("kpiMinRetailRevenue");
      const kpiMaxActiveTickets = sp.get("kpiMaxActiveTickets");
      const snap = await getReportSnapshot({
        incidentsDays: incidentsDays != null && incidentsDays !== "" ? incidentsDays : undefined,
        reviewsDays: reviewsDays != null && reviewsDays !== "" ? reviewsDays : undefined,
        kpiMaxIncidents: kpiMaxIncidents != null && kpiMaxIncidents !== "" ? kpiMaxIncidents : undefined,
        kpiMinRetailRevenue:
          kpiMinRetailRevenue != null && kpiMinRetailRevenue !== "" ? kpiMinRetailRevenue : undefined,
        kpiMaxActiveTickets:
          kpiMaxActiveTickets != null && kpiMaxActiveTickets !== "" ? kpiMaxActiveTickets : undefined,
      });
      const buf = await buildSnapshotPdf(snap);
      const headers = {
        ...h,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="report-snapshot.pdf"',
        "Content-Length": String(buf.length),
      };
      res.writeHead(200, headers);
      res.end(buf);
      return;
    }
    if (method === "GET" && pathname === "/api/reports/visitor-reviews") {
      const limit = url.searchParams.get("limit");
      const q = url.searchParams.get("q") || "";
      sendJson(res, 200, await listVisitorReviewsReport({ limit, q }), h);
      return;
    }

    if (method === "GET" && pathname === "/api/system/parks") {
      sendJson(res, 200, await listVisitorParks(), h);
      return;
    }
    const parkPatch = pathname.match(/^\/api\/system\/parks\/(\d+)$/);
    if (parkPatch && method === "PATCH") {
      const id = parseInt(parkPatch[1], 10);
      const body = await readJsonBody(req);
      const ok = await updateVisitorPark(id, body);
      if (!ok) {
        sendJson(res, 400, { error: "Invalid park or no fields to update" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "system_park_updated",
        targetType: "visitor_park",
        targetId: String(id),
        detail: JSON.stringify(body),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, ParkID: id }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/system/special-events") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listSpecialEvents(limit), h);
      return;
    }
    if (method === "POST" && pathname === "/api/system/special-events") {
      const body = await readJsonBody(req);
      const id = await createSpecialEvent(body);
      if (!id) {
        sendJson(res, 400, { error: "Need eventName, eventDate (YYYY-MM-DD), optional parkId, description, startTime, endTime" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "special_event_created",
        targetType: "visitor_special_event",
        targetId: String(id),
        detail: JSON.stringify(body),
        ...reqMeta(req),
      });
      sendJson(res, 201, { ok: true, EventID: id }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/system/ticket-pricing") {
      sendJson(res, 200, await getTicketPricingByType(), h);
      return;
    }
    if (method === "PATCH" && pathname === "/api/system/ticket-pricing") {
      const body = await readJsonBody(req);
      const tt = body && body.ticketType != null ? String(body.ticketType) : "";
      const price = body && body.price != null ? body.price : null;
      const ok = await setTicketTypePrice(tt, price);
      if (!ok) {
        sendJson(res, 400, { error: "Invalid ticketType (General|VIP|Discount) or price" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "ticket_type_price_updated",
        targetType: "ticket",
        targetId: tt,
        detail: JSON.stringify({ price: Number(price) }),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, ticketType: tt, price: Number(price) }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/system/settings") {
      sendJson(res, 200, await getSystemSettings(), h);
      return;
    }
    if (method === "PATCH" && pathname === "/api/system/settings") {
      const body = await readJsonBody(req);
      await patchSystemSettings(body || {});
      await insertAdminAuditLog({
        action: "system_settings_updated",
        targetType: "admin_system_settings",
        detail: JSON.stringify(Object.keys(body || {})),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true }, h);
      return;
    }

    const visitorPatch = pathname.match(/^\/api\/visitors\/(\d+)$/);
    if (visitorPatch && method === "PATCH") {
      const id = parseInt(visitorPatch[1], 10);
      const body = await readJsonBody(req);
      if (typeof body.isActive !== "boolean" && body.isActive !== 0 && body.isActive !== 1) {
        sendJson(res, 400, { error: "Body must include isActive (boolean or 0/1)" }, h);
        return;
      }
      const active = body.isActive === true || body.isActive === 1;
      const ok = await setVisitorActive(id, active);
      if (!ok) {
        sendJson(res, 404, { error: "Visitor not found" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "visitor_is_active_updated",
        targetType: "visitor",
        targetId: String(id),
        detail: JSON.stringify({ isActive: active }),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, VisitorID: id, IsActive: active ? 1 : 0 }, h);
      return;
    }

    const attStatus = pathname.match(/^\/api\/attractions\/(\d+)\/status$/);
    if (attStatus && method === "PATCH") {
      const id = parseInt(attStatus[1], 10);
      const body = await readJsonBody(req);
      const status = body && body.status != null ? String(body.status) : "";
      if (!status) {
        sendJson(res, 400, { error: "Body must include status (e.g. Open, Closed)" }, h);
        return;
      }
      const ok = await updateAttractionStatus(id, status);
      if (!ok) {
        sendJson(res, 400, { error: "Invalid attraction or status" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "attraction_status_updated",
        targetType: "attraction",
        targetId: String(id),
        detail: JSON.stringify({ status }),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, AttractionID: id, Status: status }, h);
      return;
    }

    const alertHandled = pathname.match(/^\/api\/alerts\/(\d+)\/handled$/);
    if (alertHandled && method === "PATCH") {
      const id = parseInt(alertHandled[1], 10);
      if (!Number.isInteger(id) || id < 1) {
        sendJson(res, 400, { error: "Invalid AlertID" }, h);
        return;
      }
      const ok = await markAlertHandled(id);
      if (!ok) {
        sendJson(res, 404, { error: "Alert not found or already handled" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "maintenance_alert_handled",
        targetType: "maintenancealert",
        targetId: String(id),
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, AlertID: id }, h);
      return;
    }

    sendJson(res, 404, { error: "Not found", path: pathname }, h);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error", detail: String(e.message) }, h);
  }
}
