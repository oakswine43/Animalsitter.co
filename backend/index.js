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
  // ✅ 8 MB so phone pics work
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

    const row = rows[0];
    const full_name = `${row.first_name || ""} ${row.last_name || ""}`.trim();

    res.json({
      ok: true,
      user: {
        ...row,
        full_name
      }
    });
  } catch (err) {
    console.error("PROFILE_GET_ERROR:", err);
    res.status(500).json({ error: "Failed to load profile." });
  }
});

// PUT /profile  -> update first_name, last_name, phone, etc.
app.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, full_name, phone } = req.body || {};

    // 1) Load current values
    const [rows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
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

    // 2) Decide new values
    let newFirst = current.first_name || "";
    let newLast = current.last_name || "";

    if (typeof first_name === "string") {
      newFirst = first_name.trim();
    }
    if (typeof last_name === "string") {
      newLast = last_name.trim();
    }

    // Optional legacy support for full_name only
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

    // 3) If nothing changed, just return current
    if (
      newFirst === (current.first_name || "") &&
      newLast === (current.last_name || "") &&
      (newPhone || null) === (current.phone || null)
    ) {
      const full_name_response =
        `${current.first_name || ""} ${current.last_name || ""}`.trim();

      return res.json({
        ok: true,
        user: {
          ...current,
          full_name: full_name_response
        }
      });
    }

    // 4) Simple fixed-parameter UPDATE
    await pool.query(
      `UPDATE users
       SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newFirst, newLast, newPhone, userId]
    );

    // 5) Re-load updated row
    const [updatedRows] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
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

    const updated = updatedRows[0];
    const full_name_response =
      `${updated.first_name || ""} ${updated.last_name || ""}`.trim();

    res.json({
      ok: true,
      user: {
        ...updated,
        full_name: full_name_response
      }
    });
  } catch (err) {
    console.error("PROFILE_UPDATE_ERROR:", err.message, err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// POST /profile/photo  (multipart/form-data, field name: photo)
app.post(
  "/profile/photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const relativePath = `/uploads/${req.file.filename}`;

      await pool.query(
        `UPDATE users
         SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [relativePath, userId]
      );

      const fullUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

      console.log("PROFILE_PHOTO_SAVED for user", userId, "->", relativePath);

      res.json({
        ok: true,
        url: relativePath,
        fullUrl
      });
    } catch (err) {
      console.error("PROFILE_PHOTO_ERROR:", err);
      res.status(500).json({ error: "Failed to upload profile photo." });
    }
  }
);

// =====================
// PUP GALLERY ROUTES
// =====================

// Get posts for the gallery
app.get("/gallery/posts", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         title,
         author_name,
         caption,
         image_url,
         likes_count,
         created_at
       FROM gallery_posts
       ORDER BY created_at DESC
       LIMIT 20`
    );

    res.json({ ok: true, posts: rows });
  } catch (err) {
    console.error("GALLERY_POSTS_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to load gallery posts." });
  }
});

// Get comments for a specific post
app.get("/gallery/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Invalid post id." });
    }

    const [rows] = await pool.query(
      `SELECT
         id,
         post_id,
         author_name,
         body,
         created_at
       FROM gallery_comments
       WHERE post_id = ?
       ORDER BY created_at ASC`,
      [postId]
    );

    res.json({ ok: true, comments: rows });
  } catch (err) {
    console.error("GALLERY_COMMENTS_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to load comments." });
  }
});

// Like a gallery post (anyone can like for now)
app.post("/gallery/posts/:id/like", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Invalid post id." });
    }

    const [result] = await pool.query(
      `UPDATE gallery_posts
       SET likes_count = likes_count + 1
       WHERE id = ?`,
      [postId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: "Post not found." });
    }

    const [rows] = await pool.query(
      `SELECT id, likes_count
       FROM gallery_posts
       WHERE id = ?`,
      [postId]
    );

    res.json({ ok: true, post: rows[0] });
  } catch (err) {
    console.error("GALLERY_LIKE_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to like post." });
  }
});

// Add a comment to a post (no auth required; uses name from body or "Guest")
app.post("/gallery/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Invalid post id." });
    }

    const { author_name, body } = req.body || {};
    if (!body || !body.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "Comment body is required." });
    }

    const safeAuthor = (author_name || "Guest").trim().slice(0, 120);

    await pool.query(
      `INSERT INTO gallery_comments (post_id, author_name, body)
       VALUES (?, ?, ?)`,
      [postId, safeAuthor, body.trim()]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("GALLERY_COMMENT_CREATE_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to add comment." });
  }
});

// =====================
// BOOKINGS + COMMISSION
// =====================

// Helper to generate a simple receipt number like MR-2025-00001
function makeReceiptNumber(bookingId) {
  const year = new Date().getFullYear();
  const padded = String(bookingId).padStart(5, "0");
  return `MR-${year}-${padded}`;
}

app.post("/bookings", async (req, res) => {
  try {
    const {
      client_id,
      sitter_id,
      pet_id = null,
      service_type,
      start_time,
      end_time,
      location,
      price_total,
      notes,
      payment_method = "card",
      currency = "USD"
    } = req.body || {};

    // Basic validation
    if (!client_id || !sitter_id || !service_type || !start_time || !end_time) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing required fields (client_id, sitter_id, service_type, start_time, end_time)."
      });
    }

    const price = Number(price_total);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid price_total." });
    }

    // Commission + payout
    const platformFee = parseFloat((price * COMMISSION_RATE).toFixed(2));
    const sitterPayout = parseFloat((price - platformFee).toFixed(2));

    // 1) Insert booking
    const [bookingResult] = await pool.query(
      `INSERT INTO bookings
       (client_id, sitter_id, pet_id,
        service_type, status,
        start_time, end_time,
        total_price, start_datetime, end_datetime,
        location, price_total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        sitter_id,
        pet_id,
        service_type,
        "accepted", // for now we auto-accept
        start_time,
        end_time,
        price,
        start_time,
        end_time,
        location || null,
        price,
        notes || null
      ]
    );

    const bookingId = bookingResult.insertId;

    // 2) Lookup emails
    const [[clientRow] = [[]]] = await Promise.all([
      pool.query(`SELECT email FROM users WHERE id = ?`, [client_id])
    ]).catch(() => [[[]]]);
    const clientEmail = clientRow?.email || null;

    const [sitterRows] = await pool.query(
      `SELECT email FROM users WHERE id = ?`,
      [sitter_id]
    );
    const sitterEmail = sitterRows[0]?.email || null;

    // 3) Insert into mr_transactions for the full charge to the client
    const receiptNumber = makeReceiptNumber(bookingId);

    const [txResult] = await pool.query(
      `INSERT INTO mr_transactions
       (booking_id, client_id, sitter_id,
        receipt_number, transaction_type,
        amount, currency, payment_method,
        status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        client_id,
        sitter_id,
        receiptNumber,
        "CHARGE",
        price,
        currency,
        payment_method,
        "paid",
        notes || "Booking charge"
      ]
    );
    const transactionId = txResult.insertId;

    // 4) Insert an admin_receipts row for the platform commission
    await pool.query(
      `INSERT INTO admin_receipts
       (transaction_id,
        receipt_number,
        transaction_type,
        amount,
        currency,
        payment_status,
        payment_method,
        booking_id,
        service_type,
        booking_status,
        client_email,
        sitter_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        receiptNumber,
        "CHARGE",
        platformFee, // platform's cut
        currency,
        "paid",
        payment_method,
        bookingId,
        service_type,
        "accepted",
        clientEmail,
        sitterEmail
      ]
    );

    res.status(201).json({
      ok: true,
      booking_id: bookingId,
      client_id,
      sitter_id,
      service_type,
      total_price: price,
      commission_rate: COMMISSION_RATE,
      platform_fee: platformFee,
      sitter_payout: sitterPayout
    });
  } catch (err) {
    console.error("BOOKING_CREATE_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to create booking." });
  }
});

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

  // Special handling for Multer errors
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