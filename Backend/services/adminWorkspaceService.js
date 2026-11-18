const normalizeCompanyArrays = require("./normalizeCompanyArrays");
const mongoose = require("mongoose"),
  User = require("../models/User"),
  Lead = require("../models/Lead"),
  Activity = require("../models/LeadActivity"),
  Proposal = require("../models/CompanyProposal"),
  Mandate = require("../models/Mandate"),
  Task = require("../models/Task");
const service = require("./bdMonitoringService"),
  rules = require("./bdMonitoringRules"),
  team = require("./managerWorkspaceService"),
  models = require("../models/BDMonitoring");
function requireAdmin(access) {
  if (access.role !== "Admin") service.fail("Admin access required.", 403);
}
async function dashboard(access, query) {
  requireAdmin(access);
  const managers = await User.find({ role: "Manager", status: "Active" })
    .select("name")
    .sort({ name: 1 })
    .lean();
  if (
    query.manager &&
    !managers.some((person) => String(person._id) === query.manager)
  )
    service.fail("Choose an active manager.", 403);
  let scope = access;
  if (query.manager) {
    const reports = await User.find({
      reporter: query.manager,
      role: "BD Executive",
      status: "Active",
    })
      .select("_id")
      .lean();
    scope = {
      ...access,
      role: "Manager",
      ids: [
        new mongoose.Types.ObjectId(query.manager),
        ...reports.map((person) => person._id),
      ],
    };
  }
  const data = await team.dashboard(scope, query, { allCompanies: true }),
    leadIds = data.companies.map(
      (company) => new mongoose.Types.ObjectId(company._id),
    ),
    now = new Date();
  const activeManagers = query.manager
    ? managers.filter((person) => String(person._id) === query.manager)
    : managers;
  const portfolioOwners = new Set(
    data.companies.flatMap((company) => company.ownerIds),
  );
  const scopedRows =
    query.territory || query.employee
      ? data.roster.filter(
          (person) =>
            portfolioOwners.has(person._id) &&
            (!query.employee || person._id === query.employee),
        )
      : data.roster;
  const recipientManagers =
    query.territory || query.employee
      ? activeManagers.filter(
          (person) =>
            portfolioOwners.has(String(person._id)) ||
            scopedRows.some((row) => row.reporter === String(person._id)),
        )
      : activeManagers;
  const recipientIds = [
    ...scopedRows.map((person) => person._id),
    ...recipientManagers.map((person) => String(person._id)),
  ];
  const auditQuery = {
    kind: {
      $in: [
        "admin-directive",
        "admin-meeting",
        "manager-task",
        "manager-research",
        "manager-remind",
        "manager-compliance",
        "manager-reassign",
        "manager-corep",
        "lifecycle",
        "proposal-review",
        "proposal-sent",
        "mandate-updated",
      ],
    },
  };
  if (query.manager || query.territory || query.employee)
    auditQuery.$or = [
      { leadId: { $in: leadIds } },
      { "data.leadIds": { $in: leadIds } },
      { "data.recipientIds": { $in: recipientIds } },
    ];
  const [stageRows, proposals, mandates, audit] = await Promise.all([
    Lead.aggregate([
      { $match: { _id: { $in: leadIds } } },
      {
        $lookup: {
          from: Activity.collection.name,
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
      {
        $project: {
          stage: 1,
          company_name: 1,
          companyProfile: 1,
          bdPlanning: 1,
          points_of_contact: 1,
          createdAt: 1,
          transition: { $arrayElemAt: ["$transition", 0] },
        },
      },
    ]).then((companies) => companies.map(normalizeCompanyArrays)),
    Proposal.find({
      leadId: { $in: leadIds },
      status: { $in: ["In Review", "Approved", "Sent"] },
    })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select(
        "leadId title reference status followupAt ownerId reviewerId revision",
      )
      .lean(),
    Mandate.aggregate([
      { $match: { leadId: { $in: leadIds }, status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: "$status",
          positions: { $sum: "$positions" },
          filled: { $sum: "$filled" },
          count: { $sum: 1 },
        },
      },
    ]),
    models.Event.find(auditQuery)
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("actorId", "name")
      .populate("leadId", "company_name")
      .select("kind actorId leadId data createdAt")
      .lean(),
  ]);
  const stages = [
    "New",
    "Contacted",
    "Proposal Sent",
    "Negotiation",
    "Won",
    "Onboarded",
  ];
  const velocity = stages.map((stage) => {
    const leads = stageRows.filter((lead) => lead.stage === stage),
      ages = leads
        .map((lead) =>
          lead.transition?.metadata?.to === stage
            ? lead.transition.timestamp
            : stage === "New"
              ? lead.createdAt
              : null,
        )
        .filter(Boolean)
        .map((date) => (now - new Date(date)) / rules.DAY);
    return {
      stage,
      count: leads.length,
      withoutCritical: leads.filter(
        (lead) =>
          !data.alerts.some(
            (row) => row.leadId === String(lead._id) && row.critical,
          ),
      ).length,
      dwellDays: ages.length
        ? Number((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1))
        : null,
      recorded: ages.length,
    };
  });
  const rowManagers = [
    ...activeManagers.map((person) => ({
      _id: String(person._id),
      name: person.name,
    })),
    ...(!query.manager
      ? [{ _id: "unassigned", name: "No active reporting manager" }]
      : []),
  ]
    .map((manager) => {
      const rows = data.roster.filter((person) =>
          manager._id === "unassigned"
            ? !managers.some((item) => String(item._id) === person.reporter)
            : person.reporter === manager._id,
        ),
        ids = rows.map((row) => row._id),
        sum = (key) => rows.reduce((total, row) => total + (row[key] || 0), 0),
        due = sum("followupDue");
      return {
        ...manager,
        executives: ids,
        team: rows.length,
        territories: [...new Set(rows.flatMap((row) => row.territories))],
        assigned: data.companies.filter((company) =>
          company.ownerIds.some((id) => ids.includes(id)),
        ).length,
        calls: sum("calls"),
        connected: sum("connected"),
        pending: sum("pending"),
        overdue: sum("overdue"),
        incomplete: sum("incomplete"),
        proposals: sum("proposals"),
        proposalTarget: sum("proposalTarget"),
        onboardings: sum("onboardings"),
        sla: due ? Math.round((sum("followupOnTime") / due) * 100) : null,
        stalled: data.alerts.filter(
          (row) =>
            row.reasons.includes("Lifecycle stalled") &&
            ids.includes(row.ownerId),
        ).length,
      };
    })
    .filter((row) => row.team || row._id !== "unassigned");
  const companyMap = new Map(stageRows.map((lead) => [String(lead._id), lead]));
  const closureQueue = proposals.map((proposal) => ({
    ...proposal,
    _id: String(proposal._id),
    leadId: String(proposal.leadId),
    company: companyMap.get(String(proposal.leadId))?.company_name || "Company",
    priority:
      companyMap.get(String(proposal.leadId))?.companyProfile?.priority ||
      "Normal",
  }));
  const requirementTotals = mandates.reduce(
    (sum, row) => ({
      positions: sum.positions + row.positions,
      filled: sum.filled + row.filled,
      active:
        sum.active + (["Open", "Sourcing"].includes(row._id) ? row.count : 0),
      activePositions:
        sum.activePositions +
        (["Open", "Sourcing"].includes(row._id)
          ? Math.max(0, row.positions - row.filled)
          : 0),
    }),
    { positions: 0, filled: 0, active: 0, activePositions: 0 },
  );
  const qualified = stageRows
    .filter((lead) => lead.bdPlanning?.qualifiedForProposal)
    .map((lead) => ({
      _id: String(lead._id),
      name: lead.company_name,
      expectedAt: lead.bdPlanning.expectedOnboardingAt,
      positions: lead.bdPlanning.openRequirements || 0,
      probability: lead.bdPlanning.probability ?? null,
    }));
  return {
    ...data,
    accounts: stageRows.map((lead) => ({
      _id: String(lead._id),
      name: lead.company_name,
      stage: lead.stage,
      priority: lead.companyProfile?.priority || "Normal",
    })),
    managers: managers.map((person) => ({
      _id: String(person._id),
      name: person.name,
    })),
    managerMatrix: rowManagers,
    recipients: recipientIds,
    velocity,
    outcomes: ["Lost", "No vendor", "Future Reference"].map((stage) => ({
      stage,
      count: stageRows.filter((lead) => lead.stage === stage).length,
    })),
    proposals: closureQueue,
    requirements: requirementTotals,
    qualified,
    executiveAudit: audit.map((event) => ({
      _id: String(event._id),
      kind: event.kind,
      actor: event.actorId?.name || "CRM user",
      company: event.leadId?.company_name,
      createdAt: event.createdAt,
      message:
        service.text(
          event.data?.message || event.data?.reason || event.data?.remarks,
        ) || event.kind.replace(/-/g, " "),
    })),
    contactCount: stageRows.reduce(
      (sum, lead) =>
        sum +
        lead.points_of_contact.filter(
          (person) => !["pending", "rejected"].includes(person.approvalStatus),
        ).length,
      0,
    ),
    urgent: data.alerts.filter((row) => row.critical).length,
  };
}
async function directive(access, body) {
  requireAdmin(access);
  const requestId = service.requestId(body),
    kind = body.kind,
    title = service.text(body.title),
    message = service.text(body.message);
  if (
    !["directive", "meeting"].includes(kind) ||
    !title ||
    !message ||
    title.length > 200
  )
    service.fail("Enter a title and instructions.");
  if (
    !Array.isArray(body.recipientIds) ||
    !body.recipientIds.length ||
    body.recipientIds.length > 200 ||
    body.recipientIds.some((id) => !mongoose.isValidObjectId(id))
  )
    service.fail("Choose 1–200 active recipients.");
  const ids = [...new Set(body.recipientIds)];
  let dueAt;
  if (kind === "meeting") {
    dueAt = service.date(body.dueAt, "meeting time");
    if (dueAt <= new Date()) service.fail("Choose a future meeting time.");
  }
  return mongoose.connection.transaction(async (session) => {
    const previous = await models.Event.findOne({
      actorId: access.id,
      requestId,
    }).session(session);
    if (previous) {
      if (previous.kind !== "admin-" + kind)
        service.fail("Request identifier already used.", 409);
      return previous.data.result;
    }
    const people = await User.find({
      _id: { $in: ids },
      status: "Active",
      role: { $in: ["Manager", "BD Executive"] },
    })
      .select("_id")
      .session(session);
    if (people.length !== ids.length)
      service.fail("Recipients must be active managers or executives.");
    for (const person of people) {
      await models.Notification.create(
        [
          {
            recipientId: person._id,
            key: "executive:" + requestId,
            title: title + " — " + message,
            severity: "warning",
          },
        ],
        { session },
      );
      if (kind === "meeting")
        await Task.create(
          [
            {
              user_id: person._id,
              createdBy: access.id,
              title,
              description: message,
              type: "Meeting",
              due_date: dueAt,
            },
          ],
          { session },
        );
    }
    const result = {
      message: `${kind === "meeting" ? "Meeting tasks and in-app invitations" : "In-app directive"} saved for ${people.length} recipient(s).`,
    };
    await models.Event.create(
      [
        {
          actorId: access.id,
          ownerId: access.id,
          requestId,
          day: rules.dayKey(),
          kind: "admin-" + kind,
          data: { title, message, recipientIds: ids, dueAt, result },
        },
      ],
      { session },
    );
    return result;
  });
}
module.exports = { dashboard, directive, requireAdmin };
