// backend/auth.js
const jwt = require("jsonwebtoken");

const SECRET_KEY =
  process.env.JWT_SECRET || "theme-park-dev-jwt-secret-change-in-production";

if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET is unset; using insecure dev default.");
}

// Generate token (MySQL columns: UserID, Role — see sql files/homepage_users_seed.sql)
function generateToken(user) {
  const id = user.UserID ?? user.userID ?? user.id;
  const role = user.Role ?? user.role ?? "staff";
  return jwt.sign({ id, role }, SECRET_KEY, { expiresIn: "1h" });
}

// Verify token
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken };