const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const routeSource = readFileSync(join(__dirname, '../routes/leadRoutes.js'), 'utf8');

function setup() {
    const handlers = new Map();
    const contact = { _id: 'contact', approvalStatus: 'pending', linkedin_url: 'https://www.linkedin.com/in/test/' };
    const contacts = Object.assign([], {
        id: id => id === contact._id ? contact : null,
        create: fields => ({ ...fields, toObject: () => fields }),
    });
    const lead = { _id: 'company', assignedBy: 'staff', points_of_contact: contacts, populate: async () => {} };
    let alreadySubmitted = false;
    const database = {
        findById: async () => lead,
        updateOne: async (query, update) => {
            assert.equal(query['points_of_contact.linkedin_url'].$ne, contact.linkedin_url);
            assert.equal(update.$push.points_of_contact.approvalStatus, 'pending');
            if (alreadySubmitted) return { modifiedCount: 0 };
            alreadySubmitted = true;
            return { modifiedCount: 1 };
        },
        findOneAndUpdate: async (query, update) => {
            if (contact.approvalStatus !== query.points_of_contact.$elemMatch.approvalStatus) return null;
            for (const [path, value] of Object.entries(update.$set)) {
                contact[path.split('.').at(-1)] = value;
            }
            return lead;
        },
    };
    const router = new Proxy({}, {
        get: (_, method) => (route, ...callbacks) => handlers.set(`${method} ${route}`, callbacks.at(-1)),
    });
    runInNewContext(routeSource, {
        require: name => name === 'express' ? { Router: () => router }
            : name === '../models/Lead' ? database
            : name === '../utils/logActivity' ? async () => {} : {},
        module: { exports: {} }, console,
    });
    return async (route, user, body) => {
        const result = { status: 200, data: null };
        const res = {
            status(code) { result.status = code; return this; },
            json(data) { result.data = data; },
        };
        await handlers.get(route)({ params: { id: lead._id, pocId: contact._id }, user, body }, res);
        return result;
    };
}

test('company staff can submit a LinkedIn profile once and outsiders cannot submit', async () => {
    const request = setup();
    const route = 'post /:id/poc';
    const staff = { id: 'staff', role: 'BD Executive' };
    const body = { linkedin_url: 'https://linkedin.com/in/Test?tracking=1', approvalStatus: 'pending' };

    assert.equal((await request(route, staff, { ...body, linkedin_url: 'https://linkedin.com.example/in/test' })).status, 400);
    assert.equal((await request(route, { ...staff, id: 'outsider' }, body)).status, 403);
    const submitted = await request(route, staff, body);
    assert.equal(submitted.status, 200);
    assert.equal(submitted.data.poc.linkedin_url, 'https://www.linkedin.com/in/test/');
    assert.equal((await request(route, staff, body)).status, 409);
});

test('inline approval requires an admin and approves the contact only while pending', async () => {
    const request = setup();
    const route = 'patch /:id/approve-poc/:pocId';
    const admin = { role: 'Admin' };
    const body = { details: { name: ' Test Contact ', phone: '5550100' } };

    assert.equal((await request(route, { role: 'Manager' }, body)).status, 403);
    assert.equal((await request(route, admin, { details: { name: 'Test Contact' } })).status, 400);
    assert.equal((await request(route, admin, body)).status, 200);
    assert.equal((await request(route, admin, body)).status, 409);
});

test('rejection stores a visible reason and a second rejection cannot overwrite it', async () => {
    const request = setup();
    const route = 'patch /:id/reject-poc/:pocId';
    const admin = { id: 'admin', role: 'Admin' };
    assert.equal((await request(route, { role: 'BD Executive' }, { reason: 'Wrong contact' })).status, 403);
    assert.equal((await request(route, admin, { reason: '   ' })).status, 400);
    assert.equal((await request(route, admin, { reason: 'x'.repeat(501) })).status, 400);
    const rejected = await request(route, admin, { reason: ' Wrong contact ' });
    assert.equal(rejected.status, 200);
    const contact = rejected.data.lead.points_of_contact.id('contact');
    assert.equal(contact.approvalStatus, 'rejected');
    assert.equal(contact.rejectedBy, 'admin');
    assert.equal(contact.rejectionReason, 'Wrong contact');
    assert.equal((await request(route, admin, { reason: 'Second reason' })).status, 409);
    assert.equal(contact.rejectionReason, 'Wrong contact');
});
