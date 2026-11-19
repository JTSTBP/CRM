const User = require("../models/User"),
  { BusinessEvent } = require("../models/BDMonitoring");
const id = (value) => (value ? String(value._id || value) : "");
function owners(lead) {
  return [
    ...new Set(
      [
        lead.assignedBy,
        ...(Array.isArray(lead.assignedTo)
          ? lead.assignedTo
          : lead.assignedTo
            ? [lead.assignedTo]
            : []),
        lead.createdBy,
      ]
        .map(id)
        .filter(Boolean),
    ),
  ];
}
async function recordProposalStages(companies, access, session) {
  const pending = [
    ...new Map(companies.map((lead) => [id(lead), lead])).values(),
  ];
  if (!pending.length) return;
  const existing = await BusinessEvent.find({
    leadId: { $in: pending.map((lead) => lead._id) },
    kind: "proposal",
  })
    .select("leadId")
    .session(session)
    .lean();
  const recorded = new Set(existing.map((event) => id(event.leadId))),
    fresh = pending.filter((lead) => !recorded.has(id(lead)));
  if (!fresh.length) return;
  const candidates = [...new Set(fresh.flatMap(owners))];
  const active = await User.find({
    _id: { $in: candidates },
    role: "BD Executive",
    status: "Active",
  })
    .select("_id")
    .session(session)
    .lean();
  const eligible = new Set(active.map((person) => id(person)));
  const operations = fresh.map((lead) => {
    const assigned = owners(lead).filter(
      (owner) =>
        eligible.has(owner) &&
        (access.role === "Admin" ||
          access.ids.some((value) => id(value) === owner)),
    );
    const ownerId =
      access.role === "BD Executive" && assigned.includes(access.id)
        ? access.id
        : assigned[0];
    if (!ownerId || ["incomplete", "rejected"].includes(lead.status))
      throw Object.assign(
        new Error(
          "Approve the company and assign an active BD executive before setting Proposal Sent.",
        ),
        { status: 400 },
      );
    return {
      updateOne: {
        filter: {
          leadId: lead._id,
          kind: "proposal",
          reference: "AUTO-STAGE-PROPOSAL",
        },
        update: {
          $setOnInsert: {
            leadId: lead._id,
            ownerId,
            actorId: access.id,
            kind: "proposal",
            reference: "AUTO-STAGE-PROPOSAL",
            evidence: `Company status changed to Proposal Sent by ${access.name}.`,
            sentAt: new Date(),
            status: "Awaiting feedback",
          },
        },
        upsert: true,
      },
    };
  });
  await BusinessEvent.bulkWrite(operations, { session });
}
module.exports = { recordProposalStages };
