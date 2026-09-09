const authService = require("../services/auth.service");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (_req, res) => {
  return res.status(403).json({
    error: "Public registration is disabled. Accounts are centrally assigned by MakerSpace administration."
  });
};

exports.login = async (req, res, next) => {
  try {
    const studentId = req.body.studentId ?? req.body.student_id;
    const password = req.body.password;
    const asAdmin = req.body.asAdmin === true;
    const adminPassword = req.body.adminPassword ?? req.body.admin_password;

    if (!studentId || !password) {
      return res.status(400).json({ error: "Please provide student ID and password" });
    }

    const result = await authService.loginUser(studentId, password, {
      asAdmin,
      adminPassword,
    });
    res.status(200).json({ message: "Login successful", ...result });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (_req, res, next) => {
  try {
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.status(200).json({ user: req.user });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentPassword = req.body.currentPassword ?? req.body.current_password;
    const newPassword = req.body.newPassword ?? req.body.new_password;

    const user = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json({ message: "Password updated successfully", user });
  } catch (error) {
    next(error);
  }
};

exports.requestPasswordReset = async (req, res, next) => {
  try {
    const identifier = req.body.identifier ?? req.body.studentId ?? req.body.student_id ?? req.body.email;
    await authService.requestPasswordReset(identifier);

    res.status(200).json({
      message: "If the account exists, a password reset email has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

exports.validatePasswordReset = async (req, res, next) => {
  try {
    const token = req.query.token;
    const valid = await authService.validatePasswordResetToken(typeof token === "string" ? token : "");

    res.status(200).json({ valid });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const token = req.body.token;
    const newPassword = req.body.newPassword ?? req.body.new_password;
    const user = await authService.resetPasswordWithToken(token, newPassword);

    res.status(200).json({ message: "Password reset successfully", user });
  } catch (error) {
    next(error);
  }
};
