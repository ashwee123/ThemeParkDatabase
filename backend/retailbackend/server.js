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
const FRONTEND_MOUNTS = new Set(["retail", "retailfront", "portal", "retailportal", "retail-portal"]);

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
    let isFrontendMountRequest = false;

    // Default to index.html
    if (cleanPath === "/" || cleanPath === "") {
        cleanPath = "/index.html";
    }

    // Support serving the frontend from known mount points, case-insensitively.
    // Examples:
    // "/portal/app.js" -> "/app.js"
    // "/Portal/200/dashboard" -> "/200/dashboard"
    const pathSegments = cleanPath.split("/").filter(Boolean);
    const mountSegment = pathSegments[0]?.toLowerCase();
    if (mountSegment && FRONTEND_MOUNTS.has(mountSegment)) {
        isFrontendMountRequest = true;
        const remainder = pathSegments.slice(1).join("/");
        cleanPath = remainder ? `/${remainder}` : "/index.html";
    }

    const publicRoot = path.resolve(PUBLIC_DIR);
    const relativePath = cleanPath.replace(/^\/+/, "");
    const staticCandidates = [relativePath];

    // Allow area-scoped URLs (e.g. /portal/12/app.js) to resolve root assets.
    if (isFrontendMountRequest) {
        const segments = relativePath.split("/").filter(Boolean);
        if (segments.length > 1) {
            staticCandidates.push(segments.slice(1).join("/"));
        }
    }

    const tryServeStatic = (index = 0) => {
        if (index >= staticCandidates.length) {
            // SPA fallback for portal deep-links (e.g. /portal/dashboard).
            if (req.method === "GET" && isFrontendMountRequest && !path.extname(cleanPath)) {
                return serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
            }
            return routes(req, res, url, sendJSON, parseBody);
        }

        const filePath = path.resolve(PUBLIC_DIR, staticCandidates[index]);
        const isInsidePublicDir = filePath === publicRoot || filePath.startsWith(publicRoot + path.sep);
        if (!isInsidePublicDir) {
            res.writeHead(403);
            return res.end("Forbidden");
        }

        fs.stat(filePath, (err, stat) => {
            if (!err && stat.isFile()) {
                return serveStatic(res, filePath);
            }
            return tryServeStatic(index + 1);
        });
    };

    tryServeStatic();
});

// ======================
// START SERVER
// ======================
server.listen(process.env.PORT || 3001, () => {
    console.log(`Server running on port ${process.env.PORT || 3001}`);
});
