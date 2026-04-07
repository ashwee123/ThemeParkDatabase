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
  if (s === "Basic" || s === "Membership" || s === "Discount") return s;
  // Backward compatibility aliases
  if (s === "General") return "Basic";
  if (s === "VIP") return "Membership";
  if (s.toLowerCase() === "basic") return "Basic";
  if (s.toLowerCase() === "membership") return "Membership";
  if (s.toLowerCase() === "discount") return "Discount";
  return null;
}

function normalizeDiscountFor(v) {
  const s = String(v || "").trim();
  if (!s || s.toLowerCase() === "none") return "None";
  if (s === "Child" || s === "Senior" || s === "Veteran") return s;
  return null;
}

module.exports = {
  sendJson,
  sendText,
  readJson,
  normalizeEnumTicketType,
  normalizeDiscountFor,
};

