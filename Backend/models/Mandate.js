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
    title: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["Open", "Sourcing", "Paused", "Filled", "Cancelled"],
      default: "Open",
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High"],
      default: "Normal",
    },
    location: { type: String, maxlength: 300 },
    dueAt: Date,
    positions: { type: Number, required: true, min: 1, max: 100000 },
    submissions: { type: Number, default: 0, min: 0, max: 1000000 },
    interviews: { type: Number, default: 0, min: 0, max: 1000000 },
    filled: { type: Number, default: 0, min: 0, max: 100000 },
    sourcingSlaDays: { type: Number, min: 1, max: 365 },
    note: { type: String, maxlength: 2000 },
    revision: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ leadId: 1, status: 1, dueAt: 1 });
module.exports = mongoose.model("Mandate", schema);
