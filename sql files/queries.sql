-- =========================================
-- 1. MAINTENANCE ALERTS (UNHANDLED)
-- =========================================
SELECT 
    ma.AlertID,
    a.AttractionName,
    a.SeverityLevel,
    ma.AlertMessage,
    ma.CreatedAt
FROM MaintenanceAlert ma
INNER JOIN Attraction a 
    ON ma.AttractionID = a.AttractionID
WHERE ma.Handled = 'No'
ORDER BY ma.CreatedAt DESC;



-- =========================================
-- 2. RETAIL PERFORMANCE REPORT
-- =========================================
SET @ManagerAreaID = 1;
SET @StartDate = '2024-01-01';
SET @EndDate   = '2024-12-31';

SELECT
    rp.RetailName,
    ri.ItemName,

    SUM(tl.Quantity) AS UnitsSold,

    SUM(CASE 
        WHEN tl.Type IN ('Normal','Discount') 
        THEN tl.TotalCost 
        ELSE 0 
    END) AS Revenue,

    SUM(tl.Quantity * ri.BuyPrice) AS COGS,

    SUM(CASE 
        WHEN tl.Type IN ('Normal','Discount') 
        THEN tl.TotalCost 
        ELSE 0 
    END) 
    - SUM(tl.Quantity * ri.BuyPrice) AS GrossProfit,

    ROUND(
        CASE 
            WHEN SUM(tl.TotalCost) = 0 THEN 0
            ELSE (
                SUM(CASE 
                    WHEN tl.Type IN ('Normal','Discount') 
                    THEN tl.TotalCost 
                    ELSE 0 
                END) 
                - SUM(tl.Quantity * ri.BuyPrice)
            ) / SUM(tl.TotalCost) * 100
        END, 2
    ) AS GrossMarginPct,

    COUNT(CASE WHEN tl.Type = 'Discount' THEN 1 END) AS DiscountTransactions,
    COUNT(CASE WHEN tl.Type = 'Damaged'  THEN 1 END) AS DamagedCount,
    COUNT(CASE WHEN tl.Type = 'Stolen'   THEN 1 END) AS StolenCount

FROM TransactionLog tl
JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
JOIN RetailPlace rp ON ri.RetailID = rp.RetailID

WHERE rp.AreaID = @ManagerAreaID
AND tl.Date BETWEEN @StartDate AND @EndDate
AND tl.Type IN ('Normal', 'Discount', 'Damaged', 'Stolen')

GROUP BY rp.RetailName, ri.ItemID, ri.ItemName
ORDER BY GrossProfit DESC;



-- =========================================
-- 3. EMPLOYEE WORKLOAD (TOTAL HOURS)
-- =========================================
SELECT 
    EmployeeID, 
    SUM(HoursWorked) AS TotalHours
FROM TimeLog
GROUP BY EmployeeID;



-- =========================================
-- 4. EMPLOYEE SCHEDULE
-- =========================================
SELECT 
    e.Name, 
    s.ShiftDate, 
    s.StartTime, 
    s.EndTime
FROM Employee e
JOIN Shift s 
    ON e.EmployeeID = s.EmployeeID
WHERE e.EmployeeID = 1;



-- =========================================
-- 5. INCIDENT REPORTS
-- =========================================
SELECT 
    e.Name, 
    i.ReportType, 
    i.Description, 
    i.ReportDate
FROM IncidentReport i
JOIN Employee e 
    ON i.EmployeeID = e.EmployeeID;



-- =========================================
-- 6. EMPLOYEES UNDER HR MANAGERS
-- =========================================
SELECT 
    m.ManagerName, 
    e.Name, 
    e.Position, 
    e.Salary
FROM HRManager h
JOIN Manager m 
    ON h.ManagerID = m.ManagerID
JOIN Employee e 
    ON e.ManagerID = h.ManagerID;



-- =========================================
-- 7. EMPLOYEE COUNT BY AREA
-- =========================================
SELECT 
    a.AreaName, 
    COUNT(e.EmployeeID) AS TotalEmployees
FROM Employee e
JOIN Area a 
    ON e.AreaID = a.AreaID
GROUP BY a.AreaName;



-- =========================================
-- 8. AVERAGE SALARY BY AREA
-- =========================================
SELECT 
    a.AreaName, 
    AVG(e.Salary) AS AvgSalary
FROM Employee e
JOIN Area a 
    ON e.AreaID = a.AreaID
GROUP BY a.AreaName;



-- =========================================
-- 9. HIGHEST PAID EMPLOYEE
-- =========================================
SELECT 
    Name, 
    Salary
FROM Employee
ORDER BY Salary DESC
LIMIT 1;



-- =========================================
-- 10. EMPLOYEE TO HR MANAGER MAPPING
-- =========================================
SELECT 
    e.Name AS Employee, 
    m.ManagerName AS HR_Manager
FROM Employee e
JOIN HRManager h 
    ON e.ManagerID = h.ManagerID
JOIN Manager m 
    ON m.ManagerID = h.ManagerID;