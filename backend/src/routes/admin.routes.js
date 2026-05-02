const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(authenticate, requireRole('admin'));

router.get('/users', adminController.getUsers);
router.patch('/users/:id/role', adminController.updateUserRole);

router.get('/reservations/pending', adminController.getPendingReservations);
router.patch('/reservations/:id/approve', adminController.approveReservation);
router.patch('/reservations/:id/reject', adminController.rejectReservation);

module.exports = router;
