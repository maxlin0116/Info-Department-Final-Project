const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const adminFabricationController = require('../controllers/adminFabrication.controller');

router.use(authenticate, requireRole('admin'));

router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/reset-password', adminController.resetUserPassword);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);

router.get('/reservations/pending', adminController.getPendingReservations);
router.patch('/reservations/:id/approve', adminController.approveReservation);
router.patch('/reservations/:id/reject', adminController.rejectReservation);
router.patch('/reservations/:id/confirm-attendance', adminController.confirmReservationAttendance);
router.patch('/reservations/:id/no-show', adminController.markReservationNoShow);

router.get('/fabrication/jobs', adminFabricationController.getJobs);
router.patch('/fabrication/jobs/:id', adminFabricationController.updateJob);
router.put('/fabrication/config', adminFabricationController.updateConfig);
router.put('/fabrication/quota/:serviceType', adminFabricationController.updateQuotaPolicy);
router.get('/fabrication/quota', adminFabricationController.getQuotaPolicies);

module.exports = router;
