const mongoose = require("mongoose");

// Function to connect to the MongoDB database using Mongoose
async function connectDatabase() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mks_reservation";

  await mongoose.connect(mongoUri);

  console.log("MongoDB connected");
}

module.exports = connectDatabase;
