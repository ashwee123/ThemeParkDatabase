const db = require("./db");

// -------------------------------------------------------
// REPORTS
// -------------------------------------------------------

exports.getProfitReport = (areaID, startDate, endDate, callback) => {
    const sql = `
        SELECT SUM(t.Price * t.Quantity) AS TotalProfit
        FROM TransactionLog t
        JOIN RetailItem ri ON t.ItemID = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND t.Date BETWEEN ? AND ?
    `;
    db.query(sql, [areaID, startDate, endDate], callback);
};

exports.getDamagedStolenReport = (areaID, startDate, endDate, callback) => {
    const sql = `
        SELECT t.*
        FROM TransactionLog t
        JOIN RetailItem ri ON t.ItemID = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND t.Type IN ('Damaged', 'Stolen')
        AND t.Date BETWEEN ? AND ?
    `;
    db.query(sql, [areaID, startDate, endDate], callback);
};

// -------------------------------------------------------
// INVENTORY
// -------------------------------------------------------

exports.getInventory = (areaID, callback) => {
    const sql = `
        SELECT ri.*
        FROM RetailItem ri
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
    `;
    db.query(sql, [areaID], callback);
};

exports.adjustQuantity = (itemID, newQuantity, callback) => {
    const sql = `
        UPDATE RetailItem
        SET Quantity = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [newQuantity, itemID], callback);
};

exports.updateThreshold = (itemID, threshold, callback) => {
    const sql = `
        UPDATE RetailItem
        SET LowStockThreshold = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [threshold, itemID], callback);
};

exports.addItem = (itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID, callback) => {
    const sql = `
        INSERT INTO RetailItem 
        (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, RetailID)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID], callback);
};

exports.setItemActive = (itemID, isActive, callback) => {
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

exports.updatePrices = (itemID, buyPrice, sellPrice, discountPrice, callback) => {
    const sql = `
        UPDATE RetailItem
        SET BuyPrice = ?, SellPrice = ?, DiscountPrice = ?
        WHERE ItemID = ?
    `;
    db.query(sql, [buyPrice, sellPrice, discountPrice, itemID], callback);
};

// -------------------------------------------------------
// STORES
// -------------------------------------------------------

exports.getStores = (areaID, callback) => {
    const sql = `
        SELECT *
        FROM RetailPlace
        WHERE AreaID = ?
    `;
    db.query(sql, [areaID], callback);
};

exports.addStore = (retailName, areaID, callback) => {
    const sql = `
        INSERT INTO RetailPlace (RetailName, AreaID)
        VALUES (?, ?)
    `;
    db.query(sql, [retailName, areaID], callback);
};

// -------------------------------------------------------
// RESTOCK
// -------------------------------------------------------

exports.addRestock = (itemID, quantity, callback) => {
    const sql = `
        INSERT INTO RestockLog (ItemID, Quantity, Date)
        VALUES (?, ?, NOW())
    `;
    db.query(sql, [itemID, quantity], callback);
};

exports.getRestockHistory = (areaID, callback) => {
    const sql = `
        SELECT r.*
        FROM RestockLog r
        JOIN RetailItem ri ON r.ItemID = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
    `;
    db.query(sql, [areaID], callback);
};

// -------------------------------------------------------
// TRANSACTIONS
// -------------------------------------------------------

exports.addTransaction = (itemID, type, quantity, callback) => {
    const sql = `
        INSERT INTO TransactionLog (ItemID, Type, Quantity, Date, Time)
        VALUES (?, ?, ?, CURDATE(), CURTIME())
    `;
    db.query(sql, [itemID, type, quantity], callback);
};

exports.getTransactionHistory = (areaID, callback) => {
    const sql = `
        SELECT t.*
        FROM TransactionLog t
        JOIN RetailItem ri ON t.ItemID = ri.ItemID
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
    `;
    db.query(sql, [areaID], callback);
};

// -------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------

exports.getNotifications = (areaID, callback) => {
    const sql = `
        SELECT ri.ItemName, ri.Quantity, ri.LowStockThreshold
        FROM RetailItem ri
        JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
        WHERE rp.AreaID = ?
        AND ri.Quantity <= ri.LowStockThreshold
    `;
    db.query(sql, [areaID], callback);
};
