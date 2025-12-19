// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

// Detect if we're running on Railway (or any env that exposes MYSQLHOST)
const isRailway =
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.MYSQLHOST ||
  !!process.env.MYSQLHOSTNAME;

// Build config with both your custom DB_* vars and Railway's MYSQL* fallbacks
const config = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || "127.0.0.1",
  user: process.env.DB_USER || process.env.MYSQLUSER || "root",
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
  database:
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    "petcareportaldb",
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Railway MySQL usually needs SSL with relaxed cert checking
if (isRailway) {
  config.ssl = {
    rejectUnauthorized: false
  };
}

console.log("[DB] Creating pool with:", {
  host: config.host,
  port: config.port,
  user: config.user,
  database: config.database,
  isRailway
});

const pool = mysql.createPool(config);

module.exports = pool;