const Reservation = require("../models/reservation.model");
const Area = require("../models/area.model");
const { startOfBusinessDay, endOfBusinessDay } = require("../utils/businessDateTime");
const { getQueues, getConfig } = require("./fabrication.service");
const areaService = require("./area.service");

async function getDisplaySnapshot(now = new Date()) {
  const [reservations, queues, config] = await Promise.all([
    Reservation.find({
      status: { $in: ["pending", "approved", "check_in_pending", "in_use", "completed", "no_show"] },
      startTime: { $lte: endOfBusinessDay(now) },
      endTime: { $gte: startOfBusinessDay(now) }
    })
      .populate("area")
      .populate("user")
      .sort({ startTime: 1 })
      .lean(),
    getQueues(),
    getConfig()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    reservations: reservations
      .filter((item) => item.area?.publicDisplayEnabled !== false && item.area?.bookingMode !== "queue")
      .map((item) => ({
        id: String(item._id),
        area: item.area?.name || "Area",
        title: item.purpose || item.project || "Reservation",
        userName: item.user?.name || "Maker",
        status: item.status,
        checkInRequestedAt: item.checkInRequestedAt,
        attendanceConfirmedAt: item.attendanceConfirmedAt,
        lifecycleReason: item.lifecycleReason || "",
        startTime: item.startTime,
        endTime: item.endTime,
        participantCount: item.participantCount
      })),
    queues,
    machines: config.machines.map((item) => ({
      serviceType: item.serviceType,
      name: item.name,
      status: item.status,
      serviceOpen: item.serviceOpen,
      note: item.note
    }))
  };
}

async function getPublicSchedule({ startDate, days } = {}) {
  const areas = await Area.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  const area = areas.find((item) => {
    const bookingMode = item.bookingMode || (["3dp", "heavy_processing"].includes(item.type) ? "queue" : "schedule");
    return bookingMode === "schedule" && item.publicDisplayEnabled !== false;
  });

  if (!area) return null;

  return areaService.getAreaAvailability(String(area._id), {
    startDate,
    days,
    includeReservationDetails: true,
  });
}

module.exports = { getDisplaySnapshot, getPublicSchedule };
