const Lead = require("../models/Lead");
const User = require("../models/User");
const Task = require("../models/Task");
const Call = require("../models/CallActivity");
const Activity = require("../models/LeadActivity");
const Mandate = require("../models/Mandate");
const Proposal = require("../models/CompanyProposal");
const models = require("../models/BDMonitoring");
const accessRules = require("./bdMonitoringService");
const rules = require("./bdMonitoringRules");

async function timeline(access, leadId, query = {}, limit = 40) {
  const lead = await accessRules.accessibleLead(access, leadId);
  const page = Math.max(1, Math.min(10000, parseInt(query.page, 10) || 1));
  const eventType = {
    $switch: {
      branches: [
        {
          case: { $regexMatch: { input: "$kind", regex: "^proposal-" } },
          then: "Proposals",
        },
        {
          case: { $eq: ["$kind", "activity"] },
          then: {
            $switch: {
              branches: [
                { case: { $eq: ["$data.whatsapp", "Sent"] }, then: "WhatsApp" },
                { case: { $eq: ["$data.email", "Sent"] }, then: "Email" },
                {
                  case: {
                    $in: ["$data.linkedin", ["Sent", "Accepted", "Rejected"]],
                  },
                  then: "LinkedIn",
                },
              ],
              default: "Communication",
            },
          },
        },
        { case: { $eq: ["$kind", "task-completed"] }, then: "Tasks" },
        {
          case: { $in: ["$kind", ["mandate-created", "mandate-updated"]] },
          then: "Mandates",
        },
      ],
      default: "Company",
    },
  };
  const project = (prefix, type, at, title, body, extras = {}) => ({
    $project: {
      _id: 0,
      id: { $concat: [prefix, { $toString: "$_id" }] },
      type,
      at,
      title,
      body,
      ...extras,
    },
  });
  const pipeline = [
    {
      $match: {
        leadId: lead._id,
        // Company-level changes are shared account history. Individual outreach retains its owner scope.
        ...(access.role === "Admin"
          ? {}
          : {
              $or: [
                accessRules.ownerQuery(access),
                {
                  kind: {
                    $in: [
                      "company-profile",
                      "company-contact-flags",
                      "requirements-updated",
                      "opportunity-planning",
                      "mandate-created",
                      "mandate-updated",
                      "proposal-draft-created",
                      "proposal-update",
                      "proposal-submit",
                      "proposal-approve",
                      "proposal-reject",
                      "proposal-sent",
                    ],
                  },
                },
              ],
            }),
        kind: { $nin: ["company-note", "company-stage", "submission"] },
      },
    },
    project(
      "event:",
      eventType,
      "$createdAt",
      "$kind",
      {
        $ifNull: [
          "$data.remarks",
          {
            $ifNull: [
              "$data.reason",
              { $ifNull: ["$data.note", "Recorded CRM update"] },
            ],
          },
        ],
      },
      { pocId: 1, actorId: 1, details: "$data" },
    ),
    {
      $unionWith: {
        coll: Activity.collection.name,
        pipeline: [
          {
            $match: {
              leadId: lead._id,
              type: { $nin: ["Call Logged", "Remark Added"] },
            },
          },
          project(
            "activity:",
            {
              $switch: {
                branches: [
                  {
                    case: { $regexMatch: { input: "$type", regex: "Task" } },
                    then: "Tasks",
                  },
                  { case: { $eq: ["$type", "Email Sent"] }, then: "Email" },
                ],
                default: "Company",
              },
            },
            "$timestamp",
            "$type",
            "$description",
            { actor: "$performedByName", details: "$metadata" },
          ),
        ],
      },
    },
    {
      $unionWith: {
        coll: Call.collection.name,
        pipeline: [
          {
            $match: {
              leadId: lead._id,
              ...accessRules.ownerQuery(access, "userId"),
            },
          },
          project(
            "call:",
            { $literal: "Calls" },
            "$timestamp",
            { $concat: ["Call · ", "$stage"] },
            { $ifNull: ["$remarks", "Call outcome recorded"] },
            { pocId: 1, actorId: "$userId" },
          ),
        ],
      },
    },
    {
      $unionWith: {
        coll: models.BusinessEvent.collection.name,
        pipeline: [
          { $match: { leadId: lead._id, ...accessRules.ownerQuery(access) } },
          project(
            "business:",
            { $literal: "Proposals" },
            "$sentAt",
            { $concat: ["$kind", " · ", "$reference"] },
            "$status",
            { actorId: 1 },
          ),
        ],
      },
    },
    {
      $unionWith: {
        coll: Lead.collection.name,
        pipeline: [
          { $match: { _id: lead._id } },
          { $unwind: "$remarks" },
          {
            $project: {
              _id: 0,
              id: { $concat: ["note:", { $toString: "$remarks._id" }] },
              type: { $literal: "Notes" },
              at: "$remarks.created_at",
              title: {
                $cond: [
                  { $eq: ["$remarks.type", "file"] },
                  "Document link added",
                  "Note added",
                ],
              },
              body: "$remarks.content",
              actor: "$remarks.profile.name",
              url: "$remarks.fileUrl",
              pocId: "$remarks.poc_id",
            },
          },
        ],
      },
    },
  ];
  const types = [
    "Calls",
    "WhatsApp",
    "Email",
    "LinkedIn",
    "Proposals",
    "Notes",
    "Tasks",
    "Company",
    "Communication",
    "Mandates",
  ];
  if (types.includes(query.type))
    pipeline.push({ $match: { type: query.type } });
  if (typeof query.search === "string" && query.search.trim()) {
    const literal = query.search
      .trim()
      .slice(0, 150)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pipeline.push({
      $match: {
        $or: [
          { title: { $regex: literal, $options: "i" } },
          { body: { $regex: literal, $options: "i" } },
        ],
      },
    });
  }
  pipeline.push(
    { $sort: { at: -1, id: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "value" }],
      },
    },
  );
  const [result] = await models.Event.aggregate(pipeline);
  const actorIds = [
    ...new Set(
      result.items
        .map((item) => item.actorId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("name")
    .lean();
  return {
    items: result.items.map((item) => ({
      ...item,
      actor:
        item.actor ||
        actors.find((user) => String(user._id) === String(item.actorId))
          ?.name ||
        "CRM user",
    })),
    total: result.total[0]?.value || 0,
    page,
  };
}

async function workspace(access, leadId) {
  const lead = await accessRules.accessibleLead(access, leadId);
  await lead.populate([
    {
      path: "assignedBy assignedTo createdBy",
      select: "name role status reporter",
      populate: { path: "reporter", select: "name role" },
    },
  ]);
  const company = lead.toObject();
  const contacts = company.points_of_contact.filter(
    (person) => !["pending", "rejected"].includes(person.approvalStatus),
  );
  const ids = contacts.map((contact) => contact._id);
  const ownerIds = [
    company.assignedBy,
    company.createdBy,
    ...(company.assignedTo || []),
  ]
    .filter(Boolean)
    .map((user) => user._id);
  const [
    owners,
    states,
    tasks,
    business,
    mandates,
    changes,
    callSummary,
    history,
    config,
    openFollowups,
    dueToday,
    drafts,
    reviewers,
  ] = await Promise.all([
    User.find({
      _id: { $in: ownerIds },
      status: "Active",
      role: "BD Executive",
      ...accessRules.ownerQuery(access, "_id"),
    })
      .select("name role")
      .lean(),
    models.ContactState.find({
      leadId: lead._id,
      pocId: { $in: ids },
      ...accessRules.ownerQuery(access),
    }).lean(),
    Task.find({
      lead_id: lead._id,
      ...accessRules.ownerQuery(access, "user_id"),
    })
      .sort({ completed: 1, due_date: 1 })
      .limit(200)
      .lean(),
    models.BusinessEvent.find({
      leadId: lead._id,
      ...accessRules.ownerQuery(access),
    })
      .sort({ sentAt: -1 })
      .lean(),
    Mandate.find({ leadId: lead._id })
      .populate("ownerId", "name role status")
      .sort({ createdAt: -1 })
      .lean(),
    Activity.find({ leadId: lead._id, type: "Stage Changed" })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean(),
    Call.aggregate([
      {
        $match: {
          leadId: lead._id,
          ...accessRules.ownerQuery(access, "userId"),
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          lastAt: { $max: "$timestamp" },
        },
      },
    ]),
    timeline(access, lead._id, {}, 8),
    accessRules.settings(),
    Task.countDocuments({
      lead_id: lead._id,
      completed: false,
      ...accessRules.ownerQuery(access, "user_id"),
    }),
    Task.countDocuments({
      lead_id: lead._id,
      completed: false,
      ...accessRules.ownerQuery(access, "user_id"),
      due_date: {
        $gte: rules.dayStart(rules.dayKey()),
        $lt: new Date(rules.dayStart(rules.dayKey()).getTime() + rules.DAY),
      },
    }),
    Proposal.find({ leadId: lead._id, ...accessRules.ownerQuery(access) })
      .sort({ updatedAt: -1 })
      .lean(),
    User.find({
      status: "Active",
      role: { $in: ["Admin", "Manager"] },
      ...(access.role === "BD Executive"
        ? {
            _id: {
              $in: [access.reporter].filter(Boolean),
            },
          }
        : access.role === "Manager"
          ? { _id: access.id }
          : {}),
    })
      .select("name role")
      .lean(),
  ]);
  const activeMandates = mandates.filter((record) =>
    ["Open", "Sourcing", "Paused"].includes(record.status),
  );
  const latestState = states
    .filter((state) => state.lastActivityAt)
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))[0];
  const lastCandidates = [
    latestState && {
      at: latestState.lastActivityAt,
      label: "Communication update",
      pocId: latestState.pocId,
    },
    callSummary[0]?.lastAt && { at: callSummary[0].lastAt, label: "Call" },
    business[0] && {
      at: business[0].sentAt,
      label:
        business[0].kind === "proposal" ? "Proposal sent" : "Client onboarding",
    },
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const stageRecord = changes.find(
    (change) => change.metadata?.to === lead.stage,
  );
  const stageEnteredAt =
    stageRecord?.timestamp || (lead.stage === "New" ? lead.createdAt : null);
  return {
    company,
    contacts,
    owners,
    states,
    tasks,
    business,
    mandates,
    history,
    config,
    stageEnteredAt,
    drafts,
    reviewers,
    stageHistory: [
      { stage: "New", at: lead.createdAt },
      ...changes
        .filter((change) => change.metadata?.to)
        .map((change) => ({ stage: change.metadata.to, at: change.timestamp })),
    ],
    stats: {
      contacts: contacts.length,
      approvedContacts: contacts.filter(
        (contact) => contact.approvalStatus === "approved",
      ).length,
      decisionMakers: contacts.filter((contact) => contact.decisionMaker)
        .length,
      openPositions: mandates.length
        ? activeMandates.reduce(
            (sum, record) => sum + record.positions - record.filled,
            0,
          )
        : (lead.no_of_positions ?? lead.bdPlanning?.openRequirements ?? null),
      proposals: business.filter((record) => record.kind === "proposal").length,
      awaitingFeedback: business.filter(
        (record) =>
          record.kind === "proposal" && record.status === "Awaiting feedback",
      ).length,
      openFollowups,
      dueToday,
      calls: callSummary[0]?.count || 0,
      lastTouch: lastCandidates[0] || null,
    },
  };
}
module.exports = { workspace, timeline };
