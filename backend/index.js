// index.js
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
const authMiddleware = require("./middleware/auth");

// =====================
// Commission rate (service fee)
// =====================
const COMMISSION_RATE = parseFloat(
  process.env.PETCARE_COMMISSION_RATE ||
    process.env.COMMISSION_RATE ||
    "0.2"
);
console.log("COMMISSION_RATE in use:", COMMISSION_RATE);

// =====================
// Stripe
// =====================
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
let stripe = null;

if (stripeSecretKey) {
  stripe = require("stripe")(stripeSecretKey);
  console.log("Stripe payments enabled.");
} else {
  console.warn(
    "STRIPE_SECRET_KEY not set – Stripe payment routes will be disabled."
  );
}

const app = express();

// expose stripe on app.locals for any routes that want it
app.locals.stripe = stripe;

// =====================
// Core middleware
// =====================
app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only jpeg, jpg, png, webp images are allowed."));
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
// Helpers
// =====================
function isTruthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v || "").toLowerCase());
}

const DEBUG_ERRORS =
  isTruthy(process.env.DEBUG_ERRORS) ||
  (process.env.NODE_ENV || "").toLowerCase() !== "production";

function toMySqlDateTime(input) {
  if (!input) return null;

  // Already looks like "YYYY-MM-DD HH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(input)) {
    return input.length === 16 ? `${input}:00` : input;
  }

  // "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(input)) {
    const s = input.replace("T", " ");
    return s.length === 16 ? `${s}:00` : s;
  }

  // ISO with Z (or any parseable date)
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// Accepts frontend labels and returns DB enum
function normalizeServiceType(raw) {
  const s = String(raw || "").trim().toLowerCase();

  // Already enum values
  if (["overnight", "walk", "dropin", "daycare"].includes(s)) return s;

  // Common frontend labels
  if (s.includes("overnight")) return "overnight";
  if (s.includes("drop")) return "dropin";
  if (s.includes("walk")) return "walk";
  if (s.includes("daycare")) return "daycare";

  // Extra fallbacks
  if (s === "sitting") return "overnight";
  if (s === "drop-in" || s === "drop in") return "dropin";
  if (s === "dog walking") return "walk";
  if (s === "doggy daycare") return "daycare";

  return null;
}

async function getTableType(tableName) {
  const dbName =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE_NAME ||
    null;

  if (!dbName) return null;

  const [rows] = await pool.query(
    `
    SELECT TABLE_TYPE AS table_type
    FROM information_schema.tables
    WHERE table_schema = ? AND table_name = ?
    LIMIT 1
    `,
    [dbName, tableName]
  );

  return rows[0]?.table_type || null; // 'BASE TABLE' or 'VIEW'
}

async function getTableColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((r) => r.Field);
}

async function safeEnsureMinimalTables() {
  // We won’t hard-fail startup if these fail (Railway perms / existing schema differences).
  try {
    // bookings (minimal schema that matches your code)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        client_id BIGINT UNSIGNED NOT NULL,
        sitter_id BIGINT UNSIGNED NOT NULL,
        pet_id BIGINT UNSIGNED NULL,
        service_type ENUM('overnight','walk','dropin','daycare') NOT NULL,
        status ENUM('pending','accepted','completed','cancelled') NOT NULL DEFAULT 'pending',
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        start_datetime DATETIME NULL,
        end_datetime DATETIME NULL,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_total DECIMAL(10,2) NULL,
        location VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_client_id (client_id),
        KEY idx_sitter_id (sitter_id),
        KEY idx_start_time (start_time)
      )
    `);
  } catch (e) {
    console.warn("[ensure] bookings create skipped:", e.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mr_transactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        booking_id BIGINT UNSIGNED NOT NULL,
        client_id BIGINT UNSIGNED NOT NULL,
        sitter_id BIGINT UNSIGNED NOT NULL,
        receipt_number VARCHAR(64) NOT NULL,
        transaction_type VARCHAR(32) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        payment_method VARCHAR(32) NOT NULL DEFAULT 'card',
        status VARCHAR(32) NOT NULL DEFAULT 'paid',
        description VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_booking_id (booking_id),
        KEY idx_client_id (client_id),
        KEY idx_sitter_id (sitter_id),
        KEY idx_receipt (receipt_number)
      )
    `);
  } catch (e) {
    console.warn("[ensure] mr_transactions create skipped:", e.message);
  }

  // admin_receipts might currently be a VIEW (yours is!)
  // If it's a VIEW, we create a real table under a different name and insert there.
  try {
    const t = await getTableType("admin_receipts");
    if (t && t.toUpperCase() === "VIEW") {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_receipts_table (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          transaction_id BIGINT UNSIGNED NULL,
          receipt_number VARCHAR(64) NOT NULL,
          transaction_type VARCHAR(32) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          payment_status VARCHAR(32) NOT NULL,
          payment_method VARCHAR(32) NOT NULL,
          booking_id BIGINT UNSIGNED NOT NULL,
          service_type VARCHAR(32) NOT NULL,
          booking_status VARCHAR(32) NOT NULL,
          client_email VARCHAR(255) NULL,
          sitter_email VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_booking_id (booking_id),
          KEY idx_transaction_id (transaction_id),
          KEY idx_receipt_number (receipt_number)
        )
      `);
      console.warn(
        "[ensure] admin_receipts is a VIEW. Using admin_receipts_table instead."
      );
    } else {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_receipts (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          transaction_id BIGINT UNSIGNED NULL,
          receipt_number VARCHAR(64) NOT NULL,
          transaction_type VARCHAR(32) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          payment_status VARCHAR(32) NOT NULL,
          payment_method VARCHAR(32) NOT NULL,
          booking_id BIGINT UNSIGNED NOT NULL,
          service_type VARCHAR(32) NOT NULL,
          booking_status VARCHAR(32) NOT NULL,
          client_email VARCHAR(255) NULL,
          sitter_email VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_booking_id (booking_id),
          KEY idx_transaction_id (transaction_id),
          KEY idx_receipt_number (receipt_number)
        )
      `);
    }
  } catch (e) {
    console.warn("[ensure] admin_receipts create skipped:", e.message);
  }
}

// kick off best-effort schema creation
safeEnsureMinimalTables().catch((e) =>
  console.warn("[ensure] failed:", e.message)
);

// Helper to generate a simple receipt number like MR-2025-00001
function makeReceiptNumber(bookingId) {
  const year = new Date().getFullYear();
  const padded = String(bookingId).padStart(5, "0");
  return `MR-${year}-${padded}`;
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
      "/bookings",
      "/payments/create-checkout-session"
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

// DB DEBUG
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
      const p = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      routes.push({ methods, path: p });
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
      return res
        .status(400)
        .json({ error: "Temp password must be at least 6 characters." });
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
        return res
          .status(400)
          .json({ error: "Temp password must be at least 6 characters." });
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

app.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, full_name, phone } = req.body || {};

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

    let newFirst = current.first_name || "";
    let newLast = current.last_name || "";

    if (typeof first_name === "string") newFirst = first_name.trim();
    if (typeof last_name === "string") newLast = last_name.trim();

    // Legacy support for full_name-only updates
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

    // If nothing changed, just return current
    if (
      newFirst === (current.first_name || "") &&
      newLast === (current.last_name || "") &&
      (newPhone || null) === (current.phone || null)
    ) {
      const full_name_response = `${current.first_name || ""} ${
        current.last_name || ""
      }`.trim();

      return res.json({
        ok: true,
        user: {
          ...current,
          full_name: full_name_response
        }
      });
    }

    await pool.query(
      `UPDATE users
         SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newFirst, newLast, newPhone, userId]
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
         avatar_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const updated = updatedRows[0];
    const full_name_response = `${updated.first_name || ""} ${
      updated.last_name || ""
    }`.trim();

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
// LIST SITTERS
// =====================
app.get("/api/sitters", async (req, res) => {
  try {
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
       WHERE role = 'sitter'`
    );

    const sitters = rows.map((row) => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
      email: row.email,
      role: row.role,
      phone: row.phone,
      is_active: row.is_active,
      avatar_url: row.avatar_url
    }));

    res.json({ ok: true, sitters });
  } catch (err) {
    console.error("SITTERS_LIST_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to load sitters." });
  }
});

// =====================
// PUP GALLERY ROUTES
// =====================
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

app.post("/gallery/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Invalid post id." });
    }

    const { author_name, body } = req.body || {};
    if (!body || !body.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Comment body is required."
      });
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
// STRIPE: create PaymentIntent (test mode)
// =====================
app.post("/stripe/create-payment-intent", async (req, res) => {
  if (!stripe) {
    return res
      .status(500)
      .json({ error: "Stripe is not configured on this server." });
  }

  try {
    const { amount, currency = "usd", description } = req.body || {};

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res
        .status(400)
        .json({ error: "Amount (in cents) is required and must be > 0." });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountNumber),
      currency,
      description: description || "PetCare booking",
      automatic_payment_methods: { enabled: true }
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error("STRIPE_PAYMENT_INTENT_ERROR:", err);
    return res.status(500).json({ error: "Failed to create payment." });
  }
});

// =====================
// STRIPE CHECKOUT ROUTE
// =====================
app.post("/payments/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      ok: false,
      error: "Stripe not configured on server."
    });
  }

  try {
    const {
      client_id,
      sitter_id,
      service_type = "Pet sitting",
      price_total,
      currency = "usd",
      success_url,
      cancel_url
    } = req.body || {};

    const price = Number(price_total);
    if (!client_id || !sitter_id || !price || price <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid fields (client_id, sitter_id, price_total)."
      });
    }

    const amountInCents = Math.round(price * 100);

    const frontendBase =
      process.env.FRONTEND_BASE_URL || "http://localhost:5500/home-sitter-app";

    const successUrlFinal =
      success_url || `${frontendBase}/index.html?checkout=success`;
    const cancelUrlFinal =
      cancel_url || `${frontendBase}/index.html?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountInCents,
            product_data: {
              name: `AnimalSitter – ${service_type}`,
              metadata: {
                sitter_id: String(sitter_id),
                client_id: String(client_id)
              }
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        sitter_id: String(sitter_id),
        client_id: String(client_id),
        service_type
      },
      success_url: successUrlFinal,
      cancel_url: cancelUrlFinal
    });

    res.json({
      ok: true,
      checkout_session_id: session.id,
      url: session.url
    });
  } catch (err) {
    console.error("STRIPE_CHECKOUT_ERROR:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to create checkout session."
    });
  }
});

// =====================
// BOOKINGS
// =====================
app.get("/bookings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role || "client";

    let whereClause = "";
    let params = [];

    if (role === "sitter") {
      whereClause = "WHERE b.sitter_id = ?";
      params = [userId];
    } else if (role === "client") {
      whereClause = "WHERE b.client_id = ?";
      params = [userId];
    } else {
      whereClause = "";
      params = [];
    }

    const [rows] = await pool.query(
      `
      SELECT
        b.id,
        b.client_id,
        b.sitter_id,
        b.pet_id,
        b.service_type,
        b.status,
        b.start_time,
        b.end_time,
        b.total_price,
        b.location,
        b.notes,
        b.created_at,
        c.first_name AS client_first_name,
        c.last_name AS client_last_name,
        s.first_name AS sitter_first_name,
        s.last_name AS sitter_last_name
      FROM bookings b
      LEFT JOIN users c ON b.client_id = c.id
      LEFT JOIN users s ON b.sitter_id = s.id
      ${whereClause}
      ORDER BY b.start_time DESC, b.id DESC
      `,
      params
    );

    const bookings = rows.map((row) => {
      const clientName = `${row.client_first_name || ""} ${
        row.client_last_name || ""
      }`.trim();
      const sitterName = `${row.sitter_first_name || ""} ${
        row.sitter_last_name || ""
      }`.trim();

      return {
        id: row.id,
        client_id: row.client_id,
        sitter_id: row.sitter_id,
        pet_id: row.pet_id,
        service_type: row.service_type,
        status: row.status,
        start_time: row.start_time,
        end_time: row.end_time,
        total_price: row.total_price,
        location: row.location,
        notes: row.notes,
        created_at: row.created_at,
        client_name: clientName,
        sitter_name: sitterName
      };
    });

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error("BOOKINGS_LIST_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to load bookings." });
  }
});

app.post("/bookings", async (req, res) => {
  const warnings = [];

  try {
    const body = req.body || {};

    // Accept both naming styles (frontend sometimes changes)
    const client_id = body.client_id ?? body.clientId ?? null;
    const sitter_id = body.sitter_id ?? body.sitterId ?? null;
    const pet_id = body.pet_id ?? body.petId ?? null;

    const rawService = body.service_type ?? body.serviceType ?? body.service ?? null;
    const service_type = normalizeServiceType(rawService);

    // Accept either start/end or date + start/end times
    const rawStart =
      body.start_time ??
      body.startTime ??
      body.start_datetime ??
      null;

    const rawEnd =
      body.end_time ??
      body.endTime ??
      body.end_datetime ??
      null;

    const date = body.date ?? body.bookingDate ?? null;
    const startClock = body.start ?? body.bookingStart ?? null;
    const endClock = body.end ?? body.bookingEnd ?? null;

    let start_time = toMySqlDateTime(rawStart);
    let end_time = toMySqlDateTime(rawEnd);

    if ((!start_time || !end_time) && date && startClock && endClock) {
      start_time = toMySqlDateTime(`${date}T${startClock}`);
      end_time = toMySqlDateTime(`${date}T${endClock}`);
    }

    const location = body.location ?? body.bookingLocation ?? null;
    const notes = body.notes ?? body.bookingPetNotes ?? null;

    const price_total =
      body.price_total ??
      body.total_price ??
      body.price ??
      body.amount ??
      null;

    if (!client_id || !sitter_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields (client_id, sitter_id)."
      });
    }

    if (!service_type) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid service_type. Use overnight / walk / dropin / daycare (or the normal labels like 'Dog walking')."
      });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields (start_time, end_time)."
      });
    }

    const price = Number(price_total);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid price_total." });
    }

    const platformFee = parseFloat((price * COMMISSION_RATE).toFixed(2));
    const sitterPayout = parseFloat((price - platformFee).toFixed(2));

    // Make sure tables exist (best-effort)
    await safeEnsureMinimalTables().catch(() => {});

    // Insert booking using only columns that exist
    let bookingColumns = [];
    try {
      bookingColumns = await getTableColumns("bookings");
    } catch (e) {
      // bookings table truly missing / perms
      return res.status(500).json({
        ok: false,
        error: "Bookings table not available in DB.",
        ...(DEBUG_ERRORS
          ? { debug: { message: e.message, code: e.code, sqlMessage: e.sqlMessage } }
          : {})
      });
    }

    const bookingRow = {
      client_id,
      sitter_id,
      pet_id: pet_id || null,
      service_type,
      status: "accepted",
      start_time,
      end_time,
      start_datetime: start_time,
      end_datetime: end_time,
      total_price: price,
      price_total: price,
      location: location || null,
      notes: notes || null
    };

    const insertKeys = Object.keys(bookingRow).filter((k) =>
      bookingColumns.includes(k)
    );
    const insertVals = insertKeys.map((k) => bookingRow[k]);

    const [bookingResult] = await pool.query(
      `INSERT INTO bookings (${insertKeys.map((k) => `\`${k}\``).join(", ")})
       VALUES (${insertKeys.map(() => "?").join(", ")})`,
      insertVals
    );

    const bookingId = bookingResult.insertId;

    // Emails (optional)
    let clientEmail = null;
    let sitterEmail = null;
    try {
      const [clientRows] = await pool.query("SELECT email FROM users WHERE id = ?", [
        client_id
      ]);
      clientEmail = clientRows[0]?.email || null;
    } catch (e) {
      warnings.push("Could not lookup client email.");
    }

    try {
      const [sitterRows] = await pool.query("SELECT email FROM users WHERE id = ?", [
        sitter_id
      ]);
      sitterEmail = sitterRows[0]?.email || null;
    } catch (e) {
      warnings.push("Could not lookup sitter email.");
    }

    const receiptNumber = makeReceiptNumber(bookingId);

    // Transaction insert (best-effort)
    let transactionId = null;
    try {
      const currency = String(body.currency || "USD").toUpperCase();
      const payment_method = String(body.payment_method || "card");
      const description = notes || "Booking charge";

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
          description
        ]
      );
      transactionId = txResult.insertId;
    } catch (e) {
      console.warn("mr_transactions insert failed:", e.message);
      warnings.push("Transaction record was not saved (mr_transactions).");
    }

    // Admin receipt insert (best-effort) — handles admin_receipts being a VIEW
    try {
      const currency = String(body.currency || "USD").toUpperCase();
      const payment_method = String(body.payment_method || "card");

      const t = await getTableType("admin_receipts").catch(() => null);
      const receiptsTable =
        t && String(t).toUpperCase() === "VIEW"
          ? "admin_receipts_table"
          : "admin_receipts";

      await pool.query(
        `INSERT INTO \`${receiptsTable}\`
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
          platformFee,
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
    } catch (e) {
      console.warn("admin_receipts insert failed:", e.message);
      warnings.push(
        "Admin receipt was not saved (admin_receipts is likely a VIEW or schema mismatch)."
      );
    }

    return res.status(201).json({
      ok: true,
      booking_id: bookingId,
      client_id,
      sitter_id,
      service_type,
      start_time,
      end_time,
      total_price: price,
      commission_rate: COMMISSION_RATE,
      platform_fee: platformFee,
      sitter_payout: sitterPayout,
      receipt_number: receiptNumber,
      transaction_id: transactionId,
      warnings
    });
  } catch (err) {
    console.error("BOOKING_CREATE_ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to create booking.",
      ...(DEBUG_ERRORS
        ? {
            debug: {
              message: err.message,
              code: err.code,
              errno: err.errno,
              sqlState: err.sqlState,
              sqlMessage: err.sqlMessage
            }
          }
        : {})
    });
  }
});

// =====================
// 404 + error handlers
// =====================
app.use((req, res, next) => {
  if (res.headersSent) return next();
  console.warn("404 Not Found:", req.method, req.url);
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.url
  });
});

app.use((err, req, res, next) => {
  console.error("UNHANDLED_ERROR:", err);

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