exports.register = (req, res) => {
  res.json({ message: "Register endpoint" });
};

exports.login = (req, res) => {
  res.json({ message: "Login endpoint" });
};

exports.logout = (req, res) => {
  res.json({ message: "Logout endpoint" });
};

exports.me = (req, res) => {
  res.json({ message: "Current user endpoint" });
};
