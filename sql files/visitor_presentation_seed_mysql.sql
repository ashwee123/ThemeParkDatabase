-- =============================================================================
-- Visitor portal — presentation / demo data (run directly in MySQL)
-- =============================================================================
-- Prereqs:
--   1) Base schema loaded
--   2) sql files/visitor_ticket_type_migration.sql
--   3) sql files/visitor_views_and_triggers.sql
--   4) area rows (e.g. AreaID 1, 101, 102, 103)
--
-- This file DELETEs prior demo rows (emails *@presentation-demo.local) then INSERTs:
--   8 visitors, ~22 tickets, 12 reviews, 5 children
--
-- Login (all demo accounts): password = Demo1234!
--   morgan@presentation-demo.local … alex@presentation-demo.local
--
-- PasswordHash matches backend/visitorbackend/auth.js (pbkdf2, 120000 iterations).
-- =============================================================================

USE newthemepark;

SET NAMES utf8mb4;

START TRANSACTION;

-- Remove old demo data (CASCADE removes tickets, reviews, children for those visitors).
-- Use exact Email IN (...) so MySQL Workbench "Safe Updates" accepts it (LIKE '%...@...' does not).
DELETE FROM visitor
WHERE Email IN (
  'morgan@presentation-demo.local',
  'jordan@presentation-demo.local',
  'riley@presentation-demo.local',
  'casey@presentation-demo.local',
  'sam@presentation-demo.local',
  'taylor@presentation-demo.local',
  'jamie@presentation-demo.local',
  'alex@presentation-demo.local'
);

-- Same pbkdf2 hash for every demo user (password: Demo1234!)
INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age, IsActive) VALUES
  ('Morgan Lee', '555-1001', 'morgan@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Female', 29, 1),
  ('Jordan Kim', '555-1002', 'jordan@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Male', 41, 1),
  ('Riley Chen', '555-1003', 'riley@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Other', 22, 1),
  ('Casey Nova', NULL, 'casey@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Prefer not to say', NULL, 1),
  ('Sam Patel', '555-1005', 'sam@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Male', 54, 1),
  ('Taylor Brooks', '555-1006', 'taylor@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Female', 17, 1),
  ('Jamie Ortiz', '555-1007', 'jamie@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Female', 63, 1),
  ('Alex Rivera', '555-1008', 'alex@presentation-demo.local', 'pbkdf2$120000$e363bf1bb809b3ddff3bfddef120cb97$c4d1ff2920bc9fa3a1c5e0fa7db5d9052666e7d1d62ad01526e2de8c51a80ffd', 'Male', 35, 1);

-- Tickets (IssueDate / ExpiryDate relative to CURDATE() when you run this script)
INSERT INTO ticket (TicketType, DiscountFor, Price, IssueDate, ExpiryDate, VisitorID, IsActive) VALUES
  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 40 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'morgan@presentation-demo.local' LIMIT 1), 0),
  ('Membership', 'None', 199.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 355 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'morgan@presentation-demo.local' LIMIT 1), 1),
  ('Discount', 'Senior', 49.50, DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'morgan@presentation-demo.local' LIMIT 1), 1),

  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 0),
  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 1),
  ('Discount', 'Child', 39.00, DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 1),
  ('Membership', 'None', 199.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 300 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 1),

  ('Discount', 'Veteran', 44.00, DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'riley@presentation-demo.local' LIMIT 1), 0),
  ('Basic', 'None', 89.99, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'riley@presentation-demo.local' LIMIT 1), 1),

  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 21 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'casey@presentation-demo.local' LIMIT 1), 1),
  ('Discount', 'Child', 39.00, DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 21 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'casey@presentation-demo.local' LIMIT 1), 1),

  ('Membership', 'None', 199.00, DATE_SUB(CURDATE(), INTERVAL 200 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'sam@presentation-demo.local' LIMIT 1), 0),
  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'sam@presentation-demo.local' LIMIT 1), 1),

  ('Basic', 'None', 79.99, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'taylor@presentation-demo.local' LIMIT 1), 1),

  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 90 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jamie@presentation-demo.local' LIMIT 1), 0),
  ('Membership', 'None', 199.00, DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 364 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'jamie@presentation-demo.local' LIMIT 1), 1),

  ('Basic', 'None', 99.00, DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 1),
  ('Discount', 'Senior', 49.50, DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 1),
  ('Basic', 'None', 79.99, DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), (SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 1);

INSERT INTO review (VisitorID, AreaID, Feedback, Comment, DateSubmitted, IsActive) VALUES
  ((SELECT VisitorID FROM visitor WHERE Email = 'morgan@presentation-demo.local' LIMIT 1), 1, 8, 'Great atmosphere today.', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'morgan@presentation-demo.local' LIMIT 1), 101, 6, 'Queues were long.', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 101, 9, 'Loved the rides.', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 102, 7, 'Food was solid.', DATE_SUB(CURDATE(), INTERVAL 4 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'riley@presentation-demo.local' LIMIT 1), 102, 10, 'Best visit this year.', CURDATE(), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'riley@presentation-demo.local' LIMIT 1), 103, 4, 'Kids area crowded.', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'casey@presentation-demo.local' LIMIT 1), 1, 5, 'Okay experience.', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'sam@presentation-demo.local' LIMIT 1), 103, 9, 'Staff were helpful.', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'taylor@presentation-demo.local' LIMIT 1), 101, 3, 'Rain affected the day.', DATE_SUB(CURDATE(), INTERVAL 14 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'jamie@presentation-demo.local' LIMIT 1), 102, 8, 'Good snacks.', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 1, 7, 'Easy to navigate.', DATE_SUB(CURDATE(), INTERVAL 6 DAY), 1),
  ((SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 101, 8, 'Would come again.', DATE_SUB(CURDATE(), INTERVAL 8 DAY), 1);

INSERT INTO child (GuardianID, Name, Age, Gender) VALUES
  ((SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 'Sky Kim', 9, 'Female'),
  ((SELECT VisitorID FROM visitor WHERE Email = 'jordan@presentation-demo.local' LIMIT 1), 'Bo Kim', 6, 'Male'),
  ((SELECT VisitorID FROM visitor WHERE Email = 'casey@presentation-demo.local' LIMIT 1), 'River Nova', 12, 'Other'),
  ((SELECT VisitorID FROM visitor WHERE Email = 'taylor@presentation-demo.local' LIMIT 1), 'Quinn Patel', 14, 'Female'),
  ((SELECT VisitorID FROM visitor WHERE Email = 'alex@presentation-demo.local' LIMIT 1), 'Rio Rivera', 7, 'Male');

COMMIT;

-- =============================================================================
-- Done. Verify: SELECT COUNT(*) FROM visitor WHERE Email LIKE '%@presentation-demo.local';
-- =============================================================================
