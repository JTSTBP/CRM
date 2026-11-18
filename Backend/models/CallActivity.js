const mongoose = require("mongoose");

const CallActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    pocId: { type: String, required: true }, // ID of the specific contact person
    phone: { type: String, required: true },
    stage: { type: String, required: true }, // Stage set after call
    remarks: { type: String }, // Remarks added after call
    device: { type: String }, // Laptop, Mobile, etc.
    timestamp: { type: Date, default: Date.now },
    bdRecorded: { type: Boolean },
});

CallActivitySchema.index({ userId: 1, timestamp: -1 });
CallActivitySchema.index({ timestamp: -1, stage: 1 });
CallActivitySchema.index({ bdRecorded: 1, timestamp: -1 });
module.exports = mongoose.model("CallActivity", CallActivitySchema);
