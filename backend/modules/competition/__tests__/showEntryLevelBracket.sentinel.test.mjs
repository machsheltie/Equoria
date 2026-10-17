/**
 * Show entry is never gated by the horse's XP (owner ruling R9; Equoria-576c0 B9).
 *
 * OLD CONTRACT (Equoria-g8qg0, user decision 2026-07-07): both entry paths
 * enforced the show's level bracket using an XP-derived level,
 * horseLevel = floor(horseXp / 100) + 1, and refused a horse outside
 * levelMin..levelMax with 400.
 *
 * NEW RULING: R9 (Stacey, 2026-10-15): "Entering shows has nothing to do with
 * XP/points." The owner's entry rules keep "meet the show's level/range", but
 * the level comes from the score (C8, B8, blocked on O6), never from XP. Until
 * B8 lands no level refuses an entry, and XP never does.
 *
 * This sentinel keeps the old boundary set (below-min, at-min, at-max,
 * above-max under the old mapping) and pins that every one of them is now
 * accepted on BOTH real HTTP paths, for an otherwise eligible horse (age 3-20,
 * an eligible rider). Free shows, so nothing touches the shared escrow account.
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
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'TestFixture-g8qg0';
const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
const future = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

let entrant;
let entrantToken;
const showIds = [];
const horseIds = [];
const riderIds = [];
const cleanup = createCleanupTracker();

// The old bracket [3, 6]; the XP values sat below, at and above it.
const OLD_BRACKET = { levelMin: 3, levelMax: 6 };
const XP_CASES = [
  ['below the old minimum (old L1)', 0],
  ['at the old minimum (old L3)', 250],
  ['at the old maximum (old L6)', 550],
  ['above the old maximum (old L7)', 650],
];

async function makeShow() {
  const s = await prisma.show.create({
    data: {
      name: `${PREFIX}-show-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      maxEntries: null,
      ...OLD_BRACKET,
      prize: 0,
      runDate: future(),
      closeDate: future(),
      openDate: new Date(),
      status: 'open',
      createdByUserId: entrant.id,
    },
  });
  showIds.push(s.id);
  return s;
}

async function makeHorse(horseXp) {
  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: entrant.id,
      healthStatus: 'healthy',
      horseXp,
    },
  });
  horseIds.push(h.id);
  await giveEligibleRider(prisma, { horseId: h.id, userId: entrant.id }, riderIds);
  return h;
}

async function post(path, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${entrantToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

beforeAll(async () => {
  entrant = await prisma.user.create({
    data: {
      email: `g8qg0-entrant-${uid()}@test.com`,
      username: `g8e${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Entrant',
      money: 0,
    },
  });
  entrantToken = generateTestToken({ id: entrant.id, email: entrant.email, role: 'user' });

  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: entrant.id } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe.each([
  ['POST /api/v1/shows/:id/enter', (showId, horseId) => post(`/api/v1/shows/${showId}/enter`, { horseId })],
  ['POST /api/v1/competition/enter', (showId, horseId) => post('/api/v1/competition/enter', { horseId, showId })],
])('%s: XP never refuses an entry (R9)', (_label, enter) => {
  it.each(XP_CASES)(
    'accepts a horse with XP %s',
    async (_case, horseXp) => {
      const show = await makeShow();
      const horse = await makeHorse(horseXp);
      const res = await enter(show.id, horse.id);
      expect(res.status).toBe(201);
      expect(await prisma.showEntry.count({ where: { showId: show.id, horseId: horse.id } })).toBe(1);
    },
    30000,
  );
});
