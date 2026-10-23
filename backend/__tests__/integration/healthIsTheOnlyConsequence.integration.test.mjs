/**
 * healthIsTheOnlyConsequence.integration.test.mjs (Equoria-0d4wa)
 *
 * Owner ruling 2026-10-22 (Stacey):
 *   - There is NO burnout. A horse carrying the old `burnout` trait trains like
 *     any other horse; nothing blocks or reduces its session.
 *   - Bad health is the ONLY consequence: a horse in bad health cannot breed,
 *     train or enter shows.
 *
 * "Bad health" is the threshold the breeding and conformation gates already
 * used, and the one the feed-system health contract names
 * (docs/features/feed-system.md: "Critical displayed health blocks breeding
 * and competition entry"): displayed health — the worse of feed health and vet
 * health, utils/horseHealth.mjs getDisplayedHealth — equal to 'critical'.
 *
 * Every action goes through the real HTTP route (supertest on the app, auth +
 * CSRF) against the real DB. Shows are free (entryFee 0) so no escrow moves.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../helpers/eligibleCompetitor.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
const riderIds = [];
const showIds = [];
const groomIds = [];
let owner;
let token;

/** Ten Eastern days without feed: feed health 'critical' (bands: 9+ days). */
const tenDaysAgo = () => new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      email: `hioc-${uid()}@test.local`,
      username: `hioc${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Health',
      lastName: 'Only',
      money: 1000,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'logs');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groom assignments');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

/** An adult horse owned by `owner`; fed today and in Excellent health unless overridden. */
function makeHorse(fields = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-hioc-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(7),
      age: 7,
      userId: owner.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      disciplineScores: {},
      ...fields,
    },
    horseIds,
  );
}

async function makeShow(fields = {}) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-hioc-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      prize: 0,
      levelMin: 1,
      levelMax: 1,
      runDate: future,
      closeDate: future,
      openDate: new Date(Date.now() - 60 * 1000),
      status: 'open',
      createdByUserId: owner.id,
      ...fields,
    },
  });
  showIds.push(show.id);
  return show;
}

async function post(path, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

function get(path) {
  return request(app)
    .get(path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', `accessToken=${token}`);
}

describe('No burnout (owner ruling 2026-10-22)', () => {
  it('a horse carrying the old burnout trait trains and gains the full +5', async () => {
    const horse = await makeHorse({
      epigeneticModifiers: { positive: [], negative: ['burnout'], hidden: [] },
    });

    const res = await post('/api/v1/training/train', { horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disciplineScoreIncrease).toBe(5);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { disciplineScores: true },
    });
    expect(after.disciplineScores.Dressage).toBe(5);
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(1);
  });
});

describe('Bad health blocks training', () => {
  it('refuses a horse in critical health (ten days unfed) and writes nothing', async () => {
    const horse = await makeHorse({ lastFedDate: tenDaysAgo() });

    const res = await post('/api/v1/training/train', { horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/critical health/i);
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(0);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { disciplineScores: true },
    });
    expect(after.disciplineScores?.Dressage ?? 0).toBe(0);
  });

  it('refuses a horse with a critical vet finding even when fed today', async () => {
    const horse = await makeHorse({ healthStatus: 'Critical' });
    const res = await post('/api/v1/training/train', { horseId: horse.id, discipline: 'Dressage' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health/i);
  });

  it('still trains a horse in poor (not critical) health', async () => {
    const horse = await makeHorse({ healthStatus: 'Poor' });
    const res = await post('/api/v1/training/train', { horseId: horse.id, discipline: 'Dressage' });
    expect(res.status).toBe(200);
  });
});

describe.each([
  ['POST /api/v1/shows/:id/enter', (showId, horseId) => post(`/api/v1/shows/${showId}/enter`, { horseId })],
  ['POST /api/v1/competition/enter', (showId, horseId) => post('/api/v1/competition/enter', { horseId, showId })],
])('Bad health blocks ridden show entry: %s', (_label, enter) => {
  async function riddenHorse(fields) {
    const horse = await makeHorse(fields);
    await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id }, riderIds);
    return horse;
  }

  it('refuses a horse in critical health (ten days unfed) and creates no entry', async () => {
    const show = await makeShow();
    const horse = await riddenHorse({ lastFedDate: tenDaysAgo() });

    const res = await enter(show.id, horse.id);

    expect({ status: res.status, code: res.body.code }).toEqual({
      status: 400,
      code: 'horseCriticalHealth',
    });
    expect(res.body.message).toMatch(/critical health/i);
    expect(await prisma.showEntry.count({ where: { showId: show.id, horseId: horse.id } })).toBe(0);
  });

  it('accepts the same horse once it is fed (control)', async () => {
    const show = await makeShow();
    const horse = await riddenHorse({});
    expect((await enter(show.id, horse.id)).status).toBe(201);
  });
});

describe('Bad health blocks conformation show entry', () => {
  it('refuses a horse in critical health before any groom or show lookup', async () => {
    const horse = await makeHorse({ lastFedDate: tenDaysAgo() });
    const res = await post('/api/v1/competition/conformation/enter', {
      horseId: horse.id,
      groomId: 1,
      showId: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health/i);
  });
});

/**
 * Owner rulings 2026-10-23 (Equoria-0d4wa follow-ups): conformation entry uses
 * the SAME health bar as breeding, training and ridden shows — only critical
 * displayed health blocks (the old Excellent/Good requirement is gone) — and
 * the non-blocking high-stress warning on entry is removed.
 */
describe('Conformation entry: only critical health blocks (owner ruling 2026-10-23)', () => {
  /** An entry-ready conformation horse: a groom on staff, assigned five days ago. */
  async function conformationHorse(fields) {
    const horse = await makeHorse(fields);
    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-hioc-groom-${uid()}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'expert',
        user: { connect: { id: owner.id } },
      },
    });
    groomIds.push(groom.id);
    await prisma.groomAssignment.create({
      data: {
        groom: { connect: { id: groom.id } },
        foal: { connect: { id: horse.id } },
        user: { connect: { id: owner.id } },
        isActive: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });
    return { horse, groom };
  }

  const conformationShow = () => makeShow({ discipline: 'Conformation', showType: 'conformation', levelMax: 10 });

  const enterConformation = (show, { horse, groom }) =>
    post('/api/v1/competition/conformation/enter', {
      horseId: horse.id,
      groomId: groom.id,
      showId: show.id,
    });

  it.each(['Poor', 'Fair'])('enters a horse in %s (not critical) health', async healthStatus => {
    const show = await conformationShow();
    const entrant = await conformationHorse({ healthStatus });

    const res = await enterConformation(show, entrant);

    expect({ status: res.status, errors: res.body.errors }).toEqual({ status: 201, errors: undefined });
    expect(await prisma.showEntry.count({ where: { showId: show.id, horseId: entrant.horse.id } })).toBe(1);
  });

  it('gives no high-stress warning on entry', async () => {
    const show = await conformationShow();
    const entrant = await conformationHorse({ stressLevel: 95 });

    const res = await enterConformation(show, entrant);

    expect(res.status).toBe(201);
    expect(res.body.data.warnings.filter(w => /stress/i.test(w))).toEqual([]);
  });

  it('refuses a horse with a critical vet finding and creates no entry', async () => {
    const show = await conformationShow();
    const entrant = await conformationHorse({ healthStatus: 'Critical' });

    const res = await enterConformation(show, entrant);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health/i);
    expect(await prisma.showEntry.count({ where: { showId: show.id } })).toBe(0);
  });

  it('the eligibility check applies the same bar: poor is eligible, critical is not', async () => {
    const poor = await conformationHorse({ healthStatus: 'Poor' });
    const unfed = await conformationHorse({ lastFedDate: tenDaysAgo() });

    const poorRes = await get(`/api/v1/competition/conformation/eligibility/${poor.horse.id}`);
    const unfedRes = await get(`/api/v1/competition/conformation/eligibility/${unfed.horse.id}`);

    expect({ status: poorRes.status, eligible: poorRes.body.data.eligible }).toEqual({
      status: 200,
      eligible: true,
    });
    expect({ status: unfedRes.status, eligible: unfedRes.body.data.eligible }).toEqual({
      status: 200,
      eligible: false,
    });
    expect(unfedRes.body.data.errors.join(' ')).toMatch(/critical health/i);
  });
});

describe('Bad health blocks breeding', () => {
  it('refuses a pair when the mare is in critical health and starts no pregnancy', async () => {
    const sire = await makeHorse({ sex: 'Stallion' });
    const dam = await makeHorse({ lastFedDate: tenDaysAgo() });

    const res = await post('/api/v1/horses/foals', { sireId: sire.id, damId: dam.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health/i);
    const after = await prisma.horse.findUnique({
      where: { id: dam.id },
      select: { inFoalSinceDate: true, lastBredDate: true },
    });
    expect(after).toEqual({ inFoalSinceDate: null, lastBredDate: null });
  });

  it('refuses a pair when the stallion is in critical health', async () => {
    const sire = await makeHorse({ sex: 'Stallion', lastFedDate: null });
    const dam = await makeHorse();
    const res = await post('/api/v1/horses/foals', { sireId: sire.id, damId: dam.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health/i);
  });
});
