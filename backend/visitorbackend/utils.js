function sendJson(res, statusCode, data) {
  const body = data == null ? "" : JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readJson(req) {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) return null;

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) break;
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

function normalizeEnumTicketType(t) {
  const s = String(t || "").trim();
  if (s === "General" || s === "VIP" || s === "Discount") return s;
  // Allow friendly aliases from UI
  if (s.toLowerCase() === "basic") return "General";
  if (s.toLowerCase() === "membership") return "VIP";
  if (s.toLowerCase() === "discount") return "Discount";
  return null;
}

module.exports = {
  sendJson,
  sendText,
  readJson,
  normalizeEnumTicketType,
};

