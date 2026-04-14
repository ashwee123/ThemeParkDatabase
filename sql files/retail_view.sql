-- =============================================================
-- VIEWS
-- =============================================================

CREATE VIEW RetailProfitReport AS
SELECT
    rp.RetailName,
    ri.ItemName,
    tl.Date,
    SUM(tl.Quantity)                        AS UnitsSold,
    SUM(tl.TotalCost)                       AS Revenue,
    SUM(tl.Quantity * ri.BuyPrice)          AS COGS,
    SUM(tl.TotalCost) - 
    SUM(tl.Quantity * ri.BuyPrice)          AS GrossProfit,
    ROUND(
        (SUM(tl.TotalCost) - SUM(tl.Quantity * ri.BuyPrice)) 
        / SUM(tl.TotalCost) * 100, 2)       AS GrossMarginPct,
    COUNT(CASE WHEN tl.Type = 'Discount' 
               THEN 1 END)                  AS DiscountTransactions,
    COUNT(CASE WHEN tl.Type = 'Damaged' 
               THEN 1 END)                  AS DamagedCount,
    COUNT(CASE WHEN tl.Type = 'Stolen' 
               THEN 1 END)                  AS StolenCount,
    rp.AreaID
FROM TransactionLog tl
JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
WHERE tl.Type IN ('Normal', 'Discount')
GROUP BY rp.RetailName, ri.ItemID, ri.ItemName, rp.AreaID, tl.Date
ORDER BY GrossProfit DESC;