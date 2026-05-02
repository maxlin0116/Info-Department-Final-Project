const express = require("express");
const reservationController = require("../controllers/reservation.controller");

const router = express.Router();

router.get("/", reservationController.listReservations);
router.get("/current", reservationController.getCurrentReservations);
router.get("/my", reservationController.getMyReservations);
router.post("/", reservationController.createReservation);
router.patch("/:id", reservationController.updateReservation);
router.delete("/:id", reservationController.cancelReservation);

module.exports = router;
