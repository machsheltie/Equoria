/**
 * leaderboardAveragePlacementMetric.integration.test.mjs
 *
 * Equoria-6lobd — GET /api/v1/leaderboards/competition?metric=average_placement
 * must return 200 with a correct numeric average, not a 500.
 *
 * Pre-fix defect: groupAveragePlacementByHorse() called prisma.groupBy with
 * `_avg: { placement: true }` / `orderBy: { _avg: { placement: 'asc' } }`,
 * but `CompetitionResult.placement` is a String? column — Prisma only allows
 * _avg on numeric fields, so every request with this metric threw
 * PrismaClientValidationError and the route's catch returned HTTP 500.
 *
 * This suite fails RED before the fix (500 where 200 is asserted) and locks
 * the post-fix contract:
 *   - 200 with a correct per-horse average placement, ascending (lower = better)
 *   - ordinal-encoded placements ('1st') parse by leading digits, consistent
 *     with placementToNumber()/parseCompetitionPlacement() elsewhere
 *   - non-numeric placements (e.g. 'DQ') are excluded from BOTH the average
 *     and the competitionCount shown next to it (honest count of the n
 *     actually averaged)
 *   - horses with fewer than 3 numeric placements are excluded (HAVING >= 3)
 *
 * NO MOCKS — real backend, real Prisma, real auth, real DB. Fixtures scoped
 * (TestFixture-6lobd- prefix + per-run random suffix) and cleaned up by
 * explicit ID (CLAUDE.md REAL DB ONLY rule). Assertions locate fixture rows
 * by horseId and assert RELATIVE order — they never assume the fixtures
 * dominate the leaderboard.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: GET /api/v1/leaderboards/competition metric=average_placement (Equoria-6lobd)', () => {
  const suffix = randomBytes(6).toString('hex');
  const DISCIPLINE = 'Dressage';

  let token;
  let userId;
  let horseA; // placements '1st','2','3','1'  -> avg 1.75, count 4
  let horseB; // placements '2','3','4','3','DQ' -> avg 3.0, count 4 (DQ excluded)
  let horseC; // placements '1','1'            -> excluded (fewer than 3)
  let horseD; // placements '2','2','2'        -> exactly 3: the HAVING boundary, included
  const horseIds = [];
  const showIds = [];

  async function createShow(i) {
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-6lobd-show-${i}-${suffix}`,
        discipline: DISCIPLINE,
        runDate: new Date(),
        prize: 1000,
        entryFee: 100,
        levelMin: 1,
        levelMax: 10,
      },
    });
    showIds.push(show.id);
    return show;
  }

  async function createResult(horseId, showId, placement) {
    await prisma.competitionResult.create({
      data: {
        horseId,
        showId,
        showName: `TestFixture-6lobd-show-${suffix}`,
        discipline: DISCIPLINE,
        placement,
        prizeWon: 0,
        score: 80.0,
        runDate: new Date(),
      },
    });
  }

  beforeAll(async () => {
    const u = await createTestUser({
      username: `TF6lobd_${suffix}`,
      email: `tf6lobd_${suffix}@test.com`,
    });
    token = u.token;
    userId = u.user.id;

    horseA = await createTestHorse({ name: `TestFixture-6lobd-A-${suffix}`, userId });
    horseB = await createTestHorse({ name: `TestFixture-6lobd-B-${suffix}`, userId });
    horseC = await createTestHorse({ name: `TestFixture-6lobd-C-${suffix}`, userId });
    horseD = await createTestHorse({ name: `TestFixture-6lobd-D-${suffix}`, userId });
    horseIds.push(horseA.id, horseB.id, horseC.id, horseD.id);

    // @@unique([showId, horseId]) — one show may hold one result per horse,
    // so five shows cover the widest fixture (horse B has 5 results).
    const shows = [];
    for (let i = 0; i < 5; i++) {
      shows.push(await createShow(i));
    }

    // Horse A — mixed ordinal + plain numeric encodings (the f46tb split):
    // (1 + 2 + 3 + 1) / 4 = 1.75
    await createResult(horseA.id, shows[0].id, '1st');
    await createResult(horseA.id, shows[1].id, '2');
    await createResult(horseA.id, shows[2].id, '3');
    await createResult(horseA.id, shows[3].id, '1');

    // Horse B — four numeric placements + one non-numeric 'DQ' row:
    // (2 + 3 + 4 + 3) / 4 = 3.0; DQ must not enter avg or count.
    await createResult(horseB.id, shows[0].id, '2');
    await createResult(horseB.id, shows[1].id, '3');
    await createResult(horseB.id, shows[2].id, '4');
    await createResult(horseB.id, shows[3].id, '3');
    await createResult(horseB.id, shows[4].id, 'DQ');

    // Horse C — only two numeric placements: below the minimum of 3.
    await createResult(horseC.id, shows[0].id, '1');
    await createResult(horseC.id, shows[1].id, '1');

    // Horse D — EXACTLY 3 numeric placements: the HAVING >= 3 boundary.
    // (2 + 2 + 2) / 3 = 2.0 — must be included, ranked between A and B.
    await createResult(horseD.id, shows[0].id, '2');
    await createResult(horseD.id, shows[1].id, '2');
    await createResult(horseD.id, shows[2].id, '2');
  }, 120000);

  afterAll(async () => {
    // Scoped, id-based cleanup only (CLAUDE.md §3).
    if (horseIds.length > 0) {
      await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
    }
    if (showIds.length > 0) {
      await prisma.show.deleteMany({ where: { id: { in: showIds } } });
    }
    if (horseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  }, 120000);

  it('returns 200 with correct ascending averages (was a guaranteed 500 pre-fix)', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/competition')
      .query({ metric: 'average_placement', discipline: DISCIPLINE, limit: 100 })
      .set('Authorization', `Bearer ${token}`);

    // Pre-fix: PrismaClientValidationError (_avg on String column) -> 500.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.filters.metric).toBe('average_placement');

    const leaderboard = res.body.data.leaderboard;
    expect(Array.isArray(leaderboard)).toBe(true);

    const rowA = leaderboard.find(r => r.horseId === horseA.id);
    const rowB = leaderboard.find(r => r.horseId === horseB.id);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    // Horse A: ordinal '1st' parses as 1 -> (1+2+3+1)/4 = 1.75.
    expect(rowA.averagePlacement).toBeCloseTo(1.75, 5);
    expect(rowA.value).toBeCloseTo(1.75, 5);
    expect(rowA.metric).toBe('average_placement');
    expect(rowA.competitionCount).toBe(4);

    // Horse B: 'DQ' excluded from both average and count -> 3.0 over 4 rows.
    expect(rowB.averagePlacement).toBeCloseTo(3.0, 5);
    expect(rowB.competitionCount).toBe(4);

    // Horse D: exactly 3 numeric placements — the HAVING >= 3 boundary —
    // must be INCLUDED, with avg 2.0 over its 3 rows.
    const rowD = leaderboard.find(r => r.horseId === horseD.id);
    expect(rowD).toBeDefined();
    expect(rowD.averagePlacement).toBeCloseTo(2.0, 5);
    expect(rowD.competitionCount).toBe(3);

    // Lower average ranks higher (ascending). Other horses may interleave,
    // so assert relative order, not adjacency: A (1.75) < D (2.0) < B (3.0).
    expect(leaderboard.indexOf(rowA)).toBeLessThan(leaderboard.indexOf(rowD));
    expect(leaderboard.indexOf(rowD)).toBeLessThan(leaderboard.indexOf(rowB));
  }, 60000);

  it('excludes horses with fewer than 3 numeric placements (minimum-sample rule)', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/competition')
      .query({ metric: 'average_placement', discipline: DISCIPLINE, limit: 100 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const leaderboard = res.body.data.leaderboard;
    expect(leaderboard.find(r => r.horseId === horseC.id)).toBeUndefined();
  }, 60000);
});
