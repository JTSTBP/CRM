const User = require("../models/User"),
  Lead = require("../models/Lead"),
  Call = require("../models/CallActivity"),
  Task = require("../models/Task"),
  Email = require("../models/EmailSendLog");
const models = require("../models/BDMonitoring"),
  rules = require("./bdMonitoringRules"),
  service = require("./bdMonitoringService"),
  reporting = require("./bdDashboardService");
const ratio = (a, b) => (b ? Math.round((a / b) * 100) : null);
function range(query, now = new Date()) {
  const today = rules.dayKey(now);
  let from = today,
    to = today;
  if (query.period === "week") {
    const weekday = new Date(
      rules.dayStart(today).getTime() + 12 * 3600000,
    ).getUTCDay();
    from = rules.dayKey(
      new Date(
        rules.dayStart(today).getTime() - ((weekday + 6) % 7) * rules.DAY,
      ),
    );
  } else if (query.period === "month") from = today.slice(0, 7) + "-01";
  else if (query.period === "custom") {
    from = query.from;
    to = query.to;
    if (!rules.validDay(from) || !rules.validDay(to))
      service.fail("Choose valid reporting dates.");
  } else if (query.period && query.period !== "today")
    service.fail("Choose a valid reporting period.");
  if (
    from > to ||
    to > today ||
    rules.dayStart(to) - rules.dayStart(from) > 92 * rules.DAY
  )
    service.fail("Choose up to 93 days ending today or earlier.");
  return {
    from,
    to,
    days:
      Math.round((rules.dayStart(to) - rules.dayStart(from)) / rules.DAY) + 1,
  };
}
function requireManager(access) {
  if (!["Manager", "Admin"].includes(access.role))
    service.fail("Manager access required.", 403);
}
async function dashboard(access, query) {
  requireManager(access);
  const now = new Date(),
    today = rules.dayKey(now),
    start = rules.dayStart(today),
    end = new Date(+start + rules.DAY),
    monthStart = rules.dayStart(today.slice(0, 7) + "-01"),
    selected = range(query, now),
    periodStart = rules.dayStart(selected.from),
    periodEnd = new Date(+rules.dayStart(selected.to) + rules.DAY),
    previousStart = new Date(+periodStart - selected.days * rules.DAY);
  const config = await service.settings();
  const employees = await User.find({
    ...service.ownerQuery(access, "_id"),
    role: "BD Executive",
    status: "Active",
  })
    .select("name reporter")
    .sort({ name: 1 })
    .lean();
  if (
    query.employee &&
    !employees.some((person) => String(person._id) === query.employee)
  )
    service.fail("Executive is outside your active team.", 403);
  const members = query.employee
      ? employees.filter((person) => String(person._id) === query.employee)
      : employees,
    ids = members.map((person) => person._id);
  const allLeads = await Lead.find({
    ...service.leadQuery(access),
    status: { $nin: ["incomplete", "rejected"] },
  })
    .select(
      "company_name companyProfile assignedBy assignedTo createdBy stage points_of_contact bdPlanning createdAt",
    )
    .lean();
  const territories = [
    ...new Set(
      allLeads.map((lead) => lead.companyProfile?.territory).filter(Boolean),
    ),
  ].sort();
  if (query.territory && !territories.includes(query.territory))
    service.fail("Choose a territory in your team portfolio.");
  const leads = allLeads.filter(
    (lead) =>
      (!query.territory ||
        lead.companyProfile?.territory === query.territory) &&
      [lead.assignedBy, lead.createdBy, ...lead.assignedTo].some((owner) =>
        ids.some((id) => String(id) === String(owner)),
      ),
  );
  const leadIds = leads.map((lead) => lead._id),
    leadMap = new Map(leads.map((lead) => [String(lead._id), lead])),
    scope = { ownerId: { $in: ids }, leadId: { $in: leadIds } },
    since = new Date(Math.min(+previousStart, +monthStart, +start));
  const owner = (field) => ({ [field]: { $in: ids } });
  const stalledPipeline = reporting.stalledPipeline({ ...access, ids }, now);
  stalledPipeline[0].$match._id = { $in: leadIds };
  const [
    callGroups,
    dailyCalls,
    channels,
    daily,
    states,
    tasks,
    business,
    targets,
    submissions,
    provider,
    stalled,
    audit,
  ] = await Promise.all([
    Call.aggregate([
      {
        $match: {
          ...owner("userId"),
          leadId: { $in: leadIds },
          timestamp: { $gte: since, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            owner: "$userId",
            lead: "$leadId",
            day: {
              $dateToString: {
                date: "$timestamp",
                format: "%Y-%m-%d",
                timezone: "Asia/Kolkata",
              },
            },
            outcome: "$stage",
          },
          count: { $sum: 1 },
          first: { $min: "$timestamp" },
        },
      },
    ]),
    Call.aggregate([
      {
        $match: {
          ...owner("userId"),
          leadId: { $in: leadIds },
          timestamp: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { owner: "$userId", lead: "$leadId", poc: "$pocId" },
          at: { $max: "$timestamp" },
        },
      },
    ]),
    models.Event.aggregate([
      {
        $match: {
          ...scope,
          kind: "activity",
          createdAt: { $gte: since, $lt: end },
        },
      },
      {
        $group: {
          _id: { owner: "$ownerId", day: "$day" },
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
    models.Event.aggregate([
      { $match: { ...scope, kind: "activity", day: today } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: { owner: "$ownerId", lead: "$leadId", poc: "$pocId" },
          data: { $first: "$data" },
          at: { $first: "$createdAt" },
        },
      },
    ]),
    models.ContactState.find(scope).lean(),
    Task.find({
      ...owner("user_id"),
      lead_id: { $in: leadIds },
      monitoringDisposition: { $ne: "Superseded" },
      $or: [
        { completed: false },
        { due_date: { $gte: since, $lt: end } },
        { completedAt: { $gte: since, $lt: end } },
      ],
    })
      .select(
        "user_id lead_id poc_id title type due_date completed completedAt monitoringDisposition",
      )
      .lean(),
    models.BusinessEvent.find({ ...scope, sentAt: { $gte: since, $lt: end } })
      .select("ownerId leadId kind sentAt status")
      .lean(),
    models.Target.find({ ...owner("userId"), effectiveDate: { $lte: today } })
      .sort({ effectiveDate: -1 })
      .lean(),
    models.Submission.find({ ...owner("userId"), day: today }).lean(),
    Email.aggregate([
      {
        $match: {
          ...owner("userId"),
          leadId: { $in: leadIds },
          status: "success",
          sentAt: { $gte: since, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            owner: "$userId",
            day: {
              $dateToString: {
                date: "$sentAt",
                format: "%Y-%m-%d",
                timezone: "Asia/Kolkata",
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate(stalledPipeline),
    models.Event.find({
      actorId: access.id,
      kind: {
        $in: [
          "manager-task",
          "manager-research",
          "manager-remind",
          "manager-compliance",
          "manager-reassign",
          "manager-corep",
          "lifecycle",
          "reassigned",
          "resolved",
        ],
      },
      $or: [
        { leadId: { $in: leadIds } },
        { "data.leadIds": { $in: leadIds } },
        { kind: "manager-compliance" },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("leadId", "company_name")
      .lean(),
  ]);
  const activeStates = states.filter(
    (state) =>
      !state.resolvedAt &&
      leadMap
        .get(String(state.leadId))
        ?.points_of_contact.some(
          (person) =>
            String(person._id) === String(state.pocId) &&
            !["pending", "rejected"].includes(person.approvalStatus),
        ),
  );
  const between = (day) => day >= selected.from && day <= selected.to;
  const targetAt = (id, day) =>
    targets.find(
      (target) =>
        String(target.userId) === String(id) && target.effectiveDate <= day,
    );
  const workingDays = Array.from({ length: selected.days }, (_, i) =>
    rules.dayKey(new Date(+periodStart + i * rules.DAY)),
  ).filter((day) => rules.workingDay(day, config));
  const rows = members.map((member) => {
    const id = String(member._id),
      myCalls = callGroups.filter(
        (row) => String(row._id.owner) === id && between(row._id.day),
      ),
      todayCalls = callGroups.filter(
        (row) => String(row._id.owner) === id && row._id.day === today,
      ),
      myChannels = channels.filter(
        (row) => String(row._id.owner) === id && between(row._id.day),
      ),
      myEmails = provider.filter(
        (row) => String(row._id.owner) === id && between(row._id.day),
      );
    const myDaily = daily.filter((row) => String(row._id.owner) === id),
      legacy = dailyCalls.filter(
        (call) =>
          String(call._id.owner) === id &&
          !myDaily.some(
            (row) =>
              String(row._id.lead) === String(call._id.lead) &&
              String(row._id.poc) === String(call._id.poc) &&
              new Date(row.at) >= new Date(call.at),
          ),
      );
    const workedContacts = new Set([
        ...myDaily.map((row) => `${row._id.lead}:${row._id.poc}`),
        ...legacy.map((row) => `${row._id.lead}:${row._id.poc}`),
      ]).size,
      incomplete =
        myDaily.filter((row) => rules.missing(row.data).length).length +
        legacy.filter(
          (call) =>
            !myDaily.some(
              (row) =>
                String(row._id.lead) === String(call._id.lead) &&
                String(row._id.poc) === String(call._id.poc) &&
                rules.missing(row.data).length,
            ),
        ).length;
    const submission = submissions.find((item) => String(item.userId) === id),
      latest = Math.max(
        0,
        ...myDaily.map((row) => +new Date(row.at)),
        ...dailyCalls
          .filter((call) => String(call._id.owner) === id)
          .map((call) => +new Date(call.at)),
      ),
      submitted = Boolean(
        submission &&
        !incomplete &&
        +new Date(submission.submittedAt) >= latest,
      );
    const myTasks = tasks.filter((task) => String(task.user_id) === id),
      pending = myTasks.filter((task) => !task.completed),
      due = myTasks.filter(
        (task) =>
          new Date(task.due_date) < now && new Date(task.due_date) >= start,
      ),
      oldCases = myTasks.filter(
        (task) =>
          new Date(task.due_date) < start &&
          (!task.completed || new Date(task.completedAt) >= start),
      ),
      myStalled = stalled.filter((lead) => {
        const company = leadMap.get(String(lead._id));
        return [
          company.assignedBy,
          company.createdBy,
          ...company.assignedTo,
        ].some((owner) => String(owner) === id);
      });
    const reportStatus = !rules.workingDay(today, config)
      ? "Non-working day"
      : submitted
        ? submission.late
          ? "Submitted late"
          : "Submitted"
        : now >= rules.cutoffAt(today, config)
          ? "Pending submission"
          : "Due today";
    const parts = [
      {
        label: "Communication records",
        weight: 25,
        value: ratio(workedContacts - incomplete, workedContacts),
      },
      {
        label: "Follow-ups on time",
        weight: 25,
        value: ratio(
          due.filter(
            (task) =>
              task.completed &&
              task.completedAt &&
              new Date(task.completedAt) <= new Date(task.due_date),
          ).length,
          due.length,
        ),
      },
      {
        label: "Overdue cases resolved",
        weight: 15,
        value: ratio(
          oldCases.filter(
            (task) => task.completed && new Date(task.completedAt) >= start,
          ).length,
          oldCases.length,
        ),
      },
      {
        label: "Lifecycle reviewed",
        weight: 15,
        value: ratio(
          myStalled.filter(
            (lead) =>
              new Date(lead.review?.createdAt) >= start &&
              new Date(lead.review?.data?.dueAt) > now,
          ).length,
          myStalled.length,
        ),
      },
      {
        label: "Report submitted on time",
        weight: 20,
        value:
          rules.workingDay(today, config) &&
          (now >= rules.cutoffAt(today, config) || submitted)
            ? reportStatus === "Submitted"
              ? 100
              : 0
            : null,
      },
    ];
    const applicable = parts.filter((part) => part.value !== null),
      score = applicable.length
        ? Math.round(
            applicable.reduce(
              (sum, part) => sum + part.value * part.weight,
              0,
            ) / applicable.reduce((sum, part) => sum + part.weight, 0),
          )
        : null;
    const myBusiness = business.filter((row) => String(row.ownerId) === id),
      periodBusiness = myBusiness.filter(
        (row) =>
          new Date(row.sentAt) >= periodStart &&
          new Date(row.sentAt) < periodEnd,
      ),
      monthBusiness = myBusiness.filter(
        (row) =>
          row.kind === "onboarding" && new Date(row.sentAt) >= monthStart,
      ),
      periodProposalTarget = workingDays.reduce(
        (sum, day) =>
          sum + (targetAt(id, day)?.proposalTarget ?? config.proposalTarget),
        0,
      ),
      dailyTarget = rules.workingDay(today, config)
        ? (targetAt(id, today)?.proposalTarget ?? config.proposalTarget)
        : 0;
    const sum = (key) =>
      myChannels.reduce((total, row) => total + (row[key] || 0), 0);
    const periodProposals = periodBusiness.filter(
      (row) => row.kind === "proposal",
    ).length;
    return {
      _id: id,
      name: member.name,
      territories: [
        ...new Set(
          leads
            .filter((company) =>
              [
                company.assignedBy,
                company.createdBy,
                ...company.assignedTo,
              ].some((owner) => String(owner) === id),
            )
            .map((company) => company.companyProfile?.territory)
            .filter(Boolean),
        ),
      ],
      calls: myCalls.reduce((sum, row) => sum + row.count, 0),
      connected: myCalls
        .filter((row) => ["Connected", "Contacted"].includes(row._id.outcome))
        .reduce((sum, row) => sum + row.count, 0),
      companies: new Set(myCalls.map((row) => String(row._id.lead))).size,
      whatsapp: sum("whatsapp"),
      email: sum("email") + myEmails.reduce((sum, row) => sum + row.count, 0),
      linkedinSent: sum("linkedinSent"),
      linkedinAccepted: sum("linkedinAccepted"),
      proposals: periodProposals,
      proposalTarget: periodProposalTarget,
      dailyProposals: myBusiness.filter(
        (row) => row.kind === "proposal" && new Date(row.sentAt) >= start,
      ).length,
      dailyTarget,
      onboardings: monthBusiness.length,
      onboardingTarget:
        targetAt(id, today)?.onboardingTarget ?? config.onboardingTarget,
      pending: pending.length,
      overdue: pending.filter((task) => new Date(task.due_date) < now).length,
      incomplete,
      workedContacts,
      reportStatus,
      submitted,
      score,
      parts,
      todayCalls: todayCalls.reduce((sum, row) => sum + row.count, 0),
    };
  });
  const queue = activeStates
    .filter((state) => !state.resolvedAt)
    .map((state) => {
      const lead = leadMap.get(String(state.leadId)),
        person = lead.points_of_contact.find(
          (person) => String(person._id) === String(state.pocId),
        );
      const reasons = rules.alerts(state, now, config);
      if (state.lastWorkedDate === today && rules.missing(state).length)
        reasons.push("Pending communication update");
      return {
        id: String(state._id),
        stateId: String(state._id),
        leadId: String(lead._id),
        company: lead.company_name,
        pocId: String(state.pocId),
        contact: person.name || "Contact",
        ownerId: String(state.ownerId),
        owner:
          members.find((member) => String(member._id) === String(state.ownerId))
            ?.name || "Executive",
        reasons,
        critical: reasons.some(
          (reason) =>
            reason.includes("escalation") || reason === "Overdue follow-up",
        ),
        dueAt: state.dueAt,
        callOutcome: state.callOutcome,
        attempts: state.attempts || 0,
        daysUnreached:
          state.firstUnsuccessfulAt && !state.reachedAt
            ? Math.floor(
                (now - new Date(state.firstUnsuccessfulAt)) / rules.DAY,
              )
            : null,
        nextAction: state.nextAction,
        linkedin: state.linkedin,
        linkedinFollowup: state.linkedinFollowup,
      };
    });
  const alerts = queue.filter((row) => row.reasons.length);
  for (const lead of stalled) {
    const owner = members.find((member) =>
      [
        leadMap.get(String(lead._id)).assignedBy,
        ...leadMap.get(String(lead._id)).assignedTo,
      ].some((id) => String(id) === String(member._id)),
    );
    alerts.push({
      id: "lifecycle:" + lead._id,
      leadId: String(lead._id),
      company: lead.company_name,
      ownerId: String(owner?._id || ""),
      owner: owner?.name || "Team account",
      contact: "Account lifecycle",
      reasons: ["Lifecycle stalled"],
      critical: false,
      dueAt: lead.review?.data?.dueAt,
      since: lead.since,
      nextAction: lead.review?.data?.nextAction,
    });
  }
  alerts.sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      +new Date(a.dueAt || now) - +new Date(b.dueAt || now) ||
      a.company.localeCompare(b.company),
  );
  const periodCalls = callGroups.filter((row) => between(row._id.day)),
    periodBusiness = business.filter(
      (row) =>
        new Date(row.sentAt) >= periodStart && new Date(row.sentAt) < periodEnd,
    ),
    periodTotals = {
      calls: 0,
      connected: 0,
      whatsapp: 0,
      email: 0,
      linkedinSent: 0,
      linkedinAccepted: 0,
      proposals: 0,
      proposalTarget: 0,
      onboardings: 0,
      onboardingTarget: 0,
      pending: 0,
      overdue: 0,
    };
  for (const key of Object.keys(periodTotals))
    periodTotals[key] = rows.reduce((sum, row) => sum + (row[key] || 0), 0);
  periodTotals.companies = new Set(
    periodCalls.map((row) => String(row._id.lead)),
  ).size;
  const previousCalls = callGroups
    .filter(
      (row) =>
        new Date(row._id.day + "T00:00:00+05:30") >= previousStart &&
        row._id.day < selected.from,
    )
    .reduce((sum, row) => sum + row.count, 0);
  const worked = rows.reduce((sum, row) => sum + row.workedContacts, 0),
    missing = rows.reduce((sum, row) => sum + row.incomplete, 0),
    legacyCount = dailyCalls.filter(
      (call) =>
        !daily.some(
          (row) =>
            String(row._id.owner) === String(call._id.owner) &&
            String(row._id.lead) === String(call._id.lead) &&
            String(row._id.poc) === String(call._id.poc),
        ),
    ).length;
  const checklist = [
    [
      "Outcome",
      daily.filter(
        (row) =>
          rules.OUTCOMES.includes(row.data.callOutcome) ||
          row.data.callNotApplicable,
      ).length + legacyCount,
    ],
    [
      "WhatsApp",
      daily.filter(
        (row) => row.data.whatsapp && row.data.whatsapp !== "Pending",
      ).length,
    ],
    [
      "Email",
      daily.filter((row) => row.data.email && row.data.email !== "Pending")
        .length,
    ],
    [
      "LinkedIn",
      daily.filter(
        (row) => row.data.linkedin && row.data.linkedin !== "Unknown",
      ).length,
    ],
    [
      "Next follow-up",
      daily.filter(
        (row) =>
          (row.data.nextAction && row.data.dueAt) ||
          (row.data.resolvedAt && row.data.resolution),
      ).length,
    ],
  ].map(([label, complete]) => ({
    label,
    complete,
    total: worked,
    rate: ratio(complete, worked),
  }));
  const duePeriod = tasks.filter(
      (task) =>
        task.monitoringDisposition !== "Resolved" &&
        new Date(task.due_date) >= periodStart &&
        new Date(task.due_date) < periodEnd &&
        new Date(task.due_date) < now,
    ),
    onTime = duePeriod.filter(
      (task) =>
        task.completed &&
        task.completedAt &&
        new Date(task.completedAt) <= new Date(task.due_date),
    ).length,
    late = duePeriod.filter(
      (task) =>
        task.completed &&
        task.completedAt &&
        new Date(task.completedAt) > new Date(task.due_date),
    ).length,
    overdue = tasks.filter(
      (task) => !task.completed && new Date(task.due_date) < now,
    );
  const cohort = new Set(periodCalls.map((row) => String(row._id.lead))),
    connected = new Set(
      periodCalls
        .filter((row) => ["Connected", "Contacted"].includes(row._id.outcome))
        .map((row) => String(row._id.lead)),
    ),
    proposed = new Set(
      periodBusiness
        .filter(
          (row) => row.kind === "proposal" && connected.has(String(row.leadId)),
        )
        .map((row) => String(row.leadId)),
    ),
    onboarded = new Set(
      periodBusiness
        .filter(
          (row) =>
            row.kind === "onboarding" && proposed.has(String(row.leadId)),
        )
        .map((row) => String(row.leadId)),
    );
  const trend = Array.from({ length: selected.days }, (_, i) => {
    const day = rules.dayKey(new Date(+periodStart + i * rules.DAY));
    return {
      day,
      calls: periodCalls
        .filter((row) => row._id.day === day)
        .reduce((sum, row) => sum + row.count, 0),
      connected: periodCalls
        .filter(
          (row) =>
            row._id.day === day &&
            ["Connected", "Contacted"].includes(row._id.outcome),
        )
        .reduce((sum, row) => sum + row.count, 0),
      whatsapp: channels
        .filter((row) => row._id.day === day)
        .reduce((sum, row) => sum + row.whatsapp, 0),
      proposals: periodBusiness.filter(
        (row) => row.kind === "proposal" && rules.dayKey(row.sentAt) === day,
      ).length,
    };
  });
  const lifecycle = Object.entries(
    leads.reduce((counts, lead) => {
      counts[lead.stage] = (counts[lead.stage] || 0) + 1;
      return counts;
    }, {}),
  ).map(([stage, count]) => ({ stage, count }));
  const recovery = rules.RECOVERY.map((key) => ({
    key,
    count: activeStates.filter(
      (state) =>
        rules.recoveryPending(state) && state.recovery?.[key] === "Completed",
    ).length,
  }));
  const scores = rows.filter((row) => row.score !== null);
  let remainingWorkingDays = 0;
  for (let day = Number(today.slice(-2)); day <= 31; day++) {
    const key = today.slice(0, 7) + "-" + String(day).padStart(2, "0");
    if (rules.validDay(key) && rules.workingDay(key, config))
      remainingWorkingDays++;
  }
  return {
    today,
    generatedAt: now,
    range: selected,
    config,
    employees: employees.map((person) => ({
      _id: String(person._id),
      name: person.name,
    })),
    territories,
    companies: leads.map((lead) => ({
      _id: String(lead._id),
      name: lead.company_name,
      ownerIds: [lead.assignedBy, lead.createdBy, ...lead.assignedTo]
        .filter(Boolean)
        .map(String),
    })),
    roster: rows,
    periodTotals,
    previousCalls,
    alerts,
    queue,
    followups: tasks
      .filter((task) => !task.completed)
      .map((task) => ({
        id: String(task._id),
        leadId: String(task.lead_id),
        company: leadMap.get(String(task.lead_id))?.company_name,
        title: task.title,
        ownerId: String(task.user_id),
        owner: members.find(
          (member) => String(member._id) === String(task.user_id),
        )?.name,
        dueAt: task.due_date,
      })),
    stalledCount: stalled.length,
    compliance: {
      rate: ratio(worked - missing, worked),
      submitted: rows.filter((row) => row.submitted).length,
      total: rows.length,
      incomplete: rows.filter(
        (row) => row.incomplete || row.reportStatus === "Pending submission",
      ).length,
      checklist,
    },
    health: {
      onTime,
      late,
      rate: ratio(onTime, duePeriod.length),
      overdue: overdue.length,
      dueToday: tasks.filter(
        (task) => !task.completed && rules.dayKey(task.due_date) === today,
      ).length,
      aging: [1, 3, 5, Infinity].map((max, index) => ({
        label: ["≤1 day", "2–3 days", "4–5 days", ">5 days"][index],
        count: overdue.filter((task) => {
          const days = (now - new Date(task.due_date)) / rules.DAY;
          return days <= max && days > (index ? [1, 3, 5][index - 1] : -1);
        }).length,
      })),
    },
    callbacks: {
      busy: activeStates.filter((state) => state.callOutcome === "Busy").length,
      noAnswer: activeStates.filter(
        (state) => state.callOutcome === "No Answer",
      ).length,
      requested: activeStates.filter(
        (state) => state.callOutcome === "Callback Requested",
      ).length,
      unscheduled: activeStates
        .filter(
          (state) =>
            !state.resolvedAt &&
            ["Busy", "No Answer", "Callback Requested"].includes(
              state.callOutcome,
            ) &&
            !state.dueAt,
        )
        .map((state) => String(state._id)),
    },
    recovery,
    linkedin: {
      sent: activeStates.filter((state) => state.linkedin === "Sent").length,
      pending: activeStates.filter((state) => state.linkedin === "Pending")
        .length,
      accepted: activeStates.filter((state) => state.linkedin === "Accepted")
        .length,
      rejected: activeStates.filter((state) => state.linkedin === "Rejected")
        .length,
      awaitingFollowup: activeStates.filter(
        (state) =>
          state.linkedin === "Accepted" && state.linkedinFollowup !== "Sent",
      ).length,
    },
    lifecycle,
    trend,
    funnel: [
      { label: "Companies worked", count: cohort.size },
      { label: "Connected companies", count: connected.size },
      { label: "Proposals in connected cohort", count: proposed.size },
      { label: "Verified onboardings in cohort", count: onboarded.size },
    ],
    accountability: {
      score: scores.length
        ? Math.round(
            scores.reduce((sum, row) => sum + row.score, 0) / scores.length,
          )
        : null,
      provisional: now < rules.cutoffAt(today, config),
    },
    remainingWorkingDays,
    plannedNextWeek: leads.filter(
      (lead) =>
        lead.bdPlanning?.expectedOnboardingAt &&
        new Date(lead.bdPlanning.expectedOnboardingAt) >= now &&
        new Date(lead.bdPlanning.expectedOnboardingAt) <=
          new Date(+now + 7 * rules.DAY),
    ).length,
    audit,
  };
}
module.exports = { dashboard, range, requireManager };
