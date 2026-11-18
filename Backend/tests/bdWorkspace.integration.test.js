const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Call = require("../models/CallActivity");
const models = require("../models/BDMonitoring");
const service = require("../services/bdMonitoringService");
const rules = require("../services/bdMonitoringRules");
const EmailSendLog = require("../models/EmailSendLog");
const LeadActivity = require("../models/LeadActivity");

const enabled = Boolean(process.env.MONITORING_TEST_URI);
let server, base, admin, manager, bd, outsider, lead, contact;
const database = `crm_bd_test_${crypto.randomBytes(8).toString("hex")}`;
const requestId = () => crypto.randomUUID();
const body = () => ({
  requestId: requestId(),
  revision: 0,
  callOutcome: "Busy",
  whatsapp: "Not Applicable",
  email: "Not Applicable",
  linkedin: "Not Sent",
  linkedinFollowup: "Not Applicable",
  channelReason: "Client requested phone contact only",
  remarks: "Integration fixture",
  recovery: {},
});
async function api(user, route, method = "GET", payload) {
  const token = jwt.sign(
    { user: { id: String(user._id), role: user.role } },
    process.env.JWT_SECRET,
  );
  const response = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json", "x-auth-token": token, "User-Agent":"Mozilla/5.0 (iPhone) Mobile" },
    ...(payload === undefined ? {} : { body: JSON.stringify({...payload,mobileDialStarted:true}) }),
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
      [
        ...Object.values(models),
        User,
        Lead,
        Task,
        Call,
        EmailSendLog,
        LeadActivity,
      ].map((model) => model.init()),
    );
    [admin, manager, outsider] = await User.create([
      {
        name: "Test admin",
        email: "admin@test.invalid",
        password: "fixture-only",
        role: "Admin",
      },
      {
        name: "Test manager",
        email: "manager@test.invalid",
        password: "fixture-only",
        role: "Manager",
      },
      {
        name: "Test outsider",
        email: "outsider@test.invalid",
        password: "fixture-only",
        role: "BD Executive",
      },
    ]);
    bd = await User.create({
      name: "Test BD",
      email: "bd@test.invalid",
      password: "fixture-only",
      role: "BD Executive",
      reporter: manager._id,
    });
    lead = await Lead.create({
      company_name: "Test company",
      assignedBy: bd._id,
      createdBy: bd._id,
      assignedTo: [bd._id],
      points_of_contact: [
        {
          name: "Test contact",
          phone: "5550100",
          email: "contact@test.invalid",
          approvalStatus: "approved",
        },
      ],
    });
    contact = lead.points_of_contact[0];
    const app = express();
    app.use(express.json());
    app.use("/api/bd-workspace", require("../routes/bdWorkspaceRoutes"));
    app.use("/api/bd-workspace/leads", require("../routes/leadRoutes"));
    app.use("/api/bd-workspace/tasks", require("../routes/taskRoutes"));
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
    database.startsWith("crm_bd_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test(
  "workspace integration: activity, reminders, access, targets, outcomes and report accuracy",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const path = `/contact/${lead._id}/${contact._id}`;
    assert.equal((await api(outsider, path)).status, 404);
    assert.equal(
      (
        await api(bd, path, "POST", {
          ...body(),
          email: "Sent",
          emailSubject: "Hello",
        })
      ).status,
      400,
    );
    const first = body();
    const saved = await api(bd, path, "POST", first);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.state.attempts, 1);
    assert.equal(saved.data.state.callOutcome, "Busy");
    assert.equal((await api(bd, path, "POST", first)).status, 200);
    assert.equal(await Call.countDocuments(), 1);
    assert.equal(await Task.countDocuments({ type: "Busy callback" }), 1);
    assert.equal(
      (await api(bd, path, "POST", { ...body(), revision: 0 })).status,
      409,
    );
    const update = {
      ...body(),
      revision: 1,
      callOutcome: "No Answer",
      linkedin: "Sent",
      linkedinUrl: "https://www.linkedin.com/in/test/",
      linkedinConfirmed: true,
    };
    assert.equal((await api(bd, path, "POST", update)).status, 200);
    assert.equal(
      await Task.countDocuments({ type: "LinkedIn review", completed: false }),
      1,
    );
    let dashboard = await api(bd, "/dashboard");
    assert.equal(dashboard.status, 200, JSON.stringify(dashboard.data));
    assert.equal(dashboard.data.totals.calls, 2);
    assert.equal(dashboard.data.totals.linkedinSent, 1);
    assert.equal(dashboard.data.totals.proposals, 0);
    assert.equal((await api(manager, "/dashboard")).data.team.length, 1);
    assert.equal((await api(outsider, "/dashboard")).data.totals.calls, 0);
    let current = await models.ContactState.findOne({
      leadId: lead._id,
    }).lean();
    const accepted = await api(bd, path, "POST", {
      ...body(),
      callOutcome: "",
      revision: current.revision,
      linkedin: "Accepted",
      linkedinConfirmed: true,
      linkedinUrl: update.linkedinUrl,
      nextAction: "Send a personal introduction",
      dueAt: new Date(Date.now() + rules.DAY).toISOString(),
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.ok(accepted.data.state.linkedinAcceptedAt);
    assert.equal(
      await Task.countDocuments({ type: "LinkedIn review", completed: false }),
      0,
    );
    assert.equal((await api(bd, "/dashboard")).data.totals.linkedinAccepted, 1);
    current = await models.ContactState.findOne({ leadId: lead._id }).lean();
    const wrong = await api(bd, path, "POST", {
      ...body(),
      callOutcome: "Wrong Number",
      revision: current.revision,
      linkedin: "Accepted",
      nextAction: "Verify alternative decision-maker",
      dueAt: new Date(Date.now() + rules.DAY).toISOString(),
    });
    assert.equal(wrong.status, 200, JSON.stringify(wrong.data));
    assert.equal(
      (await api(bd, "/dashboard")).data.alertCounts["Wrong Number recovery"],
      1,
    );
    const email = await EmailSendLog.create({
      userId: bd._id,
      leadId: lead._id,
      pocId: contact._id,
      recipientEmail: "contact@test.invalid",
      subject: "Provider-confirmed fixture",
      status: "success",
      sentAt: new Date(),
      dayKey: rules.dayKey(),
      dailySlot: 1,
    });
    await service.syncProviderEmail(email);
    await service.syncProviderEmail(email);
    assert.equal((await api(bd, "/dashboard")).data.totals.email, 1);
    assert.equal(
      await models.Event.countDocuments({ requestId: `provider_${email._id}` }),
      1,
    );
    const proposal = {
      leadId: String(lead._id),
      kind: "proposal",
      reference: "PROP-1",
      evidence: "Confirmed email fixture",
      confirmed: true,
    };
    const sent = await api(bd, "/business", "POST", proposal);
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal((await api(bd, "/business", "POST", proposal)).status, 409);
    assert.equal(
      (
        await api(bd, "/business", "POST", {
          ...proposal,
          kind: "onboarding",
          reference: "ACT-1",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(bd, "/business", "POST", {
          ...proposal,
          kind: "onboarding",
          reference: "ACT-1",
          agreementConfirmed: true,
          handoverConfirmed: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, "/business", "POST", {
          ...proposal,
          kind: "onboarding",
          reference: "ACT-2",
          agreementConfirmed: true,
          handoverConfirmed: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(bd, `/business/${sent.data.event._id}`, "PATCH", {
          status: "Accepted",
          reason: "Client confirmed",
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal((await api(bd, "/targets", "PUT", {})).status, 403);
    assert.equal(
      (
        await api(admin, "/targets", "PUT", {
          userId: String(bd._id),
          effectiveDate: rules.dayKey(),
          proposalTarget: 7,
          onboardingTarget: 12,
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal((await api(bd, "/dashboard")).data.totals.proposalTarget, 7);
    assert.equal(
      (
        await api(admin, "/settings", "PUT", {
          cutoff: "00:00",
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          holidays: [],
          linkedinDays: 3,
          recoveryDays: 3,
          proposalTarget: 5,
          onboardingTarget: 10,
          callbackNoticeMinutes: 15,
          requireAgreement: true,
          requireHandover: true,
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, "/submit", "POST", { requestId: requestId() })).status,
      400,
    );
    assert.equal(
      (
        await api(bd, "/submit", "POST", {
          requestId: requestId(),
          reason: "Late fixture",
        })
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, "/dashboard")).data.team[0].reportStatus,
      "Submitted late",
    );
    const stalled = await Lead.create({
      company_name: "Stalled fixture",
      stage: "Contacted",
      assignedBy: bd._id,
      assignedTo: [bd._id],
    });
    await LeadActivity.create({
      leadId: stalled._id,
      type: "Stage Changed",
      description: "Fixture transition",
      performedBy: bd._id,
      timestamp: new Date(Date.now() - 49 * 3600000),
      metadata: { from: "New", to: "Contacted" },
    });
    assert.equal(
      (await api(manager, "/dashboard?stalledSearch=Stalled")).data
        .stalledCount,
      1,
    );
    assert.equal(
      (await api(outsider, `/lifecycle/${stalled._id}`, "POST", {})).status,
      404,
    );
    assert.equal(
      (
        await api(bd, `/lifecycle/${stalled._id}`, "POST", {
          reason: "Waiting for client response",
          nextAction: "Review hiring plan",
          dueAt: new Date(Date.now() + rules.DAY).toISOString(),
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal((await Lead.findById(stalled._id)).stage, "Contacted");
    assert.equal(
      (
        await api(bd, `/opportunity/${stalled._id}`, "POST", {
          qualifiedForProposal: true,
          expectedOnboardingAt: new Date(
            Date.now() + 5 * rules.DAY,
          ).toISOString(),
          note: "Confirmed requirement under review",
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      (await api(bd, "/dashboard")).data.qualifiedAwaitingProposal,
      1,
    );
    assert.equal((await api(bd, "/dashboard")).data.expectedOnboardings, 1);
    await models.ContactState.updateOne(
      { leadId: lead._id },
      { $set: { firstUnsuccessfulAt: new Date(Date.now() - 6 * rules.DAY) } },
    );
    await Promise.all([service.runMonitoring(), service.runMonitoring()]);
    const counts = await models.Notification.aggregate([
      {
        $group: {
          _id: { owner: "$recipientId", key: "$key" },
          count: { $sum: 1 },
        },
      },
    ]);
    assert.ok(counts.every((row) => row.count === 1));
    const state = await models.ContactState.findOne({ leadId: lead._id });
    assert.equal(
      (
        await api(manager, `/state/${state._id}`, "PATCH", {
          ownerId: String(outsider._id),
          reason: "Outside team",
          requestId: requestId(),
        })
      ).status,
      400,
    );
    assert.equal(
      (await api(manager, `/state/${state._id}/remind`, "POST", {})).status,
      200,
    );
    assert.equal(
      (
        await api(bd, `/state/${state._id}`, "PATCH", {
          reason: "Close",
          requestId: requestId(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api(manager, `/state/${state._id}`, "PATCH", {
          reason: "Reviewed and resolved fixture",
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal((await api(bd, "/dashboard")).data.queueCount, 0);
    const scheduled = await Task.findOne({
      type: "Lifecycle review",
      completed: false,
    });
    assert.equal(
      (
        await api(outsider, `/task/${scheduled._id}/complete`, "PATCH", {
          requestId: requestId(),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api(bd, `/task/${scheduled._id}/complete`, "PATCH", {
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(bd, `/task/${scheduled._id}/complete`, "PATCH", {
          requestId: requestId(),
        })
      ).status,
      200,
    );
    assert.equal(
      await models.Event.countDocuments({ kind: "task-completed" }),
      1,
    );
    const paged = await Lead.create({
      company_name: "Paged company fixture",
      assignedBy: bd._id,
      assignedTo: [bd._id],
      points_of_contact: Array.from({ length: 25 }, (_, index) => ({
        name: `Paged contact ${index}`,
        phone: `55502${index}`,
        approvalStatus: "approved",
      })),
    });
    await models.ContactState.insertMany(
      paged.points_of_contact.map((poc, index) => ({
        leadId: paged._id,
        pocId: poc._id,
        ownerId: bd._id,
        callOutcome: "Busy",
        lastActivityAt: new Date(Date.now() - index * 1000),
        dueAt: new Date(Date.now() + (index + 1) * rules.DAY),
      })),
    );
    const pagedResult = await api(bd, "/dashboard?search=Paged&page=2");
    assert.equal(pagedResult.status, 200, JSON.stringify(pagedResult.data));
    assert.equal(pagedResult.data.queueCount, 25);
    assert.equal(pagedResult.data.queue.length, 5);
    assert.equal(
      (await api(bd, "/dashboard?search=Paged&page=101")).data.queue.length,
      0,
    );
    assert.equal(
      (await api(bd, `/dashboard?employee=${outsider._id}`)).status,
      403,
    );
    assert.ok(pagedResult.data.accountability.score >= 0 && pagedResult.data.accountability.score <= 100);
    assert.equal(pagedResult.data.accountability.parts.reduce((sum, part) => sum + part.weight, 0), 100);
    assert.ok(pagedResult.data.workingDayNumber <= pagedResult.data.workingDayTotal);
    const selectedStates = await models.ContactState.find({ leadId: paged._id }).sort({ _id: 1 }).limit(2).lean();
    const bulk = { ids: selectedStates.map(state => String(state._id)), requestId: requestId(),
      nextAction: "Schedule a verified requirements discussion", dueAt: new Date(Date.now() + 2 * rules.DAY).toISOString() };
    const callsBefore = await Call.countDocuments();
    assert.equal((await api(outsider, "/bulk-followup", "POST", bulk)).status, 409);
    assert.equal((await api(bd, "/bulk-followup", "POST", bulk)).status, 200);
    assert.equal((await api(bd, "/bulk-followup", "POST", bulk)).status, 200);
    assert.equal(await models.Event.countDocuments({ kind: "followup-scheduled" }), 2);
    assert.equal(await Call.countDocuments(), callsBefore);
    paged.points_of_contact[0].name = "=2+2";
    await paged.save();
    const exportToken = jwt.sign({ user: { id: String(bd._id), role: bd.role } }, process.env.JWT_SECRET);
    const exported = await fetch(base + "/queue-export?search=Paged", { headers: { "x-auth-token": exportToken } });
    assert.equal(exported.status, 200);
    assert.ok(exported.headers.get("content-type").includes("text/csv"));
    const csv = await exported.text();
    assert.equal(csv.split("\r\n").length, 26);
    assert.ok(csv.includes("\"'=2+2\""));
    const opportunity = { requestId: requestId(), qualifiedForProposal: true,
      note: "Scope five positions with the hiring contact", openRequirements: 5, probability: 60 };
    assert.equal((await api(bd, `/opportunity/${lead._id}`, "POST", opportunity)).status, 200);
    const planned = (await api(bd, path)).data.company.planning;
    assert.equal(planned.openRequirements, 5);
    assert.equal(planned.probability, 60);
    assert.equal((await api(bd, `/opportunity/${lead._id}`, "POST", { ...opportunity, probability: 101 })).status, 400);
    assert.equal((await api(bd, `/opportunity/${lead._id}`, "POST", { ...opportunity, openRequirements: -1 })).status, 400);
    assert.equal((await api(outsider, `/opportunity/${lead._id}`, "POST", opportunity)).status, 404);
    const assignedContactLead = await Lead.create({ company_name: "Assigned contact fixture", assignedBy: admin._id,
      assignedTo: [bd._id], company_size: "50-100", hiring_needs: ["Store manager"],
      points_of_contact: [{ name: "Assigned contact", email: "assigned@test.invalid" },
        { name: "Unapproved contact", approvalStatus: "pending" }] });
    const assignedContact = assignedContactLead.points_of_contact[0];
    const priorEmailAt=new Date(Date.now()-2*rules.DAY),priorDue=new Date(Date.now()-rules.DAY);
    await models.ContactState.create({leadId:assignedContactLead._id,pocId:assignedContact._id,ownerId:bd._id,email:'Sent',emailSubject:'Prior email subject',emailAt:priorEmailAt,dueAt:priorDue,nextAction:'Existing follow-up'});
    const selectedPath=`/contact/${assignedContactLead._id}/${assignedContact._id}`;
    const selectedActivity={requestId:requestId(),revision:0,activityType:'whatsapp',whatsapp:'Sent',whatsappConfirmed:true,email:'Failed',emailConfirmed:true,callOutcome:'Connected',remarks:'WhatsApp introduction confirmed'};
    const beforeSelectedCalls=await Call.countDocuments();
    assert.equal((await api(outsider,selectedPath,'POST',selectedActivity)).status,404);
    const selectedSaved=await api(bd,selectedPath,'POST',selectedActivity);
    assert.equal(selectedSaved.status,200,JSON.stringify(selectedSaved.data));
    assert.equal((await api(bd,selectedPath,'POST',selectedActivity)).status,200);
    const selectedState=(await api(bd,selectedPath)).data.state;
    assert.equal(selectedState.whatsapp,'Sent');assert.equal(selectedState.email,'Sent');assert.equal(new Date(selectedState.emailAt).getTime(),+priorEmailAt);assert.equal(new Date(selectedState.dueAt).getTime(),+priorDue);
    assert.equal(await Call.countDocuments(),beforeSelectedCalls);
    const selectedEvent=await models.Event.findOne({requestId:selectedActivity.requestId});assert.equal(selectedEvent.data.emailConfirmed,false);assert.equal(selectedEvent.data.callLogged,false);
    assert.equal((await api(bd,selectedPath,'POST',{...selectedActivity,requestId:requestId()})).status,409);
    const detailPath = `/leads/poc/${assignedContact._id}`;
    const detail = await api(bd, detailPath);
    assert.equal(detail.status, 200, JSON.stringify(detail.data));
    assert.equal(detail.data.lead.company_size, "50-100");
    assert.equal(detail.data.lead.points_of_contact.length, 1);
    assert.equal((await api(outsider, detailPath)).status, 404);
    const taskPayload = { title: "Contact discovery meeting", lead_id: String(assignedContactLead._id),
      poc_id: String(assignedContact._id), due_date: new Date(Date.now() + rules.DAY).toISOString() };
    assert.equal((await api(outsider, "/tasks", "POST", taskPayload)).status, 404);
    assert.equal((await api(bd, "/tasks", "POST", { ...taskPayload, poc_id: String(contact._id) })).status, 400);
    const newTask = await api(bd, "/tasks", "POST", taskPayload);
    assert.equal(newTask.status, 201, JSON.stringify(newTask.data));
    assert.equal((await api(bd, detailPath)).data.tasks.length, 2);
    assert.equal((await api(bd, `/task/${newTask.data._id}/complete`, "PATCH", { requestId: requestId() })).status, 200);
    assert.equal((await api(bd, detailPath)).data.tasks.find(task => task._id === newTask.data._id).completed, true);
    const requirements = { requestId: requestId(), hiringNeeds: ["Regional manager", "Merchandiser"], positions: 8, designations: 2 };
    assert.equal((await api(outsider, `/requirements/${assignedContactLead._id}`, "POST", requirements)).status, 404);
    assert.equal((await api(bd, `/requirements/${assignedContactLead._id}`, "POST", { ...requirements, positions: -1 })).status, 400);
    assert.equal((await api(bd, `/requirements/${assignedContactLead._id}`, "POST", requirements)).status, 200);
    assert.equal((await api(bd, `/requirements/${assignedContactLead._id}`, "POST", requirements)).status, 200);
    const revisedRequirements = (await api(bd, detailPath)).data.lead;
    assert.deepEqual(revisedRequirements.hiring_needs, requirements.hiringNeeds);
    assert.equal(revisedRequirements.no_of_positions, 8);
    assert.equal(await models.Event.countDocuments({ kind: "requirements-updated", leadId: assignedContactLead._id }), 1);
    assert.ok((await api(bd, `/contact/${assignedContactLead._id}/${assignedContact._id}`)).data.history.some(event=>event.kind === "requirements-updated"));
  },
);
