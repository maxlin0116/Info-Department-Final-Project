const express = require("express");
const areaController = require("../controllers/area.controller");

const router = express.Router();

router.get("/", areaController.listAreas);
router.get("/status", areaController.getAreaStatus);
router.get("/:id/status", areaController.getAreaStatusById);

module.exports = router;
