import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/pages/Login/Login.tsx', import.meta.url), 'utf8');
const block = source.match(/if \(data.user.role === 'Admin'\) \{[\s\S]*?window.location.href = '\/dashboard';\s*\}/g).at(-1);
const redirect = new Function('data', 'window', block);
for (const [role, expected] of Object.entries({ Admin: '/admin/dashboard', Manager: '/manager/dashboard', 'BD Executive': '/bd/dashboard' })) {
    test(`${role} login redirects to its dashboard`, () => {
        const window = { location: { href: '' } };
        redirect({ user: { role } }, window);
        assert.equal(window.location.href, expected);
    });
}
