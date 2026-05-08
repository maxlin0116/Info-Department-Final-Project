const User = require("../models/user.model");
const Reservation = require("../models/reservation.model");

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

function serializeArea(area) {
  if (!area) {
    return null;
  }

  return {
    id: String(area._id ?? area.id),
    name: area.name,
    type: area.type,
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

exports.getPendingReservations = async () => {
  const reservations = await Reservation.find({ status: "pending" })
    .populate("user")
    .populate("area")
    .sort({ startTime: 1, createdAt: 1 })
    .lean();

  return reservations.map(serializeReservation);
};
