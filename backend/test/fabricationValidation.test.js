const test = require("node:test");
const assert = require("node:assert/strict");
const {
  acknowledgeCollection,
  LASER_MATERIAL_OPTIONS,
  deriveLaserTitle,
  normalizeLaserMaterial,
  serializeJob
} = require("../src/services/fabrication.service");
const FabricationJob = require("../src/models/fabricationJob.model");
const AuditLog = require("../src/models/auditLog.model");

test("laser job title is derived from the uploaded filename", () => {
  assert.equal(deriveLaserTitle("panel-v2.dxf"), "panel-v2");
  assert.equal(deriveLaserTitle("壓克力面板.DXF"), "壓克力面板");
});

test("laser material accepts only the four UI options", () => {
  assert.deepEqual(LASER_MATERIAL_OPTIONS, ["3mm 密集板", "5mm 密集板", "3mm 壓克力", "5mm 壓克力"]);
  for (const material of LASER_MATERIAL_OPTIONS) assert.equal(normalizeLaserMaterial(material), material);
  assert.throws(() => normalizeLaserMaterial("10mm 木板"), /有效的雷切材料與厚度/);
});

test("pickup acknowledgement fields are exposed to clients", () => {
  const collectedAt = new Date("2026-09-06T01:02:03.000Z");
  const result = serializeJob({
    _id: "job-1",
    user: "user-1",
    serviceType: "laser",
    title: "panel",
    status: "completed",
    collectedAt,
    collectedBy: "admin-1",
    createdAt: collectedAt,
    updatedAt: collectedAt
  });
  assert.equal(result.collectedAt, collectedAt);
  assert.equal(result.collectedBy, "admin-1");
});

test("the owner can acknowledge physical collection of a completed job", async () => {
  const originalFindById = FabricationJob.findById;
  const originalAuditCreate = AuditLog.create;
  let saveCount = 0;
  let auditAction = "";
  const rawJob = {
    _id: "job-1",
    user: "user-1",
    serviceType: "laser",
    title: "panel",
    status: "completed",
    collectedAt: null,
    collectedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    async save() { saveCount += 1; }
  };
  FabricationJob.findById = () => ({
    then(resolve, reject) { return Promise.resolve(rawJob).then(resolve, reject); },
    populate() { return Promise.resolve({ ...rawJob, user: { _id: "user-1", name: "Maker" } }); }
  });
  AuditLog.create = async (entry) => { auditAction = entry.action; };

  try {
    const result = await acknowledgeCollection({ id: "user-1", role: "user" }, "job-1");
    assert.equal(saveCount, 1);
    assert.equal(auditAction, "collect");
    assert.ok(rawJob.collectedAt instanceof Date);
    assert.equal(rawJob.collectedBy, "user-1");
    assert.equal(result.collectedBy, "user-1");
  } finally {
    FabricationJob.findById = originalFindById;
    AuditLog.create = originalAuditCreate;
  }
});
