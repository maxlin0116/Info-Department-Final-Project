exports.listUsers = (req, res) => {
  res.json({ message: "List users endpoint" });
};

exports.updateUserRole = (req, res) => {
  res.json({ message: "Update user role endpoint" });
};

exports.listPendingReservations = (req, res) => {
  res.json({ message: "Pending reservations endpoint" });
};

exports.approveReservation = (req, res) => {
  res.json({ message: "Approve reservation endpoint" });
};

exports.rejectReservation = (req, res) => {
  res.json({ message: "Reject reservation endpoint" });
};
