const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  express = require("express"),
  jwt = require("jsonwebtoken"),
  crypto = require("node:crypto");
const User = require("../models/User"),
  Lead = require("../models/Lead"),
  Call = require("../models/CallActivity"),
  Task = require("../models/Task"),
  Activity = require("../models/LeadActivity"),
  Email = require("../models/EmailSendLog");
const models = require("../models/BDMonitoring"),
  rules = require("../services/bdMonitoringRules");
const enabled = Boolean(process.env.MONITORING_TEST_URI),
  database = "crm_manager_test_" + crypto.randomBytes(8).toString("hex");
let manager,
  otherManager,
  bd1,
  bd2,
  outsider,
  west,
  east,
  foreign,
  state,
  server,
  base;
const requestId = () => crypto.randomUUID();
async function api(user, path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": user
        ? jwt.sign(
            { user: { id: String(user._id), role: user.role } },
            process.env.JWT_SECRET,
          )
        : "",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}
before(
  async () => {
    if (!enabled) return;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    await mongoose.connect(process.env.MONITORING_TEST_URI, {
      dbName: database,
    });
    await Promise.all(
      [User, Lead, Call, Task, Activity, Email, ...Object.values(models)].map(
        (model) => model.init(),
      ),
    );
    [manager, otherManager] = await User.create([
      {
        name: "Manager West",
        email: "manager@manager-test.invalid",
        role: "Manager",
        password: "test-only",
      },
      {
        name: "Other Manager",
        email: "other-manager@manager-test.invalid",
        role: "Manager",
        password: "test-only",
      },
    ]);
    [bd1, bd2, outsider] = await User.create([
      {
        name: "First BD",
        email: "first@manager-test.invalid",
        role: "BD Executive",
        password: "test-only",
        reporter: manager._id,
      },
      {
        name: "Second BD",
        email: "second@manager-test.invalid",
        role: "BD Executive",
        password: "test-only",
        reporter: manager._id,
      },
      {
        name: "Foreign BD",
        email: "foreign@manager-test.invalid",
        role: "BD Executive",
        password: "test-only",
        reporter: otherManager._id,
      },
    ]);
    await User.create({
      name: "Inactive BD",
      email: "inactive@manager-test.invalid",
      role: "BD Executive",
      password: "test-only",
      reporter: manager._id,
      status: "Inactive",
    });
    [west, east, foreign] = await Lead.create([
      {
        company_name: "West fixture",
        assignedBy: bd1._id,
        companyProfile: { territory: "West" },
        stage: "Contacted",
        points_of_contact: [
          { name: "HR West", phone: "55501" },
          { name: "Recovery HR", phone: "55502" },
        ],
      },
      {
        company_name: "East fixture",
        assignedBy: bd2._id,
        companyProfile: { territory: "East" },
        points_of_contact: [{ name: "HR East", phone: "55503" }],
      },
      {
        company_name: "Foreign fixture",
        assignedBy: outsider._id,
        companyProfile: { territory: "Private" },
        points_of_contact: [{ name: "Foreign HR", phone: "55504" }],
      },
    ]);
    const today = rules.dayKey(),
      start = rules.dayStart(today),
      yesterday = new Date(start.getTime() - rules.DAY),
      at = new Date(start.getTime() + 3600000);
    await Call.create([
      {
        userId: bd1._id,
        leadId: west._id,
        pocId: String(west.points_of_contact[0]._id),
        phone: "55501",
        stage: "Connected",
        timestamp: at,
      },
      {
        userId: bd1._id,
        leadId: west._id,
        pocId: String(west.points_of_contact[0]._id),
        phone: "55501",
        stage: "Busy",
        timestamp: at,
      },
      {
        userId: bd2._id,
        leadId: east._id,
        pocId: String(east.points_of_contact[0]._id),
        phone: "55503",
        stage: "No Answer",
        timestamp: at,
      },
      {
        userId: bd1._id,
        leadId: west._id,
        pocId: String(west.points_of_contact[0]._id),
        phone: "55501",
        stage: "Connected",
        timestamp: new Date(yesterday.getTime() + 3600000),
      },
      {
        userId: outsider._id,
        leadId: foreign._id,
        pocId: String(foreign.points_of_contact[0]._id),
        phone: "55504",
        stage: "Connected",
        timestamp: at,
      },
    ]);
    await models.Event.create({
      actorId: bd1._id,
      ownerId: bd1._id,
      leadId: west._id,
      pocId: west.points_of_contact[0]._id,
      kind: "activity",
      requestId: requestId(),
      day: today,
      data: {
        callOutcome: "Connected",
        whatsapp: "Sent",
        whatsappConfirmed: true,
        email: "Not Applicable",
        linkedin: "Not Sent",
        callNotApplicable: false,
        nextAction: "Confirm scope",
        dueAt: new Date(Date.now() + rules.DAY),
      },
      createdAt: new Date(),
    });
    state = await models.ContactState.create({
      ownerId: bd1._id,
      leadId: west._id,
      pocId: west.points_of_contact[1]._id,
      callOutcome: "Wrong Number",
      firstUnsuccessfulAt: new Date(Date.now() - 6 * rules.DAY),
      wrongNumberAt: new Date(Date.now() - 6 * rules.DAY),
      dueAt: new Date(Date.now() - rules.DAY),
      lastWorkedDate: today,
      recovery: { alternativeFound: "Pending" },
    });
    await models.BusinessEvent.create({
      ownerId: bd1._id,
      actorId: bd1._id,
      leadId: west._id,
      kind: "proposal",
      reference: "MANAGER-FIXTURE",
      evidence: "Fixture confirmation",
      sentAt: at,
      status: "Awaiting feedback",
    });
    await Activity.create({
      leadId: west._id,
      type: "Stage Changed",
      description: "Contacted fixture",
      metadata: { from: "New", to: "Contacted" },
      timestamp: new Date(Date.now() - 3 * rules.DAY),
    });
    await Task.create({
      title: "Late fixture follow-up",
      user_id: bd1._id,
      createdBy: bd1._id,
      lead_id: west._id,
      poc_id: west.points_of_contact[1]._id,
      due_date: new Date(Date.now() - 2 * rules.DAY),
      completed: false,
    });
    const app = express();
    app.use(express.json());
    app.use("/api/bd-workspace", require("../routes/bdWorkspaceRoutes"));
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/bd-workspace`;
  },
  { timeout: 60000 },
);
after(async () => {
  if (!enabled) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    mongoose.connection.name === database &&
    database.startsWith("crm_manager_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test(
  "manager dashboard scopes filters, reporting and interventions",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const path = "/manager/dashboard";
    assert.equal((await api(null, path)).status, 401);
    assert.equal((await api(bd1, path)).status, 403);
    const full = await api(manager, path);
    assert.equal(full.status, 200, JSON.stringify(full.data));
    assert.equal(full.data.roster.length, 2);
    assert.equal(full.data.periodTotals.calls, 3);
    assert.equal(full.data.periodTotals.connected, 1);
    assert.equal(full.data.periodTotals.proposals, 1);
    assert.equal(full.data.territories.includes("Private"), false);
    assert.equal(full.data.compliance.incomplete, 1);
    assert.ok(
      full.data.alerts.some((row) =>
        row.reasons.includes("Five-day escalation"),
      ),
    );
    assert.equal(
      (await api(manager, path + "?territory=East")).data.periodTotals.calls,
      1,
    );
    assert.equal(
      (await api(manager, path + "?employee=" + bd1._id)).data.periodTotals
        .calls,
      2,
    );
    assert.equal(
      (await api(manager, path + "?employee=" + outsider._id)).status,
      403,
    );
    const yesterday = rules.dayKey(
      new Date(rules.dayStart(rules.dayKey()).getTime() - rules.DAY),
    );
    assert.equal(
      (
        await api(
          manager,
          path + `?period=custom&from=${yesterday}&to=${yesterday}`,
        )
      ).data.periodTotals.calls,
      1,
    );
    assert.equal(
      (await api(manager, path + "?period=custom&from=bad&to=bad")).status,
      400,
    );
    const action = {
      requestId: requestId(),
      kind: "task",
      leadId: String(west._id),
      ownerId: String(bd1._id),
      title: "Manager scope review",
      reason: "Confirm the hiring requirements",
      dueAt: new Date(Date.now() + rules.DAY).toISOString(),
    };
    assert.equal(
      (await api(otherManager, "/manager/action", "POST", action)).status,
      404,
    );
    assert.equal(
      (
        await api(manager, "/manager/action", "POST", {
          ...action,
          ownerId: String(outsider._id),
        })
      ).status,
      403,
    );
    assert.equal(
      (await api(manager, "/manager/action", "POST", action)).status,
      200,
    );
    assert.equal(
      (await api(manager, "/manager/action", "POST", action)).status,
      200,
    );
    assert.equal(await Task.countDocuments({ title: action.title }), 1);
    const reassign = {
      requestId: requestId(),
      kind: "reassign",
      stateIds: [String(state._id)],
      ownerId: String(bd2._id),
      reason: "Balance the recovery workload",
    };
    assert.equal(
      (await api(manager, "/manager/action", "POST", reassign)).status,
      200,
    );
    assert.equal(
      String((await models.ContactState.findById(state._id)).ownerId),
      String(bd2._id),
    );
    assert.equal(
      (await api(manager, "/manager/action", "POST", reassign)).status,
      200,
    );
    const reminder = {
      requestId: requestId(),
      kind: "remind",
      stateIds: [String(state._id)],
      reason: "Review the recovery checklist",
    };
    assert.equal(
      (await api(manager, "/manager/action", "POST", reminder)).status,
      200,
    );
    assert.equal(
      (await api(manager, "/manager/action", "POST", reminder)).status,
      200,
    );
    assert.equal(
      await models.Notification.countDocuments({ recipientId: bd2._id }),
      1,
    );
    assert.equal(
      (
        await api(bd1, "/manager/action", "POST", {
          ...action,
          requestId: requestId(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api(manager, "/manager/action", "POST", {
          ...action,
          requestId: requestId(),
          dueAt: new Date(Date.now() - rules.DAY).toISOString(),
        })
      ).status,
      400,
    );
    const bulk = {
      ...reassign,
      requestId: requestId(),
      ownerId: String(bd1._id),
      stateIds: [String(state._id), String(new mongoose.Types.ObjectId())],
    };
    assert.equal(
      (await api(manager, "/manager/action", "POST", bulk)).status,
      404,
    );
    assert.equal(
      String((await models.ContactState.findById(state._id)).ownerId),
      String(bd2._id),
    );
    const review = {
      ...action,
      requestId: requestId(),
      kind: "lifecycle",
      title: "Review stalled account",
    };
    assert.equal(
      (await api(manager, "/manager/action", "POST", review)).status,
      200,
    );
    const reviewed = (await api(manager, path)).data.roster.find(
      (row) => row._id === String(bd1._id),
    );
    assert.equal(
      reviewed.parts.find((part) => part.label === "Lifecycle reviewed").value,
      100,
    );
    const compliance = {
      kind: "compliance",
      requestId: requestId(),
      reason: "Complete today’s contact records",
      employeeIds: [String(bd2._id)],
    };
    assert.equal(
      (await api(manager, "/manager/action", "POST", compliance)).status,
      200,
    );
    assert.equal(
      (await api(manager, "/manager/action", "POST", compliance)).status,
      200,
    );
    assert.equal(
      await models.Notification.countDocuments({ recipientId: bd2._id }),
      2,
    );
    const final = (await api(manager, path)).data;
    assert.ok(final.audit.some((event) => event.kind === "manager-compliance"));
    assert.ok(final.audit.some((event) => event.kind === "manager-reassign"));
    assert.ok(
      final.roster.every(
        (row) => row.score === null || (row.score >= 0 && row.score <= 100),
      ),
    );
    assert.equal(final.range.from, rules.dayKey());
  },
);
