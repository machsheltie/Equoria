/**
 * Server-side level-bracket enforcement at show entry (Equoria-g8qg0).
 *
 * DEFECT (pre-fix): `createShow` persists a level bracket (levelMin/levelMax,
 * Equoria-nx8t1 R1) and the browse UI advertises it, but NEITHER entry path
 * enforced it. A max-progression horse could enter a "level 5" show funded
 * with the creator's own prize money and take the player-funded prize — the
 * advertised rule was client-side theater (Constitution: the server must
 * enforce game rules, not the UI).
 *
 * USER DECISION (2026-07-07, on the issue): ENFORCE the bracket server-side.
 * MAPPING PINNED: horseLevel = floor(horseXp / 100) + 1 (mirrors the user XP
 * "100 XP = a level" curve). Enforce levelMin <= horseLevel <= levelMax in
 * BOTH entry paths — showController.enterShow (POST /api/v1/shows/:id/enter)
 * AND POST /api/v1/competition/enter — inside the entry $transaction alongside
 * the Equoria-8pb6w status predicate. Out-of-bracket => 400, wallet unchanged,
 * no ShowEntry. In-bracket => 201.
 *
 * This sentinel exercises BOTH real HTTP paths against the real DB (no mocks),
 * boundary-complete (below-min, at-min, at-max, above-max), and asserts the
 * money/entry side-effects are atomic: an out-of-bracket 400 leaves the
 * entrant's wallet untouched and creates no ShowEntry row.
 *
 * horseXp -> horseLevel reference (floor(xp/100)+1):
 *   xp   0 -> L1     xp 250 -> L3     xp 550 -> L6     xp 650 -> L7
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

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'TestFixture-g8qg0';
const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
const future = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

let creator;
let entrant;
let entrantToken;
const showIds = [];
const horseIds = [];
const cleanup = createCleanupTracker();

// A bracket of [3, 6] so we can test the below-min / at-min / at-max /
// above-max boundaries. levelMin/levelMax are non-null Int on Show.
const BRACKET_MIN = 3;
const BRACKET_MAX = 6;

async function makeShow(entryFee = 100) {
  const prize = Math.max(entryFee * 10, 1000);
  const s = await prisma.show.create({
    data: {
      name: `${PREFIX}-show-${uid()}`,
      discipline: 'Dressage',
      entryFee,
      maxEntries: null,
      levelMin: BRACKET_MIN,
      levelMax: BRACKET_MAX,
      prize,
      runDate: future(),
      closeDate: future(),
      openDate: new Date(),
      status: 'open',
      createdByUserId: creator.id,
      prizeEscrow: prize,
      feeEscrow: 0,
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
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: entrant.id,
      healthStatus: 'healthy',
      horseXp,
    },
  });
  horseIds.push(h.id);
  return h;
}

async function enterViaShows(showId, horseId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
  return request(app)
    .post(`/api/v1/shows/${showId}/enter`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${entrantToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId });
}

async function enterViaCompetition(showId, horseId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
  return request(app)
    .post('/api/v1/competition/enter')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${entrantToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, showId });
}

async function money(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return u.money;
}

async function entryCount(showId, horseId) {
  return prisma.showEntry.count({ where: { showId, horseId } });
}

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      email: `g8qg0-creator-${uid()}@test.com`,
      username: `g8c${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Creator',
      money: 1_000_000,
    },
  });
  entrant = await prisma.user.create({
    data: {
      email: `g8qg0-entrant-${uid()}@test.com`,
      username: `g8e${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Entrant',
      money: 1_000_000,
    },
  });
  entrantToken = generateTestToken({ id: entrant.id, email: entrant.email, role: 'user' });

  cleanup.add(async () => {
    for (const id of showIds) {
      await prisma.competitionResult.deleteMany({ where: { showId: id } });
      await prisma.showEntry.deleteMany({ where: { showId: id } });
      await prisma.show.delete({ where: { id } });
    }
  }, 'shows');
  cleanup.add(async () => {
    if (horseIds.length) {
      await prisma.showEntry.deleteMany({ where: { horseId: { in: horseIds } } });
      await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
  }, 'horses');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: [creator.id, entrant.id] } } }), 'txns');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [creator.id, entrant.id] } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 60000);

// ── Path A: canonical POST /api/v1/shows/:id/enter (showController.enterShow) ──
describe('Path A — POST /api/v1/shows/:id/enter enforces the level bracket', () => {
  it('SENTINEL: below-min horse (L1) is rejected 400, wallet unchanged, no ShowEntry', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(0); // floor(0/100)+1 = L1, below min 3
    const before = await money(entrant.id);

    const res = await enterViaShows(show.id, horse.id);

    expect(res.status).toBe(400);
    expect(await money(entrant.id)).toBe(before); // wallet unchanged
    expect(await entryCount(show.id, horse.id)).toBe(0); // no ShowEntry
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
    expect(showAfter.feeEscrow).toBe(0); // escrow untouched
  }, 30000);

  it('SENTINEL: above-max horse (L7) is rejected 400, wallet unchanged, no ShowEntry', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(650); // floor(650/100)+1 = L7, above max 6
    const before = await money(entrant.id);

    const res = await enterViaShows(show.id, horse.id);

    expect(res.status).toBe(400);
    expect(await money(entrant.id)).toBe(before);
    expect(await entryCount(show.id, horse.id)).toBe(0);
  }, 30000);

  it('at-min horse (L3) is accepted 201', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(250); // floor(250/100)+1 = L3 == min
    const res = await enterViaShows(show.id, horse.id);
    expect(res.status).toBe(201);
    expect(await entryCount(show.id, horse.id)).toBe(1);
  }, 30000);

  it('at-max horse (L6) is accepted 201', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(550); // floor(550/100)+1 = L6 == max
    const res = await enterViaShows(show.id, horse.id);
    expect(res.status).toBe(201);
    expect(await entryCount(show.id, horse.id)).toBe(1);
  }, 30000);
});

// ── Path B: POST /api/v1/competition/enter (enterShowDeferredTx) ──────────────
describe('Path B — POST /api/v1/competition/enter enforces the level bracket', () => {
  it('SENTINEL: below-min horse (L1) is rejected 400, wallet unchanged, no ShowEntry', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(0); // L1, below min 3
    const before = await money(entrant.id);

    const res = await enterViaCompetition(show.id, horse.id);

    expect(res.status).toBe(400);
    expect(await money(entrant.id)).toBe(before);
    expect(await entryCount(show.id, horse.id)).toBe(0);
    const showAfter = await prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } });
    expect(showAfter.feeEscrow).toBe(0);
  }, 30000);

  it('SENTINEL: above-max horse (L7) is rejected 400, wallet unchanged, no ShowEntry', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(650); // L7, above max 6
    const before = await money(entrant.id);

    const res = await enterViaCompetition(show.id, horse.id);

    expect(res.status).toBe(400);
    expect(await money(entrant.id)).toBe(before);
    expect(await entryCount(show.id, horse.id)).toBe(0);
  }, 30000);

  it('at-min horse (L3) is accepted 201', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(250); // L3 == min
    const res = await enterViaCompetition(show.id, horse.id);
    expect(res.status).toBe(201);
    expect(await entryCount(show.id, horse.id)).toBe(1);
  }, 30000);

  it('at-max horse (L6) is accepted 201', async () => {
    const show = await makeShow(100);
    const horse = await makeHorse(550); // L6 == max
    const res = await enterViaCompetition(show.id, horse.id);
    expect(res.status).toBe(201);
    expect(await entryCount(show.id, horse.id)).toBe(1);
  }, 30000);
});
