const mongoose = require('mongoose');

const LeadActivitySchema = new mongoose.Schema({
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'Lead Created',
            'Lead Updated',
            'Stage Changed',
            'Reassigned',
            'POC Added',
            'POC Updated',
            'POC Removed',
            'Call Logged',
            'Task Created',
            'Task Updated',
            'Task Completed',
            'Task Reopened',
            'Task Deleted',
            'Remark Added',
            'Bulk Upload',
            'Lead Merged',
            'Lead Approved',
            'Lead Rejected',
            'POC Approved',
            'POC Rejected',
            'Email Sent'
        ]
    },
    description: { type: String, required: true },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    performedByName: { type: String, default: 'System' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
});

LeadActivitySchema.index({ leadId: 1, type: 1, timestamp: -1, _id: -1 });
module.exports = mongoose.model('LeadActivity', LeadActivitySchema);
