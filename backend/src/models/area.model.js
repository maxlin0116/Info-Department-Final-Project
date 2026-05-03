// Import Mongoose library for MongoDB interactions
const mongoose = require("mongoose");

// Define the Area schema with fields: name, type, maxCapacity, description, showPrintingStatus, and isActive
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
    showPrintingStatus: {
      type: Boolean,
      default: false
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
