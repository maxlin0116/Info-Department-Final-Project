const areaService = require('../services/area.service');

exports.getAllAreas = async (req, res, next) => {
    try {
        const areas = await areaService.getAllAreasInfo();
        res.status(200).json({ areas });
    } catch (error) {
        next(error);
    }
};

exports.getAllAreasStatus = async (req, res, next) => {
    try {
        const currentTime = new Date();
        const statuses = await areaService.getAreaStatus(currentTime);
        res.status(200).json({ statuses });
    } catch (error) {
        next(error);
    }
};

exports.getAreaStatusById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentTime = new Date();
        const status = await areaService.getSingleAreaStatus(id, currentTime);
        
        if (!status) {
            return res.status(404).json({ error: '找不到該區域' });
        }
        
        res.status(200).json({ status });
    } catch (error) {
        next(error);
    }
};