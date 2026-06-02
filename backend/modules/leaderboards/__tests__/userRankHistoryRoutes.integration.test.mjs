/**
 * userRankHistoryRoutes.integration.test.mjs
 *
 * Real-DB integration test for GET /api/v1/leaderboards/rank-history/:userId
 * (Equoria-l332 backend half).
 *
 * Coverage:
 *   - unauthenticated → 401
 *   - malformed / cross-user id → 403 (ownership guard runs first)
 *   - cross-user access (own token, someone else's id) → 403 (ownership)
 *   - own id, no snapshots → 200 with empty series (honest empty state)
 *   - own id, seeded snapshots → 200 grouped into ascending series per category
 *   - ?days window excludes snapshots older than the window
 *
 * NO MOCKS — real backend, real Prisma, real auth, real DB. Fixtures are
 * scoped + cleaned up by explicit ID (CLAUDE.md REAL DB ONLY rule).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: GET /api/v1/leaderboards/rank-history/:userId (Equoria-l332)', () => {
  let ownerUser;
  let ownerToken;
  let otherUser;
  let otherToken;
  const snapshotIds = [];

  beforeAll(async () => {
    const ts = Date.now();

    const owner = await createTestUser({
      username: `rankhist_owner_${ts}`,
      email: `rankhist_owner_${ts}@test.com`,
      level: 5,
      xp: 100,
    });
    ownerUser = owner.user;
    ownerToken = owner.token;

    const other = await createTestUser({
      username: `rankhist_other_${ts}`,
      email: `rankhist_other_${ts}@test.com`,
      level: 3,
      xp: 50,
    });
    otherUser = other.user;
    otherToken = other.token;

    // Seed snapshots for the owner: 'level' improving over 3 weeks (all
    // within the 30-day window) + one 'xp' snapshot 100 days ago (inside the
    // default 365-day window but OUTSIDE a 30-day window) to exercise the
    // ?days filter boundary.
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const rows = [
      { userId: ownerUser.id, category: 'level', rank: 14, capturedAt: new Date(now - 21 * day) },
      { userId: ownerUser.id, category: 'level', rank: 9, capturedAt: new Date(now - 14 * day) },
      { userId: ownerUser.id, category: 'level', rank: 6, capturedAt: new Date(now - 7 * day) },
      { userId: ownerUser.id, category: 'xp', rank: 30, capturedAt: new Date(now - 100 * day) },
    ];
    for (const r of rows) {
      const created = await prisma.userRankSnapshot.create({ data: r });
      snapshotIds.push(created.id);
    }
  }, 120000);

  afterAll(async () => {
    try {
      if (snapshotIds.length) {
        await prisma.userRankSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
      }
      const ids = [ownerUser?.id, otherUser?.id].filter(Boolean);
      if (ids.length) {
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } catch (err) {
      console.error('[userRankHistoryRoutes cleanup] afterAll error:', err.message);
    }
    await cleanupTestData();
  }, 120000);

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/rank-history/${ownerUser.id}`)
      .set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a malformed userId (never leaks id validity to a non-owner)', async () => {
    // A malformed id can never equal the caller's own UUID, so the ownership
    // guard rejects it with 403 before the controller's UUID check. This is
    // intentional defense-in-depth — the endpoint must not reveal whether an
    // arbitrary id is well-formed to anyone but its owner.
    const res = await request(app)
      .get('/api/v1/leaderboards/rank-history/not-a-uuid')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when requesting another user's rank history", async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/rank-history/${ownerUser.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty series when the user has no snapshots', async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/rank-history/${otherUser.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(otherUser.id);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.series).toHaveLength(0);
  });

  it("returns the owner's snapshots grouped into ascending series per category", async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/rank-history/${ownerUser.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(ownerUser.id);

    const byCat = Object.fromEntries(res.body.series.map(s => [s.category, s]));

    // 'level' has 3 points ordered ascending by capturedAt
    expect(byCat.level).toBeDefined();
    expect(byCat.level.categoryLabel).toBe('Level');
    expect(byCat.level.points).toHaveLength(3);
    const ranks = byCat.level.points.map(p => p.rank);
    expect(ranks).toEqual([14, 9, 6]);
    const times = byCat.level.points.map(p => new Date(p.capturedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));

    // 'xp' snapshot is 100 days old → present under the default 365d window
    expect(byCat.xp).toBeDefined();
    expect(byCat.xp.points).toHaveLength(1);
  });

  it('excludes snapshots older than the ?days window', async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/rank-history/${ownerUser.id}?days=30`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);

    const cats = res.body.series.map(s => s.category);
    // 'level' snapshots are within 21 days → present
    expect(cats).toContain('level');
    // 'xp' snapshot is 100 days old → excluded by the 30-day window
    expect(cats).not.toContain('xp');
  });
});
