import pool from "../db.js";
import { logPortalActivity } from "./portalActivity.js";

export async function getEmployees(res, send) {
  const [rows] = await pool.query("SELECT * FROM employee");
  send(res, 200, rows);
}

export async function addEmployee(res, send, body) {
  const [result] = await pool.query(
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

  const newId = Number(result.insertId);
  try {
    await logPortalActivity(
      "Employee added",
      `${body.name} (ID ${Number.isFinite(newId) ? newId : "?"}) — ${body.position || "position unset"}; salary ${body.salary ?? "—"}`
    );
  } catch (e) {
    console.error("hr_portal_activity log failed:", e);
  }

  send(res, 200, { message: "Employee added", employeeId: newId });
}
