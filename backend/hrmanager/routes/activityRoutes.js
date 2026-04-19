import pool from "../db.js";

export async function getActivity(res, send) {
  const [rows] = await pool.query(`
    SELECT e.Name, p.PerformanceScore, p.WorkloadNotes
    FROM employeeperformance p
    JOIN employee e ON e.EmployeeID = p.EmployeeID
  `);

  send(res, 200, rows);
}

export async function addActivity(res, send, body) {
  await pool.query(
    `INSERT INTO employeeperformance 
     (EmployeeID, ReviewDate, PerformanceScore, WorkloadNotes)
     VALUES (?, CURDATE(), ?, ?)`,
    [body.employeeId, body.score, body.notes]
  );

  send(res, 200, { message: "Activity added" });
}
