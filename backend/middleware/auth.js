// backend/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (!token || (scheme && scheme.toLowerCase() !== "bearer")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header." });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    );

    // decoded should include { id, email, role }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error("AUTH_MIDDLEWARE_VERIFY_ERROR:", err);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};
