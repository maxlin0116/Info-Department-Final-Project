const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");

const { parseDurationText, parseSlicedArchive, getCliArguments } = require("../src/services/slicer.service");

test("parseDurationText handles Bambu-style duration fields", () => {
  assert.equal(parseDurationText("1d 2h 3m 4s"), 93784);
  assert.equal(parseDurationText("42m 8s"), 2528);
  assert.equal(parseDurationText("0s"), null);
});

test("getCliArguments applies P1S overrides and keeps input positional", () => {
  process.env.BAMBU_MACHINE_PROFILE = "/profiles/p1s-machine.json";
  process.env.BAMBU_PROCESS_PROFILE = "/profiles/standard-process.json";
  process.env.BAMBU_FILAMENT_PROFILE = "/profiles/bambu-pla-basic.json";
  const args = getCliArguments("/files/model.stl", "/work/output.gcode.3mf", "/work", {
    scalePercent: 125,
    layerHeight: 0.2,
    infillPercent: 15,
    infillPattern: "gyroid",
    supportType: "tree-auto",
    brimEnabled: true,
    autoOrient: true
  });

  assert.equal(args.at(-1), "/files/model.stl");
  assert.equal(args[args.indexOf("--scale") + 1], "1.25");
  assert.equal(args[args.indexOf("--orient") + 1], "1");
  assert.ok(args.includes("--enable-support=1"));
  assert.ok(args.includes("--sparse-infill-pattern=gyroid"));
  assert.equal(args[args.indexOf("--export-3mf") + 1], "output.gcode.3mf");
});

test("parseSlicedArchive extracts time, weight and layers", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mks-slicer-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const archivePath = path.join(directory, "output.gcode.3mf");
  const zip = new AdmZip();
  zip.addFile("Metadata/slice_info.config", Buffer.from('<config><plate prediction="3661" weight="12.5" /></config>'));
  zip.addFile("Metadata/plate_1.gcode", Buffer.from("; total layer number: 123\n"));
  zip.writeZip(archivePath);

  assert.deepEqual(parseSlicedArchive(archivePath), {
    estimatedSeconds: 3661,
    estimatedMinutes: 62,
    filamentGrams: 12.5,
    layerCount: 123
  });
});
