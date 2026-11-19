const mongoose = require("mongoose"),
  Call = require("../models/CallActivity"),
  Email = require("../models/EmailSendLog"),
  models = require("../models/BDMonitoring"),
  service = require("./bdMonitoringService"),
  rules = require("./bdMonitoringRules"),
  { range } = require("./managerWorkspaceService");
async function activityReport(access, query) {
  if (access.role !== "BD Executive")
    service.fail("BD executive access required.", 403);
  const selected = range(query),
    start = rules.dayStart(selected.from),
    end = new Date(+rules.dayStart(selected.to) + rules.DAY),
    owner = new mongoose.Types.ObjectId(access.id),
    config = await service.settings(),
    dates = { $gte: start, $lt: end };
  const [calls, channels, emails, business, targets] = await Promise.all([
    Call.aggregate([
      { $match: { userId: owner, timestamp: dates } },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          connected: {
            $sum: {
              $cond: [{ $in: ["$stage", ["Connected", "Contacted"]] }, 1, 0],
            },
          },
          companies: { $addToSet: "$leadId" },
        },
      },
    ]),
    models.Event.aggregate([
      { $match: { ownerId: owner, kind: "activity", createdAt: dates } },
      {
        $group: {
          _id: null,
          whatsapp: { $sum: { $cond: ["$data.whatsappConfirmed", 1, 0] } },
          email: { $sum: { $cond: ["$data.emailConfirmed", 1, 0] } },
          linkedinSent: {
            $sum: { $cond: ["$data.linkedinRequestRecorded", 1, 0] },
          },
          linkedinAccepted: {
            $sum: { $cond: ["$data.linkedinAcceptanceRecorded", 1, 0] },
          },
          companies: { $addToSet: "$leadId" },
        },
      },
    ]),
    Email.aggregate([
      { $match: { userId: owner, status: "success", sentAt: dates } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          companies: { $addToSet: "$leadId" },
        },
      },
    ]),
    models.BusinessEvent.aggregate([
      { $match: { ownerId: owner, sentAt: dates } },
      {
        $group: {
          _id: null,
          proposals: {
            $sum: { $cond: [{ $eq: ["$kind", "proposal"] }, 1, 0] },
          },
          onboardings: {
            $sum: { $cond: [{ $eq: ["$kind", "onboarding"] }, 1, 0] },
          },
          companies: { $addToSet: "$leadId" },
        },
      },
    ]),
    models.Target.find({ userId: owner, effectiveDate: { $lte: selected.to } })
      .sort({ effectiveDate: -1 })
      .lean(),
  ]);
  let proposalTarget = 0;
  for (let index = 0; index < selected.days; index++) {
    const day = rules.dayKey(new Date(+start + index * rules.DAY));
    if (rules.workingDay(day, config))
      proposalTarget +=
        targets.find((target) => target.effectiveDate <= day)?.proposalTarget ??
        config.proposalTarget;
  }
  const c = calls[0] || {},
    touch = channels[0] || {},
    mail = emails[0] || {},
    milestones = business[0] || {};
  const companies = new Set(
    [
      ...(c.companies || []),
      ...(touch.companies || []),
      ...(mail.companies || []),
      ...(milestones.companies || []),
    ]
      .filter(Boolean)
      .map(String),
  );
  return {
    range: selected,
    totals: {
      companies: companies.size,
      calls: c.calls || 0,
      connected: c.connected || 0,
      whatsapp: touch.whatsapp || 0,
      email: (touch.email || 0) + (mail.count || 0),
      linkedinSent: touch.linkedinSent || 0,
      linkedinAccepted: touch.linkedinAccepted || 0,
      proposals: milestones.proposals || 0,
      onboardings: milestones.onboardings || 0,
      proposalTarget,
    },
  };
}
module.exports = { activityReport };
