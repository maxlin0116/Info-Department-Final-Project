const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const AdmZip = require("adm-zip");
const FabricationJob = require("../models/fabricationJob.model");
const { WORK_DIR, getAbsolutePath, storeGenerated } = require("./fileStorage.service");
const { publishDisplayChange } = require("./displayEvents.service");

function parseDurationText(value) {
  if (!value) return null;
  let seconds = 0;
  const day = value.match(/(\d+)\s*d/i);
  const hour = value.match(/(\d+)\s*h/i);
  const minute = value.match(/(\d+)\s*m(?!s)/i);
  const second = value.match(/(\d+)\s*s/i);
  if (day) seconds += Number(day[1]) * 86400;
  if (hour) seconds += Number(hour[1]) * 3600;
  if (minute) seconds += Number(minute[1]) * 60;
  if (second) seconds += Number(second[1]);
  return seconds > 0 ? seconds : null;
}

function parseSlicedArchive(archivePath) {
  const zip = new AdmZip(archivePath);
  const entries = zip.getEntries();
  const sliceInfo = entries.find((entry) => /Metadata\/slice_info\.config$/i.test(entry.entryName));
  const gcode = entries.find((entry) => /Metadata\/.*\.gcode$/i.test(entry.entryName));
  const infoText = sliceInfo ? sliceInfo.getData().toString("utf8") : "";
  const gcodeText = gcode ? gcode.getData().subarray(0, 256 * 1024).toString("utf8") : "";

  const predictionMatch = infoText.match(/(?:prediction=["']|key=["']prediction["']\s+value=["'])(\d+(?:\.\d+)?)/i);
  const weightMatch = infoText.match(/(?:weight=["']|key=["']weight["']\s+value=["'])(\d+(?:\.\d+)?)/i);
  const totalTimeMatch = gcodeText.match(/total estimated time:\s*([^;\r\n]+)/i);
  const modelTimeMatch = gcodeText.match(/model printing time:\s*([^;\r\n]+)/i);
  const layerMatch = gcodeText.match(/total layer number:\s*(\d+)/i);

  const estimatedSeconds = predictionMatch
    ? Math.round(Number(predictionMatch[1]))
    : parseDurationText(totalTimeMatch?.[1]) || parseDurationText(modelTimeMatch?.[1]);

  if (!estimatedSeconds || estimatedSeconds <= 0 || estimatedSeconds > 60 * 60 * 24 * 14) {
    throw new Error("Bambu Studio output did not contain a valid total print-time estimate");
  }

  return {
    estimatedSeconds,
    estimatedMinutes: Math.ceil(estimatedSeconds / 60),
    filamentGrams: weightMatch ? Number(weightMatch[1]) : null,
    layerCount: layerMatch ? Number(layerMatch[1]) : null
  };
}

function getCliArguments(sourcePath, outputPath, workDirectory, settings) {
  const machineProfile = process.env.BAMBU_MACHINE_PROFILE;
  const processProfile = process.env.BAMBU_PROCESS_PROFILE;
  const filamentProfile = process.env.BAMBU_FILAMENT_PROFILE;
  if (!machineProfile || !processProfile || !filamentProfile) {
    throw new Error("Bambu Studio profiles are not configured");
  }

  const supportEnabled = settings.supportType !== "none";
  const supportType = settings.supportType === "tree-auto" ? "tree(auto)" : "normal(auto)";
  const args = [
    "--debug", "2",
    "--slice", "0",
    "--arrange", "1",
    "--allow-newer-file",
    "--load-settings", `${machineProfile};${processProfile}`,
    "--load-filaments", filamentProfile,
    "--outputdir", workDirectory,
    "--export-3mf", path.basename(outputPath),
    `--layer-height=${settings.layerHeight}`,
    `--sparse-infill-density=${settings.infillPercent}%`,
    `--sparse-infill-pattern=${settings.infillPattern}`,
    `--enable-support=${supportEnabled ? 1 : 0}`,
    `--support-type=${supportType}`,
    `--brim-type=${settings.brimEnabled ? "auto_brim" : "no_brim"}`
  ];
  if (settings.scalePercent !== 100) args.push("--scale", String(settings.scalePercent / 100));
  // Bambu Studio defines orient as an integer option (0 = off, 1 = force,
  // other values = auto). A bare --orient is rejected by current Linux builds.
  if (settings.autoOrient) args.push("--orient", "1");
  args.push(sourcePath);
  return args;
}

function runCommand(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const useXvfb = String(process.env.BAMBU_STUDIO_USE_XVFB || "").toLowerCase() === "true";
    const command = useXvfb ? "xvfb-run" : executable;
    const commandArgs = useXvfb ? ["-a", executable, ...args] : args;
    const child = spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Bambu Studio slicing timed out"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-16000); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-16000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Bambu Studio exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

async function processSliceJob(jobId, workerId) {
  const job = await FabricationJob.findById(jobId).populate("sourceFile");
  if (!job || job.serviceType !== "3dp" || job.status !== "slicing" || job.sliceWorkerId !== workerId) return null;

  const executable = process.env.BAMBU_STUDIO_CLI;
  if (!executable) throw new Error("BAMBU_STUDIO_CLI is not configured on the slicing worker");

  const workDirectory = path.join(WORK_DIR, String(job._id));
  await fs.rm(workDirectory, { recursive: true, force: true });
  await fs.mkdir(workDirectory, { recursive: true });
  const outputPath = path.join(workDirectory, `${job._id}.gcode.3mf`);

  try {
    const args = getCliArguments(getAbsolutePath(job.sourceFile), outputPath, workDirectory, job.sliceSettings);
    await runCommand(executable, args, Number(process.env.SLICER_TIMEOUT_MS || 300000));
    const result = parseSlicedArchive(outputPath);
    const outputFile = await storeGenerated({
      sourcePath: outputPath,
      ownerId: job.user,
      originalFilename: `${job.title.replace(/[^a-z0-9_-]+/gi, "-") || "print"}.gcode.3mf`,
      metadata: result
    });

    const updatedJob = await FabricationJob.findOneAndUpdate(
      { _id: job._id, status: "slicing", sliceWorkerId: workerId },
      {
        $set: {
          outputFile: outputFile._id,
          estimatedSeconds: result.estimatedSeconds,
          estimatedMinutes: result.estimatedMinutes,
          filamentGrams: result.filamentGrams,
          layerCount: result.layerCount,
          slicerProfileVersion: process.env.BAMBU_PROFILE_VERSION || "P1S / 0.4 mm / Bambu PLA Basic",
          slicerError: "",
          status: "slice_ready",
          sliceWorkerId: ""
        }
      },
      { new: true }
    );
    if (!updatedJob) return null;
    publishDisplayChange("slice_ready");
    return updatedJob;
  } finally {
    await fs.rm(workDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

async function claimNextSliceJob() {
  const workerId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const staleBefore = new Date(Date.now() - Number(process.env.SLICER_STALE_LOCK_MS || 15 * 60 * 1000));
  const job = await FabricationJob.findOneAndUpdate(
    {
      serviceType: "3dp",
      status: "slicing",
      $or: [
        { sliceWorkerId: "" },
        { sliceWorkerId: { $exists: false } },
        { sliceStartedAt: { $lt: staleBefore } }
      ]
    },
    { $set: { sliceWorkerId: workerId, sliceStartedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  );
  return job ? { job, workerId } : null;
}

async function processNextSliceJob() {
  const claim = await claimNextSliceJob();
  if (!claim) return false;
  const { job, workerId } = claim;
  try {
    await processSliceJob(job._id, workerId);
  } catch (error) {
    await FabricationJob.findOneAndUpdate(
      { _id: job._id, status: "slicing", sliceWorkerId: workerId },
      { $set: { status: "slice_failed", sliceWorkerId: "", slicerError: String(error.message || error).slice(0, 2000) } }
    );
    publishDisplayChange("slice_failed");
  }
  return true;
}

module.exports = { parseDurationText, parseSlicedArchive, getCliArguments, processSliceJob, processNextSliceJob };
