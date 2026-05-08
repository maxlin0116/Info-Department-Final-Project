const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_EXPIRES_IN = "7d";

function getJwtSecret() {
  return process.env.JWT_SECRET || "development-only-secret";
}

function getAdminAccessPassword() {
  return process.env.ADMIN_ACCESS_PASSWORD?.trim() || "";
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializeUser(user, roleOverride) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: String(source._id ?? source.id),
    name: source.name,
    grade: source.grade,
    studentId: source.studentId,
    personalEmail: source.personalEmail,
    role: roleOverride ?? source.role,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function issueToken(user, roleOverride) {
  const effectiveRole = roleOverride ?? user.role;

  return jwt.sign(
    {
      id: String(user._id),
      studentId: user.studentId,
      role: effectiveRole,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

exports.serializeUser = serializeUser;

exports.registerUser = async (userData) => {
  const name = userData.name?.trim();
  const grade = userData.grade?.trim();
  const studentId = userData.studentId?.trim();
  const password = userData.password;
  const personalEmail = userData.personalEmail?.trim().toLowerCase();

  if (!name || !grade || !studentId || !password || !personalEmail) {
    throw createError(400, "All fields are required");
  }

  const existingUser = await User.findOne({ studentId });
  if (existingUser) {
    throw createError(409, "This student ID is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    grade,
    studentId,
    passwordHash,
    personalEmail,
    role: "user",
  });

  return {
    token: issueToken(user),
    user: serializeUser(user),
  };
};

exports.loginUser = async (studentId, password, options = {}) => {
  const normalizedStudentId = studentId?.trim();
  if (!normalizedStudentId || !password) {
    throw createError(400, "Please provide student ID and password");
  }

  const user = await User.findOne({ studentId: normalizedStudentId });
  if (!user) {
    throw createError(401, "Invalid student ID or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createError(401, "Invalid student ID or password");
  }

  let sessionRole = user.role;

  if (options.asAdmin) {
    const providedAdminPassword = options.adminPassword?.trim();
    const configuredAdminPassword = getAdminAccessPassword();

    if (!providedAdminPassword) {
      throw createError(400, "Please provide the admin access password");
    }

    if (!configuredAdminPassword) {
      throw createError(500, "Admin access password is not configured on the server");
    }

    if (providedAdminPassword !== configuredAdminPassword) {
      throw createError(403, "Invalid admin access password");
    }

    sessionRole = "admin";
  }

  return {
    token: issueToken(user, sessionRole),
    user: serializeUser(user, sessionRole),
  };
};
