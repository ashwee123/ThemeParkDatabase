const http = require("http");
const queries = require("./queries");

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url  = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    const sendJSON = (res, status, data) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
    };

    const parseBody = (req, callback) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                callback(JSON.parse(body));
            } catch {
                callback(null);
            }
        });
    };

    // -------------------------------------------------------
    // REPORTS
    // -------------------------------------------------------

    // GET /report?areaID=1&startDate=2024-01-01&endDate=2024-12-31
    if (path === "/report" && req.method === "GET") {
        const areaID    = url.searchParams.get("areaID");
        const startDate = url.searchParams.get("startDate");
        const endDate   = url.searchParams.get("endDate");
        queries.getProfitReport(areaID, startDate, endDate, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // GET /damaged-stolen?areaID=1&startDate=2024-01-01&endDate=2024-12-31
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

    // GET /inventory?areaID=1
    } else if (path === "/inventory" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getInventory(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // PUT /inventory/adjust
    } else if (path === "/inventory/adjust" && req.method === "PUT") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, newQuantity } = body;
            queries.adjustQuantity(itemID, newQuantity, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Quantity updated successfully" });
            });
        });

    // PUT /inventory/threshold
    } else if (path === "/inventory/threshold" && req.method === "PUT") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, threshold } = body;
            queries.updateThreshold(itemID, threshold, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Threshold updated successfully" });
            });
        });

    // POST /item
    } else if (path === "/item" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID } = body;
            queries.addItem(itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Item added successfully" });
            });
        });

    // PUT /item/active
    } else if (path === "/item/active" && req.method === "PUT") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, isActive } = body;
            queries.setItemActive(itemID, isActive, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: `Item ${isActive ? "activated" : "deactivated"} successfully` });
            });
        });

    // -------------------------------------------------------
    // PRICING
    // -------------------------------------------------------

    // PUT /item/price
    } else if (path === "/item/price" && req.method === "PUT") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, buyPrice, sellPrice, discountPrice } = body;
            queries.updatePrices(itemID, buyPrice, sellPrice, discountPrice, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Prices updated successfully" });
            });
        });

    // -------------------------------------------------------
    // STORE MANAGEMENT
    // -------------------------------------------------------

    // GET /stores?areaID=1
    } else if (path === "/stores" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getStores(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // POST /store
    } else if (path === "/store" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { retailName, areaID } = body;
            queries.addStore(retailName, areaID, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Store added successfully" });
            });
        });

    // -------------------------------------------------------
    // LOGS
    // -------------------------------------------------------

    // POST /restock
    } else if (path === "/restock" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, quantity } = body;
            queries.addRestock(itemID, quantity, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Restock logged successfully" });
            });
        });

    // GET /restock/history?areaID=1
    } else if (path === "/restock/history" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getRestockHistory(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // POST /transaction
    } else if (path === "/transaction" && req.method === "POST") {
        parseBody(req, (body) => {
            if (!body) return sendJSON(res, 400, { error: "Invalid request body" });
            const { itemID, type, quantity } = body;
            queries.addTransaction(itemID, type, quantity, (err, results) => {
                if (err) return sendJSON(res, 500, { error: err.message });
                sendJSON(res, 200, { message: "Transaction logged successfully" });
            });
        });

    // GET /transactions?areaID=1
    } else if (path === "/transactions" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getTransactionHistory(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    // GET /notifications?areaID=1
    } else if (path === "/notifications" && req.method === "GET") {
        const areaID = url.searchParams.get("areaID");
        queries.getNotifications(areaID, (err, results) => {
            if (err) return sendJSON(res, 500, { error: err.message });
            sendJSON(res, 200, results);
        });

    } else {
        sendJSON(res, 404, { error: "Route not found" });
    }
});

server.listen(3001, () => {
    console.log("Server running on port 3001");
});