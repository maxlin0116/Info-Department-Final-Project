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
    plannedItems: {
      type: [String], // Array of strings to store planned items for the reservation
      default: []
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
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Reservation", reservationSchema);
