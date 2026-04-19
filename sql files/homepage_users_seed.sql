-- Portal logins for homepageBackend /login (staff only; not visitor accounts).
-- Run once against the same database as DB_NAME / newthemepark.
-- Passwords are plain text to match server.js (replace with hashed auth in production).

CREATE TABLE IF NOT EXISTS `users` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Email` varchar(255) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `Role` varchar(50) NOT NULL DEFAULT 'staff',
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `uq_users_email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`Email`, `Password`, `Role`) VALUES
  ('admin@nightmarenexus.com', 'Admin123!', 'admin'),
  ('parkmanager@nightmarenexus.com', 'Manager123!', 'manager'),
  ('maintenance@nightmarenexus.com', 'Maint123!', 'maintenance'),
  ('retail@nightmarenexus.com', 'Retail123!', 'retail'),
  ('hr@nightmarenexus.com', 'Hr123!', 'hr'),
  ('employee@nightmarenexus.com', 'Emp123!', 'employee')
ON DUPLICATE KEY UPDATE
  `Password` = VALUES(`Password`),
  `Role` = VALUES(`Role`);
