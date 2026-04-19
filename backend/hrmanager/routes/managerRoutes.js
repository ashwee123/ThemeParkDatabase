import pool from "../db.js";
import { logPortalActivity } from "./portalActivity.js";

export async function getManagers(res, send) {
  const [rows] = await pool.query(
    "SELECT ManagerID, ManagerName, ManagerEmail FROM manager"
  );
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

  try {
    await logPortalActivity(
      "Manager added",
      `${name} (ID ${id}) — ${email}`
    );
  } catch (e) {
    console.error("hr_portal_activity log failed:", e);
  }

  send(res, 200, { message: "Manager added" });
}

export async function deleteManager(res, send, managerId) {
  const [rows] = await pool.query(
    "SELECT ManagerID, ManagerName, ManagerEmail FROM manager WHERE ManagerID = ?",
    [managerId]
  );
  const manager = rows[0];
  if (!manager) {
    return send(res, 404, { error: "Manager not found" });
  }

  const [result] = await pool.query(
    "DELETE FROM manager WHERE ManagerID = ?",
    [managerId]
  );
  if (!result.affectedRows) {
    return send(res, 404, { error: "Manager not found" });
  }

  try {
    await logPortalActivity(
      "Manager deleted",
      `${manager.ManagerName} (ID ${manager.ManagerID}) — ${manager.ManagerEmail ?? "no email"}`
    );
  } catch (e) {
    console.error("hr_portal_activity log failed:", e);
  }

  send(res, 200, { message: "Manager deleted", managerId });
}
