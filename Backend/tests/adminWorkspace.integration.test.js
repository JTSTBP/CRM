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
  database = "crm_admin_test_" + crypto.randomBytes(8).toString("hex");
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
    database.startsWith("crm_admin_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test(
  "executive dashboard filters and directives are admin-only, scoped and idempotent",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const admin = await User.create({
      name: "Admin fixture",
      email: "admin@executive-test.invalid",
      role: "Admin",
      password: "test-only",
    });
    const unassigned = await Lead.create({
      company_name: "Unassigned fixture",
      assignedBy: admin._id,
      stage: "New",
    });
    const Proposal = require("../models/CompanyProposal");
    await Proposal.init();
    await Proposal.create({
      leadId: west._id,
      ownerId: bd1._id,
      createdBy: bd1._id,
      reviewerId: manager._id,
      title: "Hiring scope fixture",
      reference: "ADMIN-SCOPE",
      scope: "Confirm positions",
      status: "In Review",
    });
    // Imported legacy records can lack array fields entirely.
    await Lead.collection.updateOne(
      { _id: unassigned._id },
      { $unset: { assignedTo: "", points_of_contact: "" } },
    );
    const path = "/admin/dashboard";
    assert.equal((await api(null, path)).status, 401);
    assert.equal((await api(manager, path)).status, 403);
    assert.equal((await api(bd1, path)).status, 403);
    const result = await api(admin, path);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.periodTotals.calls, 4);
    assert.equal(result.data.managers.length, 2);
    assert.equal(result.data.companies.length, 4);
    assert.equal(result.data.proposals.length, 1);
    assert.ok(
      result.data.companies.some(
        (company) => company._id === String(unassigned._id),
      ),
    );
    for (const assignedTo of [null, bd1._id]) {
      await Lead.collection.updateOne(
        { _id: unassigned._id },
        { $set: { assignedTo } },
      );
      const legacyResult = await api(admin, path);
      assert.equal(legacyResult.status, 200, JSON.stringify(legacyResult.data));
      assert.equal(legacyResult.data.companies.length, 4);
      const legacyCompany = legacyResult.data.companies.find(
        (company) => company._id === String(unassigned._id),
      );
      assert.equal(
        legacyCompany.ownerIds.includes(String(bd1._id)),
        assignedTo !== null,
      );
    }
    const scoped = (await api(admin, path + "?manager=" + manager._id)).data;
    assert.equal(scoped.periodTotals.calls, 3);
    assert.equal(
      scoped.companies.some((company) => company.name === "Foreign fixture"),
      false,
    );
    assert.equal(
      (await api(admin, path + "?manager=" + outsider._id)).status,
      403,
    );
    assert.equal(
      (
        await api(
          admin,
          path + "?manager=" + manager._id + "&employee=" + outsider._id,
        )
      ).status,
      403,
    );
    assert.equal(
      (await api(admin, path + "?territory=East")).data.periodTotals.calls,
      1,
    );
    const directive = {
      kind: "directive",
      requestId: requestId(),
      recipientIds: [String(manager._id), String(bd1._id)],
      title: "Review team cadence",
      message: "Confirm scheduled callbacks before cutoff",
    };
    assert.equal(
      (await api(manager, "/admin/directive", "POST", directive)).status,
      403,
    );
    assert.equal(
      (await api(admin, "/admin/directive", "POST", directive)).status,
      200,
    );
    assert.equal(
      (await api(admin, "/admin/directive", "POST", directive)).status,
      200,
    );
    assert.equal(
      await models.Notification.countDocuments({
        title: directive.title + " — " + directive.message,
      }),
      2,
    );
    const inactive = await User.findOne({ status: "Inactive" });
    assert.equal(
      (
        await api(admin, "/admin/directive", "POST", {
          ...directive,
          requestId: requestId(),
          recipientIds: [String(inactive._id)],
        })
      ).status,
      400,
    );
    const meeting = {
      ...directive,
      kind: "meeting",
      requestId: requestId(),
      dueAt: new Date(Date.now() + rules.DAY).toISOString(),
    };
    assert.equal(
      (await api(admin, "/admin/directive", "POST", meeting)).status,
      200,
    );
    assert.equal(
      (await api(admin, "/admin/directive", "POST", meeting)).status,
      200,
    );
    assert.equal(await Task.countDocuments({ title: directive.title }), 2);
    assert.ok(
      (await api(admin, path)).data.executiveAudit.some(
        (event) => event.kind === "admin-directive",
      ),
    );
  },
);
