const test = require("node:test");
const assert = require("node:assert/strict");

const reservationService = require("../src/services/reservation.service");
const { areas } = require("../src/database/seedAreas");
const Reservation = require("../src/models/reservation.model");

test("MakerSpace is the only time-slot reservation area", () => {
  const scheduleAreas = areas.filter((area) => area.bookingMode === "schedule");
  assert.deepEqual(scheduleAreas.map((area) => area.name), ["MakerSpace"]);
  assert.equal(areas.some((area) => area.type === "soldering"), false);
});

test("check-in window defaults to 15 minutes before and after start", (context) => {
  const previousEarly = process.env.RESERVATION_CHECK_IN_EARLY_MINUTES;
  const previousGrace = process.env.RESERVATION_CHECK_IN_GRACE_MINUTES;
  context.after(() => {
    if (previousEarly === undefined) delete process.env.RESERVATION_CHECK_IN_EARLY_MINUTES;
    else process.env.RESERVATION_CHECK_IN_EARLY_MINUTES = previousEarly;
    if (previousGrace === undefined) delete process.env.RESERVATION_CHECK_IN_GRACE_MINUTES;
    else process.env.RESERVATION_CHECK_IN_GRACE_MINUTES = previousGrace;
  });
  delete process.env.RESERVATION_CHECK_IN_EARLY_MINUTES;
  delete process.env.RESERVATION_CHECK_IN_GRACE_MINUTES;

  const start = new Date("2026-09-12T02:00:00.000Z");
  const window = reservationService.getCheckInWindow(start);
  assert.equal(window.opensAt.toISOString(), "2026-09-12T01:45:00.000Z");
  assert.equal(window.closesAt.toISOString(), "2026-09-12T02:15:00.000Z");
});

test("check-in policy can be configured for deployment", (context) => {
  const previousEarly = process.env.RESERVATION_CHECK_IN_EARLY_MINUTES;
  const previousGrace = process.env.RESERVATION_CHECK_IN_GRACE_MINUTES;
  context.after(() => {
    if (previousEarly === undefined) delete process.env.RESERVATION_CHECK_IN_EARLY_MINUTES;
    else process.env.RESERVATION_CHECK_IN_EARLY_MINUTES = previousEarly;
    if (previousGrace === undefined) delete process.env.RESERVATION_CHECK_IN_GRACE_MINUTES;
    else process.env.RESERVATION_CHECK_IN_GRACE_MINUTES = previousGrace;
  });
  process.env.RESERVATION_CHECK_IN_EARLY_MINUTES = "10";
  process.env.RESERVATION_CHECK_IN_GRACE_MINUTES = "20";

  assert.deepEqual(reservationService.getCheckInPolicy(), { earlyMinutes: 10, graceMinutes: 20 });
});

test("owner check-in moves an approved reservation to admin confirmation", async (context) => {
  const originalFindById = Reservation.findById;
  context.after(() => { Reservation.findById = originalFindById; });
  const reservation = {
    _id: "reservation-1",
    user: "user-1",
    area: "area-1",
    status: "approved",
    startTime: new Date("2026-09-12T02:00:00.000Z"),
    endTime: new Date("2026-09-12T03:00:00.000Z"),
    async save() {},
    async populate() {},
    toObject() { return { ...this }; }
  };
  Reservation.findById = async () => reservation;

  const result = await reservationService.checkInReservation(
    { id: "user-1" },
    "reservation-1",
    new Date("2026-09-12T01:50:00.000Z")
  );
  assert.equal(result.status, "check_in_pending");
  assert.equal(reservation.lifecycleReason, "Waiting for administrator attendance confirmation");
});

test("lifecycle sweep releases approved reservations after grace period", async (context) => {
  const originalUpdateMany = Reservation.updateMany;
  context.after(() => { Reservation.updateMany = originalUpdateMany; });
  const calls = [];
  Reservation.updateMany = async (query, update) => {
    calls.push({ query, update });
    return { modifiedCount: query.status === "approved" ? 1 : 0 };
  };

  const now = new Date("2026-09-12T02:16:00.000Z");
  const result = await reservationService.runLifecycleSweep(now);
  const noShowCall = calls.find((call) => call.query.status === "approved");
  assert.equal(noShowCall.query.startTime.$lte.toISOString(), "2026-09-12T02:01:00.000Z");
  assert.equal(noShowCall.update.$set.status, "no_show");
  assert.equal(result.noShows, 1);
  assert.equal(result.changed, 1);
});

test("administrator confirmation moves checked-in reservation to in-use", async (context) => {
  const originalFindById = Reservation.findById;
  context.after(() => { Reservation.findById = originalFindById; });
  const reservation = {
    _id: "reservation-2",
    user: "user-1",
    area: "area-1",
    status: "check_in_pending",
    startTime: new Date("2026-09-12T02:00:00.000Z"),
    endTime: new Date("2026-09-12T03:00:00.000Z"),
    async save() {},
    async populate() {},
    toObject() { return { ...this }; }
  };
  Reservation.findById = async () => reservation;

  const result = await reservationService.confirmAttendance(
    { id: "admin-1" },
    "reservation-2",
    new Date("2026-09-12T02:03:00.000Z")
  );
  assert.equal(result.status, "in_use");
  assert.equal(reservation.attendanceConfirmedBy, "admin-1");
});
