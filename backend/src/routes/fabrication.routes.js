const crypto = require("crypto");
const multer = require("multer");
const express = require("express");
const fabricationController = require("../controllers/fabrication.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { INCOMING_DIR } = require("../services/fileStorage.service");

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, INCOMING_DIR),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}-${file.originalname.replace(/[^a-z0-9._-]/gi, "_")}`)
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024), files: 1 }
});

router.get("/config", fabricationController.getConfig);
router.get("/queues", fabricationController.getQueues);
router.get("/jobs/my", authenticate, fabricationController.getMyJobs);
router.get("/jobs/:id", authenticate, fabricationController.getJob);
router.post("/jobs/3dp", authenticate, upload.single("file"), fabricationController.createThreeDpJob);
router.post("/jobs/laser", authenticate, upload.single("file"), fabricationController.createLaserJob);
router.post("/jobs/:id/confirm", authenticate, fabricationController.confirmJob);
router.post("/jobs/:id/retry-slice", authenticate, fabricationController.retrySlice);
router.post("/jobs/:id/collect", authenticate, fabricationController.collectJob);
router.delete("/jobs/:id", authenticate, fabricationController.cancelJob);
router.get("/files/:id/download", authenticate, fabricationController.downloadFile);
router.get("/quota/me", authenticate, fabricationController.getMyQuota);

module.exports = router;
