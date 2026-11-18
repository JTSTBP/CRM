const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activityPatch } = require("../services/contactActivityPatch");
test("selected activity preserves other channels and does not confirm them", () => {
  const state = {
    whatsapp: "Sent",
    email: "Sent",
    emailSubject: "Existing subject",
    linkedin: "Accepted",
    linkedinFollowup: "Pending",
    recovery: { emailSent: "Completed" },
    remarks: "Existing note",
    nextAction: "Call later",
    dueAt: new Date("2026-01-01"),
  };
  const result = activityPatch(
    {
      activityType: "whatsapp",
      whatsapp: "Failed",
      email: "Failed",
      emailConfirmed: true,
      callOutcome: "Connected",
      remarks: "Delivery failed",
    },
    state,
  );
  assert.equal(result.email, "Sent");
  assert.equal(result.emailConfirmed, false);
  assert.equal(result.callOutcome, "");
  assert.equal(result.linkedin, "Accepted");
  assert.equal(result.whatsapp, "Failed");
  assert.deepEqual(result.recovery, state.recovery);
  assert.equal(result.nextAction, state.nextAction);
});
test("invalid activity types and empty calls are rejected", () => {
  assert.throws(() => activityPatch({ activityType: "invalid" }, {}));
  assert.throws(() => activityPatch({ activityType: "call" }, {}));
});
