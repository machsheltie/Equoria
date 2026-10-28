/**
 * An injured horse cannot breed, on the real breeding route (Equoria-xju2p).
 *
 * The old finding: the breeding action path applied only ownership and input
 * validation, so 'Injured horses cannot breed' (and the age window) were claims
 * with no enforcement behind them. The age window (3-20, Equoria-e7tgc.4, owner
 * ruling 2026-10-23) and the Fair-or-better health gate (Equoria-u0jop) are now
 * applied by the one shared validator, validateBreedingPair; this pins the
 * injured case, a vet finding stored as healthStatus 'Injured', for both parents,
 * and that a healthy pair in the window still breeds.
 *
 * Real HTTP route (supertest, auth + CSRF), real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let owner;
let token;
let breed;

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `brinj-${uid()}@test.local`,
      username: `brinj${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Injured',
      lastName: 'Breeding',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Shared test breed' },
  });
  cleanup.add(() => prisma.breedingRecord.deleteMany({ where: { damId: { in: horseIds } } }), 'breeding records');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

/** An adult horse of the shared breed, fed today and healthy unless overridden. */
function makeHorse(fields = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-brinj-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(7),
      age: 7,
      userId: owner.id,
      breedId: breed.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      lastVettedDate: new Date(),
      ...fields,
    },
    horseIds,
  );
}

async function breed_(sireId, damId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/horses/foals')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ sireId, damId });
}

const inFoal = async damId =>
  (await prisma.horse.findUnique({ where: { id: damId }, select: { inFoalSinceDate: true } })).inFoalSinceDate;

describe('an injured horse cannot breed (Equoria-xju2p)', () => {
  it('refuses an injured mare and starts no pregnancy', async () => {
    const sire = await makeHorse({ sex: 'Stallion' });
    const dam = await makeHorse({ healthStatus: 'Injured' });
    const res = await breed_(sire.id, dam.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot breed/);
    expect(await inFoal(dam.id)).toBeNull();
  });

  it('refuses an injured stallion', async () => {
    const sire = await makeHorse({ sex: 'Stallion', healthStatus: 'Injured' });
    const dam = await makeHorse();
    const res = await breed_(sire.id, dam.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot breed/);
    expect(await inFoal(dam.id)).toBeNull();
  });

  it('refuses a mare past the last breeding year (21) and breeds a healthy pair of 20', async () => {
    const sire = await makeHorse({ sex: 'Stallion', age: 20, dateOfBirth: competitionDateOfBirth(20) });
    const retired = await makeHorse({ age: 21, dateOfBirth: competitionDateOfBirth(21) });
    const refused = await breed_(sire.id, retired.id);
    expect(refused.status).toBe(400);
    expect(await inFoal(retired.id)).toBeNull();

    const last = await makeHorse({ age: 20, dateOfBirth: competitionDateOfBirth(20) });
    const bred = await breed_(sire.id, last.id);
    expect(bred.status).toBe(200);
    expect(await inFoal(last.id)).not.toBeNull();
  });
});
