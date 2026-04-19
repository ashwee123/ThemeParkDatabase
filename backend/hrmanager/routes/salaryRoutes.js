import pool from "../db.js";

export async function getSalary(res, send) {
  const [rows] = await pool.query(
    "SELECT Name, Salary FROM employee"
  );
  send(res, 200, rows);
}
