const authService = require("../services/auth.service");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (req, res, next) => {
  try {
    const name = req.body.name;
    const grade = req.body.grade;
    const studentId = req.body.studentId ?? req.body.student_id;
    const password = req.body.password;
    const personalEmail = req.body.personalEmail ?? req.body.personal_email;

    if (!name || !grade || !studentId || !password || !personalEmail) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!emailRegex.test(personalEmail)) {
      return res.status(400).json({ error: "Invalid email format. Please check for missing @ or ." });
    }

    const result = await authService.registerUser({
      name,
      grade,
      studentId,
      password,
      personalEmail,
    });

    res.status(201).json({ message: "Registration successful", ...result });
  } catch (error) {
    next(error);
  }
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
