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

const cors = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function handleAdminApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || "GET";

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
