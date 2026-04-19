import pool from "../db.js";

export async function getManagers(res, send) {
  const [rows] = await pool.query("SELECT * FROM manager");
  send(res, 200, rows);
}

export async function addManager(res, send, body) {
  await pool.query(
    `INSERT INTO manager (ManagerID, ManagerName) VALUES (?, ?)`,
    [body.id, body.name]
  );

  send(res, 200, { message: "Manager added" });
}
