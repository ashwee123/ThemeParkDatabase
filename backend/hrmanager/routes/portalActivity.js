import pool from "../db.js";
import { logPortalActivity } from "./portalActivity.js";

export async function getActivity(res, send) {
  const [rows] = await pool.query(`
    SELECT ActivityID AS id, CreatedAt AS created_at, Action AS action, Detail AS detail
    FROM hr_portal_activity
    ORDER BY created_at DESC, id DESC
    LIMIT 200
  `);

  send(res, 200, rows);
}

export async function addActivity(res, send, body) {
  const action = (body.action || body.Activity || "").trim();
  const detail = body.detail ?? body.notes ?? null;
  if (!action) {
    return send(res, 400, { error: "action is required" });
  }

  await logPortalActivity(action, detail);
  send(res, 200, { message: "Activity recorded" });
}
