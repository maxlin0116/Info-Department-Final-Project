const express = require("express");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

router.get("/users", adminController.listUsers);
router.patch("/users/:id/role", adminController.updateUserRole);
router.get("/reservations/pending", adminController.listPendingReservations);
router.patch("/reservations/:id/approve", adminController.approveReservation);
router.patch("/reservations/:id/reject", adminController.rejectReservation);

module.exports = router;
