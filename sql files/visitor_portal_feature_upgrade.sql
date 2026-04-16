USE newthemepark;

CREATE TABLE IF NOT EXISTS visitor_park (
  ParkID INT NOT NULL AUTO_INCREMENT,
  ParkName VARCHAR(120) NOT NULL UNIQUE,
  LocationText VARCHAR(255) NULL,
  OpeningTime TIME NULL,
  ClosingTime TIME NULL,
  MapImageUrl VARCHAR(255) NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (ParkID)
);

CREATE TABLE IF NOT EXISTS visitor_attraction_detail (
  AttractionID INT NOT NULL,
  ParkID INT NULL,
  Description TEXT NULL,
  HeightRequirementCm INT NULL,
  DurationMinutes INT NULL,
  ThrillLevel ENUM('Low', 'Medium', 'High', 'Extreme') NOT NULL DEFAULT 'Medium',
  LocationHint VARCHAR(150) NULL,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (AttractionID),
  CONSTRAINT fk_vad_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE CASCADE,
  CONSTRAINT fk_vad_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_special_event (
  EventID INT NOT NULL AUTO_INCREMENT,
  ParkID INT NULL,
  EventName VARCHAR(120) NOT NULL,
  EventDescription TEXT NULL,
  EventDate DATE NOT NULL,
  StartTime TIME NULL,
  EndTime TIME NULL,
  PRIMARY KEY (EventID),
  CONSTRAINT fk_vse_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_dining_option (
  DiningID INT NOT NULL AUTO_INCREMENT,
  AreaID INT NULL,
  ParkID INT NULL,
  DiningName VARCHAR(120) NOT NULL,
  CuisineType VARCHAR(80) NULL,
  MenuSummary TEXT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (DiningID),
  CONSTRAINT fk_vdo_area FOREIGN KEY (AreaID) REFERENCES area(AreaID) ON DELETE SET NULL,
  CONSTRAINT fk_vdo_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_promo_code (
  PromoCodeID INT NOT NULL AUTO_INCREMENT,
  Code VARCHAR(32) NOT NULL UNIQUE,
  DiscountType ENUM('Percent', 'Flat') NOT NULL DEFAULT 'Percent',
  DiscountValue DECIMAL(10,2) NOT NULL,
  ActiveFrom DATE NULL,
  ActiveTo DATE NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (PromoCodeID)
);

CREATE TABLE IF NOT EXISTS visitor_order (
  OrderID INT NOT NULL AUTO_INCREMENT,
  VisitorID INT NOT NULL,
  OrderType ENUM('Ticket', 'Dining', 'Merchandise') NOT NULL,
  OrderTotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  DiscountAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
  PromoCodeID INT NULL,
  PaymentMethod VARCHAR(40) NULL,
  PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Paid',
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (OrderID),
  CONSTRAINT fk_vo_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
  CONSTRAINT fk_vo_promo FOREIGN KEY (PromoCodeID) REFERENCES visitor_promo_code(PromoCodeID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_order_item (
  OrderItemID INT NOT NULL AUTO_INCREMENT,
  OrderID INT NOT NULL,
  ItemType ENUM('Ticket', 'Dining', 'Merchandise') NOT NULL,
  ItemRefID INT NULL,
  ItemName VARCHAR(120) NOT NULL,
  Quantity INT NOT NULL DEFAULT 1,
  UnitPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
  TotalPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (OrderItemID),
  CONSTRAINT fk_voi_order FOREIGN KEY (OrderID) REFERENCES visitor_order(OrderID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor_reservation (
  ReservationID INT NOT NULL AUTO_INCREMENT,
  VisitorID INT NOT NULL,
  ReservationType ENUM('FastPass', 'Ride', 'Dining') NOT NULL,
  AttractionID INT NULL,
  DiningID INT NULL,
  ReservationDate DATE NOT NULL,
  TimeSlot VARCHAR(40) NOT NULL,
  PartySize INT NOT NULL DEFAULT 1,
  Status ENUM('Upcoming', 'Cancelled', 'Completed', 'Rescheduled') NOT NULL DEFAULT 'Upcoming',
  Notes VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ReservationID),
  CONSTRAINT fk_vr_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
  CONSTRAINT fk_vr_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL,
  CONSTRAINT fk_vr_dining FOREIGN KEY (DiningID) REFERENCES visitor_dining_option(DiningID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_itinerary_item (
  ItineraryID INT NOT NULL AUTO_INCREMENT,
  VisitorID INT NOT NULL,
  AttractionID INT NULL,
  ParkID INT NULL,
  PlannedDate DATE NULL,
  ItemType ENUM('Wishlist', 'Itinerary') NOT NULL DEFAULT 'Wishlist',
  Notes VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ItineraryID),
  CONSTRAINT fk_vii_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
  CONSTRAINT fk_vii_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL,
  CONSTRAINT fk_vii_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitor_visit_history (
  VisitHistoryID INT NOT NULL AUTO_INCREMENT,
  VisitorID INT NOT NULL,
  ActivityType VARCHAR(50) NOT NULL,
  ActivitySummary VARCHAR(255) NOT NULL,
  VisitDateTime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (VisitHistoryID),
  CONSTRAINT fk_vvh_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor_feedback_submission (
  FeedbackID INT NOT NULL AUTO_INCREMENT,
  VisitorID INT NOT NULL,
  AttractionID INT NULL,
  Rating INT NULL,
  FeedbackType ENUM('Review', 'Complaint', 'General') NOT NULL DEFAULT 'General',
  Message TEXT NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (FeedbackID),
  CONSTRAINT fk_vfs_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
  CONSTRAINT fk_vfs_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL
);

INSERT INTO visitor_park (ParkName, LocationText, OpeningTime, ClosingTime, MapImageUrl)
SELECT 'Nightmare Nexus Main Park', 'Downtown Theme District', '09:00:00', '22:00:00', '/assets/map-main-park.svg'
WHERE NOT EXISTS (SELECT 1 FROM visitor_park);

INSERT INTO visitor_promo_code (Code, DiscountType, DiscountValue, ActiveFrom, ActiveTo, IsActive)
SELECT 'WELCOME10', 'Percent', 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1
WHERE NOT EXISTS (SELECT 1 FROM visitor_promo_code WHERE Code = 'WELCOME10');

INSERT INTO visitor_promo_code (Code, DiscountType, DiscountValue, ActiveFrom, ActiveTo, IsActive)
SELECT 'FAMILY25', 'Flat', 25, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1
WHERE NOT EXISTS (SELECT 1 FROM visitor_promo_code WHERE Code = 'FAMILY25');
