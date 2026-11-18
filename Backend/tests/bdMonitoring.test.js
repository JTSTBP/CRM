const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load() {
    let handler;
    const queries = [];
    const chain = {
        sort() { return this; }, limit() { return this; }, select() { return this; },
        populate() { return this; }, lean: async () => [],
    };
    const calls = {
        aggregate: async pipeline => { queries.push(pipeline); return []; },
    };
    const models = {
        '../models/CallActivity': calls,
        '../models/Lead': { aggregate: async pipeline => { queries.push(pipeline); return []; } },
        '../models/LeadActivity': { collection: { name: 'leadactivities' } },
        '../models/User': {
            collection: { name: 'users' },
            find: () => ({ select: () => ({ lean: async () => [{ _id: 'report' }] }) }),
        },
        '../models/Task': { countDocuments: async query => { queries.push(query); return 0; }, find: query => { queries.push(query); return chain; } },
    };
    const sandbox = {
        require: name => models[name] || (name === 'express' ? { Router: () => ({
            get: (route, auth, callback) => { handler = callback; },
        }) } : name === 'mongoose' ? { Types: { ObjectId: class { constructor(id) { this.id = id; } } } } : {}),
        module: { exports: {} }, console, Intl, Date,
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/bdMonitoringRoutes.js'), 'utf8'), sandbox);
    return { sandbox, queries, handler };
}

test('reporting day uses Kolkata midnight on both sides of UTC date boundaries', () => {
    const { sandbox } = load();
    const day = vm.runInContext("reportingDay(new Date('2026-11-18T20:00:00Z'))", sandbox);
    assert.equal(day.date, '2026-11-19');
    assert.equal(day.start.toISOString(), '2026-11-18T18:30:00.000Z');
    assert.equal(day.end.toISOString(), '2026-11-19T18:30:00.000Z');
});

test('BD and manager monitoring scope calls and tasks to the permitted employees', async () => {
    for (const role of ['BD Executive', 'Manager']) {
        const { handler, queries } = load();
        let result;
        await handler({ user: { id: 'self', role } }, { json: data => { result = data; } });
        const expected = role === 'Manager' ? ['self', 'report'] : ['self'];
        assert.deepEqual(Array.from(queries[0][0].$match.userId.$in, id => id.id), expected);
        assert.equal(result.calls, 0);
        assert.equal(result.stalledCount, 0);
        const taskQuery = queries.find(query => query.completed === false);
        assert.deepEqual(Array.from(taskQuery.user_id.$in, id => id.id), expected);
    }
});

test('unsupported roles are denied before querying records', async () => {
    const { handler, queries } = load();
    let code;
    await handler({ user: { role: 'Other' } }, {
        status(value) { code = value; return this; }, json() {},
    });
    assert.equal(code, 403);
    assert.equal(queries.length, 0);
});
