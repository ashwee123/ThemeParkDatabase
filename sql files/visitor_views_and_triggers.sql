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

