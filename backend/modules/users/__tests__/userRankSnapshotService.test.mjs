/**
 * Integration Test: userRankSnapshotService (Equoria-dbdk)
 *
 * Real DB. Verifies that captureAllUserRankSnapshots() writes 4 snapshot rows
 * (level, xp, horse-earnings, horse-performance) for at least each user
 * that exists in the database — using a fixture user as the sentinel.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { captureAllUserRankSnapshots } from '../../leaderboards/services/userRankSnapshotService.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const PREFIX = `TestFixture-RankSnap-${UNIQUE}-`;

let fixtureUser;

beforeAll(async () => {
  fixtureUser = await prisma.user.create({
    data: {
      id: `${PREFIX}user`,
      email: `${PREFIX}user@test.local`,
      username: `${PREFIX}user`,
      password: 'irrelevant-for-this-test',
      firstName: 'Test',
      lastName: 'Snap',
      level: 1,
      xp: 0,
    },
  });
});

afterAll(async () => {
  await prisma.userRankSnapshot.deleteMany({ where: { userId: fixtureUser.id } });
  await prisma.user.deleteMany({ where: { id: fixtureUser.id } });
});

describe('captureAllUserRankSnapshots (Equoria-dbdk)', () => {
  it('writes four snapshot rows (one per category) for the fixture user', async () => {
    const before = await prisma.userRankSnapshot.count({ where: { userId: fixtureUser.id } });

    const result = await captureAllUserRankSnapshots();

    // The pass walks every user, so captured >= 1 (our fixture user, plus any
    // others in the real DB).
    expect(result.captured).toBeGreaterThanOrEqual(1);

    const after = await prisma.userRankSnapshot.count({ where: { userId: fixtureUser.id } });
    // captureAllUserRankSnapshots() is a GLOBAL pass with a real-DB side
    // effect: it snapshots EVERY user, writing exactly one row per category
    // per user per invocation. Equoria-3gk21: a concurrent suite that also
    // calls captureAllUserRankSnapshots() (e.g. the sibling perf suites)
    // between our `before` and `after` counts legitimately snapshots our
    // fixture user a second time — so `after - before` is 8, not 4. The
    // brittle `toBe(4)` assumed this suite is the only caller, violating
    // CLAUDE.md §2 (never assume test data dominates the real DB). The true
    // invariant of a single pass is: a POSITIVE MULTIPLE OF 4 rows added
    // (one full {level,xp,horse-earnings,horse-performance} set per pass),
    // never a partial set.
    const delta = after - before;
    expect(delta).toBeGreaterThanOrEqual(4);
    expect(delta % 4).toBe(0);

    const categories = await prisma.userRankSnapshot.findMany({
      where: { userId: fixtureUser.id },
      select: { category: true },
    });
    const categorySet = new Set(categories.map(c => c.category));
    expect(categorySet.has('level')).toBe(true);
    expect(categorySet.has('xp')).toBe(true);
    expect(categorySet.has('horse-earnings')).toBe(true);
    expect(categorySet.has('horse-performance')).toBe(true);
    // No category may be missing AND no spurious category may appear,
    // regardless of how many concurrent passes ran.
    expect([...categorySet].sort()).toEqual(['horse-earnings', 'horse-performance', 'level', 'xp']);
  });
});
