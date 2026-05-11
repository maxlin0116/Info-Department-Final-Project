const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("./src/models/user.model");
const connectDatabase = require("./src/database/db");

dotenv.config();

async function makeAdmin(studentId) {
  if (!studentId) {
    console.error("Please provide a student ID. Usage: node makeAdmin.js <studentId>");
    process.exit(1);
  }

  try {
    await connectDatabase();
    
    const user = await User.findOne({ studentId: studentId.trim() });
    
    if (!user) {
      console.error(`User with student ID "${studentId}" not found.`);
      process.exit(1);
    }

    user.role = "admin";
    await user.save();

    console.log(`Success: User "${user.name}" (${user.studentId}) is now an admin.`);
  } catch (error) {
    console.error("Error updating user role:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

const studentId = process.argv[2];
makeAdmin(studentId);
