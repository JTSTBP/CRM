const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real list handler without connecting to the CRM database.
async function listLeads(query, contacts) {
    let handler;
    let databaseQuery;
    let countQuery;
    let result;
    const router = new Proxy({}, {
        get: (_, method) => (route, ...handlers) => {
            if (method === 'get' && route === '/') handler = handlers.at(-1);
        }
    });
    const chain = {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        populate() { return this; },
        then(resolve) { resolve([{ toObject: () => ({ points_of_contact: contacts }) }]); }
    };
    const Lead = {
        countDocuments: async q => { countQuery = q; return 1; },
        find: q => { databaseQuery = q; return chain; }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/leadRoutes.js'), 'utf8'), {
        require: name => name === 'express' ? { Router: () => router }
            : name === '../models/Lead' ? Lead : {},
        module: { exports: {} }, console
    });
    await handler({ query, user: { role: 'Admin' } }, {
        json: data => { result = data; },
        status: code => { throw new Error(`Unexpected status: ${code}`); }
    });
    return JSON.parse(JSON.stringify({ result, databaseQuery, countQuery }));
}

const contacts = [
    { name: 'First', stage: 'New', approvalStatus: 'approved' },
    { name: 'Second', stage: 'Busy', approvalStatus: 'approved' },
    { name: 'Third', stage: 'No Answer', approvalStatus: 'approved' },
    { name: 'Match', stage: 'Contacted', approvalStatus: 'approved' },
    { name: 'Pending', stage: 'Contacted', approvalStatus: 'pending' },
    { name: 'Rejected', stage: 'Contacted', approvalStatus: 'rejected' },
    { name: 'Legacy', stage: 'Contacted' }
];

for (const status of [undefined, 'approved']) {
    test(`POC filter matches visible contacts and pagination query (${status || 'default'})`, async () => {
        const { result, databaseQuery, countQuery } = await listLeads({ pocStage: 'Contacted', status }, contacts);
        assert.deepEqual(databaseQuery.points_of_contact, {
            $elemMatch: { stage: 'Contacted', approvalStatus: { $nin: ['pending', 'rejected'] } }
        });
        assert.deepEqual(countQuery, databaseQuery);
        assert.deepEqual(result.leads[0].points_of_contact.map(p => p.name), ['Match', 'Legacy']);
    });
}

test('clearing the POC filter restores all visible contacts', async () => {
    const { result, databaseQuery } = await listLeads({}, contacts);
    assert.equal(databaseQuery.points_of_contact, undefined);
    assert.deepEqual(result.leads[0].points_of_contact.map(p => p.name), ['First', 'Second', 'Third', 'Match', 'Legacy']);
});

test('incomplete company view retains its existing approval visibility', async () => {
    const { result, databaseQuery } = await listLeads({ status: 'incomplete', pocStage: 'Contacted' }, contacts);
    assert.deepEqual(databaseQuery.points_of_contact, { $elemMatch: { stage: 'Contacted' } });
    assert.equal(result.leads[0].points_of_contact.length, 4);
});
