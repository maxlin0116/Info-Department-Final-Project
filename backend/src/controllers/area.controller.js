exports.listAreas = (req, res) => {
  res.json({ message: "List areas endpoint" });
};

exports.getAreaStatus = (req, res) => {
  res.json({ message: "Area status endpoint" });
};

exports.getAreaStatusById = (req, res) => {
  res.json({ message: "Area status by id endpoint" });
};
