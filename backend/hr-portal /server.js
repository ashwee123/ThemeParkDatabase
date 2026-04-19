import http from "http";
import { URL } from "url";
import mysql from "mysql2/promise";

/* -------- DB CONNECTION (YOUR AZURE DB) -------- */
const pool = mysql.createPool({
  host: "themepark6.mysql.database.azure.com",
  user: "admin1", // your username
  password: "uma1uma2uma!",
  database: "newthemepark",
  port: 3306,
  ssl: { rejectUnauthorized: false }
});

/* -------- HELPERS -------- */
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
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(JSON.parse(body || "{}")));
  });
}

/* -------- SERVER -------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") return send(res, 200, {});

  try {

    /* ================= EMPLOYEES ================= */
    if (path === "/employees" && req.method === "GET") {
      const [rows] = await pool.query("SELECT * FROM employee");
      return send(res, 200, rows);
    }

    if (path === "/employees" && req.method === "POST") {
      const body = await parseBody(req);

      await pool.query(
        `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
         VALUES (?, ?, ?, CURDATE(), ?, ?)`,
        [body.name, body.position, body.salary, body.managerId, body.areaId]
      );

      return send(res, 200, { message: "Employee added" });
    }

    /* ================= MANAGERS ================= */
    if (path === "/managers" && req.method === "GET") {
      const [rows] = await pool.query("SELECT * FROM manager");
      return send(res, 200, rows);
    }

    if (path === "/managers" && req.method === "POST") {
      const body = await parseBody(req);

      await pool.query(
        `INSERT INTO manager (ManagerID, ManagerName)
         VALUES (?, ?)`,
        [body.id, body.name]
      );

      return send(res, 200, { message: "Manager added" });
    }

    /* ================= PERFORMANCE / ACTIVITY ================= */
    if (path === "/activity" && req.method === "GET") {
      const [rows] = await pool.query(`
        SELECT e.Name, p.PerformanceScore, p.WorkloadNotes
        FROM employeeperformance p
        JOIN employee e ON e.EmployeeID = p.EmployeeID
      `);
      return send(res, 200, rows);
    }

    if (path === "/activity" && req.method === "POST") {
      const body = await parseBody(req);

      await pool.query(
        `INSERT INTO employeeperformance 
         (EmployeeID, ReviewDate, PerformanceScore, WorkloadNotes)
         VALUES (?, CURDATE(), ?, ?)`,
        [body.employeeId, body.score, body.notes]
      );

      return send(res, 200, { message: "Activity added" });
    }

    /* ================= SALARY ================= */
    if (path === "/salary" && req.method === "GET") {
      const [rows] = await pool.query(`
        SELECT Name, Salary FROM employee
      `);
      return send(res, 200, rows);
    }

    send(res, 404, { error: "Not Found" });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Running on ${PORT}`));
