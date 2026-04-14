const queries = require("./queries");

module.exports = function registerRoutes(req, res, url, sendJSON, parseBody) {
    const path = url.pathname;

    // -------------------------------------------------------
    // REPORTS
    // -------------------------------------------------------

    if (path === "/report" && req.method === "GET") {
        const areaID    = url.searchParams.get("areaID");
        const startDate = url.searchParams.get("startDate");
        const endDate   = url.searchParams.get("endDate");
        queries.getProfitReport(areaID, startDate, endDate, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    } else if (path === "/damaged-stolen" && req.method === "GET") {
        const areaID    = url.searchParams.get("areaID");
        const startDate = url.searchParams.get("startDate");
        const endDate   = url.searchParams.get("endDate");
        queries.getDamagedStolenReport(areaID, startDate, endDate, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // -------------------------------------------------------
    // INVENTORY
    // -------------------------------------------------------

    } else if (path === "/inventory" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getInventory(areaID, (err, results) => {
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
        const areaID = url.searchParams.get("areaID");
        queries.getStores(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    } else if (path === "/store" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { retailName, areaID } = body;
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
        const areaID = url.searchParams.get("areaID");
        queries.getRestockHistory(areaID, (err, results) => {
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
        const areaID = url.searchParams.get("areaID");
        queries.getTransactionHistory(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    } else if (path === "/notifications" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getNotifications(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // -------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------

    } else if (path === "/login" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { username, password } = body;
            queries.loginManager(username, password, (err, manager) => {
                if (err)      return sendJSON(res, 500, { error: err.message });
                if (!manager) return sendJSON(res, 401, { error: "Invalid username or password" });
                sendJSON(res, 200, manager);
            });
        });

    } else {
        sendJSON(res, 404, { error: "Route not found" });
    }
};