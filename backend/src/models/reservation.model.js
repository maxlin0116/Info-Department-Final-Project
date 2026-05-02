const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true
    },
    plannedItems: {
      type: [String],
      default: []
    },
    requiredItems: {
      type: String,
      default: ""
    },
    participantCount: {
      type: Number,
      required: true,
      min: 1
    },
    when2meet: {
      type: String,
      default: ""
    },
    project: {
      type: String,
      default: ""
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["approved", "pending", "rejected", "cancelled"],
      default: "approved"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Reservation", reservationSchema);
