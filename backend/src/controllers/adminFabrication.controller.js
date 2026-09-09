const fabricationService = require("../services/fabrication.service");
const quotaService = require("../services/quota.service");
const { publishDisplayChange } = require("../services/displayEvents.service");
const QuotaPolicy = require("../models/quotaPolicy.model");

exports.getJobs = async (_req, res, next) => {
  try { res.json({ jobs: await fabricationService.getAllJobs() }); } catch (error) { next(error); }
};

exports.updateJob = async (req, res, next) => {
  try { res.json({ job: await fabricationService.adminAction(req.user, req.params.id, req.body.action, req.body) }); } catch (error) { next(error); }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const config = await fabricationService.updateConfig(req.body);
    publishDisplayChange("config_updated");
    res.json({ config });
  } catch (error) { next(error); }
};

exports.updateQuotaPolicy = async (req, res, next) => {
  try { res.json({ policy: await quotaService.updatePolicy(req.params.serviceType, req.body) }); } catch (error) { next(error); }
};

exports.getQuotaPolicies = async (_req, res, next) => {
  try { res.json({ policies: await QuotaPolicy.find().sort({ serviceType: 1 }).lean() }); } catch (error) { next(error); }
};
