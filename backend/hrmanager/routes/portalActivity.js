import pool from "../db.js";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS hr_portal_activity (
  ActivityID INT NOT NULL AUTO_INCREMENT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`Action\` VARCHAR(120) NOT NULL,
  Detail VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (ActivityID),
  KEY idx_hr_activity_created (CreatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

export async function ensurePortalActivityTable() {
  await pool.query(CREATE_SQL);
}

export async function logPortalActivity(action, detail) {
  await pool.query(
    `INSERT INTO hr_portal_activity (\`Action\`, Detail) VALUES (?, ?)`,
    [action, detail ?? null]
  );
}
