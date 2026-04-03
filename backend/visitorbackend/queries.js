const pool = require("./db");

async function createVisitor({ Name, Phone, Email, PasswordHash, Gender, Age }) {
  const [result] = await pool.execute(
    `INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Name, Phone || null, Email, PasswordHash, Gender || null, Age || null]
  );
  return { VisitorID: result.insertId };
}

async function getVisitorByEmail(Email) {
  const [rows] = await pool.execute(`SELECT * FROM visitor WHERE Email = ? LIMIT 1`, [Email]);
  return rows[0] || null;
}

async function getVisitorById(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT VisitorID, Name, Phone, Email, Gender, Age, CreatedAt, IsActive
     FROM visitor WHERE VisitorID = ? LIMIT 1`,
    [VisitorID]
  );
  return rows[0] || null;
}

async function listAreas() {
  const [rows] = await pool.execute(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  return rows;
}

async function listTicketsForVisitor(VisitorID, { ticketType, includeInactive } = {}) {
  const where = [`VisitorID = ?`];
  const params = [VisitorID];
  if (ticketType) {
    where.push(`TicketType = ?`);
    params.push(ticketType);
  }
  if (!includeInactive) where.push(`IsActive = 1`);

  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, Price, IssueDate, ExpiryDate, IsActive
     FROM ticket
     WHERE ${where.join(" AND ")}
     ORDER BY ExpiryDate DESC, TicketNumber DESC`,
    params
  );
  return rows;
}

async function createTicket(VisitorID, { TicketType, Price, ExpiryDate }) {
  const [result] = await pool.execute(
    `INSERT INTO ticket (TicketType, Price, ExpiryDate, VisitorID, IsActive)
     VALUES (?, ?, ?, ?, 1)`,
    [TicketType, Price, ExpiryDate, VisitorID]
  );

  // MySQL doesn't always reliably return computed defaults across drivers;
  // fetch the row back so the frontend gets consistent fields.
  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, Price, IssueDate, ExpiryDate, IsActive
     FROM ticket
     WHERE TicketNumber = ? AND VisitorID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

async function updateTicketForVisitor(VisitorID, TicketNumber, { TicketType, Price, ExpiryDate, IsActive }) {
  const [result] = await pool.execute(
    `UPDATE ticket
     SET TicketType = ?, Price = ?, ExpiryDate = ?, IsActive = ?
     WHERE TicketNumber = ? AND VisitorID = ?`,
    [TicketType, Price, ExpiryDate, IsActive ? 1 : 0, TicketNumber, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteTicketForVisitor(VisitorID, TicketNumber) {
  const [result] = await pool.execute(
    `DELETE FROM ticket WHERE TicketNumber = ? AND VisitorID = ?`,
    [TicketNumber, VisitorID]
  );
  return result.affectedRows > 0;
}

async function listReviewsForVisitor(VisitorID, { areaId, minRating, maxRating, includeInactive } = {}) {
  const where = [`r.VisitorID = ?`];
  const params = [VisitorID];

  if (areaId) {
    where.push(`r.AreaID = ?`);
    params.push(areaId);
  }
  if (typeof minRating === "number") {
    where.push(`r.Feedback >= ?`);
    params.push(minRating);
  }
  if (typeof maxRating === "number") {
    where.push(`r.Feedback <= ?`);
    params.push(maxRating);
  }
  if (!includeInactive) where.push(`r.IsActive = 1`);

  const [rows] = await pool.execute(
    `SELECT r.ReviewID,
            r.AreaID,
            a.AreaName,
            r.Feedback,
            r.Comment,
            r.DateSubmitted,
            r.IsActive
     FROM review r
     JOIN area a ON a.AreaID = r.AreaID
     WHERE ${where.join(" AND ")}
     ORDER BY r.DateSubmitted DESC, r.ReviewID DESC`,
    params
  );
  return rows;
}

async function createReview(VisitorID, { AreaID, Feedback, Comment, IsActive }) {
  const [result] = await pool.execute(
    `INSERT INTO review (VisitorID, AreaID, Feedback, Comment, IsActive)
     VALUES (?, ?, ?, ?, ?)`,
    [VisitorID, AreaID, Feedback, Comment || null, IsActive ? 1 : 0]
  );
  const [rows] = await pool.execute(
    `SELECT r.ReviewID,
            r.AreaID,
            a.AreaName,
            r.Feedback,
            r.Comment,
            r.DateSubmitted,
            r.IsActive
     FROM review r
     JOIN area a ON a.AreaID = r.AreaID
     WHERE r.ReviewID = ? AND r.VisitorID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

async function updateReviewForVisitor(VisitorID, ReviewID, { AreaID, Feedback, Comment, IsActive }) {
  const [result] = await pool.execute(
    `UPDATE review
     SET AreaID = ?, Feedback = ?, Comment = ?, IsActive = ?
     WHERE ReviewID = ? AND VisitorID = ?`,
    [AreaID, Feedback, Comment || null, IsActive ? 1 : 0, ReviewID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteReviewForVisitor(VisitorID, ReviewID) {
  const [result] = await pool.execute(
    `DELETE FROM review WHERE ReviewID = ? AND VisitorID = ?`,
    [ReviewID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function listChildren(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT ChildID, GuardianID, Name, Age, Gender
     FROM child
     WHERE GuardianID = ?
     ORDER BY ChildID DESC`,
    [VisitorID]
  );
  return rows;
}

async function createChild(VisitorID, { Name, Age, Gender }) {
  const [result] = await pool.execute(
    `INSERT INTO child (GuardianID, Name, Age, Gender)
     VALUES (?, ?, ?, ?)`,
    [VisitorID, Name, Age || null, Gender || null]
  );
  const [rows] = await pool.execute(
    `SELECT ChildID, GuardianID, Name, Age, Gender
     FROM child
     WHERE ChildID = ? AND GuardianID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

async function updateChildForVisitor(VisitorID, ChildID, { Name, Age, Gender }) {
  const [result] = await pool.execute(
    `UPDATE child
     SET Name = ?, Age = ?, Gender = ?
     WHERE ChildID = ? AND GuardianID = ?`,
    [Name, Age || null, Gender || null, ChildID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteChildForVisitor(VisitorID, ChildID) {
  const [result] = await pool.execute(
    `DELETE FROM child WHERE ChildID = ? AND GuardianID = ?`,
    [ChildID, VisitorID]
  );
  return result.affectedRows > 0;
}

// =========================
// Queries & Reports (API)
// =========================

async function listExpiredTicketsForVisitor(VisitorID) {
  // Uses a view so your professor can see the “query layer” clearly.
  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, Price, IssueDate, ExpiryDate, IsActive
     FROM v_visitor_expired_tickets
     WHERE VisitorID = ? AND IsExpired = 1
     ORDER BY ExpiryDate DESC, TicketNumber DESC`,
    [VisitorID]
  );
  return rows;
}

async function ticketSalesSummaryForVisitor(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT TicketType,
            COUNT(*) AS TicketCount,
            SUM(Price) AS TotalRevenue,
            AVG(Price) AS AvgPrice
     FROM ticket
     WHERE VisitorID = ? AND IsActive = 1
     GROUP BY TicketType
     ORDER BY TicketType`,
    [VisitorID]
  );
  return rows;
}

async function averageRatingsPerAreaGlobal() {
  const [rows] = await pool.execute(
    `SELECT AreaID, AreaName, AvgRating, ReviewCount
     FROM v_area_avg_ratings
     WHERE ReviewCount > 0
     ORDER BY AvgRating DESC, AreaID`,
  );
  return rows;
}

async function visitorDemographicsGlobal() {
  const [byGender] = await pool.execute(
    `SELECT Gender,
            COUNT(*) AS VisitorCount
     FROM visitor
     WHERE IsActive = 1
     GROUP BY Gender
     ORDER BY VisitorCount DESC`
  );

  const [byAgeGroup] = await pool.execute(
    `SELECT
        CASE
          WHEN Age IS NULL THEN 'Unknown'
          WHEN Age < 18 THEN '<18'
          WHEN Age BETWEEN 18 AND 29 THEN '18-29'
          WHEN Age BETWEEN 30 AND 44 THEN '30-44'
          WHEN Age BETWEEN 45 AND 64 THEN '45-64'
          ELSE '65+'
        END AS AgeGroup,
        COUNT(*) AS VisitorCount
     FROM visitor
     WHERE IsActive = 1
     GROUP BY AgeGroup
     ORDER BY
       CASE AgeGroup
         WHEN 'Unknown' THEN 0
         WHEN '<18' THEN 1
         WHEN '18-29' THEN 2
         WHEN '30-44' THEN 3
         WHEN '45-64' THEN 4
         ELSE 5
       END`
  );

  return { byGender, byAgeGroup };
}

module.exports = {
  createVisitor,
  getVisitorByEmail,
  getVisitorById,
  listAreas,

  listTicketsForVisitor,
  createTicket,
  updateTicketForVisitor,
  deleteTicketForVisitor,

  listReviewsForVisitor,
  createReview,
  updateReviewForVisitor,
  deleteReviewForVisitor,

  listChildren,
  createChild,
  updateChildForVisitor,
  deleteChildForVisitor,

  listExpiredTicketsForVisitor,
  ticketSalesSummaryForVisitor,
  averageRatingsPerAreaGlobal,
  visitorDemographicsGlobal,
};

