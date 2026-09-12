const reservationService = require("../services/reservation.service");
const { publishDisplayChange } = require("../services/displayEvents.service");

exports.getAllReservations = async (_req, res, next) => {
  try {
    const reservations = await reservationService.getAllReservations();
    res.status(200).json({ reservations });
  } catch (error) {
    next(error);
  }
};

exports.getCurrentReservations = async (_req, res, next) => {
  try {
    const currentReservations = await reservationService.getCurrentReservations(new Date());
    res.status(200).json({ currentReservations });
  } catch (error) {
    next(error);
  }
};

exports.getMyReservations = async (req, res, next) => {
  try {
    const myReservations = await reservationService.getUserReservations(req.user.id);
    const quota = await reservationService.getUserQuota(req.user.id);
    res.status(200).json({ reservations: myReservations, quota });
  } catch (error) {
    next(error);
  }
};

exports.getMyReservationQuota = async (req, res, next) => {
  try {
    const quota = await reservationService.getUserQuota(req.user.id);
    res.status(200).json({ quota });
  } catch (error) {
    next(error);
  }
};

exports.createReservation = async (req, res, next) => {
  try {
    const newReservation = await reservationService.createReservation(req.user, req.body);
    publishDisplayChange("reservation_created");

    res.status(201).json({
      message: "Reservation successful",
      reservation: newReservation,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateReservation = async (req, res, next) => {
  try {
    const updatedReservation = await reservationService.updateReservation(req.user, req.params.id, req.body);
    publishDisplayChange("reservation_updated");
    res.status(200).json({ message: "Reservation updated successfully", reservation: updatedReservation });
  } catch (error) {
    next(error);
  }
};

exports.cancelReservation = async (req, res, next) => {
  try {
    const cancelledReservation = await reservationService.cancelReservation(req.user, req.params.id, new Date());
    publishDisplayChange("reservation_cancelled");
    res.status(200).json({ message: "Reservation cancelled successfully", reservation: cancelledReservation });
  } catch (error) {
    next(error);
  }
};

exports.checkInReservation = async (req, res, next) => {
  try {
    const reservation = await reservationService.checkInReservation(req.user, req.params.id, new Date());
    publishDisplayChange("reservation_check_in_requested");
    res.status(200).json({ message: "Check-in submitted for administrator confirmation", reservation });
  } catch (error) {
    next(error);
  }
};
