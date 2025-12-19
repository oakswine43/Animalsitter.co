// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "7d";

function mapDbUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    is_active: !!row.is_active,
    avatar_url: row.avatar_url || null
  };
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role = "client", phone } = req.body || {};

    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    // Check if email already exists
    const [existingRows] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existingRows.length) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [full_name, email, password_hash, role, phone || null]
    );

    const newUserId = result.insertId;

    const [userRows] = await pool.query(
      `SELECT id, full_name, email, role, phone, is_active, avatar_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [newUserId]
    );

    const dbUser = mapDbUser(userRows[0]);

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

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, phone, is_active, avatar_url, password_hash
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

// GET /auth/me  (used by restoreSession in app.js)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, phone, is_active, avatar_url
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

// POST /auth/change-password
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
