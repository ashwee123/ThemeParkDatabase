// backend/auth.js
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "supersecret";

// Generate token
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
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