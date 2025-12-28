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
app.locals.stripe = stripe;

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
  limits: { fileSize: 8 * 1024 * 1024 },
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
function normalizeServiceType(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const v = raw.toLowerCase();

  // allow short enums
  if (["overnight", "walk", "dropin", "daycare"].includes(v)) return v;

  // allow common labels
  if (v.includes("overnight")) return "overnight";
  if (v.includes("drop")) return "dropin";
  if (v.includes("walk")) return "walk";
  if (v.includes("daycare") || v.includes("day care")) return "daycare";

  return null;
}

function toMySqlDateTime(value) {
  // accepts ISO string or "YYYY-MM-DDTHH:mm"
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// cache table columns so we can safely INSERT even if schema differs
const TABLE_COL_CACHE = new Map();

async function getTableColumns(tableName) {
  if (TABLE_COL_CACHE.has(tableName)) return TABLE_COL_CACHE.get(tableName);

  const db =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    null;

  if (!db) {
    // fallback: still attempt without filtering
    const cols = null;
    TABLE_COL_CACHE.set(tableName, cols);
    return cols;
  }

  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `,
    [db, tableName]
  );

  const cols = new Set(rows.map((r) => r.COLUMN_NAME));
  TABLE_COL_CACHE.set(tableName, cols);
  return cols;
}

function filterInsertObjectByColumns(obj, colSet) {
  if (!colSet) return obj; // no filtering
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (colSet.has(k)) out[k] = v;
  }
  return out;
}

async function safeInsert(table, dataObj) {
  const colSet = await getTableColumns(table);
  const filtered = filterInsertObjectByColumns(dataObj, colSet);

  const keys = Object.keys(filtered);
  if (!keys.length) {
    throw new Error(`No matching columns found for table ${table}.`);
  }

  const colsSql = keys.map((k) => `\`${k}\``).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => filtered[k]);

  const [result] = await pool.query(
    `INSERT INTO \`${table}\` (${colsSql}) VALUES (${placeholders})`,
    values
  );
  return result;
}

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
      "/stripe/create-payment-intent",
      "/payments/create-checkout-session"
    ]
  });
});

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
// ADMIN: reset password
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
// Auth routes
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

app.post("/profile/photo", authMiddleware, upload.single("photo"), async (req, res) => {
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
});

// =====================
// SITTERS LIST
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
// GALLERY ROUTES
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
// STRIPE: PaymentIntent
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
      return res.status(400).json({
        error: "Amount (in cents) is required and must be > 0."
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountNumber),
      currency,
      description: description || "AnimalSitter booking",
      automatic_payment_methods: { enabled: true }
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    console.error("STRIPE_PAYMENT_INTENT_ERROR:", err);
    return res
      .status(500)
      .json({ error: "Failed to create payment. Please try again." });
  }
});

// =====================
// STRIPE CHECKOUT
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
        error:
          "Missing or invalid fields (client_id, sitter_id, price_total)."
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

    // Try a “safe” select: if your schema differs, adjust later
    const [rows] = await pool.query(
      `
      SELECT
        b.*,
        c.first_name AS client_first_name,
        c.last_name AS client_last_name,
        s.first_name AS sitter_first_name,
        s.last_name AS sitter_last_name
      FROM bookings b
      LEFT JOIN users c ON b.client_id = c.id
      LEFT JOIN users s ON b.sitter_id = s.id
      ${whereClause}
      ORDER BY b.id DESC
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
        ...row,
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
      currency = "USD",
      payment_intent_id = null
    } = req.body || {};

    if (!client_id || !sitter_id || !service_type || !start_time || !end_time) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing required fields (client_id, sitter_id, service_type, start_time, end_time)."
      });
    }

    const normalizedService = normalizeServiceType(service_type);
    if (!normalizedService) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid service_type. Use overnight / walk / dropin / daycare (or the normal labels like 'Dog walking')."
      });
    }

    const startDT = toMySqlDateTime(start_time);
    const endDT = toMySqlDateTime(end_time);
    if (!startDT || !endDT) {
      return res.status(400).json({
        ok: false,
        error: "Invalid start_time or end_time. Use ISO date/time."
      });
    }

    const price = Number(price_total);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid price_total." });
    }

    const platformFee = parseFloat((price * COMMISSION_RATE).toFixed(2));
    const sitterPayout = parseFloat((price - platformFee).toFixed(2));

    // ---- Insert booking (safe against schema mismatches) ----
    const bookingInsert = {
      client_id: Number(client_id),
      sitter_id: Number(sitter_id),
      pet_id: pet_id ? Number(pet_id) : null,
      service_type: normalizedService,
      status: "accepted",
      start_time: startDT,
      end_time: endDT,
      location: location || null,
      notes: notes || null,
      price_total: price,
      total_price: price,
      currency: currency || "USD",
      payment_method: payment_method || "card",
      payment_intent_id: payment_intent_id || null
    };

    const bookingResult = await safeInsert("bookings", bookingInsert);
    const bookingId = bookingResult.insertId;

    // ---- Optional receipts/transactions (don’t fail booking if missing tables) ----
    try {
      const [clientRows] = await pool.query("SELECT email FROM users WHERE id = ?", [
        client_id
      ]);
      const clientEmail = clientRows[0]?.email || null;

      const [sitterRows] = await pool.query("SELECT email FROM users WHERE id = ?", [
        sitter_id
      ]);
      const sitterEmail = sitterRows[0]?.email || null;

      const receiptNumber = makeReceiptNumber(bookingId);

      // mr_transactions (safe insert)
      let transactionId = null;
      try {
        const txResult = await safeInsert("mr_transactions", {
          booking_id: bookingId,
          client_id: Number(client_id),
          sitter_id: Number(sitter_id),
          receipt_number: receiptNumber,
          transaction_type: "CHARGE",
          amount: price,
          currency: currency,
          payment_method: payment_method,
          status: "paid",
          description: notes || "Booking charge",
          payment_intent_id: payment_intent_id || null
        });
        transactionId = txResult.insertId;
      } catch (e) {
        console.warn("mr_transactions insert skipped:", e.message);
      }

      // admin_receipts (safe insert)
      try {
        await safeInsert("admin_receipts", {
          transaction_id: transactionId,
          receipt_number: receiptNumber,
          transaction_type: "CHARGE",
          amount: platformFee,
          currency: currency,
          payment_status: "paid",
          payment_method: payment_method,
          booking_id: bookingId,
          service_type: normalizedService,
          booking_status: "accepted",
          client_email: clientEmail,
          sitter_email: sitterEmail
        });
      } catch (e) {
        console.warn("admin_receipts insert skipped:", e.message);
      }
    } catch (e) {
      console.warn("Receipt pipeline skipped:", e.message);
    }

    res.status(201).json({
      ok: true,
      booking_id: bookingId,
      client_id,
      sitter_id,
      service_type: normalizedService,
      total_price: price,
      commission_rate: COMMISSION_RATE,
      platform_fee: platformFee,
      sitter_payout: sitterPayout,
      payment_intent_id: payment_intent_id || null
    });
  } catch (err) {
    console.error("BOOKING_CREATE_ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to create booking." });
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