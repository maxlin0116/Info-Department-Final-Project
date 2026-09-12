const Reservation = require("../models/reservation.model");
const Area = require("../models/area.model");
const {
  getBusinessDayOfWeek,
  getBusinessMinutesOfDay,
  isSameBusinessDate,
  parseBusinessDateTimeInput,
} = require("../utils/businessDateTime");

const VALID_TIME_BLOCKS = [
  { start: 10 * 60, end: 12 * 60 },
  { start: 13 * 60 + 20, end: 15 * 60 + 10 },
  { start: 15 * 60 + 30, end: 17 * 60 + 20 },
  { start: 18 * 60, end: 22 * 60 },
];

const ACTIVE_STATUSES = ["approved", "pending", "check_in_pending", "in_use"];
const QUOTA_SLOT_MINUTES = 30;
const DEFAULT_RESERVATION_QUOTA_LIMIT = 64;
const DEFAULT_CHECK_IN_EARLY_MINUTES = 15;
const DEFAULT_CHECK_IN_GRACE_MINUTES = 15;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getReservationQuotaLimit() {
  const parsed = Number.parseInt(process.env.RESERVATION_QUOTA_LIMIT ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RESERVATION_QUOTA_LIMIT;
}

function getPositiveIntegerEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function getCheckInPolicy() {
  return {
    earlyMinutes: getPositiveIntegerEnv("RESERVATION_CHECK_IN_EARLY_MINUTES", DEFAULT_CHECK_IN_EARLY_MINUTES),
    graceMinutes: getPositiveIntegerEnv("RESERVATION_CHECK_IN_GRACE_MINUTES", DEFAULT_CHECK_IN_GRACE_MINUTES)
  };
}

function getCheckInWindow(startTime) {
  const policy = getCheckInPolicy();
  const start = new Date(startTime).getTime();
  return {
    ...policy,
    opensAt: new Date(start - policy.earlyMinutes * 60 * 1000),
    closesAt: new Date(start + policy.graceMinutes * 60 * 1000)
  };
}

function calculateReservationQuotaCost(startTime, endTime, participantCount) {
  const durationMinutes = Math.max(0, endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const slotCount = Math.ceil(durationMinutes / QUOTA_SLOT_MINUTES);
  return Math.max(0, slotCount * participantCount);
}

function normalizeDate(value, fieldName) {
  const date = parseBusinessDateTimeInput(value);
  if (!date || Number.isNaN(date.getTime())) {
    throw createError(400, "Invalid " + fieldName + ". Please provide a valid date/time.");
  }

  return date;
}

function isWithinOpeningHours(startTime, endTime) {
  if (endTime <= startTime) {
    return false;
  }

  if (getBusinessDayOfWeek(startTime) === 0 || getBusinessDayOfWeek(startTime) === 6) {
    return false;
  }

  if (!isSameBusinessDate(startTime, endTime)) {
    return false;
  }

  const startMinutes = getBusinessMinutesOfDay(startTime);
  const endMinutes = getBusinessMinutesOfDay(endTime);

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
    bookingMode: area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule"),
    serviceType: area.serviceType || (area.type === "heavy_processing" ? "laser" : area.type),
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
    checkInRequestedAt: source.checkInRequestedAt,
    attendanceConfirmedAt: source.attendanceConfirmedAt,
    attendanceConfirmedBy: source.attendanceConfirmedBy
      ? String(source.attendanceConfirmedBy._id ?? source.attendanceConfirmedBy)
      : null,
    noShowAt: source.noShowAt,
    completedAt: source.completedAt,
    lifecycleReason: source.lifecycleReason ?? "",
    checkInWindow: getCheckInWindow(source.startTime),
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

async function getQuotaUsageForUser(userId, currentTime = new Date(), excludeReservationId) {
  const query = {
    user: userId,
    status: { $in: ACTIVE_STATUSES },
    endTime: { $gt: currentTime },
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const reservations = await Reservation.find(query)
    .select("startTime endTime participantCount")
    .lean();
  const used = reservations.reduce((total, reservation) => {
    return total + calculateReservationQuotaCost(
      new Date(reservation.startTime),
      new Date(reservation.endTime),
      reservation.participantCount || 0
    );
  }, 0);
  const limit = getReservationQuotaLimit();

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    slotMinutes: QUOTA_SLOT_MINUTES,
    activeReservationCount: reservations.length,
  };
}

async function validateReservationQuota(userId, startTime, endTime, participantCount, excludeReservationId) {
  const quota = await getQuotaUsageForUser(userId, new Date(), excludeReservationId);
  const requested = calculateReservationQuotaCost(startTime, endTime, participantCount);
  const projectedUsed = quota.used + requested;

  if (projectedUsed > quota.limit) {
    throw createError(
      409,
      "Reservation failed. This reservation uses " +
        requested +
        " quota point(s), but only " +
        quota.remaining +
        " quota point(s) remain."
    );
  }

  return {
    ...quota,
    requested,
    projectedUsed,
    projectedRemaining: Math.max(quota.limit - projectedUsed, 0),
  };
}

async function validateReservationWindow(area, startTime, endTime, participantCount, excludeReservationId) {
  if (!area) {
    throw createError(404, "Requested reservation area not found");
  }

  if (!area.isActive) {
    throw createError(400, "This area is currently unavailable for reservations");
  }

  const bookingMode = area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule");
  if (bookingMode === "queue") {
    throw createError(409, "This resource accepts file-queue jobs instead of time-slot reservations");
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

exports.getUserQuota = async (userId) => {
  return getQuotaUsageForUser(userId);
};

exports.checkInReservation = async (user, reservationId, currentTime = new Date()) => {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw createError(404, "Reservation not found");
  if (String(reservation.user) !== user.id) throw createError(403, "You can only check in to your own reservation");
  if (reservation.status !== "approved") throw createError(409, "Only approved reservations can be checked in");

  const window = getCheckInWindow(reservation.startTime);
  if (currentTime < window.opensAt) {
    throw createError(409, `Check-in opens ${window.earlyMinutes} minutes before the reservation`);
  }
  if (currentTime > window.closesAt || currentTime >= reservation.endTime) {
    throw createError(409, "The check-in window has closed");
  }

  reservation.status = "check_in_pending";
  reservation.checkInRequestedAt = currentTime;
  reservation.lifecycleReason = "Waiting for administrator attendance confirmation";
  await reservation.save();
  await reservation.populate("user");
  await reservation.populate("area");
  return serializeReservation(reservation);
};

exports.confirmAttendance = async (adminUser, reservationId, currentTime = new Date()) => {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw createError(404, "Reservation not found");
  if (reservation.status !== "check_in_pending") {
    throw createError(409, "This reservation is not waiting for attendance confirmation");
  }
  if (currentTime >= reservation.endTime) throw createError(409, "This reservation has already ended");

  reservation.status = "in_use";
  reservation.attendanceConfirmedAt = currentTime;
  reservation.attendanceConfirmedBy = adminUser.id;
  reservation.lifecycleReason = "Attendance confirmed by administrator";
  await reservation.save();
  await reservation.populate("user");
  await reservation.populate("area");
  return serializeReservation(reservation);
};

exports.markNoShow = async (reservationId, currentTime = new Date()) => {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw createError(404, "Reservation not found");
  if (!["approved", "check_in_pending"].includes(reservation.status)) {
    throw createError(409, "This reservation cannot be marked as no-show");
  }
  if (currentTime < reservation.startTime) throw createError(409, "A future reservation cannot be marked as no-show");

  reservation.status = "no_show";
  reservation.noShowAt = currentTime;
  reservation.lifecycleReason = "Marked no-show by administrator";
  await reservation.save();
  await reservation.populate("user");
  await reservation.populate("area");
  return serializeReservation(reservation);
};

exports.runLifecycleSweep = async (currentTime = new Date()) => {
  const { graceMinutes } = getCheckInPolicy();
  const noShowCutoff = new Date(currentTime.getTime() - graceMinutes * 60 * 1000);
  const [expiredPending, noShows, unconfirmed, completed] = await Promise.all([
    Reservation.updateMany(
      { status: "pending", startTime: { $lte: currentTime } },
      { $set: { status: "cancelled", lifecycleReason: "Automatically cancelled because approval was not completed before start" } }
    ),
    Reservation.updateMany(
      { status: "approved", startTime: { $lte: noShowCutoff } },
      { $set: { status: "no_show", noShowAt: currentTime, lifecycleReason: "Automatically marked no-show after the check-in grace period" } }
    ),
    Reservation.updateMany(
      { status: "check_in_pending", endTime: { $lte: currentTime } },
      { $set: { status: "no_show", noShowAt: currentTime, lifecycleReason: "Check-in was not confirmed before the reservation ended" } }
    ),
    Reservation.updateMany(
      { status: "in_use", endTime: { $lte: currentTime } },
      { $set: { status: "completed", completedAt: currentTime, lifecycleReason: "Reservation completed" } }
    )
  ]);

  return {
    expiredPending: expiredPending.modifiedCount,
    noShows: noShows.modifiedCount + unconfirmed.modifiedCount,
    completed: completed.modifiedCount,
    changed: expiredPending.modifiedCount + noShows.modifiedCount + unconfirmed.modifiedCount + completed.modifiedCount
  };
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
  await validateReservationQuota(user.id, startTime, endTime, participantCount, null);

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

  if (ACTIVE_STATUSES.includes(reservation.status)) {
    await validateReservationQuota(String(reservation.user), nextStartTime, nextEndTime, nextParticipantCount, reservation._id);
  }

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

  if (!["pending", "approved", "check_in_pending"].includes(reservation.status)) {
    throw createError(409, "This reservation can no longer be cancelled");
  }
  reservation.status = "cancelled";
  reservation.lifecycleReason = "Cancelled by user or administrator";
  await reservation.save();

  return serializeReservation(reservation);
};

exports.approveReservation = async (reservationId) => {
  const reservation = await Reservation.findOneAndUpdate(
    { _id: reservationId, status: "pending", startTime: { $gt: new Date() } },
    { status: "approved" },
    { new: true }
  )
    .populate("user")
    .populate("area");

  if (!reservation) throw createError(409, "Only future pending reservations can be approved");

  return serializeReservation(reservation);
};

exports.rejectReservation = async (reservationId) => {
  const reservation = await Reservation.findOneAndUpdate(
    { _id: reservationId, status: "pending" },
    { status: "rejected" },
    { new: true }
  )
    .populate("user")
    .populate("area");

  if (!reservation) throw createError(409, "Only pending reservations can be rejected");

  return serializeReservation(reservation);
};

exports.getCheckInPolicy = getCheckInPolicy;
exports.getCheckInWindow = getCheckInWindow;
exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
