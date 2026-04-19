import http from "http";
import { URL } from "url";

import { getEmployees, addEmployee } from "./routes/employeeRoutes.js";
import { getManagers, addManager } from "./routes/managerRoutes.js";
import { getActivity, addActivity } from "./routes/activityRoutes.js";
import { getSalary } from "./routes/salaryRoutes.js";

/* -------- helpers -------- */
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => resolve(JSON.parse(body || "{}")));
  });
}

/* -------- server -------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return send(res, 200, {});
  }

  try {
    /* EMPLOYEES */
    if (path === "/employees" && req.method === "GET") {
      return await getEmployees(res, send);
    }

    if (path === "/employees" && req.method === "POST") {
      const body = await parseBody(req);
      return await addEmployee(res, send, body);
    }

    /* MANAGERS */
    if (path === "/managers" && req.method === "GET") {
      return await getManagers(res, send);
    }

    if (path === "/managers" && req.method === "POST") {
      const body = await parseBody(req);
      return await addManager(res, send, body);
    }

    /* ACTIVITY */
    if (path === "/activity" && req.method === "GET") {
      return await getActivity(res, send);
    }

    if (path === "/activity" && req.method === "POST") {
      const body = await parseBody(req);
      return await addActivity(res, send, body);
    }

    /* SALARY */
    if (path === "/salary" && req.method === "GET") {
      return await getSalary(res, send);
    }

    /* 404 */
    send(res, 404, { error: "Route not found" });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

/* -------- start -------- */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
