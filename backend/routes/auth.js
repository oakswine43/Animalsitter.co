// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "7d";

// Map DB user row → API user
function mapDbUser(row) {
  if (!row) return null;

  const firstName = row.first_name || "";
  const lastName = row.last_name || "";
  const fullName =
    row.full_name || `${firstName} ${lastName}`.trim() || row.email || "";

  return {
    id: row.id,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: row.email,
    role: row.role,
    phone: row.phone,
    is_active: !!row.is_active,
    avatar_url: row.avatar_url || row.photo_url || null,
    photo_url: row.photo_url || row.avatar_url || null
  };
}

// ----------------------
// POST /auth/register
// ----------------------
router.post("/register", async (req, res) => {
  try {
    let {
      first_name,
      last_name,
      full_name,
      email,
      password,
      role = "client",
      phone
    } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    // If only full_name is provided, split it
    if (!first_name && !last_name && typeof full_name === "string") {
      const parts = full_name.trim().split(/\s+/);
      first_name = parts[0] || "";
      last_name = parts.slice(1).join(" ");
    }

    const fName = (first_name || "").trim();
    const lName = (last_name || "").trim();

    if (!fName) {
      return res
        .status(400)
        .json({ error: "First name is required (or full name)." });
    }

    // Check if email already exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existing.length) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (
         first_name,
         last_name,
         email,
         password_hash,
         role,
         phone,
         is_active,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [fName, lName || null, email, password_hash, role, phone || null]
    );

    const newUserId = result.insertId;

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
         photo_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [newUserId]
    );

    const dbUser = mapDbUser(rows[0]);

    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email, role: dbUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ token, user: dbUser });
  } catch (err) {
    console.error("AUTH_REGISTER_ERROR:", err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// ----------------------
// POST /auth/login
// ----------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
         photo_url,
         password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const userRow = rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash || "");
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const dbUser = mapDbUser(userRow);

    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email, role: dbUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ token, user: dbUser });
  } catch (err) {
    console.error("AUTH_LOGIN_ERROR:", err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// ----------------------
// GET /auth/me
// ----------------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
         photo_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const dbUser = mapDbUser(rows[0]);
    res.json({ user: dbUser });
  } catch (err) {
    console.error("AUTH_ME_ERROR:", err);
    res.status(500).json({ error: "Server error loading user." });
  }
});

// ----------------------
// PUT /auth/me  (optional profile update via /auth)
// ----------------------
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      full_name,
      phone,
      avatar_url,
      photo_url
    } = req.body || {};

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
         photo_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const current = rows[0];

    // Figure out new names
    let newFirst = current.first_name || "";
    let newLast = current.last_name || "";

    if (typeof first_name === "string") newFirst = first_name.trim();
    if (typeof last_name === "string") newLast = last_name.trim();

    if (!first_name && !last_name && typeof full_name === "string") {
      const parts = full_name.trim().split(/\s+/);
      newFirst = parts[0] || "";
      newLast = parts.slice(1).join(" ");
    }

    let newPhone = current.phone || null;
    if (typeof phone === "string") {
      const p = phone.trim();
      newPhone = p || null;
    }

    let newAvatar = current.avatar_url || current.photo_url || null;
    if (typeof avatar_url === "string" && avatar_url.trim()) {
      newAvatar = avatar_url.trim();
    } else if (typeof photo_url === "string" && photo_url.trim()) {
      newAvatar = photo_url.trim();
    }

    await pool.query(
      `UPDATE users
       SET first_name = ?, last_name = ?, phone = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newFirst, newLast, newPhone, newAvatar, userId]
    );

    const [updatedRows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
         photo_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const dbUser = mapDbUser(updatedRows[0]);
    res.json({ user: dbUser });
  } catch (err) {
    console.error("AUTH_ME_UPDATE_ERROR:", err);
    res.status(500).json({ error: "Server error updating profile." });
  }
});

// ----------------------
// POST /auth/change-password
// ----------------------
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Both current and new password are required."
      });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters." });
    }

    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const userRow = rows[0];
    const ok = await bcrypt.compare(currentPassword, userRow.password_hash || "");
    if (!ok) {
      return res
        .status(401)
        .json({ error: "Current password is incorrect." });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = ?, updated_at = NOW()
       WHERE id = ?`,
      [newHash, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("AUTH_CHANGE_PASSWORD_ERROR:", err);
    res.status(500).json({ error: "Server error changing password." });
  }
});

module.exports = router;