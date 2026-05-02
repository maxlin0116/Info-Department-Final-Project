const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["meeting", "soldering", "3dp", "heavy_processing"],
      required: true
    },
    maxCapacity: {
      type: Number,
      required: true,
      min: 1
    },
    description: {
      type: String,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Area", areaSchema);
