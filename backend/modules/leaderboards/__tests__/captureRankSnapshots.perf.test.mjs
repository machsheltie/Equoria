/**
 * Integration test: leaderboardController.captureRankSnapshots perf-shape
 * (Equoria-fiiy — sibling of the ky0x set-based rewrite).
 *
 * Real DB (canonical — no test DB per house rule). No mocks; no wall-clock
 * assertion (per the issue AC: "assert single query, not N queries").
 *
 * The defect: the admin HTTP route recomputed level/xp/earnings/performance
 * ranks INSIDE a per-user loop — ~8 DB round-trips per user (a user.count,
 * three aggregates, three full-table GROUP BY/HAVING raw queries, then 4
 * individual INSERTs). That is O(users) DB round-trips with O(full-table
 * aggregate) cost each — the same O(N²) blowup ky0x fixed in
 * userRankSnapshotService.
 *
 * PERF-SHAPE ASSERTION: we wrap the controller's prisma singleton with a
 * real $extends query interceptor that counts EVERY SQL operation issued
 * during one captureRankSnapshots() call. With the per-user loop the count
 * scales with the number of users (≈ 8 × N). With the set-based delegation
 * it is a small constant independent of N. We assert the count is bounded by
 * a constant that the per-user loop CANNOT satisfy once a handful of fixture
 * users exist, so the O(N²) regression fails this test loudly.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { captureRankSnapshots } from '../controllers/leaderboardController.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const PREFIX = `TestFixture-CapRankPerf-${UNIQUE}-`;
const fixtureUsers = [];

// Number of fixture users. The per-user loop issues ~8 queries PER user, so
// with 6 users it would issue ~48+ operations; the set-based delegation
// issues a small constant (≈ a half-dozen global reads + 1 createMany)
// REGARDLESS of user count. The ceiling below sits between those two.
const N_FIXTURE_USERS = 6;
const MAX_OPERATIONS = 25; // set-based: ~6; per-user loop with 6 users: ~48+

beforeAll(async () => {
  // Below ky0x's perf-fixture band (TOP=1_000_000) so this suite's fixtures
  // never displace that suite's absolute rank-1 assertion when the two run
  // concurrently against the canonical DB. Still far above generic real
  // users, so relative ordering among THESE fixtures is deterministic.
  const TOP = 500_000;
  for (let i = 0; i < N_FIXTURE_USERS; i++) {
    const u = await prisma.user.create({
      data: {
        id: `${PREFIX}u${i}`,
        email: `${PREFIX}u${i}@test.local`,
        username: `${PREFIX}u${i}`,
        password: 'irrelevant',
        firstName: 'CapPerf',
        lastName: `U${i}`,
        level: TOP + (N_FIXTURE_USERS - i),
        xp: TOP + (N_FIXTURE_USERS - i),
      },
    });
    fixtureUsers.push(u);
  }
});

afterAll(async () => {
  for (const u of fixtureUsers) {
    await prisma.userRankSnapshot.deleteMany({ where: { userId: u.id } });
  }
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
});

describe('captureRankSnapshots perf-shape (Equoria-fiiy)', () => {
  it('issues a bounded (constant) number of DB operations, not O(users)', async () => {
    let opCount = 0;
    // Real $extends interceptor over the real client — counts every actual
    // model + raw operation. No behaviour is stubbed; queries still hit the
    // canonical DB.
    const countingPrisma = prisma.$extends({
      query: {
        async $allOperations({ args, query }) {
          opCount += 1;
          return query(args);
        },
      },
    });

    const req = {};
    let payload = null;
    const res = {
      json: body => {
        payload = body;
        return res;
      },
      status: () => res,
    };

    await captureRankSnapshots(req, res, { prismaClient: countingPrisma });

    expect(payload?.success).toBe(true);

    // PERF-SHAPE: with N_FIXTURE_USERS=6 the old per-user loop issues far
    // more than MAX_OPERATIONS (≈8 per user → 48+). The set-based delegation
    // is a small constant independent of user count. This fails loudly if
    // the O(N²) per-user loop ever returns.
    expect(opCount).toBeLessThanOrEqual(MAX_OPERATIONS);

    // Correctness parity: assert RELATIVE ordering only (per CLAUDE.md §2 —
    // never assume test fixtures dominate the real leaderboard, and never
    // pollute other suites' absolute-rank assertions). The fixtures have
    // strictly decreasing level/xp (u0 highest … u5 lowest), so u0's level
    // rank must be strictly better (smaller) than u5's regardless of how
    // much real or other-fixture data surrounds them. This still exercises
    // the delegated set-based rank computation end to end.
    const levelRank = async id =>
      (
        await prisma.userRankSnapshot.findFirst({
          where: { userId: id, category: 'level' },
          orderBy: { capturedAt: 'desc' },
        })
      )?.rank;
    const r0 = await levelRank(fixtureUsers[0].id);
    const rLast = await levelRank(fixtureUsers[fixtureUsers.length - 1].id);
    expect(typeof r0).toBe('number');
    expect(typeof rLast).toBe('number');
    expect(r0).toBeLessThan(rLast);

    // All four categories captured for every fixture user.
    for (const u of fixtureUsers) {
      const cats = await prisma.userRankSnapshot.findMany({
        where: { userId: u.id },
        select: { category: true },
      });
      const set = new Set(cats.map(c => c.category));
      expect(set.has('level')).toBe(true);
      expect(set.has('xp')).toBe(true);
      expect(set.has('horse-earnings')).toBe(true);
      expect(set.has('horse-performance')).toBe(true);
    }
  }, 90_000);
});
