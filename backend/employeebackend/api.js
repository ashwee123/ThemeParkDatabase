import {
  createIncidentReport,
  getEmployee,
  getMaintenanceAssignments,
  getPerformance,
  getShifts,
  getTimelog,
  listEmployees,
} from "./routes.js";

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

async function readJsonBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const e = new Error("Payload too large");
      e.statusCode = 413;
      throw e;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const e = new Error("Invalid JSON");
    e.statusCode = 400;
    throw e;
  }
}

const cors = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {URL} url
 * @returns {Promise<boolean>}
 */
export async function handleEmployeeApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return true;
  }

  const p = pathname.slice("/api".length) || "/";

  const h = { ...cors };

  try {
    if (method === "GET" && p === "/employees") {
      sendJson(res, 200, await listEmployees(), h);
      return true;
    }

    const mMaint = p.match(/^\/employees\/(\d+)\/maintenance-assignments$/);
    if (mMaint && method === "GET") {
      sendJson(res, 200, await getMaintenanceAssignments(parseInt(mMaint[1], 10)), h);
      return true;
    }

    const mPerf = p.match(/^\/employees\/(\d+)\/performance$/);
    if (mPerf && method === "GET") {
      sendJson(res, 200, await getPerformance(parseInt(mPerf[1], 10)), h);
      return true;
    }

    const mTime = p.match(/^\/employees\/(\d+)\/timelog$/);
    if (mTime && method === "GET") {
      sendJson(res, 200, await getTimelog(parseInt(mTime[1], 10)), h);
      return true;
    }

    const mShift = p.match(/^\/employees\/(\d+)\/shifts$/);
    if (mShift && method === "GET") {
      sendJson(res, 200, await getShifts(parseInt(mShift[1], 10)), h);
      return true;
    }

    const mEmp = p.match(/^\/employees\/(\d+)$/);
    if (mEmp && method === "GET") {
      const emp = await getEmployee(parseInt(mEmp[1], 10));
      if (!emp) {
        sendJson(res, 404, { error: "Employee not found" }, h);
        return true;
      }
      sendJson(res, 200, emp, h);
      return true;
    }

    if (method === "POST" && p === "/incident-reports") {
      const body = await readJsonBody(req);
      const out = await createIncidentReport(body);
      sendJson(res, 201, out, h);
      return true;
    }

    sendJson(res, 404, { error: "Not found", path: p }, h);
    return true;
  } catch (e) {
    const status = e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    const message = status === 500 ? "Internal server error" : e.message;
    if (status === 500) console.error(e);
    sendJson(res, status, { error: message }, h);
    return true;
  }
}
