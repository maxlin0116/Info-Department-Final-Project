const reservationService = require('../services/reservation.service');
const authService = require('../services/auth.service');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.getAllReservations = async (req, res, next) => {
    try {
        const reservations = await reservationService.getAllReservations();
        res.status(200).json({ reservations });
    } catch (error) {
        next(error);
    }
};

exports.getCurrentReservations = async (req, res, next) => {
    try {
        const currentTime = new Date();
        const currentReservations = await reservationService.getCurrentReservations(currentTime);
        res.status(200).json({ currentReservations });
    } catch (error) {
        next(error);
    }
};

exports.getMyReservations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const myReservations = await reservationService.getUserReservations(userId);
        res.status(200).json({ reservations: myReservations });
    } catch (error) {
        next(error);
    }
};

exports.createReservation = async (req, res, next) => {
    try {
        let user = req.user;
        const reservationData = req.body;
        
        if (!user) {
             const { userInfo } = req.body;
             
             if (!userInfo || !userInfo.student_id || !userInfo.password || !userInfo.name || !userInfo.grade || !userInfo.personal_email) {
                 return res.status(400).json({ error: 'Unregistered users must provide complete registration information to make a reservation' });
             }
             
             if (!emailRegex.test(userInfo.personal_email)) {
                 return res.status(400).json({ error: 'Invalid email format. Please check for missing @ or .' });
             }

             user = await authService.registerUser(userInfo);
        }

        const newReservation = await reservationService.createReservation(user, reservationData);
        
        res.status(201).json({ 
            message: 'Reservation successful', 
            reservation: newReservation,
            userCreated: !req.user 
        });
    } catch (error) {
        next(error);
    }
};

exports.updateReservation = async (req, res, next) => {
    try {
        const reservationId = req.params.id;
        const user = req.user;
        const updateData = req.body;
        const updatedReservation = await reservationService.updateReservation(user, reservationId, updateData);
        
        res.status(200).json({ message: 'Reservation updated successfully', reservation: updatedReservation });
    } catch (error) {
        next(error);
    }
};

exports.cancelReservation = async (req, res, next) => {
    try {
        const reservationId = req.params.id;
        const user = req.user;
        const currentTime = new Date();

        await reservationService.cancelReservation(user, reservationId, currentTime);
        
        res.status(200).json({ message: 'Reservation cancelled successfully' });
    } catch (error) {
        next(error);
    }
};