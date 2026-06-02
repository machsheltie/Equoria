/**
 * GET /api/v1/horses/:horseId/competition-history — IDOR sentinel (Equoria-r54u9).
 *
 * Defect: the controller skipped ownership validation after findUnique, so
 * any authenticated user could enumerate any horse's full earnings history
 * (prizeWon + per-show entrant count via _count.competitionResults). The
 * route had requireOwnership middleware, but the controller relied on it
 * alone — a routing refactor that detached the middleware would silently
 * re-open the leak.
 *
 * Fix: controller-level ownership check (defense-in-depth) returns 404 on
 * any non-owner request, plus the _count projection was dropped from the
 * public payload (totalParticipants is now 0 by design — see controller
 * comment for the rationale and the suggested follow-up endpoint).
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import config from '../../../config/config.mjs';

const FIXTURE_PREFIX = 'TestFixture-r54u9';

let userA;
let userAToken;
let userBToken;
let horseA;
let showA;
const createdShowIds = [];
const createdCompetitionResultIds = [];
const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function makeUser(suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'IDOR',
      lastName: suffix,
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '1h',
  });
  return { user, token };
}

beforeAll(async () => {
  ({ user: userA, token: userAToken } = await makeUser('victim'));
  ({ token: userBToken } = await makeUser('attacker'));

  horseA = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horseA-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: userA.id,
      healthStatus: 'healthy',
    },
  });
  createdHorseIds.push(horseA.id);

  // Plant a competition result so the owner-positive case has data to assert
  // _count was actually dropped (a horse with zero results would skip the
  // mapping branch entirely and not exercise the projection).
  const pastRunDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  showA = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: pastRunDate,
      status: 'completed',
      openDate: new Date(pastRunDate.getTime() - 8 * 24 * 60 * 60 * 1000),
      closeDate: new Date(pastRunDate.getTime() - 1 * 24 * 60 * 60 * 1000),
      createdByUserId: userA.id,
    },
  });
  createdShowIds.push(showA.id);

  const cr = await prisma.competitionResult.create({
    data: {
      showId: showA.id,
      horseId: horseA.id,
      score: 95,
      placement: '1st',
      discipline: 'Dressage',
      runDate: pastRunDate,
      showName: showA.name,
      prizeWon: 500,
    },
  });
  createdCompetitionResultIds.push(cr.id);

  // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: competitionResults
  // (showId/horseId) first, then shows, then horses, then users — Horse.userId
  // is onDelete:Restrict (schema:282), so the owned horses MUST be deleted
  // before their owning users. Callbacks read the created-id arrays at run()
  // time, so they capture every id pushed during setup. All deletes are
  // id-scoped .deleteMany — already-gone rows are a no-op (not P2025); a real
  // scope/FK failure reds afterAll instead of being swallowed.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { id: { in: createdCompetitionResultIds } } }),
    'competitionResults',
  );
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: createdShowIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/horses/:horseId/competition-history — IDOR sentinel (Equoria-r54u9)', () => {
  it("SENTINEL: User B cannot read User A's horse competition history (returns 404, not 403 — CWE-639)", async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseA.id}/competition-history`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(404);
    expect(res.body?.success).toBe(false);
    expect(res.body?.message).toBe('Horse not found');
    // Critically: no prizeWon, no entrant counts, no horseName leak.
    expect(res.body).not.toHaveProperty('competitions');
    expect(res.body).not.toHaveProperty('statistics');
    expect(res.body).not.toHaveProperty('horseName');
  });

  it('SENTINEL (projection): owner reads their own history; _count is dropped — totalParticipants is 0 not the real entrant count', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseA.id}/competition-history`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.horseId).toBe(horseA.id);
    expect(res.body.statistics.totalCompetitions).toBe(1);
    expect(res.body.statistics.totalPrizeMoney).toBe(500);
    expect(res.body.competitions).toHaveLength(1);
    // The _count projection was dropped per Equoria-r54u9. totalParticipants
    // is now always 0 (not the real entrant count). This sentinel locks the
    // projection — restoring _count would flip this to a non-zero value and
    // fail the test, surfacing the regression.
    expect(res.body.competitions[0].totalParticipants).toBe(0);
    expect(res.body.competitions[0].prizeMoney).toBe(500);
  });
});
