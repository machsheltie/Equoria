/**
 * 🛡️ SENTINEL: scoped cleanup must NOT wipe non-fixture (real) rows.
 *
 * Guards Equoria-5bwdl / Equoria-seahi class: an unscoped `deleteMany({})` in a
 * test that runs against the canonical DB (CLAUDE.md §2) destroys all real
 * users. This sentinel exercises the REAL cleanup helper
 * (tests/helpers/scopedTestCleanup.mjs#cleanupProgressionFixtures):
 *
 *   - proves the helper DELETES its fixture targets (not a no-op), and
 *   - proves the helper SPARES a non-fixture "survivor" row.
 *
 * If anyone reverts the helper to `deleteMany({})`, the survivor row is
 * deleted and this test fails — the sentinel-positive guarantee
 * (OPTIMAL_FIX_DISCIPLINE §2). Self-cleanup is id-scoped.
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../packages/database/prismaClient.mjs';
import {
  cleanupProgressionFixtures,
  PROGRESSION_TEST_USER_IDS,
} from './helpers/scopedTestCleanup.mjs';

describe('🛡️ SENTINEL: cleanupProgressionFixtures is scoped (no canonical-DB wipe)', () => {
  it('deletes fixture users but spares a non-fixture survivor', async () => {
    const fixtureId = PROGRESSION_TEST_USER_IDS[0]; // 'test-user-1'
    const survivorId = `SENTINEL-survivor-${Date.now()}`;
    const survivorEmail = `${survivorId}@sentinel.example`;

    try {
      // A fixture row the helper SHOULD delete.
      await prisma.user.create({
        data: {
          id: fixtureId,
          username: 'SentinelFixtureUser',
          firstName: 'Sentinel',
          lastName: 'Fixture',
          email: 'sentinel-fixture@example.com',
          password: 'hashedpassword',
          level: 1,
          xp: 0,
          money: 0,
        },
      });
      await prisma.xpEvent.create({
        data: { userId: fixtureId, amount: 5, reason: 'sentinel-fixture' },
      });

      // A non-fixture "real user" row the helper MUST NOT touch.
      await prisma.user.create({
        data: {
          id: survivorId,
          username: `Survivor-${Date.now()}`,
          firstName: 'Real',
          lastName: 'Survivor',
          email: survivorEmail,
          password: 'hashedpassword',
          level: 7,
          xp: 42,
          money: 999,
        },
      });
      await prisma.xpEvent.create({
        data: { userId: survivorId, amount: 11, reason: 'sentinel-survivor' },
      });

      // Run the REAL cleanup helper used by the progression suite.
      await cleanupProgressionFixtures(prisma);

      // Fixture user + its xpEvents are gone (helper actually deletes its targets).
      expect(await prisma.user.findUnique({ where: { id: fixtureId } })).toBeNull();
      expect(await prisma.xpEvent.count({ where: { userId: fixtureId } })).toBe(0);

      // Survivor (non-fixture) row is untouched — proves the scope.
      const survivor = await prisma.user.findUnique({ where: { id: survivorId } });
      expect(survivor).not.toBeNull();
      expect(survivor.email).toBe(survivorEmail);
      expect(await prisma.xpEvent.count({ where: { userId: survivorId } })).toBe(1);
    } finally {
      // Scoped self-cleanup — never unscoped.
      await prisma.xpEvent.deleteMany({ where: { userId: { in: [survivorId, fixtureId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [survivorId, fixtureId] } } });
    }
  });
});
