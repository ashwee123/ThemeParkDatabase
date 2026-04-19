import pool from "../db.js";

export async function getManagers(res, send) {
  const [rows] = await pool.query("SELECT * FROM manager");
  send(res, 200, rows);
}

export async function addManager(res, send, body) {
  const { id, name, email, username, password } = body;
  if (!id || !name || !email || !username || !password) {
    return send(res, 400, {
      error:
        "Manager ID, name, email, username, and password are required (database requires ManagerEmail, ManagerUsername, ManagerPassword)."
    });
  }

  await pool.query(
    `INSERT INTO manager (ManagerID, ManagerName, ManagerEmail, ManagerUsername, ManagerPassword)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, email, username, password]
  );

  send(res, 200, { message: "Manager added" });
}
