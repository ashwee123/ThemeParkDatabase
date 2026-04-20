-- Sample rows for employee, HR manager (manager + hrmanager), and visitor.
-- Target database: same as app (default `newthemepark`). Adjust USE if needed.
--
-- Visitor password: demo123 (PBKDF2 hash matches backend/visitorbackend + admin portal createVisitor).

USE newthemepark;

SET @demo_hash := 'pbkdf2$120000$a1b2c3d4e5f60718293a4b5c6d7e8f09$036f783b1556efca8f54ca0d2a9a21ec5ebcc67a79baad1f783686db99f86af0';

-- HR manager for kids area (103) if not already assigned — uses high ManagerID to avoid collisions.
INSERT INTO manager (ManagerID, ManagerName)
VALUES (900, 'Demo HR Manager — Kids')
ON DUPLICATE KEY UPDATE ManagerName = VALUES(ManagerName);

INSERT IGNORE INTO hrmanager (ManagerID, AreaID) VALUES (900, 103);

INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
VALUES ('Alex Park', 'Ride operator', 32000.00, '2024-05-01', 5, 102);

INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age, IsActive)
VALUES (
  'Jamie Guest',
  '555-0100',
  'jamie.adminseed@nightmarenexus.com',
  @demo_hash,
  'Other',
  28,
  1
);
