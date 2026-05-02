const User = require('../models/user.model');
const Reservation = require('../models/reservation.model');

exports.getAllUsers = async () => {
    return await User.findAll({ exclude: ['password_hash'] });
};

exports.updateUserRole = async (userId, role) => {
    if (!['admin', 'regular'].includes(role)) {
        throw new Error('Invalid user role');
    }
    
    const updatedUser = await User.updateRole(userId, role);
    if (!updatedUser) {
        throw new Error('User not found');
    }
    
    return updatedUser;
};

exports.getPendingReservations = async () => {
    return await Reservation.findPending();
};