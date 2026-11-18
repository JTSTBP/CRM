const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    recipientPocIds: [mongoose.Schema.Types.ObjectId],
    title: { type: String, required: true, maxlength: 200 },
    reference: { type: String, required: true, maxlength: 150 },
    scope: { type: String, required: true, maxlength: 2000 },
    positions: { type: Number, min: 0, max: 100000 },
    followupAt: Date,
    status: {
      type: String,
      enum: ["Draft", "In Review", "Approved", "Rejected", "Sent"],
      default: "Draft",
    },
    reviewReason: { type: String, maxlength: 2000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    reviewedAt: Date,
    sentBusinessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BDBusinessEvent",
    },
    revision: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ leadId: 1, reference: 1 }, { unique: true });
module.exports = mongoose.model("CompanyProposal", schema);
