const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Lead = require('../models/Lead');
const CallActivity = require('../models/CallActivity');
const Task = require('../models/Task');
const LeadActivity = require('../models/LeadActivity');
const router = express.Router();

// UTC bounds for an Asia/Kolkata calendar day, independent of server timezone.
function reportingDay(now) {
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const start = new Date(`${date}T00:00:00+05:30`);
    return { date, start, end: new Date(start.getTime() + 86400000) };
}

router.get('/', auth, async (req, res) => {
    try {
        if (!['Admin', 'Manager', 'BD Executive'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const now = new Date();
        const { date, start, end } = reportingDay(now);
        let users = [req.user.id];
        if (req.user.role === 'Manager') {
            const team = await User.find({ reporter: req.user.id }).select('_id').lean();
            users = users.concat(team.map(user => String(user._id)));
        }
        const ids = users.map(id => new mongoose.Types.ObjectId(id));
        const all = req.user.role === 'Admin';
        const leadScope = all ? {} : { $or: [
            { assignedBy: { $in: ids } }, { createdBy: { $in: ids } }, { assignedTo: { $in: ids } },
        ] };
        const actorScope = all ? {} : { userId: { $in: ids } };
        const taskScope = all ? {} : { user_id: { $in: ids } };
        const [outcomes, pendingCount, overdueCount, tasks, stalledCount, stalled, teamCalls] = await Promise.all([
            CallActivity.aggregate([
                { $match: { ...actorScope, timestamp: { $gte: start, $lt: end } } },
                { $group: { _id: '$stage', count: { $sum: 1 } } },
            ]),
            Task.countDocuments({ ...taskScope, completed: false }),
            Task.countDocuments({ ...taskScope, completed: false, due_date: { $lt: now } }),
            Task.find({ ...taskScope, completed: false }).sort({ due_date: 1 }).limit(30)
                .select('title due_date lead_id poc_id user_id type')
                .populate('lead_id', 'company_name').populate('user_id', 'name').lean(),
            // A known transition is required. Legacy leads without transition history
            // cannot reliably be dated from their creation or last edit.
            Lead.aggregate(stalledPipeline(leadScope, now, true)),
            Lead.aggregate(stalledPipeline(leadScope, now, false)),
            CallActivity.aggregate([
                { $match: { ...actorScope, timestamp: { $gte: start, $lt: end } } },
                { $group: { _id: '$userId', calls: { $sum: 1 } } },
                { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'employee' } },
                { $project: { calls: 1, name: { $arrayElemAt: ['$employee.name', 0] } } },
                { $sort: { calls: -1, _id: 1 } },
            ]),
        ]);
        res.json({
            date, generatedAt: now, outcomes,
            calls: outcomes.reduce((total, outcome) => total + outcome.count, 0),
            pendingTasks: pendingCount, overdueTasks: overdueCount,
            stalledCount: stalledCount[0]?.count || 0, tasks, stalled, teamCalls,
        });
    } catch (error) {
        console.error('BD monitoring failed:', error.message);
        res.status(500).json({ message: 'Could not load activity monitoring.' });
    }
});

function stalledPipeline(scope, now, countOnly) {
    return [
        { $match: { ...scope, stage: 'Contacted', status: { $nin: ['incomplete', 'rejected'] } } },
        { $lookup: {
            from: LeadActivity.collection.name, let: { lead: '$_id' },
            pipeline: [
                { $match: { $expr: { $eq: ['$leadId', '$$lead'] }, type: 'Stage Changed' } },
                { $sort: { timestamp: -1, _id: -1 } }, { $limit: 1 },
            ], as: 'transition',
        } },
        { $unwind: '$transition' },
        { $match: { 'transition.metadata.to': 'Contacted', 'transition.timestamp': { $lt: new Date(now.getTime() - 48 * 3600000) } } },
        ...(countOnly ? [{ $count: 'count' }] : [
            { $sort: { 'transition.timestamp': 1, _id: 1 } }, { $limit: 30 },
            { $project: { company_name: 1, since: '$transition.timestamp' } },
        ]),
    ];
}

module.exports = router;
