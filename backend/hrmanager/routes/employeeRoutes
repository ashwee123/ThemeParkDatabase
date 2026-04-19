import pool from "../db.js";

export async function getEmployees(res, send) {
  const [rows] = await pool.query("SELECT * FROM employee");
  send(res, 200, rows);
}

export async function addEmployee(res, send, body) {
  await pool.query(
    `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
     VALUES (?, ?, ?, CURDATE(), ?, ?)`,
    [
      body.name,
      body.position,
      body.salary,
      body.managerId,
      body.areaId
    ]
  );

  send(res, 200, { message: "Employee added" });
}
