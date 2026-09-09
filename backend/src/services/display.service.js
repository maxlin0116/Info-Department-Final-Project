const Reservation = require("../models/reservation.model");
const { startOfBusinessDay, endOfBusinessDay } = require("../utils/businessDateTime");
const { getQueues, getConfig } = require("./fabrication.service");

async function getDisplaySnapshot(now = new Date()) {
  const [reservations, queues, config] = await Promise.all([
    Reservation.find({
      status: { $in: ["pending", "approved"] },
      startTime: { $lte: endOfBusinessDay(now) },
      endTime: { $gte: startOfBusinessDay(now) }
    })
      .populate("area")
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
        status: item.status,
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

module.exports = { getDisplaySnapshot };
