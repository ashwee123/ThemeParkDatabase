import mysql from "mysql2/promise";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;

    console.log("Incoming:", email);

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ? AND password = ?",
      [email, password]
    );

    console.log("DB result:", rows);

    if (rows.length === 0) {
      return res.status(401).json({ message: "No user found" });
    }

    return res.status(200).json({
      message: "Login success",
      user: rows[0],
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
