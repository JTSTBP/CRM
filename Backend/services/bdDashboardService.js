const mongoose = require("mongoose");
const {
  ContactState,
  Event,
  Submission,
  BusinessEvent,
  Target,
} = require("../models/BDMonitoring");
const Lead = require("../models/Lead");
const User = require("../models/User");
const CallActivity = require("../models/CallActivity");
const LeadActivity = require("../models/LeadActivity");
const Task = require("../models/Task");
const EmailSendLog = require("../models/EmailSendLog");
const service = require("./bdMonitoringService");
const rules = require("./bdMonitoringRules");

async function dailyRecords(access, day) {
  return Event.aggregate([
    { $match: { ...service.ownerQuery(access), day, kind: "activity" } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: { owner: "$ownerId", lead: "$leadId", poc: "$pocId" },
        data: { $first: "$data" },
        at: { $first: "$createdAt" },
      },
    },
  ]);
}
function stalledPipeline(access, now) {
  return [
    {
      $match: {
        ...service.leadQuery(access),
        stage: "Contacted",
        status: { $nin: ["incomplete", "rejected"] },
      },
    },
    {
      $lookup: {
        from: LeadActivity.collection.name,
        let: { lead: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$leadId", "$$lead"] },
              type: "Stage Changed",
            },
          },
          { $sort: { timestamp: -1, _id: -1 } },
          { $limit: 1 },
        ],
        as: "transition",
      },
    },
    { $unwind: "$transition" },
    {
      $match: {
        "transition.metadata.to": "Contacted",
        "transition.timestamp": { $lt: new Date(now.getTime() - 48 * 3600000) },
      },
    },
    {
      $lookup: {
        from: Event.collection.name,
        let: { lead: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$leadId", "$$lead"] },
              kind: "lifecycle",
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: "review",
      },
    },
    {
      $lookup: {
        from: Event.collection.name,
        let: { lead: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$leadId", "$$lead"] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: "lastMonitoringActivity",
      },
    },
    {
      $lookup: {
        from: LeadActivity.collection.name,
        let: { lead: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$leadId", "$$lead"] } } },
          { $sort: { timestamp: -1 } },
          { $limit: 1 },
        ],
        as: "lastLeadActivity",
      },
    },
    {
      $project: {
        company_name: 1,
        since: "$transition.timestamp",
        updatedAt: 1,
        lastActivityAt: {
          $max: [
            { $arrayElemAt: ["$lastMonitoringActivity.createdAt", 0] },
            { $arrayElemAt: ["$lastLeadActivity.timestamp", 0] },
          ],
        },
        review: { $arrayElemAt: ["$review", 0] },
      },
    },
    { $sort: { since: 1 } },
  ];
}
async function dashboard(access, query, options = {}) {
  const now = new Date();
  const config = await service.settings();
  const today = rules.dayKey(now);
  const start = rules.dayStart(today);
  const end = new Date(start.getTime() + rules.DAY);
  const monthStart = rules.dayStart(`${today.slice(0, 7)}-01`);
  const periodStart = new Date(
    Math.min(monthStart.getTime(), start.getTime() - 29 * rules.DAY),
  );
  const baseOwner = service.ownerQuery(access);
  const stalledPage = Math.max(1, Number.parseInt(query.stalledPage, 10) || 1);
  const stalledSearch = service
    .text(query.stalledSearch)
    .replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
  const stalledScope = stalledSearch
    ? [{ $match: { company_name: { $regex: stalledSearch, $options: "i" } } }]
    : [];
  const [
    employees,
    callOutcomes,
    daily,
    submissions,
    business,
    targets,
    channels,
    trendCalls,
    followupCounts,
    taskCounts,
    stalledResult,
    lifecycle,
    leadCount,
    proposalClients,
    onboardedClients,
    workedCalls,
    planning,
    providerEmails,
    scheduledTasks,
  ] = await Promise.all([
    User.find({
      ...service.ownerQuery(access, "_id"),
      role: "BD Executive",
      status: "Active",
    })
      .select("name reporter")
      .sort({ name: 1 })
      .lean(),
    CallActivity.aggregate([
      {
        $match: {
          ...service.ownerQuery(access, "userId"),
          timestamp: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { owner: "$userId", outcome: "$stage" },
          count: { $sum: 1 },
        },
      },
    ]),
    dailyRecords(access, today),
    Submission.find({
      ...service.ownerQuery(access, "userId"),
      day: today,
    }).lean(),
    BusinessEvent.aggregate([
      { $match: baseOwner },
      {
        $facet: {
          owners: [
            {
              $group: {
                _id: "$ownerId",
                proposals: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$kind", "proposal"] },
                          { $gte: ["$sentAt", start] },
                          { $lt: ["$sentAt", end] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                onboardings: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$kind", "onboarding"] },
                          { $gte: ["$sentAt", monthStart] },
                          { $lt: ["$sentAt", end] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          outcomes: [
            {
              $group: {
                _id: { kind: "$kind", status: "$status" },
                count: { $sum: 1 },
              },
            },
          ],
          trend: [
            { $match: { sentAt: { $gte: periodStart, $lt: end } } },
            {
              $group: {
                _id: {
                  day: {
                    $dateToString: {
                      date: "$sentAt",
                      format: "%Y-%m-%d",
                      timezone: "Asia/Kolkata",
                    },
                  },
                  kind: "$kind",
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    Target.find({
      ...service.ownerQuery(access, "userId"),
      effectiveDate: { $lte: today },
    })
      .sort({ effectiveDate: -1 })
      .lean(),
    Event.aggregate([
      { $match: { ...baseOwner, day: today, kind: "activity" } },
      {
        $group: {
          _id: "$ownerId",
          whatsapp: { $sum: { $cond: ["$data.whatsappConfirmed", 1, 0] } },
          email: { $sum: { $cond: ["$data.emailConfirmed", 1, 0] } },
          linkedinSent: {
            $sum: { $cond: ["$data.linkedinRequestRecorded", 1, 0] },
          },
          linkedinAccepted: {
            $sum: { $cond: ["$data.linkedinAcceptanceRecorded", 1, 0] },
          },
        },
      },
    ]),
    CallActivity.aggregate([
      {
        $match: {
          ...service.ownerQuery(access, "userId"),
          timestamp: { $gte: periodStart, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$timestamp",
              format: "%Y-%m-%d",
              timezone: "Asia/Kolkata",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate([
      {
        $match: {
          ...service.ownerQuery(access, "user_id"),
          monitoringDisposition: { $nin: ["Superseded", "Resolved"] },
          due_date: { $gte: periodStart, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          due: { $sum: 1 },
          onTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$completed", true] },
                    { $ne: [{ $ifNull: ["$completedAt", null] }, null] },
                    { $lte: ["$completedAt", "$due_date"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Task.aggregate([
      {
        $match: { ...service.ownerQuery(access, "user_id"), completed: false },
      },
      {
        $group: {
          _id: "$user_id",
          pending: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $lt: ["$due_date", now] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      ...stalledPipeline(access, now),
      ...stalledScope,
      {
        $facet: {
          count: [{ $count: "total" }],
          ids: [{ $project: { _id: 1 } }],
          rows: [{ $skip: (stalledPage - 1) * 20 }, { $limit: 20 }],
        },
      },
    ]),
    Lead.aggregate([
      {
        $match: {
          ...service.leadQuery(access),
          status: { $nin: ["incomplete", "rejected"] },
        },
      },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    Lead.countDocuments({
      ...service.leadQuery(access),
      status: { $nin: ["incomplete", "rejected"] },
    }),
    BusinessEvent.distinct("leadId", { ...baseOwner, kind: "proposal" }),
    BusinessEvent.distinct("leadId", { ...baseOwner, kind: "onboarding" }),
    CallActivity.aggregate([
      {
        $match: {
          ...service.ownerQuery(access, "userId"),
          timestamp: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { owner: "$userId", poc: "$pocId" },
          at: { $max: "$timestamp" },
        },
      },
    ]),
    Lead.aggregate([
      {
        $match: {
          ...service.leadQuery(access),
          status: { $nin: ["incomplete", "rejected"] },
        },
      },
      {
        $lookup: {
          from: BusinessEvent.collection.name,
          localField: "_id",
          foreignField: "leadId",
          as: "events",
        },
      },
      {
        $group: {
          _id: null,
          qualified: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$bdPlanning.qualifiedForProposal", true] },
                    { $not: [{ $in: ["proposal", "$events.kind"] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          expected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$bdPlanning.expectedOnboardingAt", now] },
                    { $not: [{ $in: ["onboarding", "$events.kind"] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    EmailSendLog.aggregate([
      {
        $match: {
          ...service.ownerQuery(access, "userId"),
          status: "success",
          sentAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
    Task.find({ ...service.ownerQuery(access, "user_id"), completed: false })
      .sort({ due_date: 1 })
      .limit(20)
      .select("title due_date type lead_id poc_id user_id")
      .populate("lead_id", "company_name")
      .populate("user_id", "name")
      .lean(),
  ]);
  const team = employees.map((employee) => {
    const id = String(employee._id);
    const rows = daily.filter((row) => String(row._id.owner) === id);
    const submission = submissions.find((item) => String(item.userId) === id);
    const lastEvent = rows.reduce(
      (max, row) => Math.max(max, +new Date(row.at)),
      0,
    );
    const legacy = workedCalls.filter(
      (call) =>
        String(call._id.owner) === id &&
        !rows.some(
          (row) =>
            String(row._id.poc) === String(call._id.poc) &&
            +new Date(row.at) >= +new Date(call.at),
        ),
    );
    const incomplete =
      rows.filter((row) => rules.missing(row.data).length).length +
      legacy.filter(
        (call) =>
          !rows.some(
            (row) =>
              String(row._id.poc) === String(call._id.poc) &&
              rules.missing(row.data).length,
          ),
      ).length;
    const submitted = Boolean(
      submission &&
      !incomplete &&
      +new Date(submission.submittedAt) >= lastEvent,
    );
    const target = targets.find((item) => String(item.userId) === id);
    const outcome = callOutcomes.filter(
      (item) => String(item._id.owner) === id,
    );
    const achieved = business[0]?.owners.find(
      (item) => String(item._id) === id,
    );
    const task = taskCounts.find((item) => String(item._id) === id);
    const communication = channels.find((item) => String(item._id) === id);
    return {
      _id: id,
      name: employee.name,
      calls: outcome.reduce((total, item) => total + item.count, 0),
      connected: outcome
        .filter((item) => ["Connected", "Contacted"].includes(item._id.outcome))
        .reduce((total, item) => total + item.count, 0),
      incomplete,
      workedContacts: new Set([
        ...rows.map((row) => String(row._id.poc)),
        ...workedCalls
          .filter((call) => String(call._id.owner) === id)
          .map((call) => String(call._id.poc)),
      ]).size,
      submitted,
      submittedAt: submission?.submittedAt,
      reportStatus: !rules.workingDay(today, config)
        ? "Non-working day"
        : submitted
          ? submission.late
            ? "Submitted late"
            : "Submitted"
          : now >= rules.cutoffAt(today, config)
            ? "Pending submission"
            : "Due today",
      proposals: achieved?.proposals || 0,
      onboardings: achieved?.onboardings || 0,
      proposalTarget: rules.workingDay(today, config)
        ? (target?.proposalTarget ?? config.proposalTarget)
        : 0,
      onboardingTarget: target?.onboardingTarget ?? config.onboardingTarget,
      pending: task?.pending || 0,
      overdue: task?.overdue || 0,
      whatsapp: communication?.whatsapp || 0,
      email:
        (communication?.email || 0) +
        (providerEmails.find((item) => String(item._id) === id)?.count || 0),
      linkedinSent: communication?.linkedinSent || 0,
      linkedinAccepted: communication?.linkedinAccepted || 0,
    };
  });
  const alertCounts = Object.fromEntries(
    [
      "Pending communication update",
      "Busy callback",
      "No Answer retry",
      "Wrong Number recovery",
      "LinkedIn review",
      "Five-day escalation",
      "Recovery escalation",
      "Overdue follow-up",
    ].map((reason) => [reason, 0]),
  );
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = options.exportAll ? Number.MAX_SAFE_INTEGER : 20;
  const search = service.text(query.search).toLowerCase();
  const urgency = service.text(query.urgency);
  const queue = [];
  let queueCount = 0;
  const ownerFilter =
    query.employee && mongoose.isValidObjectId(query.employee)
      ? { ownerId: new mongoose.Types.ObjectId(query.employee) }
      : {};
  if (
    ownerFilter.ownerId &&
    access.role !== "Admin" &&
    !access.ids.some((id) => String(id) === String(ownerFilter.ownerId))
  )
    service.fail("Access denied.", 403);
  const stateQuery = { ...baseOwner, ...ownerFilter, resolvedAt: null };
  const queuePipeline = [
    { $match: stateQuery },
    {
      $lookup: {
        from: Lead.collection.name,
        localField: "leadId",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              ...service.leadQuery(access),
              status: { $nin: ["incomplete", "rejected"] },
            },
          },
          { $project: { company_name: 1, stage: 1, points_of_contact: 1 } },
        ],
        as: "company",
      },
    },
    { $unwind: "$company" },
    {
      $set: {
        contact: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$company.points_of_contact",
                as: "poc",
                cond: {
                  $and: [
                    { $eq: ["$$poc._id", "$pocId"] },
                    {
                      $not: [
                        {
                          $in: [
                            "$$poc.approvalStatus",
                            ["pending", "rejected"],
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            0,
          ],
        },
      },
    },
    { $match: { "contact._id": { $exists: true } } },
    {
      $lookup: {
        from: User.collection.name,
        localField: "ownerId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1 } }],
        as: "owner",
      },
    },
    { $unwind: "$owner" },
    { $set: { leadId: "$company", ownerId: "$owner" } },
    { $unset: ["company", "owner", "leadId.points_of_contact"] },
  ];
  const priorityActions = [];
  const priorityCounts = { all: 0, urgent: 0, today: 0, upcoming: 0 };
  const callbackStats = { busy: 0, noAnswer: 0, overdue: 0 };
  const stalledIds = new Set(
    (stalledResult[0]?.ids || []).map((lead) => String(lead._id)),
  );
  const compareRows = (a, b) => {
    const rank = { Urgent: 0, Review: 1, Scheduled: 2 };
    if (query.sort === "recent")
      return (
        new Date(b.lastActivityAt) - new Date(a.lastActivityAt) ||
        String(a._id).localeCompare(String(b._id))
      );
    return (
      rank[a.priority] - rank[b.priority] ||
      (a.dueAt ? +new Date(a.dueAt) : Infinity) -
        (b.dueAt ? +new Date(b.dueAt) : Infinity) ||
      String(a._id).localeCompare(String(b._id))
    );
  };
  for await (const state of ContactState.aggregate(queuePipeline).cursor({
    batchSize: 200,
  })) {
    const poc = state.contact;
    const reasons = rules.alerts(state, now, config);
    const missing = state.lastWorkedDate === today ? rules.missing(state) : [];
    if (missing.length) reasons.push("Pending communication update");
    for (const reason of reasons)
      alertCounts[reason] = (alertCounts[reason] || 0) + 1;
    const priority = reasons.some(
      (reason) =>
        reason.includes("escalation") || reason === "Overdue follow-up",
    )
      ? "Urgent"
      : reasons.length
        ? "Review"
        : "Scheduled";
    const specialized = {
      "Due today": state.dueAt && rules.dayKey(state.dueAt) === today,
      "Busy / No Answer": ["Busy", "No Answer"].includes(state.callOutcome),
      "LinkedIn pending": ["Sent", "Pending"].includes(state.linkedin),
      "LinkedIn accepted": state.linkedin === "Accepted",
      "Lifecycle stalled": stalledIds.has(String(state.leadId._id)),
    };
    const company = {
      _id: state.leadId._id,
      company_name: state.leadId.company_name,
      stage: state.leadId.stage,
    };
    const row = {
      ...state,
      leadId: company,
      contact: {
        name: poc.name,
        phone: poc.phone,
        email: poc.email,
        designation: poc.designation,
        linkedin_url: poc.linkedin_url,
      },
      missing,
      reasons,
      priority,
      daysUnreached:
        state.firstUnsuccessfulAt && !state.reachedAt
          ? Math.floor((now - new Date(state.firstUnsuccessfulAt)) / rules.DAY)
          : null,
    };
    if (state.callOutcome === "Busy") callbackStats.busy += 1;
    if (state.callOutcome === "No Answer") callbackStats.noAnswer += 1;
    if (specialized["Busy / No Answer"] && state.dueAt && state.dueAt < now)
      callbackStats.overdue += 1;
    if (reasons.length) {
      priorityCounts.all += 1;
      if (priority === "Urgent") priorityCounts.urgent += 1;
      if (specialized["Due today"]) priorityCounts.today += 1;
      if (state.dueAt && state.dueAt > now) priorityCounts.upcoming += 1;
      const matches =
        !query.priority ||
        query.priority === "all" ||
        (query.priority === "urgent" && priority === "Urgent") ||
        (query.priority === "today" && specialized["Due today"]) ||
        (query.priority === "upcoming" && state.dueAt && state.dueAt > now);
      if (matches) {
        priorityActions.push(row);
        priorityActions.sort(compareRows);
        if (priorityActions.length > 5) priorityActions.pop();
      }
    }
    if (
      urgency &&
      !(Object.hasOwn(specialized, urgency)
        ? specialized[urgency]
        : reasons.includes(urgency) || urgency === priority)
    )
      continue;
    if (
      search &&
      !`${state.leadId.company_name} ${poc.name} ${poc.phone || ""} ${state.ownerId.name}`
        .toLowerCase()
        .includes(search)
    )
      continue;
    queueCount += 1;
    let low = 0;
    let high = queue.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (compareRows(queue[middle], row) <= 0) low = middle + 1;
      else high = middle;
    }
    queue.splice(low, 0, row);
    if (queue.length > page * limit) queue.pop();
  }
  const totals = {};
  for (const field of [
    "calls",
    "connected",
    "incomplete",
    "workedContacts",
    "proposals",
    "onboardings",
    "proposalTarget",
    "onboardingTarget",
    "pending",
    "overdue",
    "whatsapp",
    "email",
    "linkedinSent",
    "linkedinAccepted",
  ])
    totals[field] = team.reduce((sum, member) => sum + member[field], 0);
  totals.calls = callOutcomes.reduce((sum, item) => sum + item.count, 0);
  totals.connected = callOutcomes
    .filter((item) => ["Connected", "Contacted"].includes(item._id.outcome))
    .reduce((sum, item) => sum + item.count, 0);
  for (const field of ["whatsapp", "email", "linkedinSent", "linkedinAccepted"])
    totals[field] = channels.reduce((sum, item) => sum + (item[field] || 0), 0);
  totals.email += providerEmails.reduce((sum, item) => sum + item.count, 0);
  totals.proposals =
    business[0]?.owners.reduce((sum, item) => sum + item.proposals, 0) || 0;
  totals.onboardings =
    business[0]?.owners.reduce((sum, item) => sum + item.onboardings, 0) || 0;
  const trend = Array.from(
    { length: Math.round((end - periodStart) / rules.DAY) },
    (_, i) => {
      const day = rules.dayKey(new Date(periodStart.getTime() + i * rules.DAY));
      return {
        day,
        calls: trendCalls.find((item) => item._id === day)?.count || 0,
        proposals:
          business[0]?.trend.find(
            (item) => item._id.day === day && item._id.kind === "proposal",
          )?.count || 0,
        onboardings:
          business[0]?.trend.find(
            (item) => item._id.day === day && item._id.kind === "onboarding",
          )?.count || 0,
      };
    },
  );
  const dayTasks = await Task.aggregate([
    {
      $match: {
        ...service.ownerQuery(access, "user_id"),
        monitoringDisposition: { $ne: "Superseded" },
        due_date: { $lt: now },
      },
    },
    {
      $group: {
        _id: null,
        dueToday: { $sum: { $cond: [{ $gte: ["$due_date", start] }, 1, 0] } },
        onTimeToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$due_date", start] },
                  { $eq: ["$completed", true] },
                  { $ne: [{ $ifNull: ["$completedAt", null] }, null] },
                  { $lte: ["$completedAt", "$due_date"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        overdueCases: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$due_date", start] },
                  {
                    $or: [
                      { $eq: ["$completed", false] },
                      { $gte: ["$completedAt", start] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolvedCases: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$due_date", start] },
                  { $eq: ["$completed", true] },
                  { $gte: ["$completedAt", start] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const lifecycleReview = await Lead.aggregate([
    ...stalledPipeline(access, now),
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        reviewed: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$review.createdAt", start] },
                  { $gt: ["$review.data.dueAt", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const linkedinPipeline = await ContactState.aggregate([
    { $match: baseOwner },
    { $group: { _id: "$linkedin", count: { $sum: 1 } } },
  ]);
  const linkedinAcceptedContacts = await ContactState.aggregate([
    ...queuePipeline,
    { $match: { linkedin: "Accepted" } },
    { $sort: { linkedinAcceptedAt: -1 } },
    { $limit: 2 },
    { $project: { leadId: 1, pocId: 1, contact: 1, linkedinUrl: 1 } },
  ]);
  const completedTasksToday = await Task.countDocuments({
    ...service.ownerQuery(access, "user_id"),
    completed: true,
    completedAt: { $gte: start, $lt: end },
    monitoringDisposition: { $exists: false },
  });
  const completionRate = totals.workedContacts
    ? Math.round(
        ((totals.workedContacts - totals.incomplete) / totals.workedContacts) *
          100,
      )
    : null;
  const dailyChecklist = [
    {
      label: "Call outcomes recorded",
      complete: daily.filter(
        (row) =>
          rules.OUTCOMES.includes(row.data.callOutcome) ||
          row.data.callNotApplicable,
      ).length,
    },
    {
      label: "WhatsApp status updated",
      complete: daily.filter(
        (row) => row.data.whatsapp && row.data.whatsapp !== "Pending",
      ).length,
    },
    {
      label: "Email status updated",
      complete: daily.filter(
        (row) => row.data.email && row.data.email !== "Pending",
      ).length,
    },
    {
      label: "Next follow-up recorded",
      complete: daily.filter(
        (row) =>
          (row.data.nextAction && row.data.dueAt) ||
          (row.data.resolvedAt && row.data.resolution),
      ).length,
    },
  ].map((item) => ({ ...item, total: totals.workedContacts }));
  const dailyTasks = dayTasks[0];
  const scoreParts = [
    { label: "Communication records", weight: 25, value: completionRate },
    {
      label: "Follow-ups on time",
      weight: 25,
      value: dailyTasks?.dueToday
        ? Math.round((dailyTasks.onTimeToday / dailyTasks.dueToday) * 100)
        : null,
    },
    {
      label: "Overdue cases resolved",
      weight: 15,
      value: dailyTasks?.overdueCases
        ? Math.round((dailyTasks.resolvedCases / dailyTasks.overdueCases) * 100)
        : null,
    },
    {
      label: "Lifecycle reviewed",
      weight: 15,
      value: lifecycleReview[0]?.total
        ? Math.round(
            (lifecycleReview[0].reviewed / lifecycleReview[0].total) * 100,
          )
        : null,
    },
    {
      label: "Report submitted on time",
      weight: 20,
      value:
        rules.workingDay(today, config) &&
        team.length &&
        (now >= rules.cutoffAt(today, config) ||
          team.every((member) => member.submitted))
          ? Math.round(
              (team.filter((member) => member.reportStatus === "Submitted")
                .length /
                team.length) *
                100,
            )
          : null,
    },
  ];
  const applicable = scoreParts.filter((part) => part.value !== null);
  const score = applicable.length
    ? Math.round(
        applicable.reduce((sum, part) => sum + part.value * part.weight, 0) /
          applicable.reduce((sum, part) => sum + part.weight, 0),
      )
    : null;
  let workingDayNumber = 0;
  let workingDayTotal = 0;
  const month = today.slice(0, 7);
  for (let day = 1; day <= 31; day++) {
    const key = `${month}-${String(day).padStart(2, "0")}`;
    if (rules.validDay(key) && rules.workingDay(key, config)) {
      workingDayTotal += 1;
      if (key <= today) workingDayNumber += 1;
    }
  }
  return {
    today,
    generatedAt: now,
    config,
    priorityActions,
    priorityCounts,
    callbackStats,
    dailyChecklist,
    portfolioCompanies: leadCount,
    workingDayNumber,
    workingDayTotal,
    accountability: {
      score,
      parts: scoreParts,
      provisional: now < rules.cutoffAt(today, config),
    },
    linkedinPipeline,
    linkedinAcceptedContacts,
    completedTasksToday,
    team,
    totals,
    outcomes: callOutcomes,
    alertCounts,
    queue: queue.slice((page - 1) * limit, page * limit),
    queueCount,
    page,
    pages: Math.ceil(queueCount / limit),
    stalled: stalledResult[0]?.rows || [],
    stalledCount: stalledResult[0]?.count[0]?.total || 0,
    stalledPage,
    stalledPages: Math.ceil((stalledResult[0]?.count[0]?.total || 0) / 20),
    qualifiedAwaitingProposal: planning[0]?.qualified || 0,
    expectedOnboardings: planning[0]?.expected || 0,
    lifecycle,
    trend,
    scheduledTasks,
    businessOutcomes: business[0]?.outcomes || [],
    completionRate: totals.workedContacts
      ? Math.round(
          ((totals.workedContacts - totals.incomplete) /
            totals.workedContacts) *
            100,
        )
      : null,
    followupCompliance: followupCounts[0]?.due
      ? Math.round((followupCounts[0].onTime / followupCounts[0].due) * 100)
      : null,
    proposalConversion: leadCount
      ? Math.round((proposalClients.length / leadCount) * 100)
      : null,
    onboardingConversion: proposalClients.length
      ? Math.round(
          (onboardedClients.filter((id) =>
            proposalClients.some((proposal) => String(proposal) === String(id)),
          ).length /
            proposalClients.length) *
            100,
        )
      : null,
  };
}
module.exports = { dashboard, dailyRecords, stalledPipeline };
