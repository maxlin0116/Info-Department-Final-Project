const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Reservation = require("../models/reservation.model");

const STUDENT_ID_REGEX = /^[a-zA-Z]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateTemporaryPassword(length = 10) {
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    pwd += charset[randomIndex];
  }
  return pwd;
}

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
    mustChangePassword: Boolean(source.mustChangePassword),
    isActive: source.isActive !== false,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function serializeArea(area) {
  if (!area) {
    return null;
  }

  return {
    id: String(area._id ?? area.id),
    name: area.name,
    type: area.type,
    bookingMode: area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule"),
    serviceType: area.serviceType || (area.type === "heavy_processing" ? "laser" : area.type),
    maxCapacity: area.maxCapacity,
    description: area.description,
    showPrintingStatus: area.showPrintingStatus,
    isActive: area.isActive,
  };
}

function serializeReservation(reservation) {
  const source = typeof reservation.toObject === "function" ? reservation.toObject() : reservation;

  return {
    id: String(source._id ?? source.id),
    user:
      source.user && typeof source.user === "object" && source.user !== null && !Array.isArray(source.user)
        ? serializeUser(source.user)
        : String(source.user),
    area:
      source.area && typeof source.area === "object" && source.area !== null && !Array.isArray(source.area)
        ? serializeArea(source.area)
        : String(source.area),
    purpose: source.purpose,
    plannedItems: Array.isArray(source.plannedItems) ? source.plannedItems : [],
    participantCount: source.participantCount,
    when2meet: source.when2meet ?? "",
    project: source.project ?? "",
    startTime: source.startTime,
    endTime: source.endTime,
    status: source.status,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

exports.getAllUsers = async () => {
  const users = await User.find().sort({ createdAt: 1 }).lean();
  return users.map(serializeUser);
};

exports.createUser = async ({ name, grade, studentId, personalEmail, role = "user", password }) => {
  const trimmedName = name?.trim();
  const trimmedGrade = grade?.trim();
  const trimmedStudentId = studentId?.trim();
  const trimmedEmail = personalEmail?.trim().toLowerCase();

  if (!trimmedName || !trimmedGrade || !trimmedStudentId || !trimmedEmail) {
    throw createError(400, "Name, grade, student ID, and email are required");
  }

  if (!STUDENT_ID_REGEX.test(trimmedStudentId)) {
    throw createError(400, "Student ID must be one letter followed by 8 digits");
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    throw createError(400, "Invalid email address format");
  }

  if (!["admin", "user"].includes(role)) {
    throw createError(400, "Invalid user role");
  }

  const existingUser = await User.findOne({ studentId: trimmedStudentId });
  if (existingUser) {
    throw createError(409, "A user with this student ID already exists");
  }

  const temporaryPassword = password?.trim() || generateTemporaryPassword(10);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const newUser = await User.create({
    name: trimmedName,
    grade: trimmedGrade,
    studentId: trimmedStudentId,
    personalEmail: trimmedEmail,
    role,
    passwordHash,
    mustChangePassword: true,
    isActive: true,
  });

  return {
    user: serializeUser(newUser),
    temporaryPassword,
  };
};

exports.resetUserPassword = async (userId, customPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createError(404, "User not found");
  }

  const temporaryPassword = customPassword?.trim() || generateTemporaryPassword(10);
  user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
  user.mustChangePassword = true;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  return {
    user: serializeUser(user),
    temporaryPassword,
  };
};

exports.updateUserStatus = async (userId, isActive) => {
  if (typeof isActive !== "boolean") {
    throw createError(400, "isActive must be a boolean");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive },
    { new: true }
  ).lean();

  if (!user) {
    throw createError(404, "User not found");
  }

  return serializeUser(user);
};

exports.updateUserRole = async (userId, role) => {
  if (!["admin", "user"].includes(role)) {
    throw createError(400, "Invalid user role");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).lean();

  if (!updatedUser) {
    throw createError(404, "User not found");
  }

  return serializeUser(updatedUser);
};

exports.deleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createError(404, "User not found");
  }

  // Check for active reservations
  const activeReservationsCount = await Reservation.countDocuments({
    user: userId,
    status: { $in: ["pending", "approved"] },
  });

  if (activeReservationsCount > 0) {
    throw createError(
      400,
      `Cannot delete user: user has ${activeReservationsCount} active or pending reservation(s). Please cancel reservations or suspend the account instead.`
    );
  }

  await User.findByIdAndDelete(userId);
  return { message: "User deleted successfully" };
};

exports.getPendingReservations = async () => {
  const reservations = await Reservation.find({ status: "pending" })
    .populate("user")
    .populate("area")
    .sort({ startTime: 1, createdAt: 1 })
    .lean();

  return reservations.map(serializeReservation);
};
