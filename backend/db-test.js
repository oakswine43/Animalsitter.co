require("dotenv").config();
const mysql = require("mysql2/promise");

console.log("=== DB TEST START ===");
console.log("HOST:", process.env.DB_HOST);
console.log("USER:", process.env.DB_USER);
console.log("DB  :", process.env.DB_NAME);
console.log("PORT:", process.env.DB_PORT);

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306)
    });

    const [rows] = await conn.query("SELECT NOW() AS now, DATABASE() AS db");
    console.log("✅ DB OK:", rows[0]);

    await conn.end();
    console.log("=== DB TEST END ===");
    process.exit(0);
  } catch (e) {
    console.log("❌ DB FAIL CODE:", e.code);
    console.log("❌ DB FAIL MSG :", e.message);
    process.exit(1);
  }
})();
