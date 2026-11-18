const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../services/bdMonitoringRules");
const { validateActivity } = require("../services/bdMonitoringService");
const config = {
  cutoff: "18:30",
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  recoveryDays: 3,
};
const now = new Date("2026-11-18T09:00:00Z");
const complete = {
  callOutcome: "Connected",
  whatsapp: "Not Applicable",
  email: "Not Applicable",
  linkedin: "Not Sent",
  linkedinFollowup: "Not Applicable",
  channelReason: "Client opted out",
  nextAction: "Review requirement",
  dueAt: new Date("2026-11-19T09:00:00Z"),
};

test("IST dates and report cutoff do not depend on the machine timezone", () => {
  assert.equal(rules.dayKey(new Date("2026-11-18T20:00:00Z")), "2026-11-19");
  assert.equal(
    rules.cutoffAt("2026-11-18", config).toISOString(),
    "2026-11-18T13:00:00.000Z",
  );
});
test("callback suggestion skips weekends and configured holidays", () => {
  assert.equal(
    rules
      .nextBusinessDay(new Date("2026-11-20T12:00:00Z"), {
        ...config,
        holidays: ["2026-11-23"],
      })
      .toISOString(),
    "2026-11-24T04:30:00.000Z",
  );
});
test("missing updates allow an explained non-call outreach without inventing a call", () => {
  assert.deepEqual(rules.missing(complete), []);
  assert.deepEqual(
    rules.missing({ ...complete, callOutcome: "", callNotApplicable: true }),
    [],
  );
  assert.ok(
    rules
      .missing({ ...complete, whatsapp: "Pending" })
      .includes("WhatsApp update"),
  );
});
test("five calendar days and wrong-number recovery produce separate alerts", () => {
  const state = {
    callOutcome: "Wrong Number",
    firstUnsuccessfulAt: new Date(now - 5 * rules.DAY),
    wrongNumberAt: new Date(now - 4 * rules.DAY),
    recovery: {},
  };
  assert.ok(rules.alerts(state, now, config).includes("Five-day escalation"));
  assert.ok(rules.alerts(state, now, config).includes("Recovery escalation"));
  assert.deepEqual(
    rules.alerts({ ...state, resolvedAt: now }, now, config),
    [],
  );
  assert.equal(
    rules
      .alerts({ ...state, reachedAt: now, wrongNumberAt: null }, now, config)
      .includes("Five-day escalation"),
    false,
  );
});
test("requested callbacks require a date and exceptions require a reason", () => {
  assert.throws(
    () =>
      validateActivity(
        { ...complete, callOutcome: "Callback Requested", dueAt: "" },
        now,
      ),
    /callback time/,
  );
  assert.throws(
    () => validateActivity({ ...complete, channelReason: "" }, now),
    /Not Applicable/,
  );
  assert.throws(
    () =>
      validateActivity(
        { ...complete, linkedinUrl: "https://linkedin.com.bad.test/in/person" },
        now,
      ),
    /LinkedIn profile/,
  );
  assert.throws(
    () =>
      validateActivity(
        { ...complete, recovery: { emailSent: "Not Available" } },
        now,
      ),
    /Explain recovery/,
  );
  assert.doesNotThrow(() =>
    validateActivity({ ...complete, callOutcome: "Busy", dueAt: "" }, now),
  );
});
