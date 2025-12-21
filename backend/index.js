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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only jpeg, png, webp images are allowed."));
    }
    cb(null, true);
  }
});

// =====================
// Auth middleware (for profile routes)
// (dev-friendly: decode, not verify, so token secret mismatch won't kill us)
// =====================
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  try {
    const payload = jwt.decode(token); // no verify -> dev friendly
    if (!payload) {
      throw new Error("Unable to decode token");
    }

    const userId = payload.id || payload.userId || payload.sub;
    if (!userId) {
      throw new Error("No user id in token payload");
    }

    req.user = { id: userId };
    next();
  } catch (err) {
    console.error("AUTH_TOKEN_ERROR:", err.message);
    return res.status(401).json({ error: "Invalid auth token." });
  }
}

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
    db: process.env.DB_NAME || null,
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

// NEW: DB debug route so you can hit
// https://<your-backend>.up.railway.app/debug/db
app.get("/debug/db", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT 1 AS ok, DATABASE() AS dbName, NOW() AS serverTime"
    );
    return res.json({
      ok: true,
      db: rows[0]?.dbName || null,
      dbPing: true,
      serverTime: rows[0]?.serverTime || null
    });
  } catch (err) {
    console.error("debug/db error:", err);
    return res.status(500).json({
      ok: false,
      db: process.env.DB_NAME || null,
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
app.post("/admin/users/:id/reset-password", requireAdminKey, async (req, res) => {
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
});

// =====================
// ADMIN: reset password by email
// =====================
app.post("/admin/users/reset-by-email", requireAdminKey, async (req, res) => {
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
});

// =====================
// Auth routes (register / login / change-password / me)
// =====================
app.use("/auth", authRoutes);

// =====================
// PROFILE ROUTES
// =====================

// GET /profile  -> return current user's profile
app.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("GET /profile for user", userId);

    const [rows] = await pool.query(
      `SELECT
         id,
         full_name,
         email,
         role,
         phone,
         is_active,
         photo_url
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

// PUT /profile  -> update basic fields (name, phone, etc.)
app.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body || {};

    const fields = [];
    const params = [];

    if (typeof name === "string") {
      fields.push("full_name = ?");
      params.push(name.trim());
    }

    if (typeof phone === "string") {
      fields.push("phone = ?");
      params.push(phone.trim());
    }

    if (!fields.length) {
      return res.status(400).json({ error: "No changes submitted." });
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    params.push(userId);

    await pool.query(sql, params);

    // Return the updated user
    const [rows] = await pool.query(
      `SELECT
         id,
         full_name,
         email,
         role,
         phone,
         is_active,
         photo_url
       FROM users
       WHERE id = ?`,
      [userId]
    );

    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error("PROFILE_UPDATE_ERROR:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// POST /profile/photo  (multipart/form-data, field name: photo)
app.post("/profile/photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const relativePath = `/uploads/${req.file.filename}`;

    await pool.query(
      `UPDATE users
       SET photo_url = ?, updated_at = CURRENT_TIMESTAMP
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
});

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
    if (!postId) return res.status(400).json({ ok: false, error: "Invalid post id." });

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
    if (!postId) return res.status(400).json({ ok: false, error: "Invalid post id." });

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
    if (!postId) return res.status(400).json({ ok: false, error: "Invalid post id." });

    const { author_name, body } = req.body || {};
    if (!body || !body.trim()) {
      return res.status(400).json({ ok: false, error: "Comment body is required." });
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
        error: "Missing required fields (client_id, sitter_id, service_type, start_time, end_time)."
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
      pool.query(`SELECT email FROM users WHERE id = ?`, [client_id]),
      // second dummy to keep structure consistent; we’ll re-query sitter separately
    ]).catch(() => [[[]]]);
    let clientEmail = clientRow?.email || null;

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
        platformFee,          // platform's cut
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
// Make sure this is AFTER all routes above
app.use((req, res) => {
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
