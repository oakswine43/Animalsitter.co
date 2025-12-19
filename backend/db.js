// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log("[DB] Creating pool with:", {
  host: config.host,
  port: config.port,
  user: config.user,
  database: config.database
});

const pool = mysql.createPool(config);

module.exports = pool;