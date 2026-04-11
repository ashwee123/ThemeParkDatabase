import { getPool } from "./db.js";

function dbHint(err) {
  if (err.code === "ECONNREFUSED") {
    return "Check MySQL is running and MYSQL_* env vars. On Windows, start the MySQL service (not only Workbench).";
  }
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return "Verify MYSQL_USER and MYSQL_PASSWORD.";
  }
  return undefined;
}

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function sendDbError(res, err, status = 500) {
  console.error(err);
  const body = {
    error: "Database error",
    sqlMessage: err.sqlMessage,
    code: err.code,
  };
  const hint = dbHint(err);
  if (hint) body.hint = hint;
  sendJson(res, status, body);
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {number} limit
 */
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

async function loadReportPayload() {
  const p = getPool();
  const [managers] = await p.execute(
    `SELECT h.ManagerID, m.ManagerName, a.AreaName
     FROM hrmanager h
     INNER JOIN manager m ON m.ManagerID = h.ManagerID
     LEFT JOIN area a ON a.AreaID = h.AreaID
     ORDER BY h.ManagerID`
  );
  const [employees] = await p.execute(
    `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID FROM employee ORDER BY EmployeeID`
  );
  const [areas] = await p.execute(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  const employeesByArea = areas.map((a) => ({
    AreaID: a.AreaID,
    AreaName: a.AreaName,
    employees: employees.filter((e) => e.AreaID === a.AreaID),
  }));
  const unassigned = employees.filter((e) => e.AreaID == null);
  if (unassigned.length) {
    employeesByArea.push({
      AreaID: null,
      AreaName: "Unassigned",
      employees: unassigned,
    });
  }
  const [maintenance] = await p.execute(
    `SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
            e.Name AS EmployeeName, a.AreaName
     FROM maintenanceassignment m
     LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
     LEFT JOIN area a ON a.AreaID = m.AreaID
     ORDER BY m.CreatedAt DESC`
  );
  const [performance] = await p.execute(
    `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes, e.Name AS EmployeeName
     FROM employeeperformance p
     LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
     ORDER BY p.ReviewDate DESC`
  );
  return {
    generatedAt: new Date().toISOString(),
    managers,
    employees,
    employeesByArea,
    maintenance,
    performance,
  };
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {URL} url
 * @returns {Promise<boolean>}
 */
export async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || "GET";

  try {
    if (method === "GET" && pathname === "/managers") {
      const [rows] = await getPool().execute(
        `SELECT h.ManagerID, m.ManagerName, a.AreaName
         FROM hrmanager h
         INNER JOIN manager m ON m.ManagerID = h.ManagerID
         LEFT JOIN area a ON a.AreaID = h.AreaID
         ORDER BY h.ManagerID`
      );
      sendJson(res, 200, rows);
      return true;
    }

    if (method === "GET" && pathname === "/employees/by-area") {
      const p = getPool();
      const [areas] = await p.execute(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
      const [emps] = await p.execute(
        `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
         FROM employee
         ORDER BY EmployeeID`
      );
      const groups = areas.map((a) => ({
        AreaID: a.AreaID,
        AreaName: a.AreaName,
        employees: emps.filter((e) => e.AreaID === a.AreaID),
      }));
      const unassigned = emps.filter((e) => e.AreaID == null);
      if (unassigned.length) {
        groups.push({
          AreaID: null,
          AreaName: "Unassigned",
          employees: unassigned,
        });
      }
      sendJson(res, 200, groups);
      return true;
    }

    if (method === "GET" && pathname === "/employees") {
      const [rows] = await getPool().execute(
        `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
         FROM employee
         ORDER BY EmployeeID`
      );
      sendJson(res, 200, rows);
      return true;
    }

    if (method === "POST" && pathname === "/employees") {
      const body = await readJsonBody(req);
      const Name = String(body?.Name ?? "").trim();
      const Position = String(body?.Position ?? "").trim();
      const Salary = body?.Salary;
      const HireDate = body?.HireDate;
      const ManagerID =
        body?.ManagerID === "" || body?.ManagerID == null ? null : Number(body.ManagerID);
      const AreaID = body?.AreaID === "" || body?.AreaID == null ? null : Number(body.AreaID);

      if (!Name || !Position) {
        sendJson(res, 400, { error: "Name and Position are required" });
        return true;
      }
      const sal = Number(Salary);
      if (!Number.isFinite(sal) || sal < 0) {
        sendJson(res, 400, { error: "Invalid salary" });
        return true;
      }
      if (!HireDate) {
        sendJson(res, 400, { error: "HireDate is required" });
        return true;
      }
      if (ManagerID != null && !Number.isInteger(ManagerID)) {
        sendJson(res, 400, { error: "Invalid ManagerID" });
        return true;
      }
      if (AreaID != null && !Number.isInteger(AreaID)) {
        sendJson(res, 400, { error: "Invalid AreaID" });
        return true;
      }

      try {
        const [result] = await getPool().execute(
          `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [Name, Position, sal, HireDate, ManagerID, AreaID]
        );
        sendJson(res, 201, { EmployeeID: Number(result.insertId) });
      } catch (e) {
        if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
          sendJson(res, 400, {
            error: "Invalid reference",
            sqlMessage: e.sqlMessage,
            hint: "ManagerID must exist in manager; AreaID must exist in area.",
          });
        } else sendDbError(res, e);
      }
      return true;
    }

    const empPutDel = pathname.match(/^\/employees\/(\d+)$/);
    if (empPutDel && method === "PUT") {
      const id = parseInt(empPutDel[1], 10);
      const body = await readJsonBody(req);
      const Name = String(body?.Name ?? "").trim();
      const Position = String(body?.Position ?? "").trim();
      const Salary = body?.Salary;
      const HireDate = body?.HireDate;
      const ManagerID =
        body?.ManagerID === "" || body?.ManagerID == null ? null : Number(body.ManagerID);
      const AreaID = body?.AreaID === "" || body?.AreaID == null ? null : Number(body.AreaID);

      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: "Invalid employee id" });
        return true;
      }
      if (!Name || !Position) {
        sendJson(res, 400, { error: "Name and Position are required" });
        return true;
      }
      const sal = Number(Salary);
      if (!Number.isFinite(sal) || sal < 0) {
        sendJson(res, 400, { error: "Invalid salary" });
        return true;
      }
      if (!HireDate) {
        sendJson(res, 400, { error: "HireDate is required" });
        return true;
      }
      if (ManagerID != null && !Number.isInteger(ManagerID)) {
        sendJson(res, 400, { error: "Invalid ManagerID" });
        return true;
      }
      if (AreaID != null && !Number.isInteger(AreaID)) {
        sendJson(res, 400, { error: "Invalid AreaID" });
        return true;
      }

      try {
        const [result] = await getPool().execute(
          `UPDATE employee SET Name = ?, Position = ?, Salary = ?, HireDate = ?, ManagerID = ?, AreaID = ?
           WHERE EmployeeID = ?`,
          [Name, Position, sal, HireDate, ManagerID, AreaID, id]
        );
        if (result.affectedRows === 0) {
          sendJson(res, 404, { error: "Employee not found" });
        } else {
          sendJson(res, 200, { ok: true });
        }
      } catch (e) {
        if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
          sendJson(res, 400, { error: "Invalid reference", sqlMessage: e.sqlMessage });
        } else sendDbError(res, e);
      }
      return true;
    }

    if (empPutDel && method === "DELETE") {
      const id = parseInt(empPutDel[1], 10);
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: "Invalid employee id" });
        return true;
      }
      try {
        const [result] = await getPool().execute("DELETE FROM employee WHERE EmployeeID = ?", [id]);
        if (result.affectedRows === 0) {
          sendJson(res, 404, { error: "Employee not found" });
        } else {
          sendJson(res, 200, { ok: true });
        }
      } catch (e) {
        if (e.code === "ER_ROW_IS_REFERENCED_2" || e.code === "ER_ROW_IS_REFERENCED") {
          sendJson(res, 409, {
            error: "Cannot delete employee: referenced by other rows.",
            sqlMessage: e.sqlMessage,
            hint: "Remove related shifts, time logs, incidents, or maintenance rows first.",
          });
        } else sendDbError(res, e);
      }
      return true;
    }

    if (method === "PUT" && pathname === "/assign-manager") {
      const body = await readJsonBody(req);
      const EmployeeID = Number(body?.EmployeeID);
      const ManagerID =
        body?.ManagerID === "" || body?.ManagerID == null ? null : Number(body.ManagerID);

      if (!Number.isInteger(EmployeeID) || EmployeeID <= 0) {
        sendJson(res, 400, { error: "Valid EmployeeID is required" });
        return true;
      }
      if (ManagerID != null && !Number.isInteger(ManagerID)) {
        sendJson(res, 400, { error: "Invalid ManagerID" });
        return true;
      }

      try {
        const [result] = await getPool().execute(
          "UPDATE employee SET ManagerID = ? WHERE EmployeeID = ?",
          [ManagerID, EmployeeID]
        );
        if (result.affectedRows === 0) {
          sendJson(res, 404, { error: "Employee not found" });
        } else {
          sendJson(res, 200, { ok: true });
        }
      } catch (e) {
        if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
          sendJson(res, 400, { error: "ManagerID must exist in manager table.", sqlMessage: e.sqlMessage });
        } else sendDbError(res, e);
      }
      return true;
    }

    if (method === "GET" && pathname === "/maintenance") {
      const status = url.searchParams.get("status");
      const allowed = ["Pending", "In Progress", "Completed"];
      if (status && !allowed.includes(status)) {
        sendJson(res, 400, { error: "Invalid status filter" });
        return true;
      }
      try {
        let sql = `SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
        e.Name AS EmployeeName, a.AreaName
      FROM maintenanceassignment m
      LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
      LEFT JOIN area a ON a.AreaID = m.AreaID`;
        const params = [];
        if (status) {
          sql += " WHERE m.Status = ?";
          params.push(status);
        }
        sql += " ORDER BY m.CreatedAt DESC";
        const [rows] = await getPool().execute(sql, params);
        sendJson(res, 200, rows);
      } catch (e) {
        sendDbError(res, e);
      }
      return true;
    }

    if (method === "POST" && pathname === "/maintenance") {
      const body = await readJsonBody(req);
      const EmployeeID = Number(body?.EmployeeID);
      const AreaID = body?.AreaID === "" || body?.AreaID == null ? null : Number(body.AreaID);
      const TaskDescription = String(body?.TaskDescription ?? "").trim();
      const Status = String(body?.Status ?? "Pending");
      const DueDate =
        body?.DueDate === "" || body?.DueDate == null ? null : String(body.DueDate);

      const allowed = ["Pending", "In Progress", "Completed"];
      if (!Number.isInteger(EmployeeID) || EmployeeID <= 0) {
        sendJson(res, 400, { error: "Valid EmployeeID is required" });
        return true;
      }
      if (!TaskDescription) {
        sendJson(res, 400, { error: "TaskDescription is required" });
        return true;
      }
      if (!allowed.includes(Status)) {
        sendJson(res, 400, { error: "Invalid Status" });
        return true;
      }
      if (AreaID != null && !Number.isInteger(AreaID)) {
        sendJson(res, 400, { error: "Invalid AreaID" });
        return true;
      }

      try {
        const [result] = await getPool().execute(
          `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
           VALUES (?, ?, ?, ?, ?)`,
          [EmployeeID, AreaID, TaskDescription, Status, DueDate]
        );
        sendJson(res, 201, { MaintenanceAssignmentID: Number(result.insertId) });
      } catch (e) {
        if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_NO_REFERENCED_ROW") {
          sendJson(res, 400, { error: "Invalid EmployeeID or AreaID", sqlMessage: e.sqlMessage });
        } else sendDbError(res, e);
      }
      return true;
    }

    const maintId = pathname.match(/^\/maintenance\/(\d+)$/);
    if (maintId && method === "PUT") {
      const id = parseInt(maintId[1], 10);
      const body = await readJsonBody(req);
      const Status = String(body?.Status ?? "");
      const allowed = ["Pending", "In Progress", "Completed"];
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: "Invalid id" });
        return true;
      }
      if (!allowed.includes(Status)) {
        sendJson(res, 400, { error: "Invalid Status" });
        return true;
      }
      try {
        const [result] = await getPool().execute(
          "UPDATE maintenanceassignment SET Status = ? WHERE MaintenanceAssignmentID = ?",
          [Status, id]
        );
        if (result.affectedRows === 0) {
          sendJson(res, 404, { error: "Assignment not found" });
        } else {
          sendJson(res, 200, { ok: true });
        }
      } catch (e) {
        sendDbError(res, e);
      }
      return true;
    }

    if (maintId && method === "DELETE") {
      const id = parseInt(maintId[1], 10);
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: "Invalid id" });
        return true;
      }
      try {
        const [result] = await getPool().execute(
          "DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID = ?",
          [id]
        );
        if (result.affectedRows === 0) {
          sendJson(res, 404, { error: "Assignment not found" });
        } else {
          sendJson(res, 200, { ok: true });
        }
      } catch (e) {
        sendDbError(res, e);
      }
      return true;
    }

    if (method === "GET" && pathname === "/performance") {
      try {
        const [rows] = await getPool().execute(
          `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes,
                  e.Name AS EmployeeName
           FROM employeeperformance p
           LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
           ORDER BY p.ReviewDate DESC, p.PerformanceID DESC`
        );
        sendJson(res, 200, rows);
      } catch (e) {
        sendDbError(res, e);
      }
      return true;
    }

    if (method === "GET" && pathname === "/report") {
      const format = String(url.searchParams.get("format") || "json").toLowerCase();
      try {
        const data = await loadReportPayload();
        if (format === "json") {
          const download = url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";
          const body = JSON.stringify(data, null, 2);
          const headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
          };
          if (download) {
            headers["Content-Disposition"] = 'attachment; filename="hr-data-report.json"';
          }
          res.writeHead(200, headers);
          res.end(body);
          return true;
        }
        if (format === "md" || format === "markdown") {
          let md = `# HR data report\n\n_Generated: ${data.generatedAt}_\n\n`;
          md += `## Managers (HR)\n\n`;
          for (const m of data.managers) {
            md += `- **${m.ManagerID}** — ${m.ManagerName ?? "—"} (${m.AreaName ?? "no area"})\n`;
          }
          md += `\n## Employees\n\n`;
          md += `| ID | Name | Position | Salary | Hire | Mgr | Area |\n`;
          md += `|---:|---|---|---|---:|---:|---:|\n`;
          for (const e of data.employees) {
            md += `| ${e.EmployeeID} | ${e.Name} | ${e.Position} | ${e.Salary} | ${String(e.HireDate).slice(0, 10)} | ${e.ManagerID ?? "—"} | ${e.AreaID ?? "—"} |\n`;
          }
          md += `\n## By area\n\n`;
          for (const g of data.employeesByArea) {
            md += `### ${g.AreaName} (AreaID: ${g.AreaID ?? "null"})\n\n`;
            if (!g.employees.length) {
              md += `_No employees._\n\n`;
              continue;
            }
            for (const e of g.employees) {
              md += `- ${e.EmployeeID}: **${e.Name}** — ${e.Position}\n`;
            }
            md += `\n`;
          }
          md += `## Maintenance assignments\n\n`;
          for (const m of data.maintenance) {
            md += `- **${m.MaintenanceAssignmentID}** [${m.Status}] ${m.TaskDescription} — ${m.EmployeeName ?? m.EmployeeID} / ${m.AreaName ?? "—"} (due ${m.DueDate ? String(m.DueDate).slice(0, 10) : "—"})\n`;
          }
          md += `\n## Performance\n\n`;
          for (const p of data.performance) {
            md += `- **${p.PerformanceID}** ${p.EmployeeName ?? p.EmployeeID} @ ${String(p.ReviewDate).slice(0, 10)} — score **${p.PerformanceScore}**${p.WorkloadNotes ? ` — _${p.WorkloadNotes}_` : ""}\n`;
          }
          const body = md;
          res.writeHead(200, {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
            "Content-Disposition": 'attachment; filename="hr-data-report.md"',
          });
          res.end(body);
          return true;
        }
        sendJson(res, 400, { error: "Unknown format", hint: "Use format=json or format=md" });
        return true;
      } catch (e) {
        sendDbError(res, e);
        return true;
      }
    }
  } catch (e) {
    const status = e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    const message = status === 500 ? "Internal server error" : e.message;
    if (status === 500) console.error(e);
    sendJson(res, status, { error: message });
    return true;
  }

  return false;
}
