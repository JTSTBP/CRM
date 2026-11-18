const mongoose = require("mongoose");
const models = require("../models/BDMonitoring");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Task = require("../models/Task");
const CallActivity = require("../models/CallActivity");
const LeadActivity = require("../models/LeadActivity");
const rules = require("./bdMonitoringRules");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
const text = (value) =>
  typeof value === "string" ? value.trim().slice(0, 2000) : "";
function date(value, label) {
  const parsed = new Date(value);
  if (!value || !Number.isFinite(parsed.getTime()))
    fail(`Enter a valid ${label}.`);
  return parsed;
}
async function settings() {
  return (
    (await models.Settings.findOne({ key: "default" }).lean()) ||
    new models.Settings().toObject()
  );
}
async function scope(user) {
  const current = await User.findById(user.id)
    .select("role status reporter name")
    .lean();
  if (
    !current ||
    current.status !== "Active" ||
    !["Admin", "Manager", "BD Executive"].includes(current.role)
  )
    fail("Access denied.", 403);
  const team =
    current.role === "Manager"
      ? await User.find({ reporter: user.id }).select("_id").lean()
      : [];
  return {
    role: current.role,
    id: String(current._id),
    ids: [current._id, ...team.map((item) => item._id)],
    name: current.name,
    reporter: current.reporter,
  };
}
function ownerQuery(access, field = "ownerId") {
  return access.role === "Admin" ? {} : { [field]: { $in: access.ids } };
}
function leadQuery(access) {
  return access.role === "Admin"
    ? {}
    : {
        $or: ["assignedBy", "createdBy", "assignedTo"].map((field) => ({
          [field]: { $in: access.ids },
        })),
      };
}
async function accessibleLead(access, leadId, session) {
  if (!mongoose.isValidObjectId(leadId)) fail("Company not found.", 404);
  const lead = await Lead.findOne({
    _id: leadId,
    ...leadQuery(access),
  }).session(session || null);
  if (!lead) fail("Company not found or access denied.", 404);
  return lead;
}
function requestId(body) {
  if (
    typeof body.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{12,100}$/.test(body.requestId)
  )
    fail("A valid request identifier is required.");
  return body.requestId;
}
async function contactHistory(leadId, pocId, session) {
  const filter = { leadId, pocId: String(pocId) };
  const attempts = await CallActivity.countDocuments(filter).session(session);
  const last = await CallActivity.findOne(filter)
    .sort({ timestamp: -1, _id: -1 })
    .session(session)
    .lean();
  const reached = await CallActivity.findOne({
    ...filter,
    stage: { $in: ["Contacted", "Connected", "Not Interested"] },
  })
    .sort({ timestamp: -1 })
    .session(session)
    .lean();
  if (!last) return { attempts };
  const firstFailure = await CallActivity.findOne({
    ...filter,
    stage: { $in: ["Busy", "No Answer", "Wrong Number", "Callback Requested"] },
    ...(reached ? { timestamp: { $gt: reached.timestamp } } : {}),
  })
    .sort({ timestamp: 1 })
    .session(session)
    .lean();
  const firstWrongNumber = await CallActivity.findOne({
    ...filter,
    stage: "Wrong Number",
    ...(reached ? { timestamp: { $gt: reached.timestamp } } : {}),
  })
    .sort({ timestamp: 1 })
    .session(session)
    .lean();
  const outcome = last.stage === "Contacted" ? "Connected" : last.stage;
  return {
    attempts,
    lastCallAt: last.timestamp,
    callOutcome: rules.OUTCOMES.includes(outcome) ? outcome : "",
    lastActivityAt: last.timestamp,
    lastWorkedDate: rules.dayKey(last.timestamp),
    needsDailyUpdate: true,
    firstUnsuccessfulAt: firstFailure?.timestamp,
    reachedAt: ["Connected", "Not Interested"].includes(outcome)
      ? last.timestamp
      : undefined,
    wrongNumberAt: firstWrongNumber?.timestamp,
  };
}
async function reminder(state, kind, dueAt, session) {
  const key = `bd:${state._id}:${kind}:${new Date(dueAt).toISOString()}`;
  await Task.updateOne(
    { monitoringKey: key },
    {
      $setOnInsert: {
        monitoringKey: key,
        createdBy: state.updatedBy || state.ownerId,
        lead_id: state.leadId,
        poc_id: state.pocId,
        completed: false,
      },
      $set: {
        title: `${kind}: ${state.nextAction || "Review contact"}`,
        type: kind,
        due_date: dueAt,
        user_id: state.ownerId,
      },
    },
    { upsert: true, session, runValidators: true },
  );
  await Task.updateOne(
    { monitoringKey: key, monitoringDisposition: "Superseded" },
    {
      $set: { completed: false },
      $unset: { monitoringDisposition: 1, completedAt: 1 },
    },
    { session },
  );
}
function validateActivity(body, now) {
  if (body.callOutcome && !rules.OUTCOMES.includes(body.callOutcome))
    fail("Select a valid call outcome.");
  for (const channel of ["whatsapp", "email", "linkedinFollowup"]) {
    if (!rules.CHANNELS.includes(body[channel]))
      fail(`Select a valid ${channel} status.`);
  }
  if (!rules.CONNECTIONS.includes(body.linkedin))
    fail("Select a valid LinkedIn status.");
  if (
    [body.whatsapp, body.email, body.linkedinFollowup].includes(
      "Not Applicable",
    ) &&
    !text(body.channelReason)
  )
    fail("Enter the reason for Not Applicable.");
  if (body.callNotApplicable === true && !text(body.channelReason))
    fail("Explain why a call is not applicable.");
  if (body.meaningfulContactConfirmed === true && !text(body.strategy))
    fail("Describe the verified two-way conversation.");
  if (
    body.email === "Sent" &&
    body.emailConfirmed === true &&
    !text(body.emailSubject)
  )
    fail("Record the subject of the sent email.");
  if (
    body.linkedinUrl &&
    !/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s]+$/i.test(
      body.linkedinUrl,
    )
  )
    fail("Enter a valid HTTPS LinkedIn profile URL.");
  const recovery = {};
  for (const key of rules.RECOVERY) {
    const value = body.recovery?.[key] || "Pending";
    if (!rules.RECOVERY_STATUSES.includes(value))
      fail("Select valid recovery outcomes.");
    recovery[key] = value;
  }
  if (
    Object.values(recovery).some((value) =>
      ["Not Applicable", "Not Available"].includes(value),
    ) &&
    !text(body.recoveryReason)
  )
    fail("Explain recovery steps marked unavailable or not applicable.");
  const dueAt = body.dueAt ? date(body.dueAt, "follow-up date") : null;
  if (dueAt && dueAt <= now) fail("Choose a future follow-up time.");
  if (body.callOutcome === "Callback Requested" && !dueAt)
    fail("Enter the client’s requested callback time.");
  if (body.callOutcome === "Not Interested" && !text(body.remarks))
    fail("Record the client’s reason for declining.");
  return { recovery, dueAt };
}

async function saveActivity(access, leadId, pocId, body) {
  const key = requestId(body);
  const replay = await models.Event.findOne({
    actorId: access.id,
    requestId: key,
  }).lean();
  if (replay) {
    await accessibleLead(access, leadId);
    if (
      String(replay.leadId) !== leadId ||
      String(replay.pocId) !== pocId ||
      replay.kind !== "activity"
    )
      fail("Request identifier already used.", 409);
    return { message: "Activity already recorded." };
  }
  const now = new Date();
  const config = await settings();
  const input = body;
  return mongoose.connection.transaction(async (session) => {
    let body = input;
    const previous = await models.Event.findOne({
      actorId: access.id,
      requestId: key,
    }).session(session);
    if (previous) {
      if (
        String(previous.leadId) !== leadId ||
        String(previous.pocId) !== pocId ||
        previous.kind !== "activity"
      )
        fail("Request identifier already used.", 409);
      return { message: "Activity already recorded." };
    }
    const lead = await accessibleLead(access, leadId, session);
    const poc = lead.points_of_contact.id(pocId);
    if (!poc || ["pending", "rejected"].includes(poc.approvalStatus))
      fail("Approved contact not found.", 404);
    let state = await models.ContactState.findOne({ leadId, pocId }).session(
      session,
    );
    const existing = Boolean(state);
    if (
      state &&
      access.role === "BD Executive" &&
      String(state.ownerId) !== access.id
    )
      fail("This follow-up belongs to another executive.", 403);
    if (state && state.revision !== body.revision)
      fail("This contact changed. Refresh it before saving.", 409);
    if (!state) {
      const ownerId = access.role === "BD Executive" ? access.id : body.ownerId;
      if (
        !mongoose.isValidObjectId(ownerId) ||
        (access.role !== "Admin" &&
          !access.ids.some((id) => String(id) === ownerId))
      )
        fail("Select a responsible BD executive.");
      const owner = await User.findOne({
        _id: ownerId,
        role: "BD Executive",
        status: "Active",
      }).session(session);
      if (
        !owner ||
        ![lead.assignedBy, lead.createdBy, ...lead.assignedTo].some(
          (id) => String(id) === ownerId,
        )
      )
        fail("Select an active executive assigned to this company.");
      state = new models.ContactState({
        leadId,
        pocId,
        ownerId,
        ...(await contactHistory(leadId, pocId, session)),
      });
    }
    const partial = Boolean(body.activityType);
    const dueProvided = Object.prototype.hasOwnProperty.call(body, 'dueAt');
    if (partial) body = require('./contactActivityPatch').activityPatch(body, state);
    const validated = validateActivity(partial && !dueProvided ? {...body, dueAt: ''} : body, now);
    if (partial && !dueProvided) validated.dueAt = state.dueAt;
    const oldLinkedin = state.linkedin;
    for (const channel of ["whatsapp", "email", "linkedinFollowup"]) {
      if (partial && body.activityType !== channel) continue;
      const sentToday =
        state[`${channel}At`] &&
        rules.dayKey(state[`${channel}At`]) === rules.dayKey(now);
      if (
        body[channel] === "Sent" &&
        (!sentToday || state[channel] !== "Sent") &&
        body[`${channel}Confirmed`] !== true
      )
        fail(`Confirm that ${channel} was sent for today's activity.`);
    }
    if (
      ["Sent", "Pending", "Accepted", "Rejected"].includes(body.linkedin) &&
      state.linkedin !== body.linkedin &&
      body.linkedinConfirmed !== true
    )
      fail("Manually verify the LinkedIn status.");
    const completed = (key) => validated.recovery[key] === "Completed";
    if (
      completed("alternativeFound") &&
      !text(body.alternativePhone) &&
      !poc.alternate_phone
    )
      fail("Record the alternative phone before marking it found.");
    if (completed("emailAvailable") && !poc.email)
      fail("Add the contact email before marking it available.");
    if (
      completed("linkedinAvailable") &&
      !text(body.linkedinUrl) &&
      !poc.linkedin_url
    )
      fail("Add the LinkedIn profile before marking it available.");
    if (completed("linkedinAccepted") && body.linkedin !== "Accepted")
      fail("Verify LinkedIn acceptance before completing this recovery step.");
    state.updatedBy = access.id;
    state.needsDailyUpdate = false;
    state.lastWorkedDate = rules.dayKey(now);
    state.lastActivityAt = now;
    for (const field of [
      "whatsapp",
      "email",
      "linkedin",
      "linkedinFollowup",
      "linkedinUrl",
      "emailSubject",
      "channelReason",
      "alternativePhone",
      "alternativeContact",
      "remarks",
      "recoveryReason",
      "strategy",
    ]) {
      state[field] = text(body[field]);
    }
    state.recovery = validated.recovery;
    for (const channel of ["whatsapp", "email", "linkedinFollowup"]) {
      if (body[`${channel}Confirmed`] && body[channel] === "Sent")
        state[`${channel}At`] = now;
    }
    if (body.linkedinConfirmed === true) state.linkedinCheckedAt = now;
    if (["Sent", "Pending"].includes(state.linkedin)) {
      if (!state.linkedinSentAt || !["Sent", "Pending"].includes(oldLinkedin))
        state.linkedinSentAt = now;
      if (!state.linkedinReviewAt || body.linkedinConfirmed === true)
        state.linkedinReviewAt = new Date(
          now.getTime() + config.linkedinDays * rules.DAY,
        );
    } else {
      state.linkedinReviewAt = undefined;
    }
    if (state.linkedin === "Accepted" && oldLinkedin !== "Accepted")
      state.linkedinAcceptedAt = now;
    if (body.callOutcome) {
      state.callNotApplicable = false;
      state.callOutcome = body.callOutcome;
      state.lastCallAt = now;
      state.attempts += 1;
      if (["Connected", "Not Interested"].includes(body.callOutcome)) {
        state.reachedAt = now;
        state.firstUnsuccessfulAt = undefined;
        state.wrongNumberAt = undefined;
      } else if (
        ["Busy", "No Answer", "Wrong Number", "Callback Requested"].includes(
          body.callOutcome,
        )
      ) {
        if (!state.firstUnsuccessfulAt) state.firstUnsuccessfulAt = now;
        state.reachedAt = undefined;
      }
      state.resolvedAt = undefined;
      state.resolution = "";
      if (body.callOutcome === "Not Interested") {
        state.resolvedAt = now;
        state.resolution = state.remarks;
      }
      if (body.callOutcome === "Wrong Number" && !state.wrongNumberAt)
        state.wrongNumberAt = now;
      const stage =
        {
          Connected: "Contacted",
          "Not Interested": "Contacted",
          "Callback Requested": "Contacted",
        }[body.callOutcome] || body.callOutcome;
      poc.stage = stage;
      await CallActivity.create(
        [
          {
            userId: state.ownerId,
            leadId,
            pocId,
            phone: poc.phone || state.alternativePhone || "Not recorded",
            stage: body.callOutcome,
            remarks: state.remarks,
            timestamp: now,
            device: "CRM activity form",
            bdRecorded: true,
          },
        ],
        { session },
      );
      await LeadActivity.create(
        [
          {
            leadId,
            type: "Call Logged",
            performedBy: access.id,
            performedByName: access.name,
            timestamp: now,
            description: `Called "${poc.name || "contact"}" — ${body.callOutcome}. ${state.remarks || ""}`,
            metadata: {
              pocId,
              stage: body.callOutcome,
              remarks: state.remarks,
            },
          },
        ],
        { session },
      );
    }
    if (!body.callOutcome && body.callNotApplicable === true)
      state.callNotApplicable = true;
    if (body.meaningfulContactConfirmed === true) {
      state.reachedAt = now;
      state.firstUnsuccessfulAt = undefined;
    }
    if (state.alternativePhone) poc.alternate_phone = state.alternativePhone;
    if (state.linkedinUrl) poc.linkedin_url = state.linkedinUrl;
    if (body.callOutcome === "Connected" && lead.stage === "New") {
      lead.stage = "Contacted";
      await LeadActivity.create(
        [
          {
            leadId,
            type: "Stage Changed",
            performedBy: access.id,
            performedByName: access.name,
            description:
              "Moved from New to Contacted after a confirmed connected call.",
            metadata: { from: "New", to: "Contacted" },
            timestamp: now,
          },
        ],
        { session },
      );
    }
    await lead.save({ session });
    state.nextAction = text(body.nextAction);
    state.dueAt = validated.dueAt || undefined;
    if (["Busy", "No Answer"].includes(body.callOutcome) && !state.dueAt) {
      state.dueAt = rules.nextBusinessDay(now, config);
      state.nextAction =
        state.nextAction || "Retry contact using the agreed outreach strategy";
    }
    state.revision += 1;
    await state.save({ session });
    if (state.resolvedAt)
      await Task.updateMany(
        {
          lead_id: leadId,
          poc_id: pocId,
          monitoringKey: /^bd:/,
          completed: false,
        },
        {
          $set: {
            completed: true,
            completedAt: now,
            monitoringDisposition: "Resolved",
          },
        },
        { session },
      );
    if (!state.resolvedAt) {
      const kind =
        state.callOutcome === "Busy"
          ? "Busy callback"
          : state.callOutcome === "No Answer"
            ? "No Answer retry"
            : "Client follow-up";
      const key = state.dueAt
        ? `bd:${state._id}:${kind}:${state.dueAt.toISOString()}`
        : null;
      await Task.updateMany(
        {
          lead_id: leadId,
          poc_id: pocId,
          monitoringKey: /^bd:/,
          type: { $ne: "LinkedIn review" },
          completed: false,
          ...(key ? { $and: [{ monitoringKey: { $ne: key } }] } : {}),
        },
        {
          $set: {
            completed: true,
            completedAt: now,
            monitoringDisposition: "Superseded",
          },
        },
        { session },
      );
      if (state.dueAt) await reminder(state, kind, state.dueAt, session);
    }
    if (state.linkedinReviewAt && !state.resolvedAt)
      await reminder(state, "LinkedIn review", state.linkedinReviewAt, session);
    await Task.updateMany(
      {
        lead_id: leadId,
        poc_id: pocId,
        monitoringKey: /^bd:/,
        type: "LinkedIn review",
        completed: false,
        ...(state.linkedinReviewAt
          ? { due_date: { $ne: state.linkedinReviewAt } }
          : {}),
      },
      {
        $set: {
          completed: true,
          completedAt: now,
          monitoringDisposition: "Superseded",
        },
      },
      { session },
    );
    const snapshot = state.toObject({ flattenMaps: true });
    await models.Event.create(
      [
        {
          actorId: access.id,
          ownerId: state.ownerId,
          leadId,
          pocId,
          requestId: key,
          kind: "activity",
          day: rules.dayKey(now),
          data: {
            ...snapshot,
            callLogged: Boolean(body.callOutcome),
            existing,
            whatsappConfirmed:
              body.whatsappConfirmed === true && body.whatsapp === "Sent",
            emailConfirmed:
              body.emailConfirmed === true && body.email === "Sent",
            linkedinConfirmed: body.linkedinConfirmed === true,
            linkedinRequestRecorded:
              ["Sent", "Pending"].includes(state.linkedin) &&
              !["Sent", "Pending"].includes(oldLinkedin),
            linkedinAcceptanceRecorded:
              state.linkedin === "Accepted" && oldLinkedin !== "Accepted",
          },
        },
      ],
      { session },
    );
    return { message: "Communication recorded.", state: snapshot };
  });
}

async function notify(recipientId, key, title, state, severity = "warning") {
  try {
    await models.Notification.updateOne(
      { recipientId, key },
      {
        $setOnInsert: {
          recipientId,
          key,
          title,
          severity,
          leadId: state?.leadId,
          pocId: state?.pocId,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}
async function runMonitoring() {
  const config = await settings();
  const now = new Date();
  const since = new Date(now.getTime() - rules.DAY);
  const EmailSendLog = require("../models/EmailSendLog");
  for await (const email of EmailSendLog.find({
    status: "success",
    bdMonitoringRecorded: { $ne: true },
    sentAt: { $gte: since },
  })
    .limit(500)
    .lean()
    .cursor()) {
    await syncProviderEmail(email);
  }
  for await (const call of CallActivity.find({
    bdRecorded: { $ne: true },
    timestamp: { $gte: since },
  })
    .sort({ timestamp: 1 })
    .limit(500)
    .lean()
    .cursor()) {
    await syncLegacyCall(call);
  }
  for await (const state of models.ContactState.find({ resolvedAt: null })
    .lean()
    .cursor()) {
    const reasons = rules.alerts(state, now, config);
    const owner = await User.findById(state.ownerId)
      .select("reporter status")
      .lean();
    if (!owner || owner.status !== "Active") continue;
    const lead = await Lead.findOne({
      _id: state.leadId,
      status: { $nin: ["incomplete", "rejected"] },
      points_of_contact: {
        $elemMatch: {
          _id: state.pocId,
          approvalStatus: { $nin: ["pending", "rejected"] },
        },
      },
    })
      .select("assignedBy createdBy assignedTo")
      .lean();
    if (
      !lead ||
      ![lead.assignedBy, lead.createdBy, ...lead.assignedTo].some(
        (id) => String(id) === String(state.ownerId),
      )
    )
      continue;
    if (
      state.dueAt &&
      new Date(state.dueAt) <=
        new Date(now.getTime() + config.callbackNoticeMinutes * 60000)
    )
      reasons.push("Follow-up due");
    for (const reason of new Set(reasons)) {
      const key = `${state._id}:${reason}:${state.dueAt?.toISOString() || state.firstUnsuccessfulAt?.toISOString() || state.updatedAt.toISOString()}`;
      await notify(
        state.ownerId,
        key,
        reason,
        state,
        reason.includes("escalation") ? "urgent" : "warning",
      );
      if (reason.includes("escalation") && owner.reporter)
        await notify(owner.reporter, key, reason, state, "urgent");
    }
  }
  const { stalledPipeline } = require("./bdDashboardService");
  const stalled = await Lead.aggregate(stalledPipeline({ role: "Admin" }, now));
  for (const item of stalled) {
    const lead = await Lead.findById(item._id)
      .select("assignedTo assignedBy createdBy")
      .lean();
    if (!lead) continue;
    const owners = await User.find({
      _id: {
        $in: [...lead.assignedTo, lead.assignedBy, lead.createdBy].filter(
          Boolean,
        ),
      },
      role: "BD Executive",
      status: "Active",
    })
      .select("_id reporter")
      .lean();
    for (const owner of owners) {
      const key = `lifecycle:${item._id}:${new Date(item.since).toISOString()}`;
      await notify(
        owner._id,
        key,
        "Lifecycle stalled — status update required",
        { leadId: item._id },
      );
      if (owner.reporter)
        await notify(
          owner.reporter,
          key,
          "Team opportunity stalled for over 48 hours",
          { leadId: item._id },
        );
    }
  }
  const day = rules.dayKey(now);
  if (
    rules.workingDay(day, config) &&
    now >= new Date(rules.cutoffAt(day, config).getTime() - 30 * 60000)
  ) {
    for await (const user of User.find({
      role: "BD Executive",
      status: "Active",
    })
      .select("_id reporter")
      .lean()
      .cursor()) {
      const submission = await models.Submission.findOne({
        userId: user._id,
        day,
      }).lean();
      const last = await models.Event.findOne({
        ownerId: user._id,
        day,
        kind: "activity",
      })
        .sort({ createdAt: -1 })
        .lean();
      const lastCall = await CallActivity.findOne({
        userId: user._id,
        timestamp: { $gte: rules.dayStart(day) },
      })
        .sort({ timestamp: -1 })
        .select("timestamp")
        .lean();
      if (
        submission &&
        (!last || last.createdAt <= submission.submittedAt) &&
        (!lastCall || lastCall.timestamp <= submission.submittedAt)
      )
        continue;
      const overdue = now >= rules.cutoffAt(day, config);
      await notify(
        user._id,
        `submission:${day}:${overdue}`,
        overdue
          ? "Daily report pending submission"
          : "Daily report due by cutoff",
      );
      if (overdue && user.reporter)
        await notify(
          user.reporter,
          `submission:${user._id}:${day}`,
          "Team daily report pending submission",
        );
    }
  }
}

async function syncLegacyCall(call) {
  const config = await settings();
  await mongoose.connection.transaction(async (session) => {
    if (
      await models.Event.exists({
        actorId: call.userId,
        requestId: `legacy_${call._id}`,
      }).session(session)
    )
      return;
    const lead = await Lead.findById(call.leadId).session(session);
    if (!lead || !lead.points_of_contact.id(call.pocId)) {
      await CallActivity.updateOne(
        { _id: call._id },
        { $set: { bdRecorded: true } },
        { session },
      );
      return;
    }
    let state = await models.ContactState.findOne({
      leadId: call.leadId,
      pocId: call.pocId,
    }).session(session);
    if (!state) {
      state = new models.ContactState({
        leadId: call.leadId,
        pocId: call.pocId,
        ownerId: call.userId,
        ...(await contactHistory(call.leadId, call.pocId, session)),
      });
      await state.save({ session });
    }
    const outcome = call.stage === "Contacted" ? "Connected" : call.stage;
    if (!state.lastCallAt || state.lastCallAt <= call.timestamp) {
      state.callOutcome = outcome;
      state.attempts = await CallActivity.countDocuments({
        leadId: call.leadId,
        pocId: call.pocId,
      }).session(session);
      state.lastCallAt = call.timestamp;
      state.lastActivityAt = call.timestamp;
      state.lastWorkedDate = rules.dayKey(call.timestamp);
      state.needsDailyUpdate = true;
      state.remarks = call.remarks;
      state.updatedBy = call.userId;
      if (["Connected", "Not Interested"].includes(outcome)) {
        state.reachedAt = call.timestamp;
        state.firstUnsuccessfulAt = undefined;
        state.wrongNumberAt = undefined;
      } else if (["Busy", "No Answer", "Wrong Number"].includes(outcome)) {
        if (!state.firstUnsuccessfulAt)
          state.firstUnsuccessfulAt = call.timestamp;
        state.reachedAt = undefined;
      }
      if (outcome === "Wrong Number")
        state.wrongNumberAt = state.wrongNumberAt || call.timestamp;
      if (["Busy", "No Answer"].includes(outcome) && !state.dueAt) {
        state.nextAction = "Review and retry contact";
        state.dueAt = rules.nextBusinessDay(new Date(), config);
      }
      state.revision += 1;
      await state.save({ session });
      if (state.dueAt)
        await reminder(
          state,
          outcome === "Busy" ? "Busy callback" : "No Answer retry",
          state.dueAt,
          session,
        );
    }
    await models.Event.create(
      [
        {
          actorId: call.userId,
          ownerId: state.ownerId,
          leadId: call.leadId,
          pocId: call.pocId,
          requestId: `legacy_${call._id}`,
          day: rules.dayKey(call.timestamp),
          kind: "legacy-call",
          data: { callId: call._id, outcome, remarks: call.remarks },
        },
      ],
      { session },
    );
    await CallActivity.updateOne(
      { _id: call._id },
      { $set: { bdRecorded: true } },
      { session },
    );
  });
}

async function syncProviderEmail(email) {
  const EmailSendLog = require("../models/EmailSendLog");
  await mongoose.connection.transaction(async (session) => {
    const existing = await models.Event.exists({
      actorId: email.userId,
      requestId: `provider_${email._id}`,
    }).session(session);
    if (existing) return;
    const lead =
      email.leadId && (await Lead.findById(email.leadId).session(session));
    const poc = lead && lead.points_of_contact.id(email.pocId);
    if (lead && poc) {
      let state = await models.ContactState.findOne({
        leadId: lead._id,
        pocId: poc._id,
      }).session(session);
      if (!state)
        state = new models.ContactState({
          leadId: lead._id,
          pocId: poc._id,
          ownerId: email.userId,
          ...(await contactHistory(lead._id, poc._id, session)),
        });
      state.needsDailyUpdate =
        state.needsDailyUpdate ||
        state.lastWorkedDate !== rules.dayKey(email.sentAt);
      state.email = "Sent";
      state.emailAt = email.sentAt;
      state.emailSubject = email.subject;
      state.updatedBy = email.userId;
      state.lastWorkedDate = rules.dayKey(email.sentAt);
      state.lastActivityAt = email.sentAt;
      state.revision += 1;
      await state.save({ session });
      await models.Event.create(
        [
          {
            actorId: email.userId,
            ownerId: email.userId,
            leadId: lead._id,
            pocId: poc._id,
            requestId: `provider_${email._id}`,
            day: rules.dayKey(email.sentAt),
            kind: "activity",
            data: {
              ...state.toObject({ flattenMaps: true }),
              emailSource: "provider",
              emailLogId: email._id,
              emailConfirmed: false,
              providerConfirmed: true,
            },
          },
        ],
        { session },
      );
    }
    await EmailSendLog.updateOne(
      { _id: email._id },
      { $set: { bdMonitoringRecorded: true } },
      { session },
    );
  });
}

module.exports = {
  fail,
  text,
  date,
  settings,
  scope,
  ownerQuery,
  leadQuery,
  accessibleLead,
  requestId,
  saveActivity,
  reminder,
  notify,
  runMonitoring,
  validateActivity,
  syncLegacyCall,
  syncProviderEmail,
};
