const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDatabase = require("./db");
const Area = require("../models/area.model");
const Reservation = require("../models/reservation.model");

dotenv.config();

const areas = [
  {
    name: "MakerSpace",
    type: "meeting",
    bookingMode: "schedule",
    serviceType: "meeting",
    publicDisplayEnabled: true,
    maxCapacity: 8,
    description: "Reserve the MakerSpace for project work, discussion, and equipment use",
    showPrintingStatus: false,
    isActive: true
  },
  {
    name: "3DP Area",
    type: "3dp",
    bookingMode: "queue",
    serviceType: "3dp",
    publicDisplayEnabled: true,
    maxCapacity: 1,
    description: "For 3D printing reservations",
    showPrintingStatus: true,
    isActive: true
  },
  {
    name: "Heavy Processing Area",
    type: "heavy_processing",
    bookingMode: "queue",
    serviceType: "laser",
    publicDisplayEnabled: true,
    maxCapacity: 1,
    description: "For heavy processing or machining work",
    showPrintingStatus: false,
    isActive: true
  }
];

async function retireLegacySolderingAreas(now = new Date()) {
  const retiredAreas = await Area.find({ type: "soldering" }).select("_id").lean();
  if (retiredAreas.length === 0) return 0;
  const retiredIds = retiredAreas.map((area) => area._id);
  await Area.updateMany(
    { _id: { $in: retiredIds } },
    { $set: { isActive: false, publicDisplayEnabled: false } }
  );
  const result = await Reservation.updateMany(
    {
      area: { $in: retiredIds },
      status: { $in: ["pending", "approved", "check_in_pending"] },
      endTime: { $gt: now }
    },
    { $set: { status: "cancelled", lifecycleReason: "Soldering Table reservations were retired" } }
  );
  return result.modifiedCount;
}

async function seedAreas() {
  await connectDatabase();
  for (const area of areas) {
    await Area.updateOne({ type: area.type }, { $set: area }, { upsert: true, setDefaultsOnInsert: true });
  }
  await retireLegacySolderingAreas();
  console.log("MakerSpace and fabrication areas synchronized; legacy soldering areas retired");
  await mongoose.disconnect();
}

module.exports = { areas, seedAreas, retireLegacySolderingAreas };

if (require.main === module) {
  seedAreas().catch(async (error) => {
    console.error("Failed to seed areas", error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
