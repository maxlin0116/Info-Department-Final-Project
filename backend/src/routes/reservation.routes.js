const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware');

router.get('/', reservationController.getAllReservations);
router.get('/current', reservationController.getCurrentReservations);

router.get('/my', authenticate, reservationController.getMyReservations);


router.post('/', optionalAuthenticate, reservationController.createReservation);

router.patch('/:id', authenticate, reservationController.updateReservation);

router.delete('/:id', authenticate, reservationController.cancelReservation);

module.exports = router;
