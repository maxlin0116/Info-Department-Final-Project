const mongoose = require("mongoose");

const quotaBucketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceType: { type: String, enum: ["3dp", "laser"], required: true },
    periodKey: { type: String, required: true },
    limitMinutes: { type: Number, required: true, min: 1 },
    reservedMinutes: { type: Number, default: 0, min: 0 },
    consumedMinutes: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

quotaBucketSchema.index({ user: 1, serviceType: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model("QuotaBucket", quotaBucketSchema);
