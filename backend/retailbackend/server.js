const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const routes = require("./routes");

const server = http.createServer((req, res) => {
    // ======================
    // CORS
    // ======================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

// ======================
// STATIC FILE SERVING
// ======================

let cleanPath = url.pathname;

cleanPath = cleanPath.replace("/retailfront", "");

if (cleanPath === "/") {
    cleanPath = "/index.html";
}

const filePath = path.join(process.cwd(), "retailfront", cleanPath);

// security check
if (!filePath.startsWith(path.join(__dirname, "retailfront"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
}

if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();

    const contentTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml"
    };

    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
    return;
}

    // ======================
    // HELPERS
    // ======================
    const sendJSON = (res, status, data) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
    };

    const parseBody = (req, callback) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try { callback(JSON.parse(body)); }
            catch { callback(null); }
        });
    };

    // ======================
    // API ROUTES
    // ======================
    routes(req, res, url, sendJSON, parseBody);
});

// ======================
// START SERVER
// ======================
server.listen(process.env.PORT || 3001, () => {
    console.log(`Server running on port ${process.env.PORT || 3001}`);
});
