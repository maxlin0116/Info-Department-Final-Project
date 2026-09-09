const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const AdmZip = require("adm-zip");
const UploadedFile = require("../models/uploadedFile.model");

const STORAGE_ROOT = path.resolve(process.env.FILE_STORAGE_ROOT || path.join(__dirname, "../../storage"));
const INCOMING_DIR = path.join(STORAGE_ROOT, "incoming");
const SOURCE_DIR = path.join(STORAGE_ROOT, "source");
const OUTPUT_DIR = path.join(STORAGE_ROOT, "output");
const WORK_DIR = path.join(STORAGE_ROOT, "work");

for (const directory of [INCOMING_DIR, SOURCE_DIR, OUTPUT_DIR, WORK_DIR]) fs.mkdirSync(directory, { recursive: true });

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function getAbsolutePath(file) {
  const relativeParts = String(file.relativePath || "").split(/[\\/]+/).filter(Boolean);
  const absolutePath = path.resolve(STORAGE_ROOT, ...relativeParts);
  if (!absolutePath.startsWith(STORAGE_ROOT + path.sep)) throw createError(400, "Unsafe file path");
  return absolutePath;
}

function getPortableRelativePath(filePath) {
  return path.relative(STORAGE_ROOT, filePath).split(path.sep).join("/");
}

async function validateFileContent(filePath, extension) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(512);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const start = header.subarray(0, bytesRead);

    if (extension === ".stl") {
      const stat = await handle.stat();
      const asciiHeader = start.toString("utf8").trimStart().toLowerCase();
      const binaryTriangleCount = bytesRead >= 84 ? start.readUInt32LE(80) : 0;
      const expectedBinarySize = 84 + binaryTriangleCount * 50;
      if (!asciiHeader.startsWith("solid") && expectedBinarySize !== stat.size) {
        throw createError(400, "The uploaded file is not a valid STL file");
      }
      return;
    }

    if (extension === ".dxf") {
      const text = start.toString("utf8").replace(/\0/g, "").toUpperCase();
      const isAsciiDxf = /(?:^|\r?\n)\s*0\s*\r?\n\s*SECTION\s*(?:\r?\n|$)/.test(text);
      const isBinaryDxf = start.toString("ascii", 0, 22).startsWith("AutoCAD Binary DXF");
      if (!isAsciiDxf && !isBinaryDxf) throw createError(400, "The uploaded file is not a valid DXF file");
      return;
    }
  } finally {
    await handle.close();
  }

  if (extension === ".3mf") {
    let zip;
    try { zip = new AdmZip(filePath); } catch { throw createError(400, "The uploaded file is not a valid 3MF archive"); }
    const entries = zip.getEntries();
    const totalExpandedBytes = entries.reduce((sum, entry) => sum + Number(entry.header?.size || 0), 0);
    const hasModel = entries.some((entry) => /^3D\/.*\.model$/i.test(entry.entryName));
    const unsafePath = entries.some((entry) => entry.entryName.split("/").some((part) => part === ".."));
    if (!hasModel || unsafePath || entries.length > 10000 || totalExpandedBytes > 500 * 1024 * 1024) {
      throw createError(400, "The uploaded 3MF archive is invalid or expands beyond the safety limit");
    }
  }
}

async function storeIncoming({ tempPath, ownerId, serviceType, originalFilename, mimeType, sizeBytes }) {
  const extension = path.extname(originalFilename).toLowerCase();
  const allowed = serviceType === "3dp" ? [".stl", ".3mf"] : [".dxf"];
  if (!allowed.includes(extension)) {
    await fsp.unlink(tempPath).catch(() => {});
    throw createError(400, `${serviceType === "3dp" ? "3DP" : "Laser"} files must be ${allowed.join(" or ")}`);
  }

  try {
    await validateFileContent(tempPath, extension);
  } catch (error) {
    await fsp.unlink(tempPath).catch(() => {});
    throw error;
  }

  const storedFilename = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(SOURCE_DIR, storedFilename);
  await fsp.rename(tempPath, destination);
  try {
    const sha256 = await sha256File(destination);
    return await UploadedFile.create({
      owner: ownerId,
      serviceType,
      kind: "source",
      originalFilename: path.basename(originalFilename),
      storedFilename,
      relativePath: getPortableRelativePath(destination),
      extension,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes,
      sha256,
      validationStatus: "ready"
    });
  } catch (error) {
    await fsp.unlink(destination).catch(() => {});
    throw error;
  }
}

async function storeGenerated({ sourcePath, ownerId, originalFilename, metadata = {} }) {
  const extension = path.extname(originalFilename).toLowerCase() || ".3mf";
  const storedFilename = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(OUTPUT_DIR, storedFilename);
  await fsp.copyFile(sourcePath, destination);
  const stat = await fsp.stat(destination);
  const sha256 = await sha256File(destination);
  return UploadedFile.create({
    owner: ownerId,
    serviceType: "3dp",
    kind: "sliced_output",
    originalFilename,
    storedFilename,
    relativePath: getPortableRelativePath(destination),
    extension,
    mimeType: "model/3mf",
    sizeBytes: stat.size,
    sha256,
    validationStatus: "generated",
    metadata
  });
}

module.exports = {
  STORAGE_ROOT,
  INCOMING_DIR,
  WORK_DIR,
  getAbsolutePath,
  validateFileContent,
  storeIncoming,
  storeGenerated,
  sha256File
};
