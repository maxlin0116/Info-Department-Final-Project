const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const connectDatabase = require("./database/db");
const authRoutes = require("./routes/auth.routes");
const areaRoutes = require("./routes/area.routes");
const reservationRoutes = require("./routes/reservation.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const port = process.env.PORT || 8000;

function parseAllowedOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesOrigin(pattern, origin) {
  if (pattern === "*") {
    return true;
  }

  if (!pattern.includes("*")) {
    return pattern === origin;
  }

  const parts = pattern.split("*");
  const regexParts = [];

  for (let i = 0; i < parts.length; i++) {
    regexParts.push(escapeRegex(parts[i]));
    if (i < parts.length - 1) {
      if (parts[i].endsWith(":")) {
        regexParts.push("[0-9]+");
      } else {
        regexParts.push("[a-zA-Z0-9.-]+");
      }
    }
  }

  const regex = new RegExp(`^${regexParts.join("")}$`);
  return regex.test(origin);
}

const configuredOrigins = parseAllowedOrigins(
  process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN
);
const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultDevOrigins;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.some((pattern) => matchesOrigin(pattern, origin))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "MKS Reservation API" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
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
