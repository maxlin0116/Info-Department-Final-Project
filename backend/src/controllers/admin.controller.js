const adminService = require('../services/admin.service');
const reservationService = require('../services/reservation.service');

exports.getUsers = async (req, res, next) => {
    try {
        const users = await adminService.getAllUsers();
        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};

exports.updateUserRole = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { role } = req.body

        const updatedUser = await adminService.updateUserRole(userId, role);
        res.status(200).json({ message: '權限更新成功', user: updatedUser });
    } catch (error) {
        next(error);
    }
};

exports.getPendingReservations = async (req, res, next) => {
    try {
        const pendingReservations = await adminService.getPendingReservations();
        res.status(200).json({ reservations: pendingReservations });
    } catch (error) {
        next(error);
    }
};

exports.approveReservation = async (req, res, next) => {
    try {
        const reservationId = req.params.id;
        const approvedReservation = await reservationService.approveReservation(reservationId);
        res.status(200).json({ message: '預約已核准', reservation: approvedReservation });
    } catch (error) {
        next(error);
    }
};

exports.rejectReservation = async (req, res, next) => {
    try {
        const reservationId = req.params.id;
        const rejectedReservation = await reservationService.rejectReservation(reservationId);
        res.status(200).json({ message: '預約已拒絕', reservation: rejectedReservation });
    } catch (error) {
        next(error);
    }
};
