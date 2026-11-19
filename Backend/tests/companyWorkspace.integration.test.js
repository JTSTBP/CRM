const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Mandate = require("../models/Mandate");
const Proposal = require("../models/CompanyProposal");
const models = require("../models/BDMonitoring");
const Task = require("../models/Task");
const enabled = Boolean(process.env.MONITORING_TEST_URI);
const database = "crm_company_test_" + crypto.randomBytes(8).toString("hex");
let server, base, bd, outsider, lead, manager;
const requestId = () => crypto.randomUUID();
async function api(user, path, method = "GET", payload) {
  const token = user
    ? jwt.sign(
        { user: { id: String(user._id), role: user.role } },
        process.env.JWT_SECRET,
      )
    : "";
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", "x-auth-token": token },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
before(
  async () => {
    if (!enabled) return;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    await mongoose.connect(process.env.MONITORING_TEST_URI, {
      dbName: database,
    });
    await Promise.all(
      [User, Lead, Mandate, Proposal, Task, ...Object.values(models)].map(
        (model) => model.init(),
      ),
    );
    manager = await User.create({
      name: "Company reviewer",
      email: "manager@company-test.invalid",
      password: "test-only",
      role: "Manager",
    });
    [bd, outsider] = await User.create([
      {
        name: "Company BD",
        email: "bd@company-test.invalid",
        password: "test-only",
        role: "BD Executive",
      },
      {
        name: "Outsider",
        email: "outsider@company-test.invalid",
        password: "test-only",
        role: "BD Executive",
      },
    ]);
    bd.reporter = manager._id;
    await bd.save();
    lead = await Lead.create({
      company_name: "Company workspace fixture",
      assignedBy: bd._id,
      points_of_contact: [
        { name: "HR contact", phone: "55501" },
        { name: "Founder", phone: "55502" },
      ],
      industry_name: "Retail",
    });
    const app = express();
    app.use(express.json());
    app.use("/api/bd-workspace", require("../routes/bdWorkspaceRoutes"));
    app.use("/api/tasks", require("../routes/taskRoutes"));
    app.use("/api/leads", require("../routes/leadRoutes"));
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  },
  { timeout: 60000 },
);
after(async () => {
  if (!enabled) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    mongoose.connection.name === database &&
    database.startsWith("crm_company_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test(
  "company workspace preserves scope, validates mandates and records company actions",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const path = `/bd-workspace/company/${lead._id}`;
    assert.equal((await api(null, path)).status, 401);
    assert.equal((await api(outsider, path)).status, 404);
    assert.equal(
      (await api(bd, path)).data.company.company_name,
      lead.company_name,
    );
    assert.equal(
      (
        await api(bd, path + "/profile", "POST", {
          requestId: requestId(),
          priority: "Impossible",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(bd, path + "/profile", "POST", {
          requestId: requestId(),
          priority: "High",
          headquarters: "Mumbai",
          businessModel: "Retail",
          territory: "West",
          tier: "Strategic",
          footprint: "Mumbai, Bengaluru",
        })
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, path)).data.company.companyProfile.headquarters,
      "Mumbai",
    );
    const mandate = {
      requestId: requestId(),
      title: "Store leadership",
      positions: 6,
      submissions: 8,
      interviews: 3,
      filled: 2,
      status: "Sourcing",
      priority: "High",
      location: "Mumbai",
      ownerId: String(bd._id),
      note: "Client confirmed scope",
    };
    assert.equal(
      (await api(bd, path + "/mandates", "POST", { ...mandate, filled: 7 }))
        .status,
      400,
    );
    assert.equal(
      (
        await api(bd, path + "/mandates", "POST", {
          ...mandate,
          ownerId: String(outsider._id),
        })
      ).status,
      400,
    );
    const created = await api(bd, path + "/mandates", "POST", mandate);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(
      (await api(bd, path + "/mandates", "POST", mandate)).status,
      200,
    );
    assert.equal(await Mandate.countDocuments(), 1);
    const editPath = `/bd-workspace/mandates/${created.data.mandate._id}`;
    assert.equal(
      (
        await api(outsider, editPath, "PATCH", {
          ...mandate,
          revision: 0,
          requestId: requestId(),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api(bd, editPath, "PATCH", {
          ...mandate,
          revision: 0,
          filled: 3,
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, editPath, "PATCH", {
          ...mandate,
          revision: 0,
          requestId: requestId(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          bd,
          path + "/contact/" + lead.points_of_contact[0]._id,
          "PATCH",
          { requestId: requestId(), primaryContact: true, decisionMaker: true },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await api(
          bd,
          path + "/contact/" + lead.points_of_contact[1]._id,
          "PATCH",
          { requestId: requestId(), primaryContact: true, decisionMaker: true },
        )
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, path)).data.contacts.filter(
        (contact) => contact.primaryContact,
      ).length,
      1,
    );
    const rolePath = path + "/contact/" + lead.points_of_contact[0]._id;
    assert.equal(
      (
        await api(bd, rolePath, "PATCH", {
          requestId: requestId(),
          primaryContact: false,
          decisionMaker: true,
          stakeholderTier: "Invalid",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(bd, rolePath, "PATCH", {
          requestId: requestId(),
          primaryContact: false,
          decisionMaker: true,
          stakeholderTier: "Primary Buyer",
          stakeholderRole: "Mandate controller",
          stakeholderNote: "Confirm scope with HR before sign-off.",
        })
      ).status,
      200,
    );
    const role = (await api(bd, path)).data.contacts.find(
      (person) => String(person._id) === String(lead.points_of_contact[0]._id),
    );
    assert.equal(role.stakeholderTier, "Primary Buyer");
    assert.equal(role.stakeholderRole, "Mandate controller");
    assert.equal(
      role.stakeholderNote,
      "Confirm scope with HR before sign-off.",
    );
    assert.equal(
      (
        await api(outsider, "/tasks", "POST", {
          lead_id: String(lead._id),
          title: "Forbidden task",
          due_date: new Date().toISOString(),
        })
      ).status,
      404,
    );
    const task = await api(bd, "/tasks", "POST", {
      lead_id: String(lead._id),
      title: "Client discovery",
      due_date: new Date(Date.now() - 1000).toISOString(),
    });
    assert.equal(task.status, 201);
    assert.equal(
      (
        await api(bd, path + "/stage", "POST", {
          requestId: requestId(),
          stage: "Won",
          reason: "Client confirmed approval",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(bd, path + "/stage", "POST", {
          requestId: requestId(),
          stage: "Contacted",
          reason: "Confirmed first discussion",
          confirmed: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, path + "/note", "POST", {
          requestId: requestId(),
          content: "Scope attachment",
          url: "javascript:alert(1)",
        })
      ).status,
      400,
    );
    const note = {
      requestId: requestId(),
      content: "Client confirmed retail scope",
      url: "https://example.com/scope.pdf",
    };
    assert.equal((await api(bd, path + "/note", "POST", note)).status, 200);
    assert.equal((await api(bd, path + "/note", "POST", note)).status, 200);
    const result = (await api(bd, path)).data;
    assert.equal(result.stats.openPositions, 3);
    assert.equal(result.stats.decisionMakers, 2);
    assert.equal(result.stats.openFollowups, 1);
    assert.ok(result.stageEnteredAt);
    assert.equal(
      result.company.remarks.filter((r) => r.content === note.content).length,
      1,
    );
    const timeline = await api(bd, path + "/timeline?type=Notes");
    assert.equal(timeline.status, 200);
    assert.ok(timeline.data.items.some((item) => item.body === note.content));
    assert.ok(timeline.data.items.every((item) => item.type === "Notes"));
    assert.equal((await api(outsider, path + "/timeline")).status, 404);
    const draft = await api(bd, path + "/proposals", "POST", {
      requestId: requestId(),
      title: "Retail leadership scope",
      reference: "SCOPE-001",
      scope: "Six confirmed positions",
      positions: 6,
      ownerId: String(bd._id),
      reviewerId: String(manager._id),
      recipientPocIds: [String(lead.points_of_contact[0]._id)],
    });
    assert.equal(draft.status, 200, JSON.stringify(draft.data));
    const draftPath = "/bd-workspace/proposals/" + draft.data.proposal._id;
    assert.equal((await api(bd, path)).data.stats.proposals, 0);
    assert.equal(
      (
        await api(bd, draftPath, "PATCH", {
          requestId: requestId(),
          revision: 0,
          action: "submit",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, draftPath, "PATCH", {
          requestId: requestId(),
          revision: 1,
          action: "approve",
          reason: "Approved scope",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api(manager, draftPath, "PATCH", {
          requestId: requestId(),
          revision: 1,
          action: "approve",
          reason: "Approved scope",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, draftPath, "PATCH", {
          requestId: requestId(),
          revision: 2,
          action: "sent",
        })
      ).status,
      400,
    );
    await models.BusinessEvent.create({
      leadId: lead._id,
      ownerId: bd._id,
      actorId: bd._id,
      kind: "proposal",
      reference: "SCOPE-001",
      evidence: "Confirmed fixture send",
      sentAt: new Date(),
      status: "Awaiting feedback",
    });
    assert.equal(
      (
        await api(bd, draftPath, "PATCH", {
          requestId: requestId(),
          revision: 2,
          action: "sent",
        })
      ).status,
      200,
    );
    assert.equal((await api(bd, path)).data.drafts[0].status, "Sent");
    assert.equal(
      await models.Notification.countDocuments({ recipientId: manager._id }),
      1,
    );
    assert.equal(
      await models.Notification.countDocuments({ recipientId: bd._id }),
      1,
    );
    const proposalTimeline = (await api(bd, path + "/timeline?type=Proposals"))
      .data;
    assert.ok(
      proposalTimeline.items.some((item) => item.title === "proposal-submit"),
    );
    assert.ok(
      proposalTimeline.items.some((item) => item.title === "proposal-approve"),
    );
    assert.equal((await api(bd, path + "/timeline?search=%5B")).status, 200);
  },
);

test(
  "Proposal Sent automatically counts once, credits the assigned executive and is atomic",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const first = await Lead.create({
      company_name: "Automatic proposal fixture",
      assignedBy: bd._id,
      stage: "Contacted",
    });
    const path = `/bd-workspace/company/${first._id}/stage`,
      payload = {
        requestId: requestId(),
        stage: "Proposal Sent",
        confirmed: true,
        reason: "Proposal sent to the hiring contact",
      };
    const baseline = await models.BusinessEvent.countDocuments({
      ownerId: bd._id,
      kind: "proposal",
    });
    const dailyBefore = (await api(bd, "/bd-workspace/dashboard")).data.totals
      .proposals;
    assert.equal((await api(outsider, path, "POST", payload)).status, 404);
    const saved = await api(bd, path, "POST", payload);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal((await api(bd, path, "POST", payload)).status, 200);
    assert.equal(
      await models.BusinessEvent.countDocuments({
        leadId: first._id,
        kind: "proposal",
      }),
      1,
    );
    const automatic = await models.BusinessEvent.findOne({
      leadId: first._id,
      kind: "proposal",
    });
    assert.equal(String(automatic.ownerId), String(bd._id));
    assert.equal(automatic.status, "Awaiting feedback");
    assert.equal(
      (
        await api(bd, path, "POST", {
          ...payload,
          requestId: requestId(),
          stage: "Negotiation",
        })
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, path, "POST", { ...payload, requestId: requestId() }))
        .status,
      200,
    );
    assert.equal(
      await models.BusinessEvent.countDocuments({
        leadId: first._id,
        kind: "proposal",
      }),
      1,
    );
    const second = await Lead.create({
      company_name: "Legacy stage update fixture",
      assignedBy: bd._id,
    });
    assert.equal(
      (await api(bd, `/leads/${second._id}`, "PUT", { stage: "Proposal Sent" }))
        .status,
      200,
    );
    assert.equal(
      (await api(bd, `/leads/${second._id}`, "PUT", { stage: "Proposal Sent" }))
        .status,
      200,
    );
    assert.equal(
      await models.BusinessEvent.countDocuments({
        leadId: second._id,
        kind: "proposal",
      }),
      1,
    );
    const third = await Lead.create({
      company_name: "Bulk stage fixture",
      assignedBy: bd._id,
    });
    const foreign = await Lead.create({
      company_name: "Outside bulk fixture",
      assignedBy: outsider._id,
    });
    assert.equal(
      (
        await api(manager, "/leads/bulk/update", "PATCH", {
          ids: [String(third._id), String(foreign._id)],
          updates: { stage: "Proposal Sent" },
        })
      ).status,
      200,
    );
    assert.equal(
      await models.BusinessEvent.countDocuments({
        leadId: third._id,
        ownerId: bd._id,
        kind: "proposal",
      }),
      1,
    );
    assert.equal((await Lead.findById(foreign._id)).stage, "New");
    const noOwner = await Lead.create({
      company_name: "Unassigned milestone fixture",
      assignedBy: manager._id,
    });
    const failed = await api(
      manager,
      `/bd-workspace/company/${noOwner._id}/stage`,
      "POST",
      { ...payload, requestId: requestId() },
    );
    assert.equal(failed.status, 400);
    assert.equal((await Lead.findById(noOwner._id)).stage, "New");
    assert.equal(
      await models.BusinessEvent.countDocuments({
        ownerId: bd._id,
        kind: "proposal",
      }),
      baseline + 3,
    );
    assert.equal(
      (await api(bd, "/bd-workspace/dashboard")).data.totals.proposals,
      dailyBefore + 3,
    );
    const failedLegacy = await api(manager, `/leads/${noOwner._id}`, "PUT", {
      stage: "Proposal Sent",
    });
    assert.equal(failedLegacy.status, 400);
    assert.equal((await Lead.findById(noOwner._id)).stage, "New");
    const validBulk = await Lead.create({
      company_name: "Atomic bulk fixture",
      assignedBy: bd._id,
    });
    assert.equal(
      (
        await api(manager, "/leads/bulk/update", "PATCH", {
          ids: [String(validBulk._id), String(noOwner._id)],
          updates: { stage: "Proposal Sent" },
        })
      ).status,
      400,
    );
    assert.equal((await Lead.findById(validBulk._id)).stage, "New");
    assert.equal(
      await models.BusinessEvent.countDocuments({ leadId: validBulk._id }),
      0,
    );
    const recorded = await Lead.create({
      company_name: "Previously recorded proposal fixture",
      assignedBy: bd._id,
    });
    await models.BusinessEvent.create({
      leadId: recorded._id,
      ownerId: bd._id,
      actorId: bd._id,
      kind: "proposal",
      reference: "EXISTING-PROPOSAL",
      evidence: "Already sent",
      sentAt: new Date(),
      status: "Awaiting feedback",
    });
    assert.equal(
      (
        await api(bd, `/bd-workspace/company/${recorded._id}/stage`, "POST", {
          ...payload,
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      await models.BusinessEvent.countDocuments({
        leadId: recorded._id,
        kind: "proposal",
      }),
      1,
    );
  },
);
