const QuotaPolicy = require("../models/quotaPolicy.model");
const QuotaBucket = require("../models/quotaBucket.model");
const FabricationJob = require("../models/fabricationJob.model");

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function taipeiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function getPeriodKey(period, date = new Date()) {
  const parts = taipeiDateParts(date);
  if (period === "monthly") return `${parts.year}-${parts.month}`;

  const pseudoLocal = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = pseudoLocal.getUTCDay() || 7;
  pseudoLocal.setUTCDate(pseudoLocal.getUTCDate() - day + 1);
  return pseudoLocal.toISOString().slice(0, 10);
}

async function getPolicy(serviceType) {
  return QuotaPolicy.findOne({ serviceType }).lean();
}

async function ensureBucket(userId, serviceType, policy, periodKey) {
  try {
    return await QuotaBucket.findOneAndUpdate(
      { user: userId, serviceType, periodKey },
      { $setOnInsert: { limitMinutes: policy.limitMinutes, reservedMinutes: 0, consumedMinutes: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return QuotaBucket.findOne({ user: userId, serviceType, periodKey });
  }
}

async function reserve(userId, serviceType, minutes) {
  const amount = Math.max(0, Math.ceil(Number(minutes)));
  const policy = await getPolicy(serviceType);
  if (!policy || !policy.enabled || amount === 0) return { periodKey: "", reservedMinutes: 0 };

  const activeCount = await FabricationJob.countDocuments({
    user: userId,
    serviceType,
    status: { $in: ["pending_admin_review", "queued", "running"] }
  });
  if (activeCount >= policy.maxActiveJobs) {
    throw createError(409, `You may only have ${policy.maxActiveJobs} active ${serviceType} job(s)`);
  }

  const periodKey = getPeriodKey(policy.period);
  await ensureBucket(userId, serviceType, policy, periodKey);
  const bucket = await QuotaBucket.findOneAndUpdate(
    {
      user: userId,
      serviceType,
      periodKey,
      $expr: {
        $lte: [
          { $add: ["$reservedMinutes", "$consumedMinutes", amount] },
          "$limitMinutes"
        ]
      }
    },
    { $inc: { reservedMinutes: amount } },
    { new: true }
  );

  if (!bucket) throw createError(409, "This job exceeds your remaining print-time quota");
  return { periodKey, reservedMinutes: amount, bucket };
}

async function release(job) {
  if (!job.quotaPeriodKey || !job.quotaReservedMinutes) return;
  const amount = job.quotaReservedMinutes;
  const result = await QuotaBucket.updateOne(
    { user: job.user, serviceType: job.serviceType, periodKey: job.quotaPeriodKey, reservedMinutes: { $gte: amount } },
    { $inc: { reservedMinutes: -amount } }
  );
  if (result.modifiedCount) job.quotaReservedMinutes = 0;
}

async function consume(job) {
  if (!job.quotaPeriodKey || !job.quotaReservedMinutes) return;
  const amount = job.quotaReservedMinutes;
  const result = await QuotaBucket.updateOne(
    { user: job.user, serviceType: job.serviceType, periodKey: job.quotaPeriodKey, reservedMinutes: { $gte: amount } },
    { $inc: { reservedMinutes: -amount, consumedMinutes: amount } }
  );
  if (!result.modifiedCount) throw createError(409, "Reserved quota could not be consumed");
  job.quotaReservedMinutes = 0;
  job.quotaConsumedMinutes += amount;
}

async function rollbackConsume(job, amount) {
  if (!job.quotaPeriodKey || !amount) return;
  const result = await QuotaBucket.updateOne(
    { user: job.user, serviceType: job.serviceType, periodKey: job.quotaPeriodKey, consumedMinutes: { $gte: amount } },
    { $inc: { reservedMinutes: amount, consumedMinutes: -amount } }
  );
  if (result.modifiedCount) {
    job.quotaReservedMinutes += amount;
    job.quotaConsumedMinutes = Math.max(0, job.quotaConsumedMinutes - amount);
  }
}

async function getSummary(userId, serviceType = "3dp") {
  const policy = await getPolicy(serviceType);
  if (!policy) return null;
  const periodKey = getPeriodKey(policy.period);
  const bucket = await ensureBucket(userId, serviceType, policy, periodKey);
  return {
    enabled: policy.enabled,
    period: policy.period,
    periodKey,
    limitMinutes: bucket.limitMinutes,
    reservedMinutes: bucket.reservedMinutes,
    consumedMinutes: bucket.consumedMinutes,
    remainingMinutes: Math.max(bucket.limitMinutes - bucket.reservedMinutes - bucket.consumedMinutes, 0),
    maxActiveJobs: policy.maxActiveJobs
  };
}

async function updatePolicy(serviceType, data) {
  const update = {};
  if (typeof data.enabled === "boolean") update.enabled = data.enabled;
  if (["weekly", "monthly"].includes(data.period)) update.period = data.period;
  if (Number.isFinite(Number(data.limitMinutes)) && Number(data.limitMinutes) > 0) update.limitMinutes = Number(data.limitMinutes);
  if (Number.isFinite(Number(data.maxActiveJobs)) && Number(data.maxActiveJobs) > 0) update.maxActiveJobs = Number(data.maxActiveJobs);
  const policy = await QuotaPolicy.findOneAndUpdate(
    { serviceType },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (update.limitMinutes) {
    const periodKey = getPeriodKey(policy.period);
    await QuotaBucket.updateMany({ serviceType, periodKey }, { $set: { limitMinutes: policy.limitMinutes } });
  }
  return policy;
}

module.exports = { getPeriodKey, reserve, release, consume, rollbackConsume, getSummary, updatePolicy };
