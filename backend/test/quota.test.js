const test = require("node:test");
const assert = require("node:assert/strict");
const { getPeriodKey } = require("../src/services/quota.service");

test("monthly quota rolls over in Asia/Taipei rather than UTC", () => {
  assert.equal(getPeriodKey("monthly", new Date("2026-01-31T16:30:00.000Z")), "2026-02");
});

test("weekly quota key is the Monday date in Asia/Taipei", () => {
  assert.equal(getPeriodKey("weekly", new Date("2026-09-06T12:00:00.000Z")), "2026-08-31");
  assert.equal(getPeriodKey("weekly", new Date("2026-09-07T02:00:00.000Z")), "2026-09-07");
});
