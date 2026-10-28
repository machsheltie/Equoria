/**
 * leaderboardController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getUserRankSummary. All leaderboard routes require auth (authRouter).
 *
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the stats, horses/earnings,
 * recent-winners and horses/performance (Equoria-847r) cases went with those
 * duplicate routes; the Leaderboards page reads GET /leaderboards/boards/:board.
 *
 * Equoria-ombe: getUserRankSummary must return 400 for non-UUID userId.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

// Equoria-0hgpw: FK-ordered, fail-loud suite cleanup. Horse.userId is
// onDelete: Restrict (schema.prisma:282) — any fixture horse this suite leaves
// behind (e.g. a per-test `finally` that did not run) makes prisma.user.delete
// throw P2003/horses_userId_fkey. The old top-level afterAll deleted ONLY the
// user with a swallowed no-op catch arm, so such a leak was hidden AND the
// row leaked into the canonical DB. We now sweep this user's horses (and any
// fixture shows/results they spawned) BEFORE the user, all scoped to ids/this
// suite's name sentinel, and fail loud if any delete fails.
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `lb-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `lb${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'LB',
      lastName: 'Tester',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Register scoped, FK-ordered cleanup: competition results → shows/horses →
  // user. The win-rate test below also deletes its own fixtures in a `finally`;
  // these sweeps are the defensive backstop so a skipped `finally` (or a
  // future test that forgets one) can never leak a horse and FK-block the
  // user delete. All scoped to this suite's user id / name sentinel.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { horse: { userId: user.id } } }),
    'competitionResults',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-WinRateShow-' } } }), 'shows');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/leaderboards/user-summary/:userId (Equoria-ombe)', () => {
  it('returns 200 with rank summary for the authenticated user', async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/user-summary/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
  });

  it('returns 200 with empty rankings for a non-existent valid-UUID userId', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/user-summary/00000000-0000-0000-0000-000000000000')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userName).toBe('Unknown');
    expect(Array.isArray(res.body.rankings)).toBe(true);
  });

  it('returns 400 for a malformed non-UUID userId (Equoria-ombe)', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/user-summary/not-a-uuid')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid userId format');
  });

  it('returns 400 for a numeric userId', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/user-summary/12345')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid userId format');
  });
});
