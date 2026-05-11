const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservation.controller");
const { authenticate } = require("../middlewares/auth.middleware");

router.get("/", authenticate, reservationController.getAllReservations);
router.get("/current", authenticate, reservationController.getCurrentReservations);
router.get("/my", authenticate, reservationController.getMyReservations);
router.post("/", authenticate, reservationController.createReservation);
router.patch("/:id", authenticate, reservationController.updateReservation);
router.delete("/:id", authenticate, reservationController.cancelReservation);

module.exports = router;
