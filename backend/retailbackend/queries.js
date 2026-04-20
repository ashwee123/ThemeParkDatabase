const db = require("./db");

// LOGIN
const loginManager = (username, password, callback) => {
    const sql = `
        SELECT 
            m.ManagerID,
            m.ManagerName,
            m.ManagerUsername,
            rm.AreaID,
            a.AreaName
        FROM Manager m
        JOIN RetailManager rm ON m.ManagerID = rm.ManagerID
        JOIN Area a           ON rm.AreaID   = a.AreaID
        WHERE m.ManagerUsername = ?
        AND m.ManagerPassword = ?
    `;
    db.query(sql, [username, password], (err, results) => {
        if (err) return callback(err);
        if (results.length === 0) return callback(null, null);
        callback(null, results[0]);
    });
};


// -------------------------------------------------------
// REPORTS
// -------------------------------------------------------

const getProfitReport = (areaID, startDate, endDate, retailID, callback) => {
    const sql = `
        SELECT
            rp.RetailName,
            ri.ItemName,
            SUM(CASE WHEN tl.Type IN ('Normal', 'Discount') THEN tl.Quantity ELSE 0 END) AS UnitsSold,
            SUM(CASE WHEN tl.Type IN ('Normal', 'Discount') THEN COALESCE(tl.TotalCost, 0) ELSE 0 END) AS Revenue,
            SUM(CASE WHEN tl.Type IN ('Normal', 'Discount') THEN COALESCE(ri.BuyPrice, 0) * tl.Quantity ELSE 0 END) AS COGS,
            SUM(CASE WHEN tl.Type = 'Discount' THEN 1 ELSE 0 END) AS DiscountTransactions,
            SUM(CASE WHEN tl.Type = 'Damaged' THEN tl.Quantity ELSE 0 END) AS DamagedCount,
            SUM(CASE WHEN tl.Type = 'Stolen' THEN tl.Quantity ELSE 0 END) AS StolenCount
        FROM TransactionLog tl
        JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND tl.Date BETWEEN ? AND ?
        AND (? IS NULL OR rp.RetailID = ?)
        GROUP BY rp.RetailID, rp.RetailName, ri.ItemID, ri.ItemName
        ORDER BY rp.RetailName ASC, ri.ItemName ASC
    `;
    db.query(sql, [areaID, startDate, endDate, retailID, retailID], (err, results) => {
        if (err) return callback(err);

        const enriched = results.map(row => {
            const revenue = Number(row.Revenue) || 0;
            const cogs = Number(row.COGS) || 0;
            const grossProfit = revenue - cogs;
            const grossMarginPct = revenue === 0 ? 0 : (grossProfit / revenue) * 100;

            return {
                ...row,
                GrossProfit: grossProfit,
                GrossMarginPct: grossMarginPct
            };
        });

        callback(null, enriched);
    });
};

const getDamagedStolenReport = (areaID, startDate, endDate, retailID, callback) => {
    const sql = `
        SELECT
            rp.RetailName,
            ri.ItemName,
            tl.Type,
            tl.Quantity,
            tl.Date,
            tl.Time
        FROM TransactionLog tl
        JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND tl.Type IN ('Damaged', 'Stolen')
        AND tl.Date BETWEEN ? AND ?
        AND (? IS NULL OR rp.RetailID = ?)
        ORDER BY tl.Date DESC
    `;
    db.query(sql, [areaID, startDate, endDate, retailID, retailID], callback);
};

const getItemsBoughtReport = (areaID, startDate, endDate, retailID, callback) => {
    const sql = `
        SELECT
            rp.RetailName,
            ri.ItemName,
            SUM(tl.Quantity) AS TotalQuantityBought,
            COUNT(*) AS PurchaseTransactions,
            SUM(COALESCE(tl.TotalCost, 0)) AS TotalSales
        FROM TransactionLog tl
        JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND tl.Type IN ('Normal', 'Discount')
        AND tl.Date BETWEEN ? AND ?
        AND (? IS NULL OR rp.RetailID = ?)
        GROUP BY rp.RetailID, rp.RetailName, ri.ItemID, ri.ItemName
        ORDER BY TotalQuantityBought DESC, rp.RetailName ASC, ri.ItemName ASC
    `;
    db.query(sql, [areaID, startDate, endDate, retailID, retailID], callback);
};

// -------------------------------------------------------
// INVENTORY
// -------------------------------------------------------

const getInventory = (areaID, retailID, callback) => {
    const sql = `
        SELECT
            ri.ItemID,
            ri.ItemName,
            ri.Quantity,
            ri.LowStockThreshold,
            ri.BuyPrice,
            ri.SellPrice,
            ri.DiscountPrice,
            ri.IsActive,
            rp.RetailID,
            rp.RetailName
        FROM RetailItem ri
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND ri.IsActive = TRUE
        AND (? IS NULL OR rp.RetailID = ?)
    `;
    db.query(sql, [areaID, retailID, retailID], callback);
};

const adjustQuantity = (itemID, newQuantity, callback) => {
    const sql = `
        UPDATE RetailItem
        SET Quantity = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [newQuantity, itemID], (err, results) => {
        if (err) return callback(err);

        // Check low stock after adjustment
        const checkSQL = `
            SELECT 
                ri.Quantity, 
                ri.LowStockThreshold, 
                ri.ItemName,
                ri.ItemID,
                rm.ManagerID,
                rp.AreaID
            FROM RetailItem ri
            JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
            JOIN RetailManager rm ON rp.AreaID = rm.AreaID
            WHERE ri.ItemID = ?
        `;
        db.query(checkSQL, [itemID], (err, rows) => {
            if (err) return callback(err);
            const item = rows[0];
            if (item.Quantity <= item.LowStockThreshold) {
                const notifySQL = `
                    INSERT INTO NotificationLog (ManagerID, ItemID, Message, CreatedAt)
                    VALUES (?, ?, ?, NOW())
                `;
                const message = `${item.ItemName} has ${item.Quantity} units left.`;
                db.query(notifySQL, [item.ManagerID, item.ItemID, message], callback);
            } else {
                callback(null, results);
            }
        });
    });
};

const updateThreshold = (itemID, threshold, callback) => {
    const sql = `
        UPDATE RetailItem
        SET LowStockThreshold = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [threshold, itemID], callback);
};

const addItem = (itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID, callback) => {
    const sql = `
        INSERT INTO RetailItem 
            (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)
    `;
    db.query(sql, [itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID], callback);
};

const setItemActive = (itemID, isActive, callback) => {
    const sql = `
        UPDATE RetailItem
        SET IsActive = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [isActive, itemID], callback);
};

const updateItemName = (itemID, itemName, callback) => {
    const sql = `
        UPDATE RetailItem
        SET ItemName = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [itemName, itemID], callback);
};

// -------------------------------------------------------
// PRICING
// -------------------------------------------------------

const updatePrices = (itemID, buyPrice, sellPrice, discountPrice, callback) => {
    const sql = `
        UPDATE RetailItem
        SET BuyPrice = ?, SellPrice = ?, DiscountPrice = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [buyPrice, sellPrice, discountPrice, itemID], callback);
};

// -------------------------------------------------------
// STORE MANAGEMENT
// -------------------------------------------------------

const addStore = (retailName, areaID, callback) => {
    const sql = `
        INSERT INTO RetailPlace (RetailName, AreaID)
        VALUES (?, ?)
    `;
    db.query(sql, [retailName, areaID], callback);
};

const getStores = (areaID, callback) => {
    const sql = `
        SELECT RetailID, RetailName, AreaID
        FROM RetailPlace
        WHERE AreaID = ?
        ORDER BY RetailID ASC
    `;
    db.query(sql, [areaID], callback);
};

const updateStoreName = (retailID, retailName, areaID, callback) => {
    const sql = `
        UPDATE RetailPlace
        SET RetailName = ?
        WHERE RetailID = ?
        AND AreaID = ?
    `;
    db.query(sql, [retailName, retailID, areaID], callback);
};

// -------------------------------------------------------
// LOGS
// -------------------------------------------------------

const addRestock = (itemID, quantity, callback) => {
    const sql = `
        INSERT INTO RestockLog (ItemID, Quantity, Cost)
        VALUES (?, ?, 0)
    `;
    db.query(sql, [itemID, quantity], callback);
};

const getRestockHistory = (areaID, retailID, callback) => {
    const sql = `
        SELECT
            rl.RestockID,
            rl.ItemID,
            rp.RetailID,
            rp.RetailName,
            ri.ItemName,
            rl.Quantity,
            rl.Cost
        FROM RestockLog rl
        JOIN RetailItem ri  ON rl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND (? IS NULL OR rp.RetailID = ?)
        ORDER BY rl.RestockID DESC
    `;
    db.query(sql, [areaID, retailID, retailID], callback);
};

const addTransaction = (itemID, type, quantity, callback) => {
    const sql = `
        INSERT INTO TransactionLog (ItemID, VisitorID, Date, Time, Type, Price, Quantity, TotalCost)
        VALUES (?, 1, CURDATE(), CURTIME(), ?, 0, ?, 0)
    `;
    db.query(sql, [itemID, type, quantity], callback);
};

const getTransactionHistory = (areaID, retailID, callback) => {
    const sql = `
        SELECT
            tl.TransactionID,
            tl.ItemID,
            ri.ItemName,
            rp.RetailID,
            rp.RetailName,
            tl.Date,
            tl.Time,
            tl.Type,
            tl.Price,
            tl.Quantity,
            tl.TotalCost,
            tl.VisitorID
        FROM TransactionLog tl
        JOIN RetailItem ri  ON tl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND (? IS NULL OR rp.RetailID = ?)
        ORDER BY tl.Date DESC, tl.Time DESC
    `;
    db.query(sql, [areaID, retailID, retailID], callback);
};

const getNotifications = (areaID, callback) => {
    const sql = `
        SELECT
            nl.NotificationID,
            nl.Message,
            nl.CreatedAt,
            ri.ItemName
        FROM NotificationLog nl
        JOIN RetailItem ri  ON nl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        ORDER BY nl.CreatedAt DESC
    `;
    db.query(sql, [areaID], callback);
};

module.exports = {
    loginManager,
    getProfitReport,
    getDamagedStolenReport,
    getItemsBoughtReport,
    getInventory,
    adjustQuantity,
    updateThreshold,
    addItem,
    setItemActive,
    updateItemName,
    updatePrices,
    addStore,
    getStores,
    updateStoreName,
    addRestock,
    getRestockHistory,
    addTransaction,
    getTransactionHistory,
    getNotifications
};
