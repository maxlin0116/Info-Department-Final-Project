// Import Mongoose library for MongoDB interactions
const mongoose = require("mongoose");

// Define the OpeningHour schema with fields for weekly staff opening slots
const openingHourSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    dayLabel: {
      type: String,
      required: true
    },
    slot: {
      type: String,
      enum: ["morning", "afternoonA", "afternoonB", "eveningA", "eveningB"],
      required: true
    },
    slotLabel: {
      type: String,
      required: true
    },
    openTime: {
      type: String,
      required: true
    },
    closeTime: {
      type: String,
      required: true
    },
    isOpen: {
      type: Boolean,
      default: true
    },
    staffName: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

openingHourSchema.index({ dayOfWeek: 1, slot: 1 }, { unique: true });

module.exports = mongoose.model("OpeningHour", openingHourSchema);
