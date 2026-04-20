/**
 * Idempotent ALTERs / new tables for admin access hardening.
 * Safe to run on every server start.
 */
import { getPool } from "./db.js";

async function addColumnIfMissing(table, column, definition) {
  const pool = getPool();
  try {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const errno = e && e.errno;
    if (errno === 1060 || msg.includes("Duplicate column") || msg.includes("check that column/key exists")) return;
    console.warn(`[admin-schema] ${table}.${column}:`, msg);
  }
}

async function addIndexIfMissing(table, indexName, columnListSql) {
  const pool = getPool();
  try {
    await pool.execute(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columnListSql})`);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes("Duplicate key name") || e.errno === 1061) return;
    console.warn(`[admin-schema] index ${table}.${indexName}:`, msg);
  }
}

export async function runAdminSchemaUpgrades() {
  const pool = getPool();

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS admin_ip_blocklist (
      BlockID INT NOT NULL AUTO_INCREMENT,
      Cidr VARCHAR(80) NOT NULL,
      Reason VARCHAR(600) NULL,
      AddedBy VARCHAR(160) NULL,
      ExpiresAt DATETIME NULL,
      BlockMode ENUM('block','flag') NOT NULL DEFAULT 'flag',
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (BlockID),
      KEY idx_blocklist_expires (ExpiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS admin_break_glass_log (
      EventID BIGINT NOT NULL AUTO_INCREMENT,
      RequestedBy VARCHAR(160) NULL,
      Reason VARCHAR(600) NULL,
      ElevatedUntil DATETIME NULL,
      RolledBackAt DATETIME NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (EventID)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS admin_cross_incident_link (
      LinkID BIGINT NOT NULL AUTO_INCREMENT,
      GroupKey VARCHAR(64) NOT NULL,
      SourceTable VARCHAR(80) NOT NULL,
      SourceId VARCHAR(64) NOT NULL,
      Note VARCHAR(500) NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (LinkID),
      KEY idx_cross_group (GroupKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await addColumnIfMissing("admin_session_log", "MfaVerifiedAt", "TIMESTAMP NULL DEFAULT NULL");
  await addColumnIfMissing("admin_session_log", "MfaMethod", "VARCHAR(40) NULL DEFAULT NULL");
  await addColumnIfMissing("admin_session_log", "RiskScore", "DECIMAL(6,2) NULL DEFAULT NULL");
  await addColumnIfMissing("admin_session_log", "IdleTtlSeconds", "INT NULL DEFAULT NULL");

  await addColumnIfMissing("admin_audit_log", "SessionLogID", "BIGINT NULL DEFAULT NULL");
  await addColumnIfMissing("admin_audit_log", "DetailJson", "LONGTEXT NULL");
  await addColumnIfMissing("admin_audit_log", "ActionResult", "VARCHAR(24) NULL DEFAULT NULL");
  await addIndexIfMissing("admin_audit_log", "idx_audit_session", "SessionLogID");

  await addColumnIfMissing("admin_employee_access", "DeactivationReason", "VARCHAR(600) NULL DEFAULT NULL");
  await addColumnIfMissing("admin_employee_access", "ApprovedByEmployeeID", "INT NULL DEFAULT NULL");
  await addColumnIfMissing("admin_employee_access", "RoleExpiresAt", "DATE NULL DEFAULT NULL");
  await addColumnIfMissing(
    "admin_employee_access",
    "HrAccessLevel",
    "ENUM('none','hr_manager','hr_admin') NOT NULL DEFAULT 'none'"
  );
  await addColumnIfMissing("admin_employee_access", "ScopeAreaIdsJson", "TEXT NULL");
  await addColumnIfMissing("admin_employee_access", "OffboardingWebhookUrl", "VARCHAR(500) NULL DEFAULT NULL");

  try {
    await addColumnIfMissing("notificationlog", "ReadAt", "TIMESTAMP NULL DEFAULT NULL");
    await addColumnIfMissing("notificationlog", "Severity", "ENUM('info','warning','critical') NOT NULL DEFAULT 'info'");
    await addColumnIfMissing("notificationlog", "LinkedAuditLogID", "BIGINT NULL DEFAULT NULL");
  } catch (e) {
    console.warn("[admin-schema] notificationlog:", e && e.message);
  }
}
