const fsp = require("fs/promises");
const path = require("path");
const FabricationJob = require("../models/fabricationJob.model");
const UploadedFile = require("../models/uploadedFile.model");
const AuditLog = require("../models/auditLog.model");
const { getConfig, updateConfig } = require("./fabricationConfig.service");
const quotaService = require("./quota.service");
const { storeIncoming, getAbsolutePath } = require("./fileStorage.service");
const { publishDisplayChange } = require("./displayEvents.service");

const TERMINAL_STATUSES = ["completed", "rejected", "cancelled", "failed"];
const LASER_MATERIAL_OPTIONS = ["3mm 密集板", "5mm 密集板", "3mm 壓克力", "5mm 壓克力"];

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializeFile(file, includeDownload = false) {
  if (!file || typeof file !== "object") return file ? String(file) : null;
  const result = {
    id: String(file._id ?? file.id),
    originalFilename: file.originalFilename,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    kind: file.kind,
    metadata: file.metadata || {},
    createdAt: file.createdAt
  };
  if (includeDownload) result.downloadUrl = `/api/fabrication/files/${result.id}/download`;
  return result;
}

function serializeUser(user) {
  if (!user || typeof user !== "object") return user ? String(user) : null;
  return { id: String(user._id ?? user.id), name: user.name, grade: user.grade };
}

function calculateMaterialFee(filamentGrams) {
  if (filamentGrams === null || filamentGrams === undefined || filamentGrams === "") return null;
  const grams = Number(filamentGrams);
  return Number.isFinite(grams) && grams >= 0 ? Math.round(grams / 2) : null;
}

function serializeJob(job, options = {}) {
  const source = typeof job.toObject === "function" ? job.toObject() : job;
  return {
    id: String(source._id ?? source.id),
    user: serializeUser(source.user),
    serviceType: source.serviceType,
    title: source.title,
    status: source.status,
    sourceFile: serializeFile(source.sourceFile, options.includeDownloads),
    outputFile: serializeFile(source.outputFile, options.includeDownloads),
    sliceSettings: source.sliceSettings || null,
    slicerError: source.slicerError || "",
    slicerProfileVersion: source.slicerProfileVersion || "",
    estimatedSeconds: source.estimatedSeconds,
    estimatedMinutes: source.estimatedMinutes,
    filamentGrams: source.filamentGrams,
    materialFee: options.public ? undefined : calculateMaterialFee(source.filamentGrams),
    layerCount: source.layerCount,
    requestedColor: source.requestedColor || "",
    assignedColor: source.assignedColor || "",
    assignedAmsSlot: source.assignedAmsSlot,
    material: source.material || "",
    thickness: source.thickness || "",
    comment: options.public ? "" : source.comment || "",
    adminNote: options.public ? "" : source.adminNote || "",
    rejectionReason: options.public ? "" : source.rejectionReason || "",
    quotaReservedMinutes: source.quotaReservedMinutes || 0,
    quotaConsumedMinutes: source.quotaConsumedMinutes || 0,
    queueEnteredAt: source.queueEnteredAt,
    startedAt: source.startedAt,
    expectedEndAt: source.expectedEndAt,
    completedAt: source.completedAt,
    collectedAt: source.collectedAt,
    collectedBy: source.collectedBy ? String(source.collectedBy._id ?? source.collectedBy) : null,
    actualDurationMinutes: source.actualDurationMinutes,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

function deriveLaserTitle(originalFilename) {
  const filename = path.basename(String(originalFilename || "").trim());
  const title = path.parse(filename).name.trim();
  return (title || "雷切工作").slice(0, 80);
}

function normalizeLaserMaterial(value) {
  const material = String(value || "").trim();
  if (!LASER_MATERIAL_OPTIONS.includes(material)) {
    throw createError(400, "請選擇有效的雷切材料與厚度");
  }
  return material;
}

function parseSliceSettings(value) {
  let source = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { throw createError(400, "Invalid slice settings"); }
  }
  source = source || {};
  const numberInRange = (key, fallback, min, max) => {
    const parsed = Number(source[key] ?? fallback);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw createError(400, `Invalid ${key}`);
    return parsed;
  };
  const enumValue = (key, fallback, allowed) => {
    const parsed = String(source[key] ?? fallback);
    if (!allowed.includes(parsed)) throw createError(400, `Invalid ${key}`);
    return parsed;
  };
  const booleanValue = (key, fallback = false) => source[key] === undefined
    ? fallback
    : source[key] === true || source[key] === "true" || source[key] === 1 || source[key] === "1";
  const brimType = enumValue(
    "brimType",
    booleanValue("brimEnabled") ? "auto_brim" : "no_brim",
    ["no_brim", "auto_brim", "outer_only", "inner_only", "outer_and_inner"]
  );
  return {
    scalePercent: numberInRange("scalePercent", 100, 10, 400),
    rotationX: numberInRange("rotationX", 0, -360, 360),
    rotationY: numberInRange("rotationY", 0, -360, 360),
    rotationZ: numberInRange("rotationZ", 0, -360, 360),
    layerHeight: numberInRange("layerHeight", 0.2, 0.08, 0.28),
    initialLayerHeight: numberInRange("initialLayerHeight", 0.2, 0.08, 0.4),
    wallGenerator: enumValue("wallGenerator", "classic", ["classic", "arachne"]),
    seamPosition: enumValue("seamPosition", "aligned", ["aligned", "nearest", "back", "random"]),
    sliceClosingRadius: numberInRange("sliceClosingRadius", 0.049, 0, 1),
    resolution: numberInRange("resolution", 0.012, 0.001, 1),
    arcFitting: booleanValue("arcFitting", true),
    preciseZHeight: booleanValue("preciseZHeight"),
    xyContourCompensation: numberInRange("xyContourCompensation", 0, -2, 2),
    xyHoleCompensation: numberInRange("xyHoleCompensation", 0, -2, 2),
    elephantFootCompensation: numberInRange("elephantFootCompensation", 0.15, 0, 1),
    wallLoops: numberInRange("wallLoops", 2, 1, 10),
    topShellLayers: numberInRange("topShellLayers", 5, 0, 20),
    bottomShellLayers: numberInRange("bottomShellLayers", 3, 0, 20),
    infillPercent: numberInRange("infillPercent", 15, 0, 100),
    infillPattern: enumValue("infillPattern", "grid", ["grid", "gyroid", "honeycomb", "rectilinear", "cubic", "adaptivecubic", "lightning"]),
    outerWallSpeed: numberInRange("outerWallSpeed", 200, 10, 500),
    innerWallSpeed: numberInRange("innerWallSpeed", 300, 10, 500),
    infillSpeed: numberInRange("infillSpeed", 270, 10, 500),
    topSurfaceSpeed: numberInRange("topSurfaceSpeed", 200, 10, 500),
    travelSpeed: numberInRange("travelSpeed", 500, 10, 700),
    supportType: enumValue("supportType", "none", ["none", "normal-auto", "tree-auto", "normal-manual", "tree-manual"]),
    supportThresholdAngle: numberInRange("supportThresholdAngle", 30, 0, 90),
    supportOnBuildPlateOnly: booleanValue("supportOnBuildPlateOnly"),
    supportXyDistance: numberInRange("supportXyDistance", 0.4, 0, 2),
    supportTopZDistance: numberInRange("supportTopZDistance", 0.2, 0, 1),
    brimType,
    brimEnabled: brimType !== "no_brim",
    brimWidth: numberInRange("brimWidth", 5, 0, 30),
    brimObjectGap: numberInRange("brimObjectGap", 0.1, 0, 2),
    ironingType: enumValue("ironingType", "no ironing", ["no ironing", "top", "topmost", "all solid"]),
    ironingFlow: numberInRange("ironingFlow", 10, 1, 100),
    ironingSpeed: numberInRange("ironingSpeed", 30, 1, 150),
    autoOrient: booleanValue("autoOrient")
  };
}

async function assertServiceOpen(serviceType) {
  const config = await getConfig();
  const machine = config.machines.find((item) => item.serviceType === serviceType);
  if (!machine || !machine.serviceOpen || ["maintenance", "offline"].includes(machine.status)) {
    throw createError(403, `${serviceType === "3dp" ? "3DP" : "Laser"} service is currently unavailable`);
  }
  return config;
}

async function createJob(user, serviceType, file, body) {
  if (!file) throw createError(400, "Please upload a file");
  try {
    await assertServiceOpen(serviceType);
    const title = serviceType === "laser"
      ? deriveLaserTitle(body.originalFilename || file.originalname)
      : String(body.title || "").trim();
    if (!title) throw createError(400, "Please provide a job name");
    if (title.length > 80) throw createError(400, "Job name must be at most 80 characters");
    const sliceSettings = serviceType === "3dp" ? parseSliceSettings(body.sliceSettings) : undefined;
    const material = serviceType === "laser"
      ? normalizeLaserMaterial(body.material)
      : String(body.material || "Bambu PLA Basic").trim();

    const asset = await storeIncoming({
      tempPath: file.path,
      ownerId: user.id,
      serviceType,
      originalFilename: body.originalFilename || file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size
    });

    let job;
    try {
      job = await FabricationJob.create({
        user: user.id,
        serviceType,
        title,
        sourceFile: asset._id,
        status: serviceType === "3dp" ? "slicing" : "pending_admin_estimate",
        sliceSettings,
        material,
        thickness: "",
        comment: String(body.comment || "").trim()
      });
    } catch (error) {
      await UploadedFile.findByIdAndDelete(asset._id);
      await fsp.unlink(getAbsolutePath(asset)).catch(() => {});
      throw error;
    }

    await job.populate(["user", "sourceFile", "outputFile"]);
    publishDisplayChange("job_created");
    return serializeJob(job, { includeDownloads: true });
  } finally {
    await fsp.unlink(file.path).catch(() => {});
  }
}

async function getMyJobs(userId) {
  const jobs = await FabricationJob.find({ user: userId })
    .populate(["user", "sourceFile", "outputFile"])
    .sort({ createdAt: -1 });
  return jobs.map((job) => serializeJob(job, { includeDownloads: true }));
}

async function getJob(user, jobId) {
  const job = await FabricationJob.findById(jobId).populate(["user", "sourceFile", "outputFile"]);
  if (!job) throw createError(404, "Job not found");
  if (String(job.user._id) !== user.id && user.role !== "admin") throw createError(403, "Access denied");
  return serializeJob(job, { includeDownloads: true });
}

async function confirmThreeDpJob(user, jobId, data) {
  const job = await FabricationJob.findById(jobId);
  if (!job || String(job.user) !== user.id) throw createError(404, "Job not found");
  if (job.serviceType !== "3dp" || job.status !== "slice_ready") throw createError(409, "This job is not ready to confirm");

  const config = await getConfig();
  const requestedSlot = Number(data.amsSlot);
  const slot = config.amsSlots.find((item) => item.slot === requestedSlot && item.available);
  if (!slot) throw createError(400, "Please choose an available AMS color");

  const quota = await quotaService.reserve(job.user, "3dp", job.estimatedMinutes);
  try {
    const updated = await FabricationJob.findOneAndUpdate(
      { _id: job._id, user: user.id, status: "slice_ready" },
      {
        $set: {
          requestedColor: slot.colorName,
          assignedColor: slot.colorName,
          assignedAmsSlot: slot.slot,
          quotaPeriodKey: quota.periodKey,
          quotaReservedMinutes: quota.reservedMinutes,
          status: "pending_admin_review"
        }
      },
      { new: true, runValidators: true }
    );
    if (!updated) throw createError(409, "This job was already confirmed");
  } catch (error) {
    if (quota.reservedMinutes) {
      job.quotaPeriodKey = quota.periodKey;
      job.quotaReservedMinutes = quota.reservedMinutes;
      await quotaService.release(job);
    }
    throw error;
  }
  publishDisplayChange("job_confirmed");
  return getJob(user, jobId);
}

async function retrySlice(user, jobId) {
  const job = await FabricationJob.findById(jobId);
  if (!job || (String(job.user) !== user.id && user.role !== "admin")) throw createError(404, "Job not found");
  if (job.status !== "slice_failed") throw createError(409, "Only failed slices can be retried");
  job.status = "slicing";
  job.slicerError = "";
  job.sliceWorkerId = "";
  job.sliceStartedAt = null;
  await job.save();
  return getJob(user, jobId);
}

async function cancelJob(user, jobId) {
  const job = await FabricationJob.findById(jobId);
  if (!job || (String(job.user) !== user.id && user.role !== "admin")) throw createError(404, "Job not found");
  if (TERMINAL_STATUSES.includes(job.status) || job.status === "running") throw createError(409, "This job can no longer be cancelled");
  await quotaService.release(job);
  job.status = "cancelled";
  await job.save();
  publishDisplayChange("job_cancelled");
  return getJob(user, jobId);
}

async function getQueues() {
  const jobs = await FabricationJob.find({
    $or: [
      { status: { $in: ["pending_admin_estimate", "pending_admin_review", "queued", "running"] } },
      { status: "completed", collectedAt: null }
    ]
  })
    .populate("user")
    .sort({ serviceType: 1, queueEnteredAt: 1, createdAt: 1 });
  const now = Date.now();
  const result = { "3dp": [], laser: [] };

  for (const serviceType of ["3dp", "laser"]) {
    const serviceJobs = jobs
      .filter((job) => job.serviceType === serviceType)
      .sort((left, right) => {
        if (left.status === "running") return -1;
        if (right.status === "running") return 1;
        if (left.status === "queued" && right.status !== "queued") return -1;
        if (right.status === "queued" && left.status !== "queued") return 1;
        if (left.status === "completed" && right.status !== "completed") return 1;
        if (right.status === "completed" && left.status !== "completed") return -1;
        const leftTime = left.status === "completed" ? left.completedAt : left.queueEnteredAt || left.createdAt;
        const rightTime = right.status === "completed" ? right.completedAt : right.queueEnteredAt || right.createdAt;
        return new Date(leftTime || 0) - new Date(rightTime || 0);
      });
    const running = serviceJobs.find((job) => job.status === "running");
    let cursor = running?.expectedEndAt ? Math.max(new Date(running.expectedEndAt).getTime(), now) : now;
    let position = 0;
    for (const job of serviceJobs) {
      const serialized = serializeJob(job, { public: true });
      if (job.status === "running") {
        result[serviceType].push({ ...serialized, position: 0, estimatedStartAt: job.startedAt });
        continue;
      }
      if (job.status === "queued") {
        position += 1;
        const start = new Date(cursor);
        cursor += (job.estimatedMinutes || 0) * 60000;
        result[serviceType].push({ ...serialized, position, estimatedStartAt: start, estimatedEndAt: new Date(cursor) });
        continue;
      }
      result[serviceType].push(serialized);
    }
  }
  return result;
}

async function acknowledgeCollection(actor, jobId) {
  const job = await FabricationJob.findById(jobId);
  if (!job) throw createError(404, "Job not found");
  if (actor.role !== "admin" && String(job.user) !== actor.id) throw createError(403, "Access denied");
  if (job.status !== "completed") throw createError(409, "Only completed jobs can be marked as collected");
  if (!job.collectedAt) {
    job.collectedAt = new Date();
    job.collectedBy = actor.id;
    await job.save();
    await logAction(actor, "collect", job);
    publishDisplayChange("job_collected");
  }
  return getJob(actor, jobId);
}

async function getFileForDownload(user, fileId) {
  const file = await UploadedFile.findById(fileId);
  if (!file) throw createError(404, "File not found");
  if (String(file.owner) !== user.id && user.role !== "admin") throw createError(403, "Access denied");
  return { file, absolutePath: getAbsolutePath(file) };
}

async function getAllJobs() {
  const jobs = await FabricationJob.find().populate(["user", "sourceFile", "outputFile"]).sort({ createdAt: -1 });
  return jobs.map((job) => serializeJob(job, { includeDownloads: true }));
}

async function logAction(actor, action, job, details = {}) {
  await AuditLog.create({ actor: actor.id, action, entityType: "FabricationJob", entityId: job._id, details });
}

async function adminAction(actor, jobId, action, data = {}) {
  if (action === "collect") return acknowledgeCollection(actor, jobId);
  const job = await FabricationJob.findById(jobId);
  if (!job) throw createError(404, "Job not found");
  const now = new Date();
  let startRollback = null;
  let reservedDuringAction = false;

  if (action === "estimate_laser") {
    if (job.serviceType !== "laser" || job.status !== "pending_admin_estimate") throw createError(409, "Laser job is not waiting for an estimate");
    const minutes = Math.ceil(Number(data.estimatedMinutes));
    if (!Number.isFinite(minutes) || minutes < 1) throw createError(400, "Estimated minutes must be at least 1");
    const quota = await quotaService.reserve(job.user, "laser", minutes);
    job.estimatedMinutes = minutes;
    job.estimatedSeconds = minutes * 60;
    job.adminNote = String(data.adminNote || "").trim();
    job.quotaPeriodKey = quota.periodKey;
    job.quotaReservedMinutes = quota.reservedMinutes;
    job.status = "queued";
    job.queueEnteredAt = now;
    job.reviewedBy = actor.id;
    reservedDuringAction = quota.reservedMinutes > 0;
  } else if (action === "approve") {
    if (job.serviceType !== "3dp" || job.status !== "pending_admin_review") throw createError(409, "3DP job is not waiting for review");
    job.status = "queued";
    job.queueEnteredAt = now;
    job.reviewedBy = actor.id;
  } else if (action === "start") {
    if (job.status !== "queued") throw createError(409, "Only queued jobs can be started");
    const firstQueuedJob = await FabricationJob.findOne({ serviceType: job.serviceType, status: "queued" })
      .sort({ queueEnteredAt: 1, createdAt: 1 })
      .select("_id");
    if (!firstQueuedJob || String(firstQueuedJob._id) !== String(job._id)) {
      throw createError(409, "Jobs must be started in FIFO queue order");
    }
    const running = await FabricationJob.exists({ serviceType: job.serviceType, status: "running" });
    if (running) throw createError(409, "This machine is already running another job");
    const config = await getConfig();
    const machine = config.machines.find((item) => item.serviceType === job.serviceType);
    if (!machine || !machine.serviceOpen || machine.status !== "idle") throw createError(409, "Machine is unavailable");
    const consumedAmount = job.quotaReservedMinutes;
    await quotaService.consume(job);
    job.status = "running";
    job.startedAt = now;
    job.expectedEndAt = new Date(now.getTime() + (job.estimatedMinutes || 0) * 60000);
    const previousMachineStatus = machine.status;
    machine.status = "running";
    await config.save();
    startRollback = { config, machine, previousMachineStatus, consumedAmount };
  } else if (action === "complete" || action === "fail") {
    if (job.status !== "running") throw createError(409, "Only running jobs can be finished");
    job.status = action === "complete" ? "completed" : "failed";
    job.completedAt = now;
    job.actualDurationMinutes = job.startedAt ? Math.max(1, Math.ceil((now - job.startedAt) / 60000)) : null;
    job.adminNote = String(data.adminNote || job.adminNote || "").trim();
    const config = await getConfig();
    const machine = config.machines.find((item) => item.serviceType === job.serviceType);
    if (machine) machine.status = "idle";
    await config.save();
  } else if (action === "reject") {
    if (!["pending_admin_review", "pending_admin_estimate", "queued"].includes(job.status)) throw createError(409, "This job cannot be rejected");
    await quotaService.release(job);
    job.status = "rejected";
    job.rejectionReason = String(data.reason || "Rejected by administrator").trim();
  } else if (action === "update") {
    if (data.assignedAmsSlot !== undefined) {
      const requestedSlot = Number(data.assignedAmsSlot);
      const config = await getConfig();
      const slot = config.amsSlots.find((item) => item.slot === requestedSlot && item.available);
      if (!slot) throw createError(400, "Please choose an available AMS slot");
      job.assignedAmsSlot = slot.slot;
      job.assignedColor = data.assignedColor === undefined ? slot.colorName : String(data.assignedColor).trim();
    } else if (data.assignedColor !== undefined) {
      job.assignedColor = String(data.assignedColor).trim();
    }
    if (data.adminNote !== undefined) job.adminNote = String(data.adminNote).trim();
  } else {
    throw createError(400, "Unsupported admin action");
  }

  try {
    await job.save();
  } catch (error) {
    if (reservedDuringAction) await quotaService.release(job).catch(() => {});
    if (startRollback) {
      await quotaService.rollbackConsume(job, startRollback.consumedAmount).catch(() => {});
      const hasRunningJob = await FabricationJob.exists({ serviceType: job.serviceType, status: "running" });
      startRollback.machine.status = hasRunningJob ? "running" : startRollback.previousMachineStatus;
      await startRollback.config.save().catch(() => {});
    }
    throw error;
  }
  await logAction(actor, action, job, data);
  publishDisplayChange(`admin_${action}`);
  return getJob(actor, jobId);
}

module.exports = {
  serializeJob,
  createJob,
  getMyJobs,
  getJob,
  confirmThreeDpJob,
  retrySlice,
  cancelJob,
  getQueues,
  getFileForDownload,
  getAllJobs,
  adminAction,
  acknowledgeCollection,
  deriveLaserTitle,
  normalizeLaserMaterial,
  calculateMaterialFee,
  LASER_MATERIAL_OPTIONS,
  getConfig,
  updateConfig
};
