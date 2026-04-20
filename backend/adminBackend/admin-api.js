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
  ensureAdminAccessSchema,
  validateAdminSessionRequest,
  insertAdminSessionRow,
  updateSessionMfaVerified,
  listIpBlocklist,
  insertIpBlocklistRow,
  deleteIpBlocklistRow,
  runLogRetentionPurge,
  markNotificationRead,
  createCrossPortalIncidentLink,
  insertBreakGlassEvent,
} from "./admin-routes.js";
import { getPool } from "./db.js";
import { buildSnapshotPdf } from "./report-pdf.js";

function reqMeta(req) {
  const h = req.headers || {};
  const xf = h["x-forwarded-for"] || h["X-Forwarded-For"];
  const ip = xf ? String(xf).split(",")[0].trim() : req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : "";
  const ua = h["user-agent"] || h["User-Agent"] || "";
  const sidRaw = h["x-admin-session-id"] || h["X-Admin-Session-Id"];
  const sid = sidRaw != null && String(sidRaw).trim() !== "" ? Number(sidRaw) : null;
  const sessionLogId = Number.isInteger(sid) && sid > 0 ? sid : null;
  return { clientIp: ip.slice(0, 80), userAgent: String(ua).slice(0, 512), sessionLogId };
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
  const allowMethods = "GET, POST, PATCH, DELETE, OPTIONS";
  const allowHeaders = "Content-Type, Authorization, X-Admin-Session-Id";
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
    await ensureAdminAccessSchema();

    const enforceSession = process.env.ADMIN_ENFORCE_SESSION === "1";
    const enforceMfaEnv = process.env.ADMIN_ENFORCE_MFA === "1";
    const sessionExempt =
      pathname === "/api/access/sessions/validate" ||
      (method === "POST" && pathname === "/api/access/sessions") ||
      (process.env.ADMIN_ENFORCE_SESSION_ALLOW_SUMMARY === "1" && pathname === "/api/summary");
    if (enforceSession && pathname.startsWith("/api/") && !sessionExempt) {
      const settings = await getSystemSettings();
      const pol = parseAccessPolicyFromSettings(settings);
      const v = await validateAdminSessionRequest(req, { requireMfa: enforceMfaEnv || pol.mfaRequired });
      if (!v.ok) {
        await insertAdminAuditLog({
          action: "api_session_denied",
          targetType: "api",
          detailJson: { path: pathname, method, code: v.code },
          actionResult: "denied",
          ...reqMeta(req),
        });
        sendJson(res, 401, { error: v.reason, code: v.code }, h);
        return;
      }
    }

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
      if (body.mfaTiers !== undefined) {
        patch.accessMfaTierJson = JSON.stringify(body.mfaTiers);
      }
      if (body.tokenTtlByPortal !== undefined) {
        patch.accessTokenTtlPolicyJson = JSON.stringify(body.tokenTtlByPortal);
      }
      if (body.retentionAuditLogDays !== undefined) {
        patch.retentionAuditLogDays = String(body.retentionAuditLogDays ?? "");
      }
      if (body.retentionSessionLogDays !== undefined) {
        patch.retentionSessionLogDays = String(body.retentionSessionLogDays ?? "");
      }
      if (body.breakGlassProcedureNotes !== undefined) {
        patch.breakGlassProcedureNotes = String(body.breakGlassProcedureNotes ?? "");
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
    if (method === "POST" && pathname === "/api/access/sessions") {
      const body = await readJsonBody(req);
      const id = await insertAdminSessionRow(body, reqMeta(req));
      await insertAdminAuditLog({
        action: "session_row_created",
        targetType: "session",
        targetId: String(id),
        detailJson: { portal: body && body.portal, eventType: body && body.eventType },
        ...reqMeta(req),
      });
      sendJson(res, 201, { ok: true, SessionLogID: id }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/access/sessions/validate") {
      const enforceMfaEnv = process.env.ADMIN_ENFORCE_MFA === "1";
      const settings = await getSystemSettings();
      const pol = parseAccessPolicyFromSettings(settings);
      const v = await validateAdminSessionRequest(req, { requireMfa: enforceMfaEnv || pol.mfaRequired });
      if (!v.ok) {
        sendJson(res, 401, { ok: false, error: v.reason, code: v.code }, h);
        return;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          sessionLogId: v.sessionLogId,
          ttlSeconds: v.ttlSeconds,
          portal: v.row.Portal,
          mfaVerifiedAt: v.row.MfaVerifiedAt,
          mfaMethod: v.row.MfaMethod,
          mfaTiers: pol.mfaTiers,
        },
        h
      );
      return;
    }
    const mfaSess = pathname.match(/^\/api\/access\/sessions\/(\d+)\/mfa$/);
    if (mfaSess && method === "PATCH") {
      const body = await readJsonBody(req);
      const sid = parseInt(mfaSess[1], 10);
      const methodName = body && body.method != null ? String(body.method) : "unknown";
      const ok = await updateSessionMfaVerified(sid, methodName);
      await insertAdminAuditLog({
        action: ok ? "session_mfa_verified" : "session_mfa_verify_failed",
        targetType: "session",
        targetId: String(sid),
        detailJson: { method: methodName },
        ...reqMeta(req),
      });
      if (!ok) {
        sendJson(res, 404, { error: "Session not found or revoked" }, h);
        return;
      }
      sendJson(res, 200, { ok: true, SessionLogID: sid, method: methodName }, h);
      return;
    }
    if (method === "GET" && pathname === "/api/access/ip-blocklist") {
      sendJson(res, 200, await listIpBlocklist(), h);
      return;
    }
    if (method === "POST" && pathname === "/api/access/ip-blocklist") {
      const body = await readJsonBody(req);
      const id = await insertIpBlocklistRow(body);
      if (!id) {
        sendJson(res, 400, { error: "Body needs cidr (IP or CIDR)" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "ip_blocklist_added",
        targetType: "admin_ip_blocklist",
        targetId: String(id),
        detailJson: { cidr: body && body.cidr, blockMode: body && body.blockMode },
        ...reqMeta(req),
      });
      sendJson(res, 201, { ok: true, BlockID: id }, h);
      return;
    }
    const ipBlockDel = pathname.match(/^\/api\/access\/ip-blocklist\/(\d+)$/);
    if (ipBlockDel && method === "DELETE") {
      const bid = parseInt(ipBlockDel[1], 10);
      const ok = await deleteIpBlocklistRow(bid);
      await insertAdminAuditLog({
        action: ok ? "ip_blocklist_deleted" : "ip_blocklist_delete_failed",
        targetType: "admin_ip_blocklist",
        targetId: String(bid),
        ...reqMeta(req),
      });
      if (!ok) {
        sendJson(res, 404, { error: "Not found" }, h);
        return;
      }
      sendJson(res, 200, { ok: true }, h);
      return;
    }
    if (method === "POST" && pathname === "/api/audit/sensitive-read") {
      const body = await readJsonBody(req);
      const action = body && body.action != null ? String(body.action).slice(0, 120) : "sensitive_read";
      await insertAdminAuditLog({
        action,
        targetType: body && body.targetType != null ? String(body.targetType).slice(0, 80) : null,
        targetId: body && body.targetId != null ? String(body.targetId).slice(0, 120) : null,
        detailJson:
          body && body.detail && typeof body.detail === "object"
            ? body.detail
            : { resource: body && body.resource, note: body && body.note },
        actionResult: "read",
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true }, h);
      return;
    }
    if (method === "POST" && pathname === "/api/system/purge-retention-logs") {
      const secret = process.env.ADMIN_LOG_PURGE_SECRET || "";
      const body = await readJsonBody(req);
      const hdr = req.headers && (req.headers["x-purge-secret"] || req.headers["X-Purge-Secret"]);
      const provided = (body && body.secret) || hdr || "";
      if (!secret || String(provided) !== secret) {
        sendJson(res, 403, { error: "Forbidden" }, h);
        return;
      }
      const out = await runLogRetentionPurge();
      await insertAdminAuditLog({
        action: "retention_purge_ran",
        targetType: "system",
        detailJson: out,
        ...reqMeta(req),
      });
      sendJson(res, 200, { ok: true, ...out }, h);
      return;
    }
    if (method === "POST" && pathname === "/api/access/break-glass") {
      const body = await readJsonBody(req);
      const id = await insertBreakGlassEvent(body);
      await insertAdminAuditLog({
        action: "break_glass_requested",
        targetType: "break_glass",
        targetId: id != null ? String(id) : null,
        detailJson: { requestedBy: body && body.requestedBy, reason: body && body.reason },
        ...reqMeta(req),
      });
      sendJson(res, 201, { ok: true, EventID: id }, h);
      return;
    }
    if (method === "POST" && pathname === "/api/incidents/cross-link") {
      const body = await readJsonBody(req);
      const out = await createCrossPortalIncidentLink(body);
      if (!out) {
        sendJson(res, 400, { error: "Need sourceTable and sourceId" }, h);
        return;
      }
      await insertAdminAuditLog({
        action: "cross_portal_incident_linked",
        targetType: "admin_cross_incident_link",
        detailJson: out,
        ...reqMeta(req),
      });
      sendJson(res, 201, { ok: true, ...out }, h);
      return;
    }
    const notifRead = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notifRead && method === "PATCH") {
      const body = await readJsonBody(req);
      const nid = parseInt(notifRead[1], 10);
      const aid = body && body.linkedAuditLogId != null ? Number(body.linkedAuditLogId) : null;
      const ok = await markNotificationRead(nid, aid);
      await insertAdminAuditLog({
        action: ok ? "notification_marked_read" : "notification_mark_read_failed",
        targetType: "notificationlog",
        targetId: String(nid),
        detailJson: { linkedAuditLogId: aid },
        ...reqMeta(req),
      });
      if (!ok) {
        sendJson(res, 404, { error: "Notification not found or table missing columns" }, h);
        return;
      }
      sendJson(res, 200, { ok: true, NotificationID: nid }, h);
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
      const periodDays = sp.get("periodDays");
      const incidentsDays = sp.get("incidentsDays");
      const reviewsDays = sp.get("reviewsDays");
      const kpiMaxIncidents = sp.get("kpiMaxIncidents");
      const kpiMinRetailRevenue = sp.get("kpiMinRetailRevenue");
      const kpiMaxActiveTickets = sp.get("kpiMaxActiveTickets");
      sendJson(
        res,
        200,
        await getReportSnapshot({
          periodDays: periodDays != null && periodDays !== "" ? periodDays : undefined,
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
      const periodDays = sp.get("periodDays");
      const incidentsDays = sp.get("incidentsDays");
      const reviewsDays = sp.get("reviewsDays");
      const kpiMaxIncidents = sp.get("kpiMaxIncidents");
      const kpiMinRetailRevenue = sp.get("kpiMinRetailRevenue");
      const kpiMaxActiveTickets = sp.get("kpiMaxActiveTickets");
      const snap = await getReportSnapshot({
        periodDays: periodDays != null && periodDays !== "" ? periodDays : undefined,
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
      const includeInactive = url.searchParams.get("includeInactive") === "1";
      sendJson(res, 200, await listVisitorReviewsReport({ limit, q, includeInactive }), h);
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
