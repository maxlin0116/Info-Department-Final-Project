const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDatabase = require("./database/db");
const authRoutes = require("./routes/auth.routes");
const areaRoutes = require("./routes/area.routes");
const reservationRoutes = require("./routes/reservation.routes");
const adminRoutes = require("./routes/admin.routes");

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "MKS Reservation API" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
});

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log("Server is running on port " + port);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
