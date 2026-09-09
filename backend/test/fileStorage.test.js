const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");

const { validateFileContent } = require("../src/services/fileStorage.service");

function temporaryFile(context, name, contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mks-upload-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

test("accepts an ASCII STL signature", async (context) => {
  const filePath = temporaryFile(context, "model.stl", "solid test\nendsolid test\n");
  await assert.doesNotReject(validateFileContent(filePath, ".stl"));
});

test("rejects renamed arbitrary data", async (context) => {
  const filePath = temporaryFile(context, "fake.stl", "this is not a model");
  await assert.rejects(validateFileContent(filePath, ".stl"), /valid STL/);
});

test("accepts a 3MF containing a model part", async (context) => {
  const filePath = temporaryFile(context, "model.3mf", Buffer.alloc(0));
  const zip = new AdmZip();
  zip.addFile("3D/3dmodel.model", Buffer.from("<model />"));
  zip.writeZip(filePath);
  await assert.doesNotReject(validateFileContent(filePath, ".3mf"));
});

test("accepts an ASCII DXF section header", async (context) => {
  const filePath = temporaryFile(context, "drawing.dxf", "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n");
  await assert.doesNotReject(validateFileContent(filePath, ".dxf"));
});
