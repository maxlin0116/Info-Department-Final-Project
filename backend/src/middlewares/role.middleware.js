function requireRole(requiredRole) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ error: "You do not have permission to access this resource" });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
