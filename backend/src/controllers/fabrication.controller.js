const fabricationService = require("../services/fabrication.service");
const quotaService = require("../services/quota.service");

exports.getConfig = async (_req, res, next) => {
  try {
    const config = await fabricationService.getConfig();
    res.json({ config });
  } catch (error) { next(error); }
};

exports.getQueues = async (_req, res, next) => {
  try { res.json({ queues: await fabricationService.getQueues() }); } catch (error) { next(error); }
};

exports.getMyJobs = async (req, res, next) => {
  try { res.json({ jobs: await fabricationService.getMyJobs(req.user.id) }); } catch (error) { next(error); }
};

exports.getJob = async (req, res, next) => {
  try { res.json({ job: await fabricationService.getJob(req.user, req.params.id) }); } catch (error) { next(error); }
};

exports.createThreeDpJob = async (req, res, next) => {
  try { res.status(202).json({ job: await fabricationService.createJob(req.user, "3dp", req.file, req.body) }); } catch (error) { next(error); }
};

exports.createLaserJob = async (req, res, next) => {
  try { res.status(201).json({ job: await fabricationService.createJob(req.user, "laser", req.file, req.body) }); } catch (error) { next(error); }
};

exports.confirmJob = async (req, res, next) => {
  try { res.json({ job: await fabricationService.confirmThreeDpJob(req.user, req.params.id, req.body) }); } catch (error) { next(error); }
};

exports.retrySlice = async (req, res, next) => {
  try { res.json({ job: await fabricationService.retrySlice(req.user, req.params.id) }); } catch (error) { next(error); }
};

exports.cancelJob = async (req, res, next) => {
  try { res.json({ job: await fabricationService.cancelJob(req.user, req.params.id) }); } catch (error) { next(error); }
};

exports.collectJob = async (req, res, next) => {
  try { res.json({ job: await fabricationService.acknowledgeCollection(req.user, req.params.id) }); } catch (error) { next(error); }
};

exports.downloadFile = async (req, res, next) => {
  try {
    const { file, absolutePath } = await fabricationService.getFileForDownload(req.user, req.params.id);
    res.download(absolutePath, file.originalFilename);
  } catch (error) { next(error); }
};

exports.getMyQuota = async (req, res, next) => {
  try { res.json({ quota: await quotaService.getSummary(req.user.id, "3dp") }); } catch (error) { next(error); }
};
