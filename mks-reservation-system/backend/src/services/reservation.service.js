const Reservation = require('../models/reservation.model');
const Area = require('../models/area.model');
// const OpeningHour = require('../models/openingHour.model'); // 要加上營業時間判斷
const VALID_TIME_BLOCKS = [
    { start: 10 * 60, end: 12 * 60 },                 // 上午: 10:00 - 12:00
    { start: 13 * 60 + 20, end: 15 * 60 + 10 },       // 下午A: 13:20 - 15:10
    { start: 15 * 60 + 30, end: 17 * 60 + 20 },       // 下午B: 15:30 - 17:20
    { start: 18 * 60, end: 22 * 60 }                  // 晚上A+B: 18:00 - 22:00 (時段連續)
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
    if (!area) throw new Error('找不到指定的預約區域');

    if (!isWithinOpeningHours(startTime, endTime)) {
        throw new Error('預約失敗！預約時間包含未開放時段、休息時間或為假日。');
    }

    const currentUsedCount = await Reservation.countParticipantsInRange(areaId, startTime, endTime);
    const nextCount = currentUsedCount + participantCount;

    if (nextCount > area.max_capacity) {
        throw new Error(`預約失敗！該時段僅剩 ${area.max_capacity - currentUsedCount} 個位子`);
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
        status: 'approved' // 暫時預設直接核准
    });

    return newReservation;
};

exports.updateReservation = async (user, reservationId, updateData) => {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new Error('找不到該筆預約');

    if (reservation.user_id !== user.id && user.role !== 'admin') {
        throw new Error('你只能修改自己的預約');
    }
    const timeDiff = new Date(reservation.start_time) - new Date();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 6 && user.role !== 'admin') {
        throw new Error('距離預約時間已少於 6 小時，不可再修改');
    }

    return await Reservation.update(reservationId, updateData);
};

exports.cancelReservation = async (user, reservationId, currentTime) => {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new Error('找不到該筆預約');

    if (reservation.user_id !== user.id && user.role !== 'admin') {
        throw new Error('你只能取消自己的預約');
    }

    const timeDiff = new Date(reservation.start_time) - new Date(currentTime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 6 && user.role !== 'admin') {
        throw new Error('距離預約時間已少於 6 小時，不可取消');
    }

    return await Reservation.delete(reservationId);
};

exports.approveReservation = async (reservationId) => {
    return await Reservation.updateStatus(reservationId, 'approved');
};

exports.rejectReservation = async (reservationId) => {
    return await Reservation.updateStatus(reservationId, 'rejected');
};