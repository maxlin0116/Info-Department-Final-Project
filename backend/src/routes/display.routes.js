const express = require("express");
const displayController = require("../controllers/display.controller");

const router = express.Router();
router.get("/", displayController.getSnapshot);
router.get("/schedule", displayController.getSchedule);
router.get("/stream", displayController.stream);

module.exports = router;
