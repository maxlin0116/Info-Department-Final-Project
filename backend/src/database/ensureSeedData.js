const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDatabase = require("./db");
const Area = require("../models/area.model");
const OpeningHour = require("../models/openingHour.model");
const { ensureFabricationDefaults } = require("../services/fabricationConfig.service");
const { areas, retireLegacySolderingAreas } = require("./seedAreas");
const { openingHours } = require("./seedOpeningHours");

dotenv.config();

function shouldAutoSeed() {
  const value = (process.env.AUTO_SEED_DATA || "true").trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "no";
}

async function ensureCollectionData(Model, label, records) {
  const count = await Model.countDocuments();

  if (count > 0) {
    console.log(`${label} already present (${count})`);
    return;
  }

  await Model.insertMany(records);
  console.log(`${label} seeded`);
}

async function ensureSeedData() {
  if (!shouldAutoSeed()) {
    console.log("AUTO_SEED_DATA disabled; skipping seed");
    return;
  }

  await connectDatabase();

  try {
    await ensureCollectionData(Area, "Areas", areas);
    await ensureCollectionData(OpeningHour, "Opening hours", openingHours);
    for (const area of areas) {
      await Area.updateOne(
        { type: area.type },
        { $set: area },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    // Preserve legacy soldering records for history, but remove the resource
    // from all current reservation views and release any future capacity.
    await retireLegacySolderingAreas();
    await ensureFabricationDefaults();
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { ensureSeedData };

if (require.main === module) {
  ensureSeedData().catch(async (error) => {
    console.error("Failed to ensure seed data", error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
