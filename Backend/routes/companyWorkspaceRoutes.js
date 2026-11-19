const express = require("express");
const mongoose = require("mongoose");
const service = require("../services/bdMonitoringService");
const rules = require("../services/bdMonitoringRules");
const reporting = require("../services/companyWorkspaceService");
const models = require("../models/BDMonitoring");
const Mandate = require("../models/Mandate");
const Proposal = require("../models/CompanyProposal");
const User = require("../models/User");
const Activity = require("../models/LeadActivity");
const router = express.Router();
const handle = (callback) => async (req, res) => {
  try {
    const access = await service.scope(req.user);
    res.json(await callback(req, access));
  } catch (error) {
    const status =
      error.status ||
      (error.code === 11000
        ? 409
        : ["ValidationError", "CastError"].includes(error.name)
          ? 400
          : 500);
    if (status === 500) console.error("Company workspace:", error);
    res.status(status).json({
      message:
        status === 500
          ? "Could not update the company workspace."
          : error.code === 11000
            ? "This reference or request was already saved. Refresh to view the existing record."
            : error.message,
    });
  }
};
async function write(access, leadId, body, kind, change) {
  const requestId = service.requestId(body);
  return mongoose.connection.transaction(async (session) => {
    const lead = await service.accessibleLead(access, leadId, session);
    const previous = await models.Event.findOne({
      actorId: access.id,
      requestId,
    }).session(session);
    if (previous) {
      if (
        String(previous.leadId) !== String(lead._id) ||
        previous.kind !== kind
      )
        service.fail("Request identifier was already used.", 409);
      return previous.data.result;
    }
    const result = await change(lead, session);
    await models.Event.create(
      [
        {
          actorId: access.id,
          ownerId: access.id,
          leadId: lead._id,
          requestId,
          day: rules.dayKey(),
          kind,
          data: {
            remarks:
              service.text(
                body.reason || body.note || body.content || body.title,
              ) || kind.replace(/-/g, " "),
            result,
          },
        },
      ],
      { session },
    );
    return result;
  });
}
const boundedText = (value, label, max = 300) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > max)
    service.fail(`Enter a valid ${label} (up to ${max} characters).`);
  return value.trim();
};
router.get(
  "/company/:leadId",
  handle((req, access) => reporting.workspace(access, req.params.leadId)),
);
router.get(
  "/company/:leadId/timeline",
  handle((req, access) =>
    reporting.timeline(access, req.params.leadId, req.query),
  ),
);
router.post(
  "/company/:leadId/profile",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "company-profile",
      async (lead, session) => {
        if (!["Low", "Normal", "High"].includes(req.body.priority))
          service.fail("Choose Low, Normal or High priority.");
        lead.companyProfile = {
          headquarters: boundedText(req.body.headquarters, "headquarters"),
          businessModel: boundedText(req.body.businessModel, "business model"),
          footprint: boundedText(req.body.footprint, "store footprint", 500),
          territory: boundedText(req.body.territory, "territory"),
          tier: boundedText(req.body.tier, "account tier", 100),
          priority: req.body.priority,
        };
        await lead.save({ session });
        return { message: "Company intelligence saved." };
      },
    ),
  ),
);
router.post(
  "/company/:leadId/stage",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "company-stage",
      async (lead, session) => {
        const stages = [
          "New",
          "Contacted",
          "Proposal Sent",
          "Negotiation",
          "Won",
          "Lost",
          "Onboarded",
          "No vendor",
          "Future Reference",
        ];
        if (
          !stages.includes(req.body.stage) ||
          req.body.confirmed !== true ||
          !service.text(req.body.reason)
        )
          service.fail(
            "Choose a stage, explain the change and confirm the milestone occurred.",
          );
        if (
          req.body.stage === "Onboarded" &&
          !(await models.BusinessEvent.exists({
            leadId: lead._id,
            kind: "onboarding",
          }).session(session))
        )
          service.fail(
            "Record a verified client activation before moving to Onboarded.",
          );
        const from = lead.stage;
        if (from !== req.body.stage) {
          lead.stage = req.body.stage;
          if (lead.stage === 'Proposal Sent') await require('../services/proposalStageService').recordProposalStages([lead],access,session);
          await lead.save({ session });
          await Activity.create(
            [
              {
                leadId: lead._id,
                type: "Stage Changed",
                performedBy: access.id,
                performedByName: access.name,
                description: service.text(req.body.reason),
                metadata: { from, to: lead.stage },
                timestamp: new Date(),
              },
            ],
            { session },
          );
        }
        return { message: "Company stage updated." };
      },
    ),
  ),
);
router.patch(
  "/company/:leadId/contact/:pocId",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "company-contact-flags",
      async (lead, session) => {
        const contact = lead.points_of_contact.id(req.params.pocId);
        if (
          !contact ||
          ["pending", "rejected"].includes(contact.approvalStatus)
        )
          service.fail("Choose an approved contact.", 404);
        if (
          typeof req.body.decisionMaker !== "boolean" ||
          typeof req.body.primaryContact !== "boolean"
        )
          service.fail("Choose the contact role flags.");
        if(req.body.stakeholderTier !== undefined){
          if(!['Unmapped','Executive Sponsor','Primary Buyer','Hiring & Operations'].includes(req.body.stakeholderTier))service.fail('Choose a valid stakeholder tier.');
          contact.stakeholderTier=req.body.stakeholderTier;
        }
        if(req.body.stakeholderRole !== undefined)contact.stakeholderRole=boundedText(req.body.stakeholderRole,'stakeholder role',150);
        if(req.body.stakeholderNote !== undefined)contact.stakeholderNote=boundedText(req.body.stakeholderNote,'relationship note',2000);
        if (req.body.primaryContact)
          lead.points_of_contact.forEach((person) => {
            person.primaryContact = false;
          });
        contact.primaryContact = req.body.primaryContact;
        contact.decisionMaker = req.body.decisionMaker;
        await lead.save({ session });
        return { message: "Contact role updated." };
      },
    ),
  ),
);
router.post(
  "/company/:leadId/note",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "company-note",
      async (lead, session) => {
        const content = boundedText(req.body.content, "note", 2000);
        if (!content) service.fail("Enter a note or document description.");
        let url = boundedText(req.body.url, "document URL", 2000);
        if (url) {
          try {
            const parsed = new URL(url);
            if (!["http:", "https:"].includes(parsed.protocol))
              throw new Error();
            url = parsed.href;
          } catch {
            service.fail("Use a complete HTTPS or HTTP document link.");
          }
        }
        lead.remarks.push({
          content,
          type: url ? "file" : "text",
          fileUrl: url || undefined,
          profile: { id: access.id, name: access.name },
        });
        await lead.save({ session });
        return {
          message: url ? "Document link saved." : "Company note saved.",
        };
      },
    ),
  ),
);

async function mandateFields(access, lead, body, session) {
  if (["incomplete", "rejected"].includes(lead.status))
    service.fail("Approve the company before creating hiring mandates.");
  const title = boundedText(body.title, "mandate title", 200);
  if (!title) service.fail("Enter a mandate title.");
  if (
    !["Open", "Sourcing", "Paused", "Filled", "Cancelled"].includes(
      body.status,
    ) ||
    !["Low", "Normal", "High"].includes(body.priority)
  )
    service.fail("Choose a valid mandate status and priority.");
  const number = (key, min, max, optional = false) => {
    const value = body[key];
    if (optional && (value === "" || value === null || value === undefined))
      return undefined;
    if (
      !["number", "string"].includes(typeof value) ||
      String(value).trim() === "" ||
      !Number.isInteger(Number(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      service.fail(`Enter a valid whole ${key} count (${min}–${max}).`);
    return Number(value);
  };
  const positions = number("positions", 1, 100000),
    filled = number("filled", 0, 100000);
  if (filled > positions || (body.status === "Filled" && filled !== positions))
    service.fail(
      "Filled positions must not exceed the mandate, and a Filled mandate must be fully staffed.",
    );
  if (!mongoose.isValidObjectId(body.ownerId))
    service.fail("Select an active company executive.");
  const eligible = [lead.assignedBy, lead.createdBy, ...lead.assignedTo]
    .filter(Boolean)
    .some((id) => String(id) === body.ownerId);
  const owner =
    eligible &&
    (await User.findOne({
      _id: body.ownerId,
      status: "Active",
      role: "BD Executive",
      ...service.ownerQuery(access, "_id"),
    }).session(session));
  if (!owner)
    service.fail("Select an active executive assigned to this company.");
  return {
    title,
    status: body.status,
    priority: body.priority,
    ownerId: owner._id,
    positions,
    filled,
    submissions: number("submissions", 0, 1000000),
    interviews: number("interviews", 0, 1000000),
    sourcingSlaDays: number("sourcingSlaDays", 1, 365, true),
    location: boundedText(body.location, "mandate location"),
    note: boundedText(body.note, "mandate notes", 2000),
    dueAt: body.dueAt
      ? service.date(body.dueAt, "mandate target date")
      : undefined,
  };
}
router.post(
  "/company/:leadId/mandates",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "mandate-created",
      async (lead, session) => {
        const fields = await mandateFields(access, lead, req.body, session);
        const [mandate] = await Mandate.create(
          [{ ...fields, leadId: lead._id, createdBy: access.id }],
          { session },
        );
        return {
          message: "Hiring mandate created.",
          mandate: mandate.toObject(),
        };
      },
    ),
  ),
);
router.patch(
  "/mandates/:id",
  handle(async (req, access) => {
    if (!mongoose.isValidObjectId(req.params.id))
      service.fail("Mandate not found.", 404);
    const record = await Mandate.findById(req.params.id).lean();
    if (!record) service.fail("Mandate not found.", 404);
    return write(
      access,
      record.leadId,
      req.body,
      "mandate-updated",
      async (lead, session) => {
        const mandate = await Mandate.findById(record._id).session(session);
        if (
          !Number.isInteger(req.body.revision) ||
          mandate.revision !== req.body.revision
        )
          service.fail("This mandate changed. Refresh before saving.", 409);
        Object.assign(
          mandate,
          await mandateFields(access, lead, req.body, session),
        );
        mandate.revision += 1;
        await mandate.save({ session });
        return {
          message: "Mandate progress saved.",
          mandate: mandate.toObject(),
        };
      },
    );
  }),
);
async function proposalFields(access, lead, body, session) {
  if (["incomplete", "rejected"].includes(lead.status))
    service.fail("Approve the company before creating proposal scopes.");
  const title = boundedText(body.title, "proposal title", 200),
    reference = boundedText(
      body.reference,
      "proposal reference",
      150,
    ).toUpperCase(),
    scope = boundedText(body.scope, "proposal scope", 2000);
  if (!title || !reference || !scope)
    service.fail("Enter a title, unique reference and proposal scope.");
  const eligible = [lead.assignedBy, lead.createdBy, ...lead.assignedTo]
    .filter(Boolean)
    .map(String);
  if (
    !mongoose.isValidObjectId(body.ownerId) ||
    !eligible.includes(body.ownerId) ||
    !(await User.exists({
      _id: body.ownerId,
      role: "BD Executive",
      status: "Active",
      ...service.ownerQuery(access, "_id"),
    }).session(session))
  )
    service.fail("Select an active company executive.");
  if (
    !Array.isArray(body.recipientPocIds) ||
    !body.recipientPocIds.length ||
    body.recipientPocIds.length > 50 ||
    body.recipientPocIds.some(
      (id) =>
        !lead.points_of_contact.some(
          (person) =>
            String(person._id) === id &&
            !["pending", "rejected"].includes(person.approvalStatus),
        ),
    )
  )
    service.fail("Select approved recipients from this company.");
  if (!mongoose.isValidObjectId(body.reviewerId))
    service.fail("Choose an active internal reviewer.");
  const current = await User.findById(access.id)
    .select("reporter")
    .session(session);
  const reviewer = await User.findOne({
    _id: body.reviewerId,
    status: "Active",
    role: { $in: ["Admin", "Manager"] },
  }).session(session);
  if (
    !reviewer ||
    (access.role === "BD Executive" &&
      String(current.reporter) !== body.reviewerId) ||
    (access.role === "Manager" && access.id !== body.reviewerId)
  )
    service.fail("Select your active manager as reviewer.");
  if (
    !["string", "number"].includes(typeof body.positions) ||
    String(body.positions).trim() === "" ||
    !Number.isInteger(Number(body.positions)) ||
    Number(body.positions) < 0 ||
    Number(body.positions) > 100000
  )
    service.fail("Enter a valid proposal position count.");
  return {
    title,
    reference,
    scope,
    ownerId: body.ownerId,
    reviewerId: reviewer._id,
    recipientPocIds: [...new Set(body.recipientPocIds)],
    positions: Number(body.positions),
    followupAt: body.followupAt
      ? service.date(body.followupAt, "proposal follow-up date")
      : undefined,
  };
}
router.post(
  "/company/:leadId/proposals",
  handle((req, access) =>
    write(
      access,
      req.params.leadId,
      req.body,
      "proposal-draft-created",
      async (lead, session) => {
        const fields = await proposalFields(access, lead, req.body, session);
        const [proposal] = await Proposal.create(
          [{ ...fields, leadId: lead._id, createdBy: access.id }],
          { session },
        );
        return {
          message:
            "Draft proposal saved. It does not count as a sent proposal.",
          proposal: proposal.toObject(),
        };
      },
    ),
  ),
);
router.patch(
  "/proposals/:id",
  handle(async (req, access) => {
    if (!mongoose.isValidObjectId(req.params.id))
      service.fail("Proposal not found.", 404);
    const record = await Proposal.findOne({
      _id: req.params.id,
      ...service.ownerQuery(access),
    }).lean();
    if (!record) service.fail("Proposal not found.", 404);
    return write(
      access,
      record.leadId,
      req.body,
      "proposal-" + String(req.body.action),
      async (lead, session) => {
        const proposal = await Proposal.findById(record._id).session(session);
        if (
          !Number.isInteger(req.body.revision) ||
          req.body.revision !== proposal.revision
        )
          service.fail("This proposal changed. Refresh before saving.", 409);
        const action = req.body.action;
        if (action === "update") {
          if (!["Draft", "Rejected"].includes(proposal.status))
            service.fail("Only drafts or rejected scopes can be edited.");
          Object.assign(
            proposal,
            await proposalFields(access, lead, req.body, session),
          );
          proposal.status = "Draft";
          proposal.reviewReason = "";
          proposal.reviewedAt = undefined;
          proposal.reviewedBy = undefined;
        } else if (action === "submit") {
          if (proposal.status !== "Draft")
            service.fail("Only a draft can be submitted for review.");
          const reviewer = await User.findOne({
            _id: proposal.reviewerId,
            status: "Active",
            role: { $in: ["Admin", "Manager"] },
          }).session(session);
          if (!reviewer)
            service.fail("Update the draft with an active reviewer.");
          proposal.status = "In Review";
          await models.Notification.updateOne(
            {
              recipientId: proposal.reviewerId,
              key: `proposal-review:${proposal._id}:${proposal.revision}`,
            },
            {
              $setOnInsert: {
                title: `Proposal review requested: ${proposal.title}`,
                severity: "info",
                leadId: lead._id,
              },
            },
            { upsert: true, session },
          );
        } else if (["approve", "reject"].includes(action)) {
          if (
            access.role !== "Admin" &&
            (access.role !== "Manager" ||
              String(proposal.reviewerId) !== access.id)
          )
            service.fail(
              "Only the assigned manager or an admin can review this scope.",
              403,
            );
          if (proposal.status !== "In Review" || !service.text(req.body.reason))
            service.fail(
              "A proposal in review and a review reason are required.",
            );
          proposal.status = action === "approve" ? "Approved" : "Rejected";
          proposal.reviewReason = service.text(req.body.reason);
          proposal.reviewedBy = access.id;
          proposal.reviewedAt = new Date();
          await models.Notification.updateOne(
            {
              recipientId: proposal.ownerId,
              key: `proposal-response:${proposal._id}:${proposal.revision}`,
            },
            {
              $setOnInsert: {
                title: `Proposal ${proposal.status.toLowerCase()}: ${proposal.title}`,
                severity: action === "reject" ? "warning" : "info",
                leadId: lead._id,
              },
            },
            { upsert: true, session },
          );
        } else if (action === "sent") {
          if (proposal.status !== "Approved")
            service.fail(
              "Internal approval is required before recording dispatch.",
            );
          const sent = await models.BusinessEvent.findOne({
            leadId: lead._id,
            ownerId: proposal.ownerId,
            kind: "proposal",
            reference: proposal.reference,
          }).session(session);
          if (!sent)
            service.fail(
              "Record the confirmed proposal send with the same reference first.",
            );
          proposal.status = "Sent";
          proposal.sentBusinessId = sent._id;
        } else service.fail("Choose a valid proposal action.");
        proposal.revision += 1;
        await proposal.save({ session });
        return {
          message: "Proposal workflow updated.",
          proposal: proposal.toObject(),
        };
      },
    );
  }),
);
module.exports = router;
