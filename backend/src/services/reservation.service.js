const Reservation = require("../models/reservation.model");
const Area = require("../models/area.model");

const VALID_TIME_BLOCKS = [
  { start: 10 * 60, end: 12 * 60 },
  { start: 13 * 60 + 20, end: 15 * 60 + 10 },
  { start: 15 * 60 + 30, end: 17 * 60 + 20 },
  { start: 18 * 60, end: 22 * 60 },
];

const ACTIVE_STATUSES = ["approved", "pending"];

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(400, "Invalid " + fieldName + ". Please provide a valid date/time.");
  }

  return date;
}

function isWithinOpeningHours(startTime, endTime) {
  if (endTime <= startTime) {
    return false;
  }

  if (startTime.getDay() === 0 || startTime.getDay() === 6) {
    return false;
  }

  if (startTime.toDateString() !== endTime.toDateString()) {
    return false;
  }

  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

  return VALID_TIME_BLOCKS.some((block) => startMinutes >= block.start && endMinutes <= block.end);
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

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id ?? user.id),
    name: user.name,
    grade: user.grade,
    role: user.role,
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

async function getOverlappingParticipantCount(areaId, startTime, endTime, excludeReservationId) {
  const query = {
    area: areaId,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const overlappingReservations = await Reservation.find(query).select("participantCount").lean();

  return overlappingReservations.reduce((total, reservation) => total + reservation.participantCount, 0);
}

async function validateReservationWindow(area, startTime, endTime, participantCount, excludeReservationId) {
  if (!area) {
    throw createError(404, "Requested reservation area not found");
  }

  if (!area.isActive) {
    throw createError(400, "This area is currently unavailable for reservations");
  }

  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw createError(400, "Participant count must be at least 1");
  }

  if (participantCount > area.maxCapacity) {
    throw createError(400, "This area can only host up to " + area.maxCapacity + " participant(s).");
  }

  if (!isWithinOpeningHours(startTime, endTime)) {
    throw createError(400, "Reservation failed. The requested time falls outside opening hours, during a break, or on a weekend.");
  }

  if (startTime < new Date()) {
    throw createError(400, "Reservation failed. Cannot make a reservation for a past time.");
  }

  const currentUsedCount = await getOverlappingParticipantCount(area._id, startTime, endTime, excludeReservationId);
  const remainingCapacity = area.maxCapacity - currentUsedCount;

  if (currentUsedCount + participantCount > area.maxCapacity) {
    throw createError(409, "Reservation failed. Only " + Math.max(remainingCapacity, 0) + " spot(s) remain available during this time slot.");
  }
}

exports.getAllReservations = async () => {
  const reservations = await Reservation.find()
    .populate("user")
    .populate("area")
    .sort({ startTime: 1 })
    .lean();

  return reservations.map(serializeReservation);
};

exports.getCurrentReservations = async (currentTime) => {
  const reservations = await Reservation.find({
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lte: currentTime },
    endTime: { $gte: currentTime },
  })
    .populate("user")
    .populate("area")
    .sort({ startTime: 1 })
    .lean();

  return reservations.map(serializeReservation);
};

exports.getUserReservations = async (userId) => {
  const reservations = await Reservation.find({ user: userId })
    .populate("user")
    .populate("area")
    .sort({ startTime: -1 })
    .lean();

  return reservations.map(serializeReservation);
};

exports.createReservation = async (user, data) => {
  const areaId = data.areaId;
  const startTime = normalizeDate(data.startTime, "startTime");
  const endTime = normalizeDate(data.endTime, "endTime");
  const participantCount = Number.parseInt(String(data.participantCount), 10);
  const purpose = typeof data.purpose === "string" && data.purpose.trim() ? data.purpose.trim() : "General MakerSpace use";
  const plannedItems = Array.isArray(data.plannedItems) ? data.plannedItems : [];
  const when2meet = typeof data.when2meet === "string" ? data.when2meet.trim() : "";
  const project = typeof data.project === "string" ? data.project.trim() : "";

  if (!areaId) {
    throw createError(400, "Please select an area to reserve");
  }

  const area = await Area.findById(areaId);
  await validateReservationWindow(area, startTime, endTime, participantCount, null);

  const reservation = await Reservation.create({
    user: user.id,
    area: area._id,
    purpose,
    plannedItems,
    participantCount,
    when2meet,
    project,
    startTime,
    endTime,
    status: "pending",
  });

  await reservation.populate("user");
  await reservation.populate("area");

  return serializeReservation(reservation);
};

exports.updateReservation = async (user, reservationId, updateData) => {
  const reservation = await Reservation.findById(reservationId).populate("area");
  if (!reservation) {
    throw createError(404, "Reservation not found");
  }

  if (String(reservation.user) !== user.id && user.role !== "admin") {
    throw createError(403, "You can only modify your own reservations");
  }

  if (updateData.areaId && String(reservation.area._id) !== String(updateData.areaId)) {
    throw createError(400, "Changing the reserved area is not supported");
  }

  const timeDiff = reservation.startTime.getTime() - Date.now();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  if (hoursDiff < 6 && user.role !== "admin") {
    throw createError(400, "Cannot modify reservations that start in less than 6 hours");
  }

  const nextStartTime = updateData.startTime ? normalizeDate(updateData.startTime, "startTime") : reservation.startTime;
  const nextEndTime = updateData.endTime ? normalizeDate(updateData.endTime, "endTime") : reservation.endTime;
  const nextParticipantCount = updateData.participantCount !== undefined
    ? Number.parseInt(String(updateData.participantCount), 10)
    : reservation.participantCount;

  await validateReservationWindow(reservation.area, nextStartTime, nextEndTime, nextParticipantCount, reservation._id);

  reservation.startTime = nextStartTime;
  reservation.endTime = nextEndTime;
  reservation.participantCount = nextParticipantCount;
  reservation.purpose = typeof updateData.purpose === "string" && updateData.purpose.trim()
    ? updateData.purpose.trim()
    : reservation.purpose;
  reservation.plannedItems = Array.isArray(updateData.plannedItems)
    ? updateData.plannedItems
    : reservation.plannedItems;
  reservation.when2meet = typeof updateData.when2meet === "string"
    ? updateData.when2meet.trim()
    : reservation.when2meet;
  reservation.project = typeof updateData.project === "string"
    ? updateData.project.trim()
    : reservation.project;

  await reservation.save();
  await reservation.populate("user");
  await reservation.populate("area");

  return serializeReservation(reservation);
};

exports.cancelReservation = async (user, reservationId, currentTime) => {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw createError(404, "Reservation not found");
  }

  if (String(reservation.user) !== user.id && user.role !== "admin") {
    throw createError(403, "You can only cancel your own reservations");
  }

  const timeDiff = reservation.startTime.getTime() - currentTime.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  if (hoursDiff < 6 && user.role !== "admin") {
    throw createError(400, "Cannot cancel reservations that start in less than 6 hours");
  }

  reservation.status = "cancelled";
  await reservation.save();

  return serializeReservation(reservation);
};

exports.approveReservation = async (reservationId) => {
  const reservation = await Reservation.findByIdAndUpdate(
    reservationId,
    { status: "approved" },
    { new: true }
  )
    .populate("user")
    .populate("area");

  if (!reservation) {
    throw createError(404, "Reservation not found");
  }

  return serializeReservation(reservation);
};

exports.rejectReservation = async (reservationId) => {
  const reservation = await Reservation.findByIdAndUpdate(
    reservationId,
    { status: "rejected" },
    { new: true }
  )
    .populate("user")
    .populate("area");

  if (!reservation) {
    throw createError(404, "Reservation not found");
  }

  return serializeReservation(reservation);
};
