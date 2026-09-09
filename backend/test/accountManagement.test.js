const test = require("node:test");
const assert = require("node:assert/strict");
const authController = require("../src/controllers/auth.controller");
const authService = require("../src/services/auth.service");

test("public registration endpoint returns 403 Forbidden with friendly error message", async () => {
  let responseStatusCode = null;
  let responseBody = null;

  const res = {
    status(code) {
      responseStatusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  await authController.register({}, res);

  assert.equal(responseStatusCode, 403);
  assert.match(responseBody.error, /Public registration is disabled/i);
});

test("authService.registerUser throws 403 error", async () => {
  await assert.rejects(
    async () => {
      await authService.registerUser({
        name: "Test",
        grade: "Freshman",
        studentId: "b11901001",
        password: "password123",
        personalEmail: "test@ntu.edu.tw"
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Public registration is disabled/i);
      return true;
    }
  );
});
