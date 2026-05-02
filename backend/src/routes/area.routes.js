const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');

router.get('/', areaController.getAllAreas);

router.get('/status', areaController.getAllAreasStatus);

router.get('/:id/status', areaController.getAreaStatusById);

module.exports = router;