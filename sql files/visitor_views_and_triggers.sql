USE newthemepark;

-- =========================
-- Views for visitor portal
-- =========================

DROP VIEW IF EXISTS `v_visitor_expired_tickets`;
CREATE VIEW `v_visitor_expired_tickets` AS
SELECT
  t.TicketNumber,
  t.VisitorID,
  t.TicketType,
  t.Price,
  t.IssueDate,
  t.ExpiryDate,
  t.IsActive,
  (t.ExpiryDate < CURDATE()) AS IsExpired
FROM ticket t;

DROP VIEW IF EXISTS `v_area_avg_ratings`;
CREATE VIEW `v_area_avg_ratings` AS
SELECT
  a.AreaID,
  a.AreaName,
  AVG(r.Feedback) AS AvgRating,
  COUNT(r.ReviewID) AS ReviewCount
FROM area a
LEFT JOIN review r
  ON r.AreaID = a.AreaID
  AND r.IsActive = 1
GROUP BY a.AreaID, a.AreaName;

-- =========================
-- Triggers for portal UX
-- =========================

DELIMITER $$

DROP TRIGGER IF EXISTS `trg_ticket_set_active_on_insert`$$
CREATE TRIGGER `trg_ticket_set_active_on_insert`
BEFORE INSERT ON `ticket`
FOR EACH ROW
BEGIN
  IF NEW.ExpiryDate < CURDATE() THEN
    SET NEW.IsActive = 0;
  ELSE
    SET NEW.IsActive = 1;
  END IF;
END$$

DROP TRIGGER IF EXISTS `trg_ticket_set_active_on_update`$$
CREATE TRIGGER `trg_ticket_set_active_on_update`
BEFORE UPDATE ON `ticket`
FOR EACH ROW
BEGIN
  IF NEW.ExpiryDate < CURDATE() THEN
    SET NEW.IsActive = 0;
  ELSE
    SET NEW.IsActive = 1;
  END IF;
END$$

DROP TRIGGER IF EXISTS `trg_review_set_date_before_insert`$$
CREATE TRIGGER `trg_review_set_date_before_insert`
BEFORE INSERT ON `review`
FOR EACH ROW
BEGIN
  SET NEW.DateSubmitted = CURDATE();
END$$

DROP TRIGGER IF EXISTS `trg_review_set_date_before_update`$$
CREATE TRIGGER `trg_review_set_date_before_update`
BEFORE UPDATE ON `review`
FOR EACH ROW
BEGIN
  SET NEW.DateSubmitted = CURDATE();
END$$

DELIMITER ;

