const adminService = require('../services/admin.service');
const reservationService = require('../services/reservation.service');
const { publishDisplayChange } = require('../services/displayEvents.service');

exports.getUsers = async (req, res, next) => {
    try {
        const users = await adminService.getAllUsers();
        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};

exports.createUser = async (req, res, next) => {
    try {
        const { name, grade, studentId, personalEmail, role, password } = req.body;
        const result = await adminService.createUser({
            name,
            grade,
            studentId,
            personalEmail,
            role,
            password,
        });
        res.status(201).json({ message: 'User created successfully', ...result });
    } catch (error) {
        next(error);
    }
};

exports.updateUserRole = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        const updatedUser = await adminService.updateUserRole(userId, role);
        res.status(200).json({ message: 'Role updated successfully', user: updatedUser });
    } catch (error) {
        next(error);
    }
};

exports.resetUserPassword = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { password } = req.body;
        const result = await adminService.resetUserPassword(userId, password);
        res.status(200).json({ message: 'Password reset successfully', ...result });
    } catch (error) {
        next(error);
    }
};

exports.updateUserStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { isActive } = req.body;
        const updatedUser = await adminService.updateUserStatus(userId, isActive);
        res.status(200).json({ message: 'User status updated successfully', user: updatedUser });
    } catch (error) {
        next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const result = await adminService.deleteUser(userId);
        res.status(200).json(result);
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
        publishDisplayChange('reservation_approved');
        res.status(200).json({ message: 'Reservation approved', reservation: approvedReservation });
    } catch (error) {
        next(error);
    }
};

exports.rejectReservation = async (req, res, next) => {
    try {
        const reservationId = req.params.id;
        const rejectedReservation = await reservationService.rejectReservation(reservationId);
        publishDisplayChange('reservation_rejected');
        res.status(200).json({ message: 'Reservation rejected', reservation: rejectedReservation });
    } catch (error) {
        next(error);
    }
};

exports.confirmReservationAttendance = async (req, res, next) => {
    try {
        const reservation = await reservationService.confirmAttendance(req.user, req.params.id, new Date());
        publishDisplayChange('reservation_attendance_confirmed');
        res.status(200).json({ message: 'Attendance confirmed', reservation });
    } catch (error) {
        next(error);
    }
};

exports.markReservationNoShow = async (req, res, next) => {
    try {
        const reservation = await reservationService.markNoShow(req.params.id, new Date());
        publishDisplayChange('reservation_no_show');
        res.status(200).json({ message: 'Reservation marked as no-show', reservation });
    } catch (error) {
        next(error);
    }
};
