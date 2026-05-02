const Area = require('../models/area.model');
const Reservation = require('../models/reservation.model');

exports.getAllAreasInfo = async () => {
    return await Area.findAll();
};

exports.getAreaStatus = async (currentTime) => {
    const areas = await Area.findAll();
    const statuses = await Promise.all(
        areas.map(async (area) => {
            const currentReservations = await Reservation.findCurrentByArea(area.id, currentTime);

            const usedCount = currentReservations.reduce(
                (sum, res) => sum + res.participant_count, 
                0
            );

            return {
                area: {
                    id: area.id,
                    name: area.name,
                    type: area.type,
                    maxCapacity: area.max_capacity
                },
                usedCount,
                isFull: usedCount >= area.max_capacity,
                hasActivePrinting: area.type === '3dp' && currentReservations.length > 0
            };
        })
    );

    return statuses;
};

exports.getSingleAreaStatus = async (areaId, currentTime) => {
    const area = await Area.findById(areaId);
    
    if (!area) {
        return null; 
    }

    const currentReservations = await Reservation.findCurrentByArea(areaId, currentTime);

    const usedCount = currentReservations.reduce(
        (sum, res) => sum + res.participant_count, 
        0
    );

    return {
        area: {
            id: area.id,
            name: area.name,
            type: area.type,
            maxCapacity: area.max_capacity
        },
        usedCount,
        isFull: usedCount >= area.max_capacity,
        hasActivePrinting: area.type === '3dp' && currentReservations.length > 0
    };
};
