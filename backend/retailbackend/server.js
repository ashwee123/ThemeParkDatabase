const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const routes = require("./routes");

// ======================
// HELPERS (moved outside request handler)
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
// STATIC FILE SERVING
// ======================
const PUBLIC_DIR = path.join(__dirname, "public", "retailfront");

const CONTENT_TYPES = {
    ".html": "text/html",
    ".css":  "text/css",
    ".js":   "application/javascript",
    ".json": "application/json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg":  "image/svg+xml"
};

const serveStatic = (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream"
    });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
        res.writeHead(500);
        res.end("Internal Server Error");
    });
    stream.pipe(res);
};

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
    let cleanPath = url.pathname;

    // Default to index.html
    if (cleanPath === "/" || cleanPath === "") {
        cleanPath = "/index.html";
    }

    // Support serving the frontend at both "/" and "/retailfront".
    // Example: "/retailfront/app.js" -> "/app.js"
    if (cleanPath === "/retailfront" || cleanPath === "/retailfront/") {
        cleanPath = "/index.html";
    } else if (cleanPath.startsWith("/retailfront/")) {
        cleanPath = cleanPath.slice("/retailfront".length);
    }

    const relativePath = cleanPath.replace(/^\/+/, "");
    const filePath = path.resolve(PUBLIC_DIR, relativePath);

    // Security check
    const publicRoot = path.resolve(PUBLIC_DIR);
    if (!filePath.startsWith(publicRoot + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }

    // Serve static file if it exists
    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isFile()) {
            return serveStatic(res, filePath);
        }

        routes(req, res, url, sendJSON, parseBody);
    });
});

// ======================
// START SERVER
// ======================
server.listen(process.env.PORT || 3001, () => {
    console.log(`Server running on port ${process.env.PORT || 3001}`);
});
