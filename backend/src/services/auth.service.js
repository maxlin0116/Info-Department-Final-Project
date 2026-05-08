const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_SECRET = process.env.JWT_SECRET || "development-only-secret";
const JWT_EXPIRES_IN = "7d";

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializeUser(user) {
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
    role: source.role,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function issueToken(user) {
  return jwt.sign(
    {
      id: String(user._id),
      studentId: user.studentId,
      role: user.role,
    },
    JWT_SECRET,
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

exports.loginUser = async (studentId, password) => {
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

  return {
    token: issueToken(user),
    user: serializeUser(user),
  };
};
