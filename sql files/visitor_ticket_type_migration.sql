USE newthemepark;

-- 1) Normalize existing enum values to the new naming.
UPDATE ticket SET TicketType = 'Basic' WHERE TicketType = 'General';
UPDATE ticket SET TicketType = 'Membership' WHERE TicketType = 'VIP';

-- 2) Change ticket type enum to match portal requirements.
ALTER TABLE ticket
  MODIFY COLUMN TicketType ENUM('Basic','Membership','Discount') NOT NULL;

-- 3) Add "who the discount is for" column if missing.
-- Workbench users: if this errors with "Duplicate column name", the column already exists.
ALTER TABLE ticket
  ADD COLUMN DiscountFor ENUM('None','Child','Senior','Veteran') NOT NULL DEFAULT 'None' AFTER TicketType;

-- 4) Keep non-discount rows set to None.
UPDATE ticket
SET DiscountFor = 'None'
WHERE TicketType <> 'Discount';

