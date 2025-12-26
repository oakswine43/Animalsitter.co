// backend/index.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const pool = require("./db");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth"); // same as /auth/me

const app = express();

// =====================
// Commission rate (service fee)
// =====================
const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || "0.2");
console.log("COMMISSION_RATE in use:", COMMISSION_RATE);

// =====================
// Core middleware
// =====================
app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// =====================
// Upload folder + static
// =====================
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}

// serve http://localhost:4000/uploads/....
app.use("/uploads", express.static(uploadsDir));

// Multer storage for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const baseRaw = path.basename(file.originalname || "photo", ext);
    const safeBase = (baseRaw || "photo").replace(/[^a-z0-9_-]/gi, "");
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${safeBase}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  // ⬇️ Increase limit so typical phone photos work (8 MB)
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only jpeg, png, webp images are allowed."));
    }
    cb(null, true);
  }
});

// =====================
// Optional admin key guard
// =====================
function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next(); // dev mode

  const provided = req.headers["x-admin-key"];
  if (!provided || provided !== key) {
    return res.status(401).json({ error: "Unauthorized admin request." });
  }
  next();
}

// =====================
// Root + health + debug routes
// =====================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "PetCare backend is running.",
    db:
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      null,
    commission_rate: COMMISSION_RATE,
    sample_routes: [
      "/health",
      "/debug/db",
      "/_debug/routes",
      "/auth/*",
      "/profile",
      "/profile/photo",
      "/gallery/posts",
      "/bookings"
    ]
  });
});

// HEALTH route
app.get("/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok, DATABASE() AS db");
    res.json({
      ok: true,
      db: rows[0]?.db || process.env.DB_NAME,
      dbPing: true
    });
  } catch (err) {
    console.error("HEALTH_DB_ERROR (raw):", err);
    res.status(500).json({
      ok: false,
      db: process.env.DB_NAME || null,
      error: "DB connection failed"
    });
  }
});

// DB DEBUG – for https://<your-backend>.up.railway.app/debug/db
app.get("/debug/db", async (req, res) => {
  try {
    const [[dbRow]] = await pool.query(
      "SELECT DATABASE() AS dbName, NOW() AS serverTime"
    );
    const [[userRow]] = await pool.query(
      "SELECT COUNT(*) AS user_count FROM users"
    );

    return res.json({
      ok: true,
      db: dbRow?.dbName || null,
      dbPing: true,
      serverTime: dbRow?.serverTime || null,
      user_count: userRow?.user_count ?? null
    });
  } catch (err) {
    console.error("DEBUG_DB_ERROR:", err);
    return res.status(500).json({
      ok: false,
      db:
        process.env.DB_NAME ||
        process.env.MYSQLDATABASE ||
        process.env.MYSQL_DATABASE ||
        null,
      dbPing: false,
      error: err.message
    });
  }
});

// List all registered routes so we can confirm /bookings exists
app.get("/_debug/routes", (req, res) => {
  const routes = [];
  if (app._router && app._router.stack) {
    app._router.stack.forEach((layer) => {
      if (!layer.route) return;
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      routes.push({ methods, path });
    });
  }
  res.json({ ok: true, routes });
});

// =====================
// ADMIN: reset password by user id
// =====================
app.post(
  "/admin/users/:id/reset-password",
  requireAdminKey,
  async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { tempPassword } = req.body || {};

      if (!userId) {
        return res.status(400).json({ error: "Invalid user id." });
      }

      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({
          error: "Temp password must be at least 6 characters."
        });
      }

      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [result] = await pool.query(
        `UPDATE users
         SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [passwordHash, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      res.json({ ok: true, userId });
    } catch (err) {
      console.error("ADMIN_RESET_ERROR:", err);
      res.status(500).json({ error: "Server error resetting password." });
    }
  }
);

// =====================
// ADMIN: reset password by email
// =====================
app.post(
  "/admin/users/reset-by-email",
  requireAdminKey,
  async (req, res) => {
    try {
      const { email, tempPassword } = req.body || {};

      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({
          error: "Temp password must be at least 6 characters."
        });
      }

      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [result] = await pool.query(
        `UPDATE users
         SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`,
        [passwordHash, email]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      res.json({ ok: true, email });
    } catch (err) {
      console.error("ADMIN_RESET_EMAIL_ERROR:", err);
      res.status(500).json({ error: "Server error resetting password." });
    }
  }
);

// =====================
// Auth routes (register / login / change-password / me)
// =====================
app.use("/auth", authRoutes);

// =====================
// PROFILE ROUTES
// =====================

// GET /profile  -> return current user's profile
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("GET /profile for user", userId);

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
       WHERE id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error("PROFILE_GET_ERROR:", err);
    res.status(500).json({ error: "Failed to load profile." });
  }
});

// PUT /profile  -> update basic fields (first/last name, phone, avatar_url)
app.put("/profile", authMiddleware, async (req, res) => {
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
       WHERE id = ?`,
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
       SET first_name = ?, last_name = ?, full_name = ?, phone = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
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
       WHERE id = ?`,
      [userId]
    );

    res.json({ ok: true, user: updatedRows[0] });
  } catch (err) {
    console.error("PROFILE_UPDATE_ERROR:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// =====================
// PUP GALLERY ROUTES
// =====================
// (unchanged – trimmed here for brevity, keep your existing gallery + bookings routes)
// ... keep your /gallery and /bookings routes exactly as you had them ...

// =====================
// 404 + error handlers
// =====================

// 404 JSON (this replaces the plain "Cannot GET /...")
app.use((req, res, next) => {
  if (res.headersSent) return next();
  console.warn("404 Not Found:", req.method, req.url);
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.url
  });
});

// Global error handler (safety net)
app.use((err, req, res, next) => {
  console.error("UNHANDLED_ERROR:", err);

  // ⬇️ Special handling for Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        error: "Image is too large. Max size is 8MB."
      });
    }
    return res.status(400).json({ ok: false, error: err.message });
  }

  res.status(500).json({ ok: false, error: "Server error" });
});

// =====================
// Start server
// =====================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("DB_NAME:", process.env.DB_NAME);
  console.log(`API running on http://localhost:${PORT}`);
});

module.exports = app;