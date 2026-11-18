const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const models = require("../models/BDMonitoring");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const CallActivity = require("../models/CallActivity");
const LeadActivity = require("../models/LeadActivity");
const service = require("../services/bdMonitoringService");
const rules = require("../services/bdMonitoringRules");
const reporting = require("../services/bdDashboardService");
const router = express.Router();

router.use(auth);
const handle = (callback) => async (req, res) => {
  try {
    const access = await service.scope(req.user);
    res.json(await callback(req, access));
  } catch (error) {
    const duplicate = error.code === 11000;
    const status = duplicate
      ? 409
      : error.status ||
        (error.name === "ValidationError" || error.name === "CastError"
          ? 400
          : 500);
    if (status === 500) console.error("BD workspace:", error);
    res.status(status).json({
      message: duplicate
        ? "This record was already saved. Refresh to view it."
        : status === 500
          ? "Could not complete the request. Please retry."
          : error.message,
    });
  }
};
const manager = (access) => {
  if (!["Admin", "Manager"].includes(access.role))
    service.fail("Manager or Admin access required.", 403);
};
const admin = (access) => {
  if (access.role !== "Admin") service.fail("Admin access required.", 403);
};

router.get(
  "/dashboard",
  handle((req, access) => reporting.dashboard(access, req.query)),
);
router.get("/queue-export", async (req, res) => {
  try {
    const access = await service.scope(req.user);
    const data = await reporting.dashboard(
      access,
      { ...req.query, page: "1" },
      { exportAll: true },
    );
    const selected = new Set(
      String(req.query.ids || "")
        .split(",")
        .filter(Boolean),
    );
    const quote = (value) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      [
        "Company",
        "Contact",
        "Phone",
        "Call outcome",
        "WhatsApp",
        "Email",
        "LinkedIn",
        "Stage",
        "Next action",
        "Due at",
        "Priority",
      ],
    ];
    for (const row of data.queue) {
      if (selected.size && !selected.has(String(row._id))) continue;
      rows.push([
        row.leadId.company_name,
        row.contact.name,
        row.contact.phone,
        row.callOutcome,
        row.whatsapp,
        row.email,
        row.linkedin,
        row.leadId.stage,
        row.nextAction,
        row.dueAt?.toISOString(),
        row.priority,
      ]);
    }
    res
      .attachment(`bd-followups-${data.today}.csv`)
      .type("text/csv")
      .send(
        "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n"),
      );
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Could not export the queue.",
    });
  }
});
router.post(
  "/bulk-followup",
  handle(async (req, access) => {
    if (
      !Array.isArray(req.body.ids) ||
      !req.body.ids.length ||
      req.body.ids.length > 100
    )
      service.fail("Select 1 to 100 contacts.");
    const ids = [...new Set(req.body.ids)];
    if (ids.some((id) => !mongoose.isValidObjectId(id)))
      service.fail("Invalid contact selection.");
    const dueAt = service.date(req.body.dueAt, "follow-up date");
    const nextAction = service.text(req.body.nextAction);
    if (!nextAction || dueAt <= new Date())
      service.fail("Enter an action and future follow-up time.");
    const requestId = service.requestId(req.body);
    await mongoose.connection.transaction(async (session) => {
      for (const id of ids) {
        const state = await models.ContactState.findOne({
          _id: id,
          ...service.ownerQuery(access),
        }).session(session);
        if (!state)
          service.fail("A selected contact is no longer available.", 409);
        await service.accessibleLead(access, state.leadId, session);
        const previous = await models.Event.exists({
          actorId: access.id,
          requestId: `${requestId}:${id}`,
        }).session(session);
        if (previous) continue;
        state.nextAction = nextAction;
        state.dueAt = dueAt;
        state.updatedBy = access.id;
        state.revision += 1;
        await state.save({ session });
        await Task.updateMany(
          {
            lead_id: state.leadId,
            poc_id: state.pocId,
            monitoringKey: /^bd:/,
            type: { $ne: "LinkedIn review" },
            completed: false,
          },
          {
            $set: {
              completed: true,
              completedAt: new Date(),
              monitoringDisposition: "Superseded",
            },
          },
          { session },
        );
        await service.reminder(
          state,
          state.callOutcome === "Busy"
            ? "Busy callback"
            : state.callOutcome === "No Answer"
              ? "No Answer retry"
              : "Client follow-up",
          dueAt,
          session,
        );
        await models.Event.create(
          [
            {
              actorId: access.id,
              ownerId: state.ownerId,
              leadId: state.leadId,
              pocId: state.pocId,
              requestId: `${requestId}:${id}`,
              day: rules.dayKey(),
              kind: "followup-scheduled",
              data: { nextAction, dueAt },
            },
          ],
          { session },
        );
      }
    });
    return { message: `Follow-up scheduled for ${ids.length} contacts.` };
  }),
);
router.get(
  "/contact/:leadId/:pocId",
  handle(async (req, access) => {
    const lead = await service.accessibleLead(access, req.params.leadId);
    const poc = lead.points_of_contact.id(req.params.pocId);
    if (!poc) service.fail("Contact not found.", 404);
    const filter = { leadId: lead._id, pocId: poc._id };
    const historyFilter = {
      leadId: lead._id,
      $or: [{ pocId: poc._id }, { pocId: { $exists: false } }],
      ...service.ownerQuery(access),
    };
    const historyPage = Math.max(
      1,
      Math.min(1000, Number.parseInt(req.query.historyPage, 10) || 1),
    );
    const [state, history, calls, business, config, historyTotal] =
      await Promise.all([
        models.ContactState.findOne(filter).lean(),
        models.Event.find(historyFilter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((historyPage - 1) * 30)
          .limit(30)
          .populate("actorId", "name")
          .lean(),
        CallActivity.find({
          ...filter,
          ...service.ownerQuery(access, "userId"),
        })
          .sort({ timestamp: -1 })
          .limit(20)
          .lean(),
        models.BusinessEvent.find({
          leadId: lead._id,
          ...service.ownerQuery(access),
        })
          .sort({ sentAt: -1 })
          .lean(),
        service.settings(),
        models.Event.countDocuments(historyFilter),
      ]);
    const owners = await User.find({
      $and: [
        {
          _id: {
            $in: [lead.assignedBy, lead.createdBy, ...lead.assignedTo].filter(
              Boolean,
            ),
          },
          role: "BD Executive",
          status: "Active",
        },
        service.ownerQuery(access, "_id"),
      ],
    })
      .select("name")
      .lean();
    return {
      state,
      history,
      historyTotal,
      historyPage,
      calls,
      business,
      config,
      owners,
      contact: {
        name: poc.name,
        phone: poc.phone,
        email: poc.email,
        linkedinUrl: poc.linkedin_url,
        alternativePhone: poc.alternate_phone,
      },
      company: {
        _id: lead._id,
        name: lead.company_name,
        stage: lead.stage,
        planning: lead.bdPlanning,
      },
    };
  }),
);
router.post(
  "/contact/:leadId/:pocId",
  handle((req, access) =>
    service.saveActivity(access, req.params.leadId, req.params.pocId, req.body),
  ),
);

router.post(
  "/submit",
  handle(async (req, access) => {
    if (access.role !== "BD Executive")
      service.fail("Daily submissions are recorded by the BD executive.", 403);
    const now = new Date();
    const day = rules.dayKey(now);
    const config = await service.settings();
    const rows = await reporting.dailyRecords(access, day);
    if (rows.some((row) => rules.missing(row.data).length))
      service.fail(
        "Complete the pending communication records before submitting.",
      );
    // Legacy call records also need an explicit communication update for that contact.
    const called = await CallActivity.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(access.id),
          timestamp: {
            $gte: rules.dayStart(day),
            $lt: new Date(rules.dayStart(day).getTime() + rules.DAY),
          },
        },
      },
      { $group: { _id: "$pocId", at: { $max: "$timestamp" } } },
    ]);
    if (
      called.some(
        (call) =>
          !rows.some(
            (row) => String(row._id.poc) === call._id && row.at >= call.at,
          ),
      )
    )
      service.fail("Some recorded calls still need communication updates.");
    const late =
      rules.workingDay(day, config) && now > rules.cutoffAt(day, config);
    const reason = service.text(req.body.reason);
    if (late && !reason) service.fail("Enter a reason for late submission.");
    const current = await models.Submission.findOne({
      userId: access.id,
      day,
    }).lean();
    if (current && rows.every((row) => row.at <= current.submittedAt))
      return { message: "Report already submitted." };
    await mongoose.connection.transaction(async (session) => {
      await models.Submission.updateOne(
        { userId: access.id, day },
        {
          $set: {
            submittedAt: now,
            snapshotAt: now,
            late,
            reason,
            activityCount: rows.length,
          },
        },
        { upsert: true, runValidators: true, session },
      );
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: access.id,
            leadId: rows[0]?._id.lead || undefined,
            requestId: service.requestId(req.body),
            day,
            kind: "submission",
            data: { late, reason, activities: rows.length },
          },
        ],
        { session },
      );
    });
    return {
      message: late
        ? "Late report submitted with reason."
        : "Daily report submitted.",
    };
  }),
);

router.post(
  "/business",
  handle(async (req, access) => {
    const lead = await service.accessibleLead(access, req.body.leadId);
    if (["incomplete", "rejected"].includes(lead.status))
      service.fail("Approve the company before recording business outcomes.");
    const kind = req.body.kind;
    if (!["proposal", "onboarding"].includes(kind))
      service.fail("Select proposal or onboarding.");
    const config = await service.settings();
    const reference = service.text(req.body.reference).toUpperCase();
    const evidence = service.text(req.body.evidence);
    if (!reference || !evidence)
      service.fail("A reference and confirmation evidence are required.");
    if (req.body.confirmed !== true)
      service.fail("Confirm this business event actually occurred.");
    if (
      kind === "onboarding" &&
      ((config.requireAgreement && !req.body.agreementConfirmed) ||
        (config.requireHandover && !req.body.handoverConfirmed))
    )
      service.fail("Complete the configured agreement and handover checks.");
    const ownerId = req.body.ownerId || access.id;
    if (
      access.role !== "Admin" &&
      !access.ids.some((id) => String(id) === ownerId)
    )
      service.fail("Owner is outside your team.", 403);
    const owner = await User.findOne({
      _id: ownerId,
      role: "BD Executive",
      status: "Active",
    });
    if (!owner) service.fail("Select an active BD executive.");
    const eligible = [lead.assignedBy, lead.createdBy, ...lead.assignedTo].some(
      (id) => String(id) === ownerId,
    );
    if (!eligible)
      service.fail("The executive must be assigned to this company.");
    const occurredAt = req.body.occurredAt
      ? service.date(req.body.occurredAt, "actual business event time")
      : new Date();
    if (occurredAt > new Date())
      service.fail("A completed business event cannot have a future date.");
    const event = await mongoose.connection.transaction(async (session) => {
      const company = await service.accessibleLead(access, lead._id, session);
      if (
        ![company.assignedBy, company.createdBy, ...company.assignedTo].some(
          (id) => String(id) === ownerId,
        )
      )
        service.fail(
          "The executive is no longer assigned to this company.",
          409,
        );
      const [record] = await models.BusinessEvent.create(
        [
          {
            leadId: company._id,
            ownerId,
            actorId: access.id,
            kind,
            reference,
            evidence,
            sentAt: occurredAt,
            status: kind === "proposal" ? "Awaiting feedback" : "Completed",
            agreementConfirmed: req.body.agreementConfirmed === true,
            handoverConfirmed: req.body.handoverConfirmed === true,
          },
        ],
        { session },
      );
      const previousStage = company.stage;
      if (kind === "onboarding") company.stage = "Onboarded";
      else if (["New", "Contacted"].includes(company.stage))
        company.stage = "Proposal Sent";
      if (previousStage !== company.stage) {
        await company.save({ session });
        await LeadActivity.create(
          [
            {
              leadId: company._id,
              type: "Stage Changed",
              performedBy: access.id,
              performedByName: access.name,
              description: `Stage updated after a confirmed ${kind} event.`,
              metadata: {
                from: previousStage,
                to: company.stage,
                businessEventId: record._id,
              },
              timestamp: new Date(),
            },
          ],
          { session },
        );
      }
      return record;
    });
    return {
      message:
        kind === "proposal"
          ? "Sent proposal recorded."
          : "Verified client onboarding recorded.",
      event,
    };
  }),
);
router.post(
  "/requirements/:leadId",
  handle(async (req, access) => {
    const lead = await service.accessibleLead(access, req.params.leadId);
    const requestId = service.requestId(req.body);
    if (
      !Array.isArray(req.body.hiringNeeds) ||
      req.body.hiringNeeds.length > 50 ||
      req.body.hiringNeeds.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value.trim().length > 200,
      )
    )
      service.fail(
        "Enter up to 50 hiring requirements, each no longer than 200 characters.",
      );
    const count = (key) => {
      const value = req.body[key];
      if (value === "" || value === null || value === undefined) return null;
      if (
        !["number", "string"].includes(typeof value) ||
        !Number.isInteger(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > 100000
      )
        service.fail("Enter a whole count between 0 and 100000.");
      return Number(value);
    };
    const fields = {
      hiring_needs: [
        ...new Set(req.body.hiringNeeds.map((value) => value.trim())),
      ],
      no_of_positions: count("positions"),
      no_of_designations: count("designations"),
    };
    await mongoose.connection.transaction(async (session) => {
      const previous = await models.Event.findOne({
        actorId: access.id,
        requestId,
      }).session(session);
      if (previous) {
        if (
          String(previous.leadId) !== String(lead._id) ||
          previous.kind !== "requirements-updated"
        )
          service.fail("Request identifier was already used.", 409);
        return;
      }
      await Lead.updateOne(
        { _id: lead._id },
        { $set: fields },
        { session, runValidators: true },
      );
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: access.id,
            leadId: lead._id,
            requestId,
            day: rules.dayKey(),
            kind: "requirements-updated",
            data: {
              ...fields,
              remarks: `Hiring requirements updated: ${fields.hiring_needs.join(", ") || "none"}`,
            },
          },
        ],
        { session },
      );
    });
    return { message: "Company hiring requirements saved." };
  }),
);
router.post(
  "/opportunity/:leadId",
  handle(async (req, access) => {
    const lead = await service.accessibleLead(access, req.params.leadId);
    const note = service.text(req.body.note);
    if (!note)
      service.fail("Explain the qualification or expected onboarding plan.");
    const expected = req.body.expectedOnboardingAt
      ? service.date(req.body.expectedOnboardingAt, "expected onboarding date")
      : undefined;
    if (expected && expected <= new Date())
      service.fail("Choose a future expected onboarding date.");
    const optionalNumber = (key, max) => {
      const value = req.body[key];
      if (value === undefined || value === null || value === "")
        return undefined;
      if (
        !["string", "number"].includes(typeof value) ||
        !Number.isInteger(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > max
      )
        service.fail(
          `Enter a valid ${key === "probability" ? "probability from 0 to 100" : "open requirements count"}.`,
        );
      return Number(value);
    };
    const planning = {
      qualifiedForProposal: req.body.qualifiedForProposal === true,
      expectedOnboardingAt: expected,
      note,
      openRequirements: optionalNumber("openRequirements", 100000),
      probability: optionalNumber("probability", 100),
      updatedBy: access.id,
      updatedAt: new Date(),
    };
    await mongoose.connection.transaction(async (session) => {
      lead.bdPlanning = planning;
      await lead.save({ session });
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: access.id,
            leadId: lead._id,
            requestId: service.requestId(req.body),
            day: rules.dayKey(),
            kind: "opportunity-planning",
            data: planning,
          },
        ],
        { session },
      );
    });
    return { message: "Opportunity planning saved." };
  }),
);
router.patch(
  "/business/:id",
  handle(async (req, access) => {
    if (
      !["Accepted", "Rejected", "Awaiting feedback"].includes(req.body.status)
    )
      service.fail("Invalid proposal feedback.");
    const reason = service.text(req.body.reason);
    if (!reason) service.fail("Record the client feedback.");
    await mongoose.connection.transaction(async (session) => {
      const event = await models.BusinessEvent.findOne({
        _id: req.params.id,
        kind: "proposal",
        ...service.ownerQuery(access),
      }).session(session);
      if (!event) service.fail("Proposal not found.", 404);
      await service.accessibleLead(access, event.leadId, session);
      const oldStatus = event.status;
      event.status = req.body.status;
      await event.save({ session });
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: event.ownerId,
            leadId: event.leadId,
            requestId: service.requestId(req.body),
            day: rules.dayKey(),
            kind: "proposal-feedback",
            data: {
              proposal: event._id,
              from: oldStatus,
              to: event.status,
              reason,
            },
          },
        ],
        { session },
      );
    });
    return { message: "Proposal feedback recorded." };
  }),
);

router.post(
  "/lifecycle/:leadId",
  handle(async (req, access) => {
    const lead = await service.accessibleLead(access, req.params.leadId);
    const reason = service.text(req.body.reason);
    const nextAction = service.text(req.body.nextAction);
    const dueAt = service.date(req.body.dueAt, "next action date");
    if (!reason || !nextAction || dueAt <= new Date())
      service.fail("Enter a delay reason, next action, and future follow-up.");
    await mongoose.connection.transaction(async (session) => {
      const event = await models.Event.findOne({
        actorId: access.id,
        requestId: service.requestId(req.body),
      }).session(session);
      if (event) return;
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: access.id,
            leadId: lead._id,
            requestId: req.body.requestId,
            day: rules.dayKey(),
            kind: "lifecycle",
            data: { reason, nextAction, dueAt },
          },
        ],
        { session },
      );
      await Task.updateOne(
        { monitoringKey: `lifecycle:${lead._id}:${dueAt.toISOString()}` },
        {
          $setOnInsert: {
            title: nextAction,
            description: reason,
            due_date: dueAt,
            user_id: access.id,
            createdBy: access.id,
            lead_id: lead._id,
            type: "Lifecycle review",
            monitoringKey: `lifecycle:${lead._id}:${dueAt.toISOString()}`,
          },
        },
        { session, upsert: true },
      );
    });
    return {
      message: "Lifecycle review recorded without changing the lead stage.",
    };
  }),
);

router.patch(
  "/state/:id",
  handle(async (req, access) => {
    manager(access);
    const reason = service.text(req.body.reason);
    if (!reason) service.fail("Enter the reason or updated contact strategy.");
    await mongoose.connection.transaction(async (session) => {
      const state = await models.ContactState.findOne({
        _id: req.params.id,
        ...service.ownerQuery(access),
      }).session(session);
      if (!state) service.fail("Follow-up not found.", 404);
      const lead = await service.accessibleLead(access, state.leadId, session);
      const fromOwnerId = state.ownerId;
      if (req.body.ownerId) {
        const owner = await User.findOne({
          $and: [
            { _id: req.body.ownerId, role: "BD Executive", status: "Active" },
            service.ownerQuery(access, "_id"),
          ],
        }).session(session);
        if (!owner) service.fail("Select an active executive in your team.");
        state.ownerId = owner._id;
        state.resolvedAt = undefined;
        state.resolution = "";
        await Lead.updateOne(
          { _id: lead._id },
          { $addToSet: { assignedTo: owner._id } },
          { session },
        );
        await Task.updateMany(
          {
            lead_id: lead._id,
            poc_id: state.pocId,
            monitoringKey: /^bd:/,
            completed: false,
          },
          { $set: { user_id: owner._id } },
          { session },
        );
      } else {
        state.resolvedAt = new Date();
        state.resolution = reason;
        await Task.updateMany(
          {
            lead_id: lead._id,
            poc_id: state.pocId,
            monitoringKey: /^bd:/,
            completed: false,
          },
          {
            $set: {
              completed: true,
              completedAt: new Date(),
              monitoringDisposition: "Resolved",
            },
          },
          { session },
        );
      }
      state.strategy = reason;
      state.updatedBy = access.id;
      state.revision += 1;
      await state.save({ session });
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: state.ownerId,
            leadId: lead._id,
            pocId: state.pocId,
            requestId: service.requestId(req.body),
            day: rules.dayKey(),
            kind: req.body.ownerId ? "reassigned" : "resolved",
            data: { reason, fromOwnerId, ownerId: state.ownerId },
          },
        ],
        { session },
      );
    });
    return {
      message: req.body.ownerId
        ? "Follow-up reassigned."
        : "Escalation resolved with reason.",
    };
  }),
);
router.post(
  "/state/:id/remind",
  handle(async (req, access) => {
    manager(access);
    const state = await models.ContactState.findOne({
      _id: req.params.id,
      ...service.ownerQuery(access),
    }).lean();
    if (!state) service.fail("Follow-up not found.", 404);
    await service.accessibleLead(access, state.leadId);
    await service.notify(
      state.ownerId,
      `manual:${state._id}:${rules.dayKey()}`,
      service.text(req.body.message) || "Manager requested a follow-up update",
      state,
    );
    return { message: "Reminder added to the executive’s notifications." };
  }),
);
router.get(
  "/notifications",
  handle(async (req, access) => ({
    items: await models.Notification.find({ recipientId: access.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    unread: await models.Notification.countDocuments({
      recipientId: access.id,
      readAt: null,
    }),
  })),
);
router.patch(
  "/task/:id/complete",
  handle(async (req, access) => {
    await mongoose.connection.transaction(async (session) => {
      const task = await Task.findOne({
        _id: req.params.id,
        ...service.ownerQuery(access, "user_id"),
      }).session(session);
      if (!task) service.fail("Task not found.", 404);
      if (task.lead_id)
        await service.accessibleLead(access, task.lead_id, session);
      if (task.completed) return;
      const updated = await Task.updateOne(
        { _id: task._id, completed: false },
        { $set: { completed: true, completedAt: new Date() } },
        { session },
      );
      if (updated.modifiedCount)
        await models.Event.create(
          [
            {
              actorId: access.id,
              ownerId: task.user_id || access.id,
              leadId: task.lead_id || undefined,
              pocId: task.poc_id,
              requestId: service.requestId(req.body),
              day: rules.dayKey(),
              kind: "task-completed",
              data: { taskId: task._id, title: task.title },
            },
          ],
          { session },
        );
    });
    return {
      message:
        "Task completed. Record the communication outcome if applicable.",
    };
  }),
);
router.patch(
  "/notifications/:id",
  handle(async (req, access) => {
    await models.Notification.updateOne(
      { _id: req.params.id, recipientId: access.id },
      { $set: { readAt: new Date() } },
    );
    return { message: "Notification read." };
  }),
);
router.get(
  "/settings",
  handle(async (req, access) => {
    admin(access);
    return service.settings();
  }),
);
router.put(
  "/settings",
  handle(async (req, access) => {
    admin(access);
    const fields = {};
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(req.body.cutoff || ""))
      service.fail("Cutoff must use HH:mm.");
    fields.cutoff = req.body.cutoff;
    for (const name of [
      "linkedinDays",
      "recoveryDays",
      "proposalTarget",
      "onboardingTarget",
      "callbackNoticeMinutes",
    ]) {
      if (
        !Number.isInteger(req.body[name]) ||
        req.body[name] < 1 ||
        req.body[name] > 1000
      )
        service.fail(`Invalid ${name}.`);
      fields[name] = req.body[name];
    }
    if (
      !Array.isArray(req.body.workingDays) ||
      !req.body.workingDays.length ||
      req.body.workingDays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    )
      service.fail("Select working days.");
    if (
      !Array.isArray(req.body.holidays) ||
      req.body.holidays.some((day) => !rules.validDay(day))
    )
      service.fail("Enter valid holiday dates as YYYY-MM-DD.");
    Object.assign(fields, {
      workingDays: req.body.workingDays,
      holidays: req.body.holidays,
      requireAgreement: req.body.requireAgreement !== false,
      requireHandover: req.body.requireHandover !== false,
      updatedBy: access.id,
    });
    await mongoose.connection.transaction(async (session) => {
      await models.Settings.updateOne(
        { key: "default" },
        { $set: fields },
        { upsert: true, runValidators: true, session },
      );
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: access.id,
            requestId: service.requestId(req.body),
            day: rules.dayKey(),
            kind: "settings",
            data: fields,
          },
        ],
        { session },
      );
    });
    return { message: "Monitoring settings saved." };
  }),
);
router.put(
  "/targets",
  handle(async (req, access) => {
    admin(access);
    const user = await User.findOne({
      _id: req.body.userId,
      role: "BD Executive",
    });
    if (!user) service.fail("BD executive not found.");
    if (!rules.validDay(req.body.effectiveDate))
      service.fail("Enter a valid effective date.");
    for (const field of ["proposalTarget", "onboardingTarget"])
      if (
        !Number.isInteger(req.body[field]) ||
        req.body[field] < 1 ||
        req.body[field] > 1000
      )
        service.fail("Targets must be whole numbers from 1 to 1000.");
    const fields = {
      userId: user._id,
      effectiveDate: req.body.effectiveDate,
      proposalTarget: req.body.proposalTarget,
      onboardingTarget: req.body.onboardingTarget,
      updatedBy: access.id,
    };
    await mongoose.connection.transaction(async (session) => {
      await models.Target.updateOne(
        { userId: user._id, effectiveDate: fields.effectiveDate },
        { $set: fields },
        { upsert: true, runValidators: true, session },
      );
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: user._id,
            requestId: service.requestId(req.body),
            day: rules.dayKey(),
            kind: "target",
            data: fields,
          },
        ],
        { session },
      );
    });
    return { message: "Employee targets saved." };
  }),
);
router.use(require('./companyWorkspaceRoutes'));
router.use(require('./managerWorkspaceRoutes'));
module.exports = router;
