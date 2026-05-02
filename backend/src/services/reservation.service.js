const Reservation = require('../models/reservation.model');
const Area = require('../models/area.model');

const VALID_TIME_BLOCKS = [
    { start: 10 * 60, end: 12 * 60 },                 // Morning: 10:00 - 12:00
    { start: 13 * 60 + 20, end: 15 * 60 + 10 },       // Afternoon A: 13:20 - 15:10
    { start: 15 * 60 + 30, end: 17 * 60 + 20 },       // Afternoon B: 15:30 - 17:20
    { start: 18 * 60, end: 22 * 60 }                  // Evening A+B: 18:00 - 22:00 (Continuous)
];

function isWithinOpeningHours(startString, endString) {
    const start = new Date(startString);
    const end = new Date(endString);

    if (end <= start) return false;

    const dayOfWeek = start.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
    }

    if (start.toDateString() !== end.toDateString()) {
        return false;
    }

    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();

    return VALID_TIME_BLOCKS.some(block => 
        startMins >= block.start && endMins <= block.end
    );
}

exports.getAllReservations = async () => {
    return await Reservation.findAll();
};

exports.getCurrentReservations = async (currentTime) => {
    return await Reservation.findCurrent(currentTime);
};

exports.getUserReservations = async (userId) => {
    return await Reservation.findByUserId(userId);
};

exports.createReservation = async (user, data) => {
    const { areaId, startTime, endTime, participantCount, purpose, plannedItems, requiredItems, when2meet } = data;
    const area = await Area.findById(areaId);
    if (!area) throw new Error('Requested reservation area not found');

    if (!isWithinOpeningHours(startTime, endTime)) {
        throw new Error('Reservation failed! The requested time falls outside opening hours, during a break, or on a weekend.');
    }

    const currentUsedCount = await Reservation.countParticipantsInRange(areaId, startTime, endTime);
    const nextCount = currentUsedCount + participantCount;

    if (nextCount > area.max_capacity) {
        throw new Error(`Reservation failed! Only ${area.max_capacity - currentUsedCount} spots remain available during this time slot.`);
    }

    const newReservation = await Reservation.create({
        user_id: user.id,
        area_id: areaId,
        purpose,
        planned_items: JSON.stringify(plannedItems),
        required_items: requiredItems,
        participant_count: participantCount,
        when2meet,
        start_time: startTime,
        end_time: endTime,
        status: 'approved' // Defaulting to approved for MVP
    });

    return newReservation;
};

exports.updateReservation = async (user, reservationId, updateData) => {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new Error('Reservation not found');

    if (reservation.user_id !== user.id && user.role !== 'admin') {
        throw new Error('You can only modify your own reservations');
    }
    
    // If updating time, check opening hours again
    if (updateData.startTime || updateData.endTime) {
        const newStart = updateData.startTime || reservation.start_time;
        const newEnd = updateData.endTime || reservation.end_time;
        if (!isWithinOpeningHours(newStart, newEnd)) {
            throw new Error('Update failed! The new time falls outside opening hours, during a break, or on a weekend.');
        }
    }

    const timeDiff = new Date(reservation.start_time) - new Date();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 6 && user.role !== 'admin') {
        throw new Error('Cannot modify reservations that start in less than 6 hours');
    }

    return await Reservation.update(reservationId, updateData);
};

exports.cancelReservation = async (user, reservationId, currentTime) => {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new Error('Reservation not found');

    if (reservation.user_id !== user.id && user.role !== 'admin') {
        throw new Error('You can only cancel your own reservations');
    }

    const timeDiff = new Date(reservation.start_time) - new Date(currentTime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 6 && user.role !== 'admin') {
        throw new Error('Cannot cancel reservations that start in less than 6 hours');
    }

    return await Reservation.delete(reservationId);
};

exports.approveReservation = async (reservationId) => {
    return await Reservation.updateStatus(reservationId, 'approved');
};

exports.rejectReservation = async (reservationId) => {
    return await Reservation.updateStatus(reservationId, 'rejected');
};