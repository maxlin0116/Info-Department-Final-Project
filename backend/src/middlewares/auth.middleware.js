const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { serializeUser } = require("../services/auth.service");

function getJwtSecret() {
  return process.env.JWT_SECRET || "development-only-secret";
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

async function resolveUserFromToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  const user = await User.findById(payload.id);
  if (!user) {
    return null;
  }

  return serializeUser(user, payload.role);
}

async function authenticate(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.user = user;
    req.authToken = token;
    next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

async function optionalAuthenticate(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const user = await resolveUserFromToken(token);
    if (user) {
      req.user = user;
      req.authToken = token;
    }
  } catch (_error) {
    req.user = undefined;
  }

  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
};
