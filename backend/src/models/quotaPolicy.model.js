const mongoose = require("mongoose");

const quotaPolicySchema = new mongoose.Schema(
  {
    serviceType: { type: String, enum: ["3dp", "laser"], required: true, unique: true },
    enabled: { type: Boolean, default: true },
    period: { type: String, enum: ["weekly", "monthly"], default: "monthly" },
    limitMinutes: { type: Number, min: 1, default: 600 },
    maxActiveJobs: { type: Number, min: 1, default: 3 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuotaPolicy", quotaPolicySchema);
