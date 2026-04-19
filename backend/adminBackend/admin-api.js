/**
 * HTTP handlers for /api/* — imported by server.js
 * Path: theme-park-admin-portal/admin-api.js (same folder as server.js)
 */
import {
  getSummary,
  listActiveAlerts,
  listAreas,
  listAttractions,
  listEmployees,
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
  updateAttractionStatus,
} from "./admin-routes.js";

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
  const allowMethods = "GET, PATCH, OPTIONS";
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
      sendJson(res, 200, await listAreas(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/attractions") {
      sendJson(res, 200, await listAttractions(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/employees") {
      sendJson(res, 200, await listEmployees(), h);
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
      sendJson(res, 200, await listRetailItems(), h);
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
      sendJson(res, 200, await listVisitors({ q, limit }), h);
      return;
    }
    if (method === "GET" && pathname === "/api/tickets/admin") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listTicketsAdmin(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/shifts") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listShiftsAdmin(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/notifications") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listNotificationLog(limit), h);
      return;
    }
    if (method === "GET" && pathname === "/api/reports/snapshot") {
      sendJson(res, 200, await getReportSnapshot(), h);
      return;
    }
    if (method === "GET" && pathname === "/api/reports/visitor-reviews") {
      const limit = url.searchParams.get("limit");
      sendJson(res, 200, await listVisitorReviewsReport(limit), h);
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
      sendJson(res, 200, { ok: true, AlertID: id }, h);
      return;
    }

    sendJson(res, 404, { error: "Not found", path: pathname }, h);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error", detail: String(e.message) }, h);
  }
}
