const express = require("express"),
  mongoose = require("mongoose");
const service = require("../services/bdMonitoringService"),
  reporting = require("../services/managerWorkspaceService"),
  rules = require("../services/bdMonitoringRules");
const models = require("../models/BDMonitoring"),
  User = require("../models/User"),
  Lead = require("../models/Lead"),
  Task = require("../models/Task");
const router = express.Router();
const handle = (fn) => async (req, res) => {
  try {
    const access = await service.scope(req.user);
    reporting.requireManager(access);
    res.json(await fn(req, access));
  } catch (error) {
    const status =
      error.status ||
      (["ValidationError", "CastError"].includes(error.name)
        ? 400
        : error.code === 11000
          ? 409
          : 500);
    if (status === 500) console.error("Manager workspace:", error);
    res.status(status).json({
      message:
        status === 500
          ? "Could not update the manager workspace."
          : error.message,
    });
  }
};
router.get(
  "/manager/dashboard",
  handle((req, access) => reporting.dashboard(access, req.query)),
);
router.post(
  "/manager/action",
  handle(async (req, access) => {
    const body = req.body,
      requestId = service.requestId(body),
      kind = body.kind,
      reason = service.text(body.reason);
    if (
      ![
        "task",
        "research",
        "reassign",
        "remind",
        "compliance",
        "corep",
        "lifecycle",
      ].includes(kind) ||
      !reason
    )
      service.fail("Choose an action and provide a reason.");
    return mongoose.connection.transaction(async (session) => {
      const prior = await models.Event.findOne({
        actorId: access.id,
        requestId,
      }).session(session);
      if (prior) {
        if (prior.kind !== `manager-${kind}`)
          service.fail("Request identifier already used.", 409);
        return prior.data.result;
      }
      const employees = await User.find({
        ...service.ownerQuery(access, "_id"),
        role: "BD Executive",
        status: "Active",
      })
        .session(session)
        .lean();
      const active = (id) =>
        employees.some((person) => String(person._id) === String(id));
      let leads = [],
        states = [],
        recipients = [];
      if (["reassign", "remind", "research"].includes(kind)) {
        if (
          !Array.isArray(body.stateIds) ||
          body.stateIds.some((id) => !mongoose.isValidObjectId(id))
        )
          service.fail("Choose valid contacts.");
        const stateIds = [...new Set(body.stateIds)];
        if (!stateIds.length || stateIds.length > 100)
          service.fail("Choose between 1 and 100 contacts.");
        states = await models.ContactState.find({
          _id: { $in: stateIds },
          ...service.ownerQuery(access),
        }).session(session);
        if (
          states.length !== stateIds.length ||
          states.some((state) => !active(state.ownerId))
        )
          service.fail("Contact is outside your active team.", 404);
        for (const state of states) {
          const lead = await service.accessibleLead(
            access,
            state.leadId,
            session,
          );
          if (
            !lead.points_of_contact.some(
              (person) =>
                String(person._id) === String(state.pocId) &&
                !["pending", "rejected"].includes(person.approvalStatus),
            )
          )
            service.fail("Contact is no longer approved.", 409);
          leads.push(lead);
        }
      } else if (kind !== "compliance")
        leads = [await service.accessibleLead(access, body.leadId, session)];
      if (body.ownerId && !active(body.ownerId))
        service.fail("Choose an active executive from your team.", 403);
      if (
        ["task", "corep", "reassign", "lifecycle"].includes(kind) &&
        !body.ownerId
      )
        service.fail("Choose an executive.");
      const future = () => {
        const due = service.date(body.dueAt, "Due date");
        if (due <= new Date()) service.fail("Choose a future due date.");
        return due;
      };
      const createTask = async (lead, ownerId, pocId, title) => {
        if (
          ![lead.assignedBy, lead.createdBy, ...lead.assignedTo].some(
            (id) => String(id) === String(ownerId),
          )
        )
          service.fail(
            "Assign this executive to the company before assigning a task.",
            403,
          );
        await Task.create(
          [
            {
              user_id: ownerId,
              createdBy: access.id,
              lead_id: lead._id,
              poc_id: pocId,
              title:
                title || service.text(body.title) || "Review contact recovery",
              description: reason,
              type: "Follow-up",
              due_date: future(),
            },
          ],
          { session },
        );
      };
      if (kind === "task" || kind === "lifecycle") {
        if (!service.text(body.title)) service.fail("Enter a task title.");
        await createTask(
          leads[0],
          body.ownerId,
          null,
          service.text(body.title),
        );
      }
      if (kind === "corep")
        await Lead.updateOne(
          { _id: leads[0]._id },
          { $addToSet: { assignedTo: body.ownerId } },
          { session },
        );
      if (kind === "reassign")
        for (let index = 0; index < states.length; index++) {
          const state = states[index];
          await Lead.updateOne(
            { _id: state.leadId },
            { $addToSet: { assignedTo: body.ownerId } },
            { session },
          );
          await Task.updateMany(
            {
              lead_id: state.leadId,
              poc_id: state.pocId,
              user_id: state.ownerId,
              completed: false,
              monitoringKey: { $exists: true },
            },
            { $set: { user_id: body.ownerId } },
            { session },
          );
          state.ownerId = body.ownerId;
          state.strategy = reason;
          state.revision = (state.revision || 0) + 1;
          await state.save({ session });
        }
      if (kind === "research")
        for (let index = 0; index < states.length; index++)
          await createTask(
            leads[index],
            body.ownerId || states[index].ownerId,
            states[index].pocId,
          );
      if (kind === "remind")
        recipients = states.map((state) => ({
          id: state.ownerId,
          leadId: state.leadId,
          pocId: state.pocId,
          key: `manager:${access.id}:${state._id}:${rules.dayKey()}`,
        }));
      if (kind === "compliance") {
        const fresh = await reporting.dashboard(access, {});
        const ids =
          body.employeeIds ||
          fresh.roster
            .filter(
              (row) =>
                row.incomplete || row.reportStatus === "Pending submission",
            )
            .map((row) => row._id);
        if (!Array.isArray(ids) || ids.some((id) => !active(id)))
          service.fail("Choose active team members.", 403);
        recipients = ids.map((id) => ({
          id,
          key: `compliance:${access.id}:${id}:${rules.dayKey()}`,
        }));
      }
      for (const item of recipients)
        await models.Notification.updateOne(
          { recipientId: item.id, key: item.key },
          {
            $set: {
              title: reason,
              severity: "warning",
              leadId: item.leadId,
              pocId: item.pocId,
            },
            $unset: { readAt: "" },
          },
          { upsert: true, session },
        );
      const result = {
        message:
          kind === "remind" || kind === "compliance"
            ? `In-app reminder saved for ${recipients.length} recipient(s).`
            : "Manager action saved.",
      };
      await models.Event.create(
        [
          {
            actorId: access.id,
            ownerId: body.ownerId || access.id,
            leadId: leads[0]?._id,
            requestId,
            day: rules.dayKey(),
            kind: `manager-${kind}`,
            data: {
              reason,
              leadIds: leads.map((lead) => lead._id),
              stateIds: states.map((state) => state._id),
              result,
            },
          },
        ],
        { session },
      );
      if (kind === "lifecycle")
        await models.Event.create(
          [
            {
              actorId: access.id,
              ownerId: body.ownerId,
              leadId: leads[0]._id,
              requestId: requestId + "-review",
              day: rules.dayKey(),
              kind: "lifecycle",
              data: {
                reason,
                nextAction: service.text(body.title),
                dueAt: future(),
              },
            },
          ],
          { session },
        );
      return result;
    });
  }),
);
module.exports = router;
