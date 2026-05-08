const Area = require("../models/area.model");
const Reservation = require("../models/reservation.model");
const OpeningHour = require("../models/openingHour.model");

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

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function setTimeOnDate(date, minutes) {
  const value = new Date(date);
  value.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return value;
}

function normalizeAvailabilityStartDate(input) {
  if (!input) {
    return startOfDay(new Date());
  }

  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfDay(new Date());
  }

  return startOfDay(parsed);
}

function getNextWeekdays(startDate, count) {
  const dates = [];
  const cursor = startOfDay(startDate);

  while (dates.length < count) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
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

  const requestedDays = Number.parseInt(days, 10);
  const totalDays = Number.isFinite(requestedDays)
    ? Math.min(Math.max(requestedDays, 1), MAX_AVAILABILITY_DAYS)
    : DEFAULT_AVAILABILITY_DAYS;

  const firstDate = normalizeAvailabilityStartDate(startDate);
  const dates = getNextWeekdays(firstDate, totalDays);
  const dayNumbers = [...new Set(dates.map((date) => date.getDay()))];

  const [openingHours, reservations] = await Promise.all([
    OpeningHour.find({ dayOfWeek: { $in: dayNumbers }, isOpen: true }).lean(),
    Reservation.find({
      area: area._id,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      startTime: { $lt: endOfDay(dates[dates.length - 1]) },
      endTime: { $gt: startOfDay(dates[0]) },
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
      const dayOfWeek = date.getDay();
      const dayOpeningHours = openingHoursByDay.get(dayOfWeek) || [];
      const daySlotRanges = buildSlotRangesForOpeningHours(dayOpeningHours);

      return {
        date: formatDate(date),
        dayLabel: DAY_LABELS[dayOfWeek],
        display: formatDisplayDate(date),
        slots: daySlotRanges.map((slotRange) => {
          const slotStart = setTimeOnDate(date, slotRange.startMinutes);
          const slotEnd = setTimeOnDate(date, slotRange.endMinutes);
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
