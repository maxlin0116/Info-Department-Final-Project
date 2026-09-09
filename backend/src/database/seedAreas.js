const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDatabase = require("./db");
const Area = require("../models/area.model");

dotenv.config();

const areas = [
  {
    name: "Meeting Area",
    type: "meeting",
    bookingMode: "schedule",
    serviceType: "meeting",
    publicDisplayEnabled: true,
    maxCapacity: 8,
    description: "For meetings, discussions, and group work",
    showPrintingStatus: false,
    isActive: true
  },
  {
    name: "Soldering Table",
    type: "soldering",
    bookingMode: "schedule",
    serviceType: "soldering",
    publicDisplayEnabled: true,
    maxCapacity: 8,
    description: "For soldering and electronics work",
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

async function seedAreas() {
  await connectDatabase();
  await Area.deleteMany();
  await Area.insertMany(areas);
  console.log("Areas seeded");
  await mongoose.disconnect();
}

module.exports = { areas, seedAreas };

if (require.main === module) {
  seedAreas().catch(async (error) => {
    console.error("Failed to seed areas", error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
