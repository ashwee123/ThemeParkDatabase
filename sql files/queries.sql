-- =========================================================
-- Theme Park HR + Retail + Visitor SQL Queries
-- Database: newthemepark
-- =========================================================

USE newthemepark;

-- =========================================================
-- SECTION 1: MAINTENANCE ALERTS
-- =========================================================
SELECT 
    ma.AlertID,
    a.AttractionName,
    a.SeverityLevel,
    ma.AlertMessage,
    ma.CreatedAt
FROM MaintenanceAlert ma
JOIN Attraction a ON ma.AttractionID = a.AttractionID
WHERE ma.Handled = 'No';


-- =========================================================
-- SECTION 2: RETAIL PERFORMANCE REPORT
-- =========================================================
SET @ManagerAreaID = 1;
SET @StartDate = '2024-01-01';
SET @EndDate   = '2024-12-31';

SELECT
    rp.RetailName,
    ri.ItemName,
    SUM(tl.Quantity) AS UnitsSold,
    SUM(tl.TotalCost) AS Revenue,
    SUM(tl.Quantity * ri.BuyPrice) AS COGS,
    SUM(tl.TotalCost) - SUM(tl.Quantity * ri.BuyPrice) AS GrossProfit,
    ROUND(
        (SUM(tl.TotalCost) - SUM(tl.Quantity * ri.BuyPrice)) 
        / SUM(tl.TotalCost) * 100, 2
    ) AS GrossMarginPct,
    COUNT(CASE WHEN tl.Type = 'Discount' THEN 1 END) AS DiscountTransactions,
    COUNT(CASE WHEN tl.Type = 'Damaged' THEN 1 END) AS DamagedCount,
    COUNT(CASE WHEN tl.Type = 'Stolen' THEN 1 END) AS StolenCount
FROM TransactionLog tl
JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
WHERE rp.AreaID = @ManagerAreaID
AND tl.Date BETWEEN @StartDate AND @EndDate
AND tl.Type IN ('Normal', 'Discount')
GROUP BY rp.RetailName, ri.ItemID, ri.ItemName
ORDER BY GrossProfit DESC;


-- =========================================================
-- SECTION 3: EMPLOYEES
-- =========================================================
SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
FROM employee
ORDER BY AreaID IS NULL, AreaID, Name;

SELECT 
    e.EmployeeID, e.Name, e.Position, e.Salary, e.HireDate, 
    e.ManagerID, e.AreaID, a.AreaName
FROM employee e
LEFT JOIN area a ON e.AreaID = a.AreaID
ORDER BY e.AreaID IS NULL, e.AreaID, e.Name;


-- =========================================================
-- SECTION 4: MANAGERS
-- =========================================================
SELECT 
    m.ManagerID, m.ManagerName, 
    h.AreaID, a.AreaName
FROM manager m
LEFT JOIN hrmanager h ON m.ManagerID = h.ManagerID
LEFT JOIN area a ON h.AreaID = a.AreaID
ORDER BY m.ManagerID;


-- =========================================================
-- SECTION 5: MAINTENANCE ASSIGNMENTS
-- =========================================================
SELECT 
    m.MaintenanceAssignmentID,
    m.EmployeeID,
    m.AreaID,
    m.TaskDescription,
    m.Status,
    m.DueDate,
    e.Name AS EmployeeName,
    ar.AreaName
FROM maintenanceassignment m
INNER JOIN employee e ON m.EmployeeID = e.EmployeeID
LEFT JOIN area ar ON m.AreaID = ar.AreaID
ORDER BY m.DueDate IS NULL, m.DueDate, m.MaintenanceAssignmentID DESC;


-- =========================================================
-- SECTION 6: PERFORMANCE REVIEWS
-- =========================================================
SELECT 
    p.PerformanceID,
    p.EmployeeID,
    p.ReviewDate,
    p.PerformanceScore,
    p.WorkloadNotes,
    e.Name AS EmployeeName
FROM employeeperformance p
INNER JOIN employee e ON p.EmployeeID = e.EmployeeID
ORDER BY p.ReviewDate DESC, p.PerformanceID DESC;


-- =========================================================
-- SECTION 7: DATA REPORT AGGREGATES
-- =========================================================
SELECT
  (SELECT COUNT(*) FROM employee) AS employees,
  (SELECT COUNT(*) FROM manager) AS managers,
  (SELECT COUNT(*) FROM area) AS areas,
  (SELECT COUNT(*) FROM hrmanager) AS hrmanager_rows,
  (SELECT COUNT(*) FROM maintenanceassignment) AS maintenance,
  (SELECT COUNT(*) FROM employeeperformance) AS performance_reviews;

SELECT 
    AVG(Salary) AS avg_sal, 
    MIN(Salary) AS min_sal, 
    MAX(Salary) AS max_sal 
FROM employee;

SELECT 
    Status, COUNT(*) AS cnt 
FROM maintenanceassignment 
GROUP BY Status 
ORDER BY Status;


-- =========================================================
-- SECTION 8: VISITOR QUERIES (from uploaded doc)
-- =========================================================

-- Q1: Expired tickets for a visitor
SELECT * 
FROM Ticket 
WHERE VisitorID = ? 
AND ExpiryDate < CURDATE();


-- Q2: Top-rated areas (avg rating >= 8)
SELECT 
    AreaName, 
    AVG(Feedback) AS AvgRating
FROM Area 
JOIN Review USING(AreaID)
GROUP BY AreaID 
HAVING AvgRating >= 8;


-- Q3: Reviews in last 30 days
SELECT 
    v.Name, 
    a.AreaName, 
    r.Feedback, 
    r.DateSubmitted
FROM Review r 
JOIN Visitor v USING(VisitorID) 
JOIN Area a USING(AreaID)
WHERE r.DateSubmitted >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);


-- =========================================================
-- SECTION 9: Problematic Attractions (high maintenance/accidents)
-- =========================================================

SELECT 
    a.AttractionName,
    COUNT(m.MaintenanceID) AS MaintenanceCount,
    COUNT(ah.AccidentID) AS AccidentCount
FROM attraction a
LEFT JOIN maintenance m ON a.AttractionID = m.AttractionID
LEFT JOIN accidenthistory ah ON a.AttractionID = ah.AttractionID
GROUP BY a.AttractionID
ORDER BY MaintenanceCount DESC, AccidentCount DESC;

-- =========================================================
-- SECTION 10: Average Repair Time for Attractions
-- =========================================================

SELECT 
    a.AttractionName,
    AVG(DATEDIFF(m.DateEnd, m.DateStart)) AS AvgRepairDays
FROM maintenance m
JOIN attraction a ON m.AttractionID = a.AttractionID
WHERE m.DateEnd IS NOT NULL
GROUP BY a.AttractionID;

-- =========================================================
-- SECTION 11: Downtime Report for Attractions
-- =========================================================

SELECT 
    a.AttractionName,
    SUM(DATEDIFF(m.DateEnd, m.DateStart)) AS TotalDowntimeDays
FROM maintenance m
JOIN attraction a ON m.AttractionID = a.AttractionID
GROUP BY a.AttractionID
ORDER BY TotalDowntimeDays DESC;

-- =========================================================
-- SECTION 12: Maintenance Per Day
-- =========================================================

SELECT 
    DateStart,
    COUNT(*) AS MaintenanceCount
FROM maintenance
GROUP BY DateStart
ORDER BY DateStart DESC;


-- =========================================================
-- SECTION 13: Attractions Needing Maintenance
-- =========================================================

SELECT 
    AttractionName,
    Status,
    SeverityLevel
FROM attraction
WHERE Status IN ('NeedsMaintenance', 'UnderMaintenance');

-- =========================================================
-- SECTION 14: Weather Impact
-- =========================================================

SELECT 
    w.WeatherDate,
    w.SeverityLevel,
    COUNT(a.AttractionID) AS AffectedAttractions
FROM weather w
JOIN attraction a 
ON a.Status = 'ClosedDueToWeather'
GROUP BY w.WeatherDate, w.SeverityLevel
ORDER BY w.WeatherDate DESC;

-- =========================================================
-- END OF FILE
-- =========================================================
