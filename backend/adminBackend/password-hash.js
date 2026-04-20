import crypto from "crypto";

/** Same format as backend/visitorbackend/auth.js (visitor portal login). */
export function pbkdf2Hash(password) {
  const iterations = Number(process.env.PBKDF2_ITERATIONS || 120000);
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256");
  return `pbkdf2$${iterations}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}
