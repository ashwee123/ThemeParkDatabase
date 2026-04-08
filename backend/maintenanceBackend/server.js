const http = require("http");
const url = require("url");
const db = require("./db");

// helper to read POST data
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      resolve(JSON.parse(body || "{}"));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS (VERY IMPORTANT)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {

    // =========================
    // GET TASKS
    // =========================
    if (parsedUrl.pathname === "/tasks" && req.method === "GET") {
      const [rows] = await db.query(`
        SELECT 
          m.MaintenanceAssignmentID, 
          e.Name AS EmployeeName, 
          a.AreaName, 
          m.TaskDescription, 
          m.Status, 
          m.DueDate 
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area a ON m.AreaID = a.AreaID
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
    }

    // =========================
    // GET TASKS BY AREA
    // =========================
    else if (parsedUrl.pathname === "/tasksByArea" && req.method === "GET") {
      const areaID = parsedUrl.query.AreaID;

      const [rows] = await db.query(`
        SELECT ma.*, att.AttractionName 
        FROM maintenanceassignment ma
        JOIN attraction att ON ma.AreaID = att.AreaID
        WHERE ma.AreaID = ?
      `, [areaID]);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
    }

    // =========================
    // ADD TASK
    // =========================
    else if (parsedUrl.pathname === "/addTask" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        INSERT INTO maintenanceassignment 
        (EmployeeID, AreaID, TaskDescription, Status, DueDate)
        VALUES (?, ?, ?, ?, ?)
      `, [
        body.EmployeeID,
        body.AreaID,
        body.TaskDescription,
        body.Status,
        body.DueDate
      ]);

      res.end("Task assigned successfully!");
    }

    // =========================
    // UPDATE TASK
    // =========================
    else if (parsedUrl.pathname === "/updateTask" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        UPDATE maintenanceassignment 
        SET Status = ? 
        WHERE MaintenanceAssignmentID = ?
      `, [body.Status, body.MaintenanceAssignmentID]);

      res.end("Status updated!");
    }

    // =========================
    // DELETE ATTRACTION
    // =========================
    else if (parsedUrl.pathname === "/deleteAttraction" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        DELETE FROM attraction WHERE AttractionID = ?
      `, [body.AttractionID]);

      res.end("Attraction removed.");
    }

    // =========================
    // GET ATTRACTIONS
    // =========================
    else if (parsedUrl.pathname === "/attractions" && req.method === "GET") {
      const [rows] = await db.query(`
        SELECT AttractionID, AttractionName, Status FROM attraction
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
    }

    // =========================
    // GET EMPLOYEES
    // =========================
    else if (parsedUrl.pathname === "/employees" && req.method === "GET") {
      const [rows] = await db.query(`SELECT * FROM employee`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
    }

    // =========================
    // ADD EMPLOYEE
    // =========================
    else if (parsedUrl.pathname === "/addEmployee" && req.method === "POST") {
      const body = await getBody(req);

      await db.query(`
        INSERT INTO employee (Name, Position, Salary, HireDate, AreaID)
        VALUES (?, ?, ?, ?, ?)
      `, [
        body.name,
        body.position,
        body.salary,
        body.hireDate,
        body.areaID
      ]);

      res.end("Employee added!");
    }

    else {
      res.writeHead(404);
      res.end("Route not found");
    }

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});