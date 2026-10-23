/**
 * Two concurrent renames of one horse: exactly one name wins (Equoria-oj5jw).
 *
 * Renames are unrestricted (owner ruling 2026-09-08): any time, any number of times. Two
 * PATCH /horses/:id/name requests in flight therefore both succeed, and the committed name
 * is exactly one of the two, never the original and never a blend. This replaces what the
 * old concurrent-PUT assertion in parameter-pollution.test.mjs was meant to prove: PUT no
 * longer renames, so the race lives here.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const origin = 'http://localhost:3000';
const tag = randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const originalName = `TestFixture-RenameRace-${tag}`;

let owner;
let token;
let horse;

const rename = async name => {
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .patch(`/api/v1/horses/${horse.id}/name`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ name });
};

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      username: `renamerace${tag}`,
      email: `renamerace-${tag}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Rename',
      lastName: 'Race',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: originalName,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: owner.id,
      healthStatus: 'Excellent',
    },
  });
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('concurrent renames of one horse (Equoria-oj5jw)', () => {
  it('accepts both and commits exactly one of the two names', async () => {
    const [first, second] = await Promise.all([rename('RenameOne'), rename('RenameTwo')]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const stored = await prisma.horse.findUnique({ where: { id: horse.id }, select: { name: true } });
    expect(['RenameOne', 'RenameTwo']).toContain(stored.name);
    expect(stored.name).not.toBe(originalName);
  });
});
