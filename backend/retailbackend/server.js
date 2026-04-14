const http   = require("http");
const routes = require("./routes");

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

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

    routes(req, res, url, sendJSON, parseBody);
});

server.listen(process.env.PORT || 3001, () => {
    console.log(`Server running on port ${process.env.PORT || 3001}`);
});
