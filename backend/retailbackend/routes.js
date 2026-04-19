const queries = require("./queries");
const jwt     = require("jsonwebtoken");
const SECRET  = process.env.JWT_SECRET || "supersecret";
const db      = require("./db");

function verifyToken(req, sendJSON, res) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        sendJSON(res, 401, { error: "Unauthorized" });
        return null;
    }
    const token   = authHeader.split(" ")[1];
    try {
        return jwt.verify(token, SECRET);
    } catch {
        sendJSON(res, 401, { error: "Invalid token" });
        return null;
    }
}

function getManagerArea(userID, callback) {
    const sql = `
        SELECT e.AreaID
        FROM users u
        JOIN employee e ON u.EmployeeID = e.EmployeeID
        WHERE u.UserID = ?
        LIMIT 1
    `;

    db.query(sql, [userID], (err, results) => {
        if (err) return callback(null);
        if (results.length === 0) return callback(null);

        callback(results[0].AreaID);
    });
}

function parseIntSafe(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function resolveAreaID(req, decoded, callback) {
    const areaFromToken = parseIntSafe(decoded?.areaID ?? decoded?.areaId);
    if (areaFromToken !== null) return callback(areaFromToken);

    const userID = parseIntSafe(decoded?.id ?? decoded?.userID ?? decoded?.UserID ?? decoded?.sub);
    if (userID !== null) return getManagerArea(userID, callback);

    const areaFromHeader = parseIntSafe(req.headers["x-area-id"]);
    if (areaFromHeader !== null) return callback(areaFromHeader);

    return callback(null);
}

module.exports = function registerRoutes(req, res, url, sendJSON, parseBody) {
    const path    = url.pathname;
    const decoded = verifyToken(req, sendJSON, res);
    if (!decoded) return;

    resolveAreaID(req, decoded, (areaID) => {
        if (areaID === null || areaID === undefined) {
            return sendJSON(res, 403, { error: "No area assigned" });
        }

        // -------------------------------------------------------
        // REPORTS
        // -------------------------------------------------------

        if (path === "/report" && req.method === "GET") {
            const startDate = url.searchParams.get("startDate");
            const endDate   = url.searchParams.get("endDate");
            const retailID  = url.searchParams.get("retailID");
            queries.getProfitReport(areaID, startDate, endDate, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/inventory-loss" && req.method === "GET") {
            const startDate = url.searchParams.get("startDate");
            const endDate   = url.searchParams.get("endDate");
            const retailID  = url.searchParams.get("retailID");
            queries.getDamagedStolenReport(areaID, startDate, endDate, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/items-bought" && req.method === "GET") {
            const startDate = url.searchParams.get("startDate");
            const endDate   = url.searchParams.get("endDate");
            const retailID  = url.searchParams.get("retailID");
            queries.getItemsBoughtReport(areaID, startDate, endDate, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        // -------------------------------------------------------
        // INVENTORY
        // -------------------------------------------------------

        } else if (path === "/inventory" && req.method === "GET") {
            const retailID = url.searchParams.get("retailID");
            queries.getInventory(areaID, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/inventory/adjust" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, newQuantity } = body;
                queries.adjustQuantity(itemID, newQuantity, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Quantity updated successfully" });
                });
            });

        } else if (path === "/inventory/threshold" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, threshold } = body;
                queries.updateThreshold(itemID, threshold, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Threshold updated successfully" });
                });
            });

        } else if (path === "/item" && req.method === "POST") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID } = body;
                queries.addItem(itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Item added successfully" });
                });
            });

        } else if (path === "/item/name" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, itemName } = body;
                queries.updateItemName(itemID, itemName, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Item name updated successfully" });
                });
            });

        } else if (path === "/item/active" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, isActive } = body;
                queries.setItemActive(itemID, isActive, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: `Item ${isActive ? "activated" : "deactivated"} successfully` });
                });
            });

        // -------------------------------------------------------
        // PRICING
        // -------------------------------------------------------

        } else if (path === "/item/price" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, buyPrice, sellPrice, discountPrice } = body;
                queries.updatePrices(itemID, buyPrice, sellPrice, discountPrice, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Prices updated successfully" });
                });
            });

        // -------------------------------------------------------
        // STORE MANAGEMENT
        // -------------------------------------------------------

        } else if (path === "/stores" && req.method === "GET") {
            queries.getStores((err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/store/name" && req.method === "PUT") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { retailID, retailName } = body;
                queries.updateStoreName(retailID, retailName, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Store name updated successfully" });
                });
            });

        } else if (path === "/store" && req.method === "POST") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { retailName } = body;
                queries.addStore(retailName, areaID, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Store added successfully" });
                });
            });

        // -------------------------------------------------------
        // LOGS
        // -------------------------------------------------------

        } else if (path === "/restock" && req.method === "POST") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, quantity } = body;
                queries.addRestock(itemID, quantity, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Restock logged successfully" });
                });
            });

        } else if (path === "/restock/history" && req.method === "GET") {
            const retailID = url.searchParams.get("retailID");
            queries.getRestockHistory(areaID, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/transaction" && req.method === "POST") {
            parseBody(req, (body) => {
                if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
                const { itemID, type, quantity } = body;
                queries.addTransaction(itemID, type, quantity, (err) => {
                    if (err) return sendJSON(res, 500, { error: err.message });
                    sendJSON(res, 200, { message: "Transaction logged successfully" });
                });
            });

        } else if (path === "/transactions" && req.method === "GET") {
            const retailID = url.searchParams.get("retailID");
            queries.getTransactionHistory(areaID, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else if (path === "/notifications" && req.method === "GET") {
            queries.getNotifications(areaID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, results);
            });

        } else {
            sendJSON(res, 404, { error: "Route not found" });
        }
    });
};
