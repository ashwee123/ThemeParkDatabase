const crypto = require("crypto");

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}

function pbkdf2Hash(password) {
  const iterations = Number(process.env.PBKDF2_ITERATIONS || 120000);
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2$${iterations}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

function pbkdf2Verify(password, storedHash) {
  if (typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const saltHex = parts[2];
  const hashHex = parts[3];
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = crypto.pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  return crypto.timingSafeEqual(derived, expected);
}

function createJwt(payload, secret, { expiresInSec = 60 * 60 * 24 } = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSec;
  const fullPayload = { ...payload, iat: now, exp };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${data}.${signatureB64}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest();
  const expectedSigB64 = base64UrlEncode(expectedSig);
  if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSigB64))) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  return payload;
}

module.exports = {
  pbkdf2Hash,
  pbkdf2Verify,
  createJwt,
  verifyJwt,
};

