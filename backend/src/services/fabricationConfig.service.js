const FabricationConfig = require("../models/fabricationConfig.model");
const QuotaPolicy = require("../models/quotaPolicy.model");

const DEFAULT_MACHINES = [
  { serviceType: "3dp", name: "P1S-01", status: "idle", serviceOpen: true, note: "Bambu Lab P1S" },
  { serviceType: "laser", name: "LASER-01", status: "idle", serviceOpen: true, note: "Laser cutter" }
];

const DEFAULT_AMS_SLOTS = [1, 2, 3, 4].map((slot) => ({
  slot,
  colorName: `Slot ${slot}`,
  colorHex: ["#ef4444", "#111827", "#f8fafc", "#2563eb"][slot - 1],
  material: "Bambu PLA Basic",
  available: true
}));

async function ensureFabricationDefaults() {
  const config = await FabricationConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { machines: DEFAULT_MACHINES, amsSlots: DEFAULT_AMS_SLOTS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Promise.all([
    QuotaPolicy.findOneAndUpdate(
      { serviceType: "3dp" },
      { $setOnInsert: { enabled: true, period: "monthly", limitMinutes: 600, maxActiveJobs: 3 } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    QuotaPolicy.findOneAndUpdate(
      { serviceType: "laser" },
      { $setOnInsert: { enabled: false, period: "monthly", limitMinutes: 600, maxActiveJobs: 3 } },
      { upsert: true, setDefaultsOnInsert: true }
    )
  ]);

  return config;
}

async function getConfig() {
  return (await FabricationConfig.findOne({ key: "default" })) || ensureFabricationDefaults();
}

async function updateConfig(data) {
  const config = await ensureFabricationDefaults();

  if (Array.isArray(data.amsSlots)) {
    const slots = data.amsSlots
      .map((item) => ({
        slot: Number(item.slot),
        colorName: String(item.colorName || "").trim(),
        colorHex: /^#[0-9a-f]{6}$/i.test(String(item.colorHex || "")) ? item.colorHex : "#64748b",
        material: String(item.material || "Bambu PLA Basic").trim(),
        available: item.available !== false
      }))
      .filter((item) => item.slot >= 1 && item.slot <= 4 && item.colorName)
      .sort((a, b) => a.slot - b.slot);

    if (slots.length !== 4 || new Set(slots.map((item) => item.slot)).size !== 4) {
      const error = new Error("AMS configuration must contain slots 1 through 4");
      error.statusCode = 400;
      throw error;
    }
    config.amsSlots = slots;
  }

  if (Array.isArray(data.machines)) {
    for (const input of data.machines) {
      const machine = config.machines.find((item) => item.serviceType === input.serviceType);
      if (!machine) continue;
      if (["idle", "running", "maintenance", "offline"].includes(input.status)) machine.status = input.status;
      if (typeof input.serviceOpen === "boolean") machine.serviceOpen = input.serviceOpen;
      if (typeof input.note === "string") machine.note = input.note.trim();
    }
  }

  await config.save();
  return config;
}

module.exports = { DEFAULT_MACHINES, DEFAULT_AMS_SLOTS, ensureFabricationDefaults, getConfig, updateConfig };
