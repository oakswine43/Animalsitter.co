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

  const first = row.first_name || "";
  const last = row.last_name || "";
  const full =
    row.full_name ||
    `${first} ${last}`.trim() ||
    null;

  return {
    id: row.id,
    first_name: first || null,
    last_name: last || null,
    full_name: full,
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
    let {
      first_name,
      last_name,
      full_name,
      email,
      password,
      role = "client",
      phone
    } = req.body || {};

    first_name = typeof first_name === "string" ? first_name.trim() : "";
    last_name = typeof last_name === "string" ? last_name.trim() : "";
    full_name = typeof full_name === "string" ? full_name.trim() : "";

    if (!full_name) {
      full_name = `${first_name} ${last_name}`.trim();
    }

    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ error: "First/last name or full name, email and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const [existingRows] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existingRows.length) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
         (first_name, last_name, full_name, email, password_hash, role, phone,
          is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [first_name || null, last_name || null, full_name, email, password_hash, role, phone || null]
    );

    const newUserId = result.insertId;

    const [userRows] = await pool.query(
      `SELECT id, first_name, last_name, full_name, email, role, phone, is_active, avatar_url
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
      `SELECT
         id,
         first_name,
         last_name,
         full_name,
         email,
         role,
         phone,
         is_active,
         avatar_url,
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

// GET /auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         full_name,
         email,
         role,
         phone,
         is_active,
         avatar_url
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

// PUT /auth/me  (update profile)
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    let { first_name, last_name, full_name, phone, avatar_url } = req.body || {};

    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         full_name,
         email,
         role,
         phone,
         is_active,
         avatar_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const current = rows[0];

    first_name =
      typeof first_name === "string" && first_name.trim()
        ? first_name.trim()
        : current.first_name;

    last_name =
      typeof last_name === "string" && last_name.trim()
        ? last_name.trim()
        : current.last_name;

    full_name =
      typeof full_name === "string" && full_name.trim()
        ? full_name.trim()
        : (current.full_name ||
           `${first_name || ""} ${last_name || ""}`.trim());

    phone =
      typeof phone === "string" && phone.trim()
        ? phone.trim()
        : current.phone;

    avatar_url =
      typeof avatar_url === "string" && avatar_url.trim()
        ? avatar_url.trim()
        : current.avatar_url;

    await pool.query(
      `UPDATE users
       SET first_name = ?, last_name = ?, full_name = ?, phone = ?, avatar_url = ?, updated_at = NOW()
       WHERE id = ?`,
      [first_name || null, last_name || null, full_name, phone || null, avatar_url || null, userId]
    );

    const [updatedRows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         full_name,
         email,
         role,
         phone,
         is_active,
         avatar_url
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