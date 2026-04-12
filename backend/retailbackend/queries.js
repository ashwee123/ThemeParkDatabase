const db = require("./db");

// -------------------------------------------------------
// REPORTS
// -------------------------------------------------------

const getProfitReport = (areaID, startDate, endDate, callback) => {
    const sql = `
        SELECT * FROM RetailProfitReport
        WHERE AreaID = ?
        AND Date BETWEEN ? AND ?
    `;
    db.query(sql, [areaID, startDate, endDate], callback);
};

const getDamagedStolenReport = (areaID, startDate, endDate, callback) => {
    const sql = `
        SELECT
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
        ORDER BY tl.Date DESC
    `;
    db.query(sql, [areaID, startDate, endDate], callback);
};

// -------------------------------------------------------
// INVENTORY
// -------------------------------------------------------

const getInventory = (areaID, callback) => {
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
            rp.RetailName
        FROM RetailItem ri
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND ri.IsActive = TRUE
    `;
    db.query(sql, [areaID], callback);
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
        SELECT * FROM RetailPlace
        WHERE AreaID = ?
    `;
    db.query(sql, [areaID], callback);
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

const getRestockHistory = (areaID, callback) => {
    const sql = `
        SELECT
            rl.RestockID,
            ri.ItemName,
            rl.Quantity,
            rl.Cost
        FROM RestockLog rl
        JOIN RetailItem ri  ON rl.ItemID   = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        ORDER BY rl.RestockID DESC
    `;
    db.query(sql, [areaID], callback);
};

const addTransaction = (itemID, type, quantity, callback) => {
    const sql = `
        INSERT INTO TransactionLog (ItemID, VisitorID, Date, Time, Type, Price, Quantity, TotalCost)
        VALUES (?, 0, CURDATE(), CURTIME(), ?, 0, ?, 0)
    `;
    db.query(sql, [itemID, type, quantity], callback);
};

const getTransactionHistory = (areaID, callback) => {
    const sql = `
        SELECT
            tl.TransactionID,
            ri.ItemName,
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
        ORDER BY tl.Date DESC, tl.Time DESC
    `;
    db.query(sql, [areaID], callback);
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
    getProfitReport,
    getDamagedStolenReport,
    getInventory,
    adjustQuantity,
    updateThreshold,
    addItem,
    setItemActive,
    updatePrices,
    addStore,
    getStores,
    addRestock,
    getRestockHistory,
    addTransaction,
    getTransactionHistory,
    getNotifications
};
