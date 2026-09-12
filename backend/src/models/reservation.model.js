// Import Mongoose library for MongoDB interactions
const mongoose = require("mongoose");

// Define the Reservation schema with fields: user, area, purpose, plannedItems, participantCount, when2meet, project, startTime, endTime, and status
const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId, // Reference to the User model
      ref: "User",
      required: true
    },
    area: {
      type: mongoose.Schema.Types.ObjectId, // Reference to the Area model
      ref: "Area",
      required: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true
    },
    plannedItems: [
      {
        category: {
          type: String,
          enum: ["development_board", "module", "other"],
          required: true
        },
        name: {
          type: String,
          required: true,
          trim: true
        },
        quantity: {
          type: Number,
          min: 1,
          default: 1
        }
      }
    ],
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
      enum: [
        "approved",
        "pending",
        "check_in_pending",
        "in_use",
        "completed",
        "no_show",
        "rejected",
        "cancelled"
      ],
      default: "pending"
    },
    checkInRequestedAt: { type: Date, default: null },
    attendanceConfirmedAt: { type: Date, default: null },
    attendanceConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    noShowAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lifecycleReason: { type: String, default: "", trim: true }
  },
  {
    timestamps: true
  }
);

reservationSchema.index({ status: 1, startTime: 1 });
reservationSchema.index({ status: 1, endTime: 1 });

module.exports = mongoose.model("Reservation", reservationSchema);
