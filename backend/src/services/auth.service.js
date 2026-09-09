const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const mailService = require("./mail.service");

const JWT_EXPIRES_IN = "7d";
const STUDENT_ID_REGEX = /^[a-zA-Z]\d{8}$/;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }
  return secret;
}

function getAdminAccessPassword() {
  return process.env.ADMIN_ACCESS_PASSWORD?.trim() || "";
}

function getPasswordResetUrlBase() {
  const configuredBase =
    process.env.PASSWORD_RESET_URL_BASE?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    process.env.FRONTEND_ORIGINS?.split(",")[0]?.trim() ||
    "http://localhost:5173";

  return configuredBase.replace(/\/$/, "");
}

function getPasswordResetTokenTtlMinutes() {
  const parsed = Number.parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES;
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPasswordResetUrl(token) {
  return `${getPasswordResetUrlBase()}/reset-password?token=${encodeURIComponent(token)}`;
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
    mustChangePassword: Boolean(source.mustChangePassword),
    isActive: source.isActive !== false,
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

exports.registerUser = async () => {
  throw createError(
    403,
    "Public registration is disabled. Accounts are centrally assigned by MakerSpace administration."
  );
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

  if (user.isActive === false) {
    throw createError(403, "Account has been suspended. Please contact MakerSpace administration.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createError(401, "Invalid student ID or password");
  }

  let sessionRole = user.role;

  if (options.asAdmin && user.role !== "admin") {
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

exports.changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || typeof newPassword !== "string" || !newPassword.trim()) {
    throw createError(400, "Please provide current password and new password");
  }

  if (currentPassword === newPassword) {
    throw createError(400, "New password must be different from the current password");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError(404, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw createError(401, "Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();

  return serializeUser(user);
};

exports.requestPasswordReset = async (identifier) => {
  const normalizedIdentifier = identifier?.trim();
  if (!normalizedIdentifier) {
    throw createError(400, "Please provide student ID or email");
  }

  mailService.assertMailConfigured();

  const userQuery = normalizedIdentifier.includes("@")
    ? { personalEmail: normalizedIdentifier.toLowerCase() }
    : { studentId: normalizedIdentifier };
  const user = await User.findOne(userQuery);

  if (!user) {
    return;
  }

  const token = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
  const expiresMinutes = getPasswordResetTokenTtlMinutes();

  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  await user.save();

  try {
    await mailService.sendPasswordResetEmail({
      to: user.personalEmail,
      name: user.name,
      resetUrl: createPasswordResetUrl(token),
      expiresMinutes,
    });
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    throw error;
  }
};

exports.validatePasswordResetToken = async (token) => {
  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    return false;
  }

  const tokenHash = hashResetToken(normalizedToken);
  const user = await User.exists({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  });

  return Boolean(user);
};

exports.resetPasswordWithToken = async (token, newPassword) => {
  const normalizedToken = token?.trim();
  if (!normalizedToken || typeof newPassword !== "string" || !newPassword.trim()) {
    throw createError(400, "Please provide reset token and new password");
  }

  const tokenHash = hashResetToken(normalizedToken);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");

  if (!user) {
    throw createError(400, "Password reset link is invalid or expired");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.mustChangePassword = false;
  await user.save();

  return serializeUser(user);
};
