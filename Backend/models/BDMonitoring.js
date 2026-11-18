const mongoose = require("mongoose");
const { Schema } = mongoose;
const ref = (model, required = false) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const channel = ["Sent", "Pending", "Failed", "Not Applicable"];
const connection = [
  "Not Sent",
  "Sent",
  "Pending",
  "Accepted",
  "Rejected",
  "Unknown",
];

const stateSchema = new Schema(
  {
    leadId: ref("Lead", true),
    pocId: { type: Schema.Types.ObjectId, required: true },
    ownerId: ref("users", true),
    updatedBy: ref("users"),
    lastWorkedDate: String,
  needsDailyUpdate: { type: Boolean, default: false },
    lastActivityAt: Date,
    callOutcome: String,
    callNotApplicable: Boolean,
    attempts: { type: Number, default: 0 },
    lastCallAt: Date,
    firstUnsuccessfulAt: Date,
    reachedAt: Date,
    whatsapp: { type: String, enum: channel, default: "Pending" },
    email: { type: String, enum: channel, default: "Pending" },
    emailSubject: String,
    whatsappAt: Date,
    emailAt: Date,
    linkedinFollowupAt: Date,
    linkedin: { type: String, enum: connection, default: "Unknown" },
    linkedinUrl: String,
    linkedinSentAt: Date,
    linkedinAcceptedAt: Date,
    linkedinCheckedAt: Date,
    linkedinReviewAt: Date,
    linkedinFollowup: { type: String, enum: channel, default: "Pending" },
    channelReason: String,
    alternativePhone: String,
    alternativeContact: String,
    recovery: { type: Map, of: String, default: {} },
    recoveryReason: String,
    wrongNumberAt: Date,
    nextAction: String,
    dueAt: Date,
    remarks: String,
    strategy: String,
    resolution: String,
    resolvedAt: Date,
    revision: { type: Number, default: 0 },
  },
  { timestamps: true },
);
stateSchema.index({ leadId: 1, pocId: 1 }, { unique: true });
stateSchema.index({ ownerId: 1, dueAt: 1 });
stateSchema.index({ firstUnsuccessfulAt: 1, resolvedAt: 1 });
stateSchema.index({ linkedinReviewAt: 1 });

const eventSchema = new Schema(
  {
    requestId: { type: String, required: true },
    actorId: ref("users", true),
    ownerId: ref("users", true),
    leadId: ref("Lead"),
    pocId: Schema.Types.ObjectId,
    kind: { type: String, required: true },
    day: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
eventSchema.index({ actorId: 1, requestId: 1 }, { unique: true });
eventSchema.index({ ownerId: 1, day: 1, kind: 1 });
eventSchema.index({ leadId: 1, pocId: 1, createdAt: -1 });
eventSchema.index({ day: 1, kind: 1, ownerId: 1 });

const submissionSchema = new Schema(
  {
    userId: ref("users", true),
    day: { type: String, required: true },
    submittedAt: { type: Date, required: true },
    late: Boolean,
    reason: String,
    activityCount: Number,
    snapshotAt: Date,
  },
  { timestamps: true },
);
submissionSchema.index({ userId: 1, day: 1 }, { unique: true });

const businessSchema = new Schema(
  {
    leadId: ref("Lead", true),
    ownerId: ref("users", true),
    actorId: ref("users", true),
    kind: { type: String, enum: ["proposal", "onboarding"], required: true },
    reference: { type: String, required: true },
    evidence: { type: String, required: true },
    sentAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Awaiting feedback", "Accepted", "Rejected", "Completed"],
      required: true,
    },
    agreementConfirmed: Boolean,
    handoverConfirmed: Boolean,
  },
  { timestamps: true },
);
businessSchema.index({ leadId: 1, kind: 1, reference: 1 }, { unique: true });
businessSchema.index(
  { leadId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: "onboarding" } },
);
businessSchema.index({ ownerId: 1, kind: 1, sentAt: 1 });
businessSchema.index({ kind: 1, sentAt: 1 });

const settingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    cutoff: { type: String, default: "18:30" },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    holidays: { type: [String], default: [] },
    linkedinDays: { type: Number, default: 3 },
    recoveryDays: { type: Number, default: 3 },
    callbackNoticeMinutes: { type: Number, default: 15 },
    proposalTarget: { type: Number, default: 5 },
    onboardingTarget: { type: Number, default: 10 },
    requireAgreement: { type: Boolean, default: true },
    requireHandover: { type: Boolean, default: true },
    updatedBy: ref("users"),
  },
  { timestamps: true },
);
const targetSchema = new Schema(
  {
    userId: ref("users", true),
    effectiveDate: { type: String, required: true },
    proposalTarget: { type: Number, required: true },
    onboardingTarget: { type: Number, required: true },
    updatedBy: ref("users", true),
  },
  { timestamps: true },
);
targetSchema.index({ userId: 1, effectiveDate: 1 }, { unique: true });
const notificationSchema = new Schema(
  {
    recipientId: ref("users", true),
    key: { type: String, required: true },
    title: String,
    severity: {
      type: String,
      enum: ["info", "warning", "urgent"],
      default: "info",
    },
    leadId: ref("Lead"),
    pocId: Schema.Types.ObjectId,
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ recipientId: 1, key: 1 }, { unique: true });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = {
  ContactState: mongoose.model("BDContactState", stateSchema),
  Event: mongoose.model("BDMonitoringEvent", eventSchema),
  Submission: mongoose.model("BDSubmission", submissionSchema),
  BusinessEvent: mongoose.model("BDBusinessEvent", businessSchema),
  Settings: mongoose.model("BDMonitoringSettings", settingsSchema),
  Target: mongoose.model("BDTarget", targetSchema),
  Notification: mongoose.model("BDNotification", notificationSchema),
};
