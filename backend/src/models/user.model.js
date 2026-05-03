// Import Mongoose library for MongoDB interactions
const mongoose = require("mongoose");

// Define the User schema with fields: name, grade, studentId, passwordHash, personalEmail, and role
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    grade: {
      type: String,
      required: true,
      trim: true
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    personalEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: ["admin", "user"], // Define allowed roles for users
      default: "user"
    }
  },
  {
    timestamps: true // Automatically add createdAt and updatedAt timestamps to the schema
  }
);

// Export the User model based on the defined schema, allowing it to be used in other parts of the application
module.exports = mongoose.model("User", userSchema);
