// Import necessary libraries and modules
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Import the function to connect to the database and the OpeningHour model
const connectDatabase = require("./db");
const OpeningHour = require("../models/openingHour.model");

dotenv.config(); // Load environment variables from .env file

// Define an array of opening hours to seed the database
const openingHours = [
  {
    dayOfWeek: 1,
    dayLabel: "Monday",
    slot: "morning",
    slotLabel: "Morning",
    openTime: "10:00",
    closeTime: "12:00",
    staffName: "林峻亨"
  },
  {
    dayOfWeek: 1,
    dayLabel: "Monday",
    slot: "afternoonA",
    slotLabel: "Afternoon A",
    openTime: "13:20",
    closeTime: "15:10",
    staffName: "游允赫"
  },
  {
    dayOfWeek: 1,
    dayLabel: "Monday",
    slot: "afternoonB",
    slotLabel: "Afternoon B",
    openTime: "15:30",
    closeTime: "17:20",
    staffName: "游允赫"
  },
  {
    dayOfWeek: 1,
    dayLabel: "Monday",
    slot: "eveningA",
    slotLabel: "Evening A",
    openTime: "18:00",
    closeTime: "20:00",
    staffName: "周冠宇"
  },
  {
    dayOfWeek: 1,
    dayLabel: "Monday",
    slot: "eveningB",
    slotLabel: "Evening B",
    openTime: "20:00",
    closeTime: "22:00",
    staffName: "呂承寰"
  },
  {
    dayOfWeek: 2,
    dayLabel: "Tuesday",
    slot: "morning",
    slotLabel: "Morning",
    openTime: "10:00",
    closeTime: "12:00",
    staffName: "林峻亨"
  },
  {
    dayOfWeek: 2,
    dayLabel: "Tuesday",
    slot: "afternoonA",
    slotLabel: "Afternoon A",
    openTime: "13:20",
    closeTime: "15:10",
    staffName: "劉祐丞"
  },
  {
    dayOfWeek: 2,
    dayLabel: "Tuesday",
    slot: "afternoonB",
    slotLabel: "Afternoon B",
    openTime: "15:30",
    closeTime: "17:20",
    staffName: "陳泓安"
  },
  {
    dayOfWeek: 2,
    dayLabel: "Tuesday",
    slot: "eveningA",
    slotLabel: "Evening A",
    openTime: "18:00",
    closeTime: "20:00",
    staffName: "曾竹慧"
  },
  {
    dayOfWeek: 2,
    dayLabel: "Tuesday",
    slot: "eveningB",
    slotLabel: "Evening B",
    openTime: "20:00",
    closeTime: "22:00",
    staffName: "劉昱辰"
  },
  {
    dayOfWeek: 3,
    dayLabel: "Wednesday",
    slot: "morning",
    slotLabel: "Morning",
    openTime: "10:00",
    closeTime: "12:00",
    staffName: "蕭鼎霖"
  },
  {
    dayOfWeek: 3,
    dayLabel: "Wednesday",
    slot: "afternoonA",
    slotLabel: "Afternoon A",
    openTime: "13:20",
    closeTime: "15:10",
    staffName: "袁紹翔"
  },
  {
    dayOfWeek: 3,
    dayLabel: "Wednesday",
    slot: "afternoonB",
    slotLabel: "Afternoon B",
    openTime: "15:30",
    closeTime: "17:20",
    staffName: "葉庭安"
  },
  {
    dayOfWeek: 3,
    dayLabel: "Wednesday",
    slot: "eveningA",
    slotLabel: "Evening A",
    openTime: "18:00",
    closeTime: "20:00",
    staffName: "鄭莆濬"
  },
  {
    dayOfWeek: 3,
    dayLabel: "Wednesday",
    slot: "eveningB",
    slotLabel: "Evening B",
    openTime: "20:00",
    closeTime: "22:00",
    staffName: "呂承寰"
  },
  {
    dayOfWeek: 4,
    dayLabel: "Thursday",
    slot: "morning",
    slotLabel: "Morning",
    openTime: "10:00",
    closeTime: "12:00",
    staffName: "鍾承芳"
  },
  {
    dayOfWeek: 4,
    dayLabel: "Thursday",
    slot: "afternoonA",
    slotLabel: "Afternoon A",
    openTime: "13:20",
    closeTime: "15:10",
    staffName: "鄭莆濬"
  },
  {
    dayOfWeek: 4,
    dayLabel: "Thursday",
    slot: "afternoonB",
    slotLabel: "Afternoon B",
    openTime: "15:30",
    closeTime: "17:20",
    staffName: "詹易夫"
  },
  {
    dayOfWeek: 4,
    dayLabel: "Thursday",
    slot: "eveningA",
    slotLabel: "Evening A",
    openTime: "18:00",
    closeTime: "20:00",
    staffName: "林鈺軒"
  },
  {
    dayOfWeek: 4,
    dayLabel: "Thursday",
    slot: "eveningB",
    slotLabel: "Evening B",
    openTime: "20:00",
    closeTime: "22:00",
    staffName: "林鈺軒"
  },
  {
    dayOfWeek: 5,
    dayLabel: "Friday",
    slot: "morning",
    slotLabel: "Morning",
    openTime: "10:00",
    closeTime: "12:00",
    staffName: "葉庭安"
  },
  {
    dayOfWeek: 5,
    dayLabel: "Friday",
    slot: "afternoonA",
    slotLabel: "Afternoon A",
    openTime: "13:20",
    closeTime: "15:10",
    staffName: "謝濟遠"
  },
  {
    dayOfWeek: 5,
    dayLabel: "Friday",
    slot: "afternoonB",
    slotLabel: "Afternoon B",
    openTime: "15:30",
    closeTime: "17:20",
    staffName: "謝濟遠"
  },
  {
    dayOfWeek: 5,
    dayLabel: "Friday",
    slot: "eveningA",
    slotLabel: "Evening A",
    openTime: "18:00",
    closeTime: "20:00",
    staffName: "曾竹慧"
  },
  {
    dayOfWeek: 5,
    dayLabel: "Friday",
    slot: "eveningB",
    slotLabel: "Evening B",
    openTime: "20:00",
    closeTime: "22:00",
    staffName: "劉昱辰"
  }
];

// Function to seed the opening hours into the database
async function seedOpeningHours() {
  await connectDatabase(); 
  await OpeningHour.deleteMany();
  await OpeningHour.insertMany(openingHours);
  console.log("Opening hours seeded");
  await mongoose.disconnect();
}

// Execute the seeding function and handle any errors that occur during the process
seedOpeningHours().catch(async (error) => {
  console.error("Failed to seed opening hours", error);
  await mongoose.disconnect();
  process.exit(1);
});
