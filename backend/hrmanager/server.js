import http from "http";
import { URL } from "url";

import { ensurePortalActivityTable, logPortalActivity } from "./routes/portalActivity.js";
import { getEmployees, addEmployee, deleteEmployee } from "./routes/employeeRoutes.js";
import { getManagers, addManager, deleteManager } from "./routes/managerRoutes.js";
import { getActivity, addActivity } from "./routes/activityRoutes.js";
import { getSalary } from "./routes/salaryRoutes.js";

/* -------- helpers -------- */
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    /* ================= LOGIN ================= */
    if (path === "/login" && req.method === "POST") {
      const body = await parseBody(req);

      const { email, password } = body;

      // hardcoded login
      if (email === "hr@nightmarenexus.com" && password === "hr123") {
        try {
          await logPortalActivity("HR login", email);
        } catch (e) {
          console.error("hr_portal_activity log failed:", e);
        }
        return send(res, 200, {
          message: "Login successful",
          role: "hr"
        });
      }

      return send(res, 401, { error: "Invalid credentials" });
    }

    /* ================= EMPLOYEES ================= */
    if (path === "/employees" && req.method === "GET") {
      return await getEmployees(res, send);
    }

    if (path === "/employees" && req.method === "POST") {
      const body = await parseBody(req);
      return await addEmployee(res, send, body);
    }
    if (req.method === "DELETE" && /^\/employees\/\d+$/.test(path)) {
      const employeeId = Number(path.split("/")[2]);
      return await deleteEmployee(res, send, employeeId);
    }

    /* ================= MANAGERS ================= */
    if (path === "/managers" && req.method === "GET") {
      return await getManagers(res, send);
    }

    if (path === "/managers" && req.method === "POST") {
      const body = await parseBody(req);
      return await addManager(res, send, body);
    }
    if (req.method === "DELETE" && /^\/managers\/\d+$/.test(path)) {
      const managerId = Number(path.split("/")[2]);
      return await deleteManager(res, send, managerId);
    }

    /* ================= ACTIVITY ================= */
    if (path === "/activity" && req.method === "GET") {
      return await getActivity(res, send);
    }

    if (path === "/activity" && req.method === "POST") {
      const body = await parseBody(req);
      return await addActivity(res, send, body);
    }

    /* ================= SALARY ================= */
    if (path === "/salary" && req.method === "GET") {
      return await getSalary(res, send);
    }

    /* ================= 404 ================= */
    send(res, 404, { error: "Route not found" });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

/* -------- start -------- */
const PORT = process.env.PORT || 5000;

await ensurePortalActivityTable();

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
