-- HR portal audit trail (auto-created by hrmanager server on startup if missing).
CREATE TABLE IF NOT EXISTS hr_portal_activity (
  ActivityID INT NOT NULL AUTO_INCREMENT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Action VARCHAR(120) NOT NULL,
  Detail VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (ActivityID),
  KEY idx_hr_activity_created (CreatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
