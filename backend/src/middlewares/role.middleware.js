function requireRole() {
  return function roleMiddleware(req, res, next) {
    next();
  };
}

module.exports = requireRole;
