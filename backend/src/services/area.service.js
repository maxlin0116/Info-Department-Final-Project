const Area = require("../models/area.model");
const Reservation = require("../models/reservation.model");
const OpeningHour = require("../models/openingHour.model");
const FabricationJob = require("../models/fabricationJob.model");
const { getConfig } = require("./fabricationConfig.service");
const {
  addBusinessDays,
  endOfBusinessDay,
  formatBusinessDate,
  formatBusinessDisplayDate,
  getBusinessDayOfWeek,
  parseBusinessDateInput,
  setTimeOnBusinessDate,
  startOfBusinessDay,
} = require("../utils/businessDateTime");

const SLOT_ALIGNMENT_MINUTES = 30;
const DEFAULT_AVAILABILITY_DAYS = 5;
const MAX_AVAILABILITY_DAYS = 10;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACTIVE_RESERVATION_STATUSES = ["approved", "pending"];

function toAreaPayload(area) {
  return {
    id: String(area._id),
    name: area.name,
    type: area.type,
    bookingMode: area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule"),
    serviceType: area.serviceType || (area.type === "heavy_processing" ? "laser" : area.type),
    publicDisplayEnabled: area.publicDisplayEnabled !== false,
    maxCapacity: area.maxCapacity,
    description: area.description,
    showPrintingStatus: area.showPrintingStatus,
    isActive: area.isActive,
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeAvailabilityStartDate(input) {
  if (!input) {
    return startOfBusinessDay(new Date());
  }

  const parsed = parseBusinessDateInput(input);
  if (!parsed) {
    return startOfBusinessDay(new Date());
  }

  return parsed;
}

function getNextWeekdays(startDate, count) {
  const dates = [];
  let cursor = startOfBusinessDay(startDate);

  while (dates.length < count) {
    const dayOfWeek = getBusinessDayOfWeek(cursor);
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(cursor));
    }
    cursor = addBusinessDays(cursor, 1);
  }

  return dates;
}

function getAlignedMinutesAfter(value) {
  return Math.ceil(value / SLOT_ALIGNMENT_MINUTES) * SLOT_ALIGNMENT_MINUTES;
}

function buildSlotRangesForOpeningHours(openingHours) {
  const sortedHours = [...openingHours].sort(
    (left, right) => timeToMinutes(left.openTime) - timeToMinutes(right.openTime)
  );

  return sortedHours.flatMap((entry) => {
    const openMinutes = timeToMinutes(entry.openTime);
    const closeMinutes = timeToMinutes(entry.closeTime);
    const internalAnchors = [];

    for (
      let minutes = getAlignedMinutesAfter(openMinutes);
      minutes < closeMinutes;
      minutes += SLOT_ALIGNMENT_MINUTES
    ) {
      if (minutes > openMinutes) {
        internalAnchors.push(minutes);
      }
    }

    if (openMinutes % SLOT_ALIGNMENT_MINUTES !== 0 && internalAnchors.length > 0) {
      internalAnchors.shift();
    }

    if (closeMinutes % SLOT_ALIGNMENT_MINUTES !== 0 && internalAnchors.length > 0) {
      internalAnchors.pop();
    }

    const boundaries = [openMinutes, ...internalAnchors, closeMinutes];

    return boundaries.slice(0, -1).map((startMinutes, index) => {
      const endMinutes = boundaries[index + 1];

      return {
        time: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        startMinutes,
        endMinutes,
      };
    });
  });
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

async function buildAreaStatus(area, currentTime) {
  const bookingMode = area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule");
  if (bookingMode === "queue") {
    const serviceType = area.serviceType || (area.type === "heavy_processing" ? "laser" : area.type);
    const [runningJobs, queuedJobs, config] = await Promise.all([
      FabricationJob.countDocuments({ serviceType, status: "running" }),
      FabricationJob.countDocuments({ serviceType, status: "queued" }),
      getConfig()
    ]);
    const machine = config.machines.find((item) => item.serviceType === serviceType);
    return {
      area: toAreaPayload(area),
      usedCount: runningJobs,
      remainingCapacity: runningJobs ? 0 : 1,
      activeReservationCount: runningJobs,
      queueLength: queuedJobs,
      isFull: runningJobs > 0,
      hasActivePrinting: serviceType === "3dp" && runningJobs > 0,
      machineStatus: machine?.status || "offline",
      serviceOpen: machine?.serviceOpen !== false
    };
  }

  const currentReservations = await Reservation.find({
    area: area._id,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    startTime: { $lte: currentTime },
    endTime: { $gt: currentTime },
  }).lean();

  const usedCount = currentReservations.reduce(
    (sum, reservation) => sum + (reservation.participantCount || 0),
    0
  );

  return {
    area: toAreaPayload(area),
    usedCount,
    remainingCapacity: Math.max(area.maxCapacity - usedCount, 0),
    activeReservationCount: currentReservations.length,
    isFull: usedCount >= area.maxCapacity,
    hasActivePrinting: area.type === "3dp" && currentReservations.length > 0,
  };
}

exports.getAllAreasInfo = async () => {
  return await Area.find().sort({ createdAt: 1 }).lean();
};

exports.getAreaStatus = async (currentTime) => {
  const areas = await Area.find().sort({ createdAt: 1 }).lean();
  return await Promise.all(areas.map((area) => buildAreaStatus(area, currentTime)));
};

exports.getSingleAreaStatus = async (areaId, currentTime) => {
  const area = await Area.findById(areaId).lean();

  if (!area) {
    return null;
  }

  return await buildAreaStatus(area, currentTime);
};

exports.getAreaAvailability = async (areaId, { startDate, days } = {}) => {
  const area = await Area.findById(areaId).lean();
  if (!area) {
    return null;
  }
  const bookingMode = area.bookingMode || (["3dp", "heavy_processing"].includes(area.type) ? "queue" : "schedule");
  if (bookingMode === "queue") {
    const error = new Error("This area uses a file queue instead of time-slot reservations");
    error.statusCode = 409;
    throw error;
  }

  const requestedDays = Number.parseInt(days, 10);
  const totalDays = Number.isFinite(requestedDays)
    ? Math.min(Math.max(requestedDays, 1), MAX_AVAILABILITY_DAYS)
    : DEFAULT_AVAILABILITY_DAYS;

  const firstDate = normalizeAvailabilityStartDate(startDate);
  const dates = getNextWeekdays(firstDate, totalDays);
  const dayNumbers = [...new Set(dates.map((date) => getBusinessDayOfWeek(date)))];

  const [openingHours, reservations] = await Promise.all([
    OpeningHour.find({ dayOfWeek: { $in: dayNumbers }, isOpen: true }).lean(),
    Reservation.find({
      area: area._id,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      startTime: { $lt: endOfBusinessDay(dates[dates.length - 1]) },
      endTime: { $gt: startOfBusinessDay(dates[0]) },
    })
      .select("startTime endTime participantCount")
      .lean(),
  ]);

  const openingHoursByDay = new Map();
  for (const entry of openingHours) {
    if (!openingHoursByDay.has(entry.dayOfWeek)) {
      openingHoursByDay.set(entry.dayOfWeek, []);
    }
    openingHoursByDay.get(entry.dayOfWeek).push(entry);
  }

  return {
    area: toAreaPayload(area),
    dates: dates.map((date) => {
      const dayOfWeek = getBusinessDayOfWeek(date);
      const dayOpeningHours = openingHoursByDay.get(dayOfWeek) || [];
      const daySlotRanges = buildSlotRangesForOpeningHours(dayOpeningHours);

      return {
        date: formatBusinessDate(date),
        dayLabel: DAY_LABELS[dayOfWeek],
        display: formatBusinessDisplayDate(date),
        slots: daySlotRanges.map((slotRange) => {
          const slotStart = setTimeOnBusinessDate(date, slotRange.startMinutes);
          const slotEnd = setTimeOnBusinessDate(date, slotRange.endMinutes);
          const isOpen = area.isActive;

          const occupiedCount = reservations.reduce((sum, reservation) => {
            return overlaps(slotStart, slotEnd, new Date(reservation.startTime), new Date(reservation.endTime))
              ? sum + (reservation.participantCount || 0)
              : sum;
          }, 0);

          const remainingCapacity = Math.max(area.maxCapacity - occupiedCount, 0);

          return {
            time: slotRange.time,
            endTime: slotRange.endTime,
            isOpen,
            occupiedCount,
            remainingCapacity,
            isFull: isOpen && remainingCapacity === 0,
            hasReservation: occupiedCount > 0,
          };
        }),
      };
    }),
  };
};
