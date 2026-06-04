const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const connectDatabase = require("./database/db");
const authRoutes = require("./routes/auth.routes");
const areaRoutes = require("./routes/area.routes");
const reservationRoutes = require("./routes/reservation.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const port = process.env.PORT || 8000;
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

function parseAllowedOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);
}

function normalizeOrigin(value) {
  return value ? value.replace(/\/$/, "") : value;
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

  const regex = new RegExp(
    `^${pattern.split("*").map((segment) => escapeRegex(segment)).join(".*")}$`
  );

  return regex.test(origin);
}

function getRequestHostOrigin(req) {
  const forwardedProto = req.header("x-forwarded-proto");
  const forwardedHost = req.header("x-forwarded-host");
  const protocol = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol).trim();
  const host = (forwardedHost ? forwardedHost.split(",")[0] : req.header("host"))?.trim();

  if (!host) {
    return null;
  }

  return normalizeOrigin(`${protocol}://${host}`);
}

const configuredOrigins = parseAllowedOrigins(
  process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN
);
const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultDevOrigins;

app.set("trust proxy", true);
app.use(
  cors((req, callback) => {
    const requestOrigin = normalizeOrigin(req.header("origin"));
    const requestHostOrigin = getRequestHostOrigin(req);

    if (!requestOrigin) {
      return callback(null, { origin: true });
    }

    if (
      requestOrigin === requestHostOrigin ||
      allowedOrigins.some((pattern) => matchesOrigin(pattern, requestOrigin))
    ) {
      return callback(null, { origin: true });
    }

    return callback(new Error(`CORS blocked for origin: ${requestOrigin}`));
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Let missing asset requests fall through to the 404 handler.
    if (path.extname(req.path)) {
      return next();
    }

    return res.sendFile(frontendIndexPath);
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ message: "MKS Reservation API" });
  });
}

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
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
