const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { assertMobileCall } = require("../services/mobileCallPolicy");
test("calls require phone browser and a number-tap context", () => {
  assert.throws(() =>
    assertMobileCall("Mozilla Windows NT 10.0", {
      callOutcome: "Connected",
      mobileDialStarted: true,
    }),
  );
  assert.throws(() =>
    assertMobileCall("Mozilla iPhone", { callOutcome: "Connected" }),
  );
  assert.doesNotThrow(() =>
    assertMobileCall("Mozilla iPhone", {
      callOutcome: "Connected",
      mobileDialStarted: true,
    }),
  );
  assert.doesNotThrow(() =>
    assertMobileCall("Windows", {
      activityType: "email",
      callOutcome: "Connected",
    }),
  );
});
