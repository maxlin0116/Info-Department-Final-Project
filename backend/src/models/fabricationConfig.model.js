const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema(
  {
    serviceType: { type: String, enum: ["3dp", "laser"], required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["idle", "running", "maintenance", "offline"], default: "idle" },
    serviceOpen: { type: Boolean, default: true },
    note: { type: String, default: "" }
  },
  { _id: false }
);

const amsSlotSchema = new mongoose.Schema(
  {
    slot: { type: Number, min: 1, max: 4, required: true },
    colorName: { type: String, required: true },
    colorHex: { type: String, required: true },
    material: { type: String, default: "Bambu PLA Basic" },
    available: { type: Boolean, default: true }
  },
  { _id: false }
);

const fabricationConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    machines: { type: [machineSchema], default: [] },
    amsSlots: { type: [amsSlotSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("FabricationConfig", fabricationConfigSchema);
