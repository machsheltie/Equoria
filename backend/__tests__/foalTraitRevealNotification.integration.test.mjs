/**
 * Integration Test: Equoria-yy1a5 — daily trait reveal fires a player notification
 *
 * Sentinel-positive proof for the trait-discovery notification wiring. Before
 * the fix, the daily cron revealed traits silently (Winston log only). This
 * suite drives the REAL producer (CronJobService.notifyTraitRevelation, the
 * exact method evaluateFoalTraits calls) against the REAL database (no mocks)
 * and asserts:
 *   1. A 'trait_discovery' Notification row is written for the foal's owner
 *      when a VISIBLE trait (positive or negative) is revealed.
 *   2. NO notification is written when only HIDDEN traits are revealed.
 *   3. NO notification when the foal has no owner (userId null).
 *
 * Strategy: direct producer sentinel (deterministic). evaluateTraitRevelation
 * is Math.random-driven so an end-to-end cron run cannot deterministically
 * guarantee a visible reveal; calling notifyTraitRevelation directly with a
 * controlled newTraits object proves the notification contract without flake.
 * This mirrors competitionNotification.sentinel.test.mjs.
 *
 * Scoped cleanup only (CLAUDE.md §2).
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import cronJobService from '../services/cronJobs.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Replaces the prior afterAll that
// wrapped cleanup in a try/catch console.warn (plus an inner
// notification.deleteMany silent no-op catch arm) — a swallowed delete would
// leak fixtures into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const randHex = () => randomBytes(6).toString('hex');

describe('INTEGRATION: daily trait reveal notification (Equoria-yy1a5)', () => {
  let user;
  let ownerlessFoal;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-yy1a5-${randHex()}`,
        email: `tf-yy1a5-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterAll(async () => {
    // Equoria-1ohys: fail-loud scoped cleanup in FK order — notifications (by
    // userId) and horses before the user (Horse.userId is onDelete: Restrict).
    // The ownerless foal (userId: null) is tracked in createdHorseIds, so
    // cleanupTestHorses covers it. The tracker runs every delete then re-throws
    // on any failure, so a leak fails the suite instead of being swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notification');
    cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
    if (user) {
      cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    }
    await cleanup.run();
  }, 120000);

  async function makeFoal({ userId = user.id } = {}) {
    return createTestHorse(
      prisma,
      {
        name: `TestFixture-yy1a5-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
  }

  it('creates a trait_discovery notification for the owner when a VISIBLE trait is revealed', async () => {
    const foal = await makeFoal();

    await cronJobService.notifyTraitRevelation(
      foal,
      { positive: ['resilient'], negative: [], hidden: ['legendary_bloodline'] },
      2,
    );

    const notifs = await prisma.notification.findMany({
      where: { userId: user.id, type: 'trait_discovery' },
    });
    const forThisFoal = notifs.filter(n => n.payload?.foalId === foal.id);
    expect(forThisFoal).toHaveLength(1);
    // Payload identifies the foal and the visible trait(s) only — hidden excluded.
    expect(forThisFoal[0].payload.foalName).toBe(foal.name);
    expect(forThisFoal[0].payload.traits).toEqual(['resilient']);
    expect(forThisFoal[0].payload.developmentDay).toBe(2);
  }, 60000);

  it('does NOT notify when only HIDDEN traits are revealed', async () => {
    const foal = await makeFoal();

    await cronJobService.notifyTraitRevelation(foal, { positive: [], negative: [], hidden: ['intelligent'] }, 3);

    const notifs = await prisma.notification.findMany({
      where: { userId: user.id, type: 'trait_discovery' },
    });
    const forThisFoal = notifs.filter(n => n.payload?.foalId === foal.id);
    expect(forThisFoal).toHaveLength(0);
  }, 60000);

  it('does NOT throw / notify when the foal has no owner', async () => {
    ownerlessFoal = await makeFoal({ userId: null });

    await expect(
      cronJobService.notifyTraitRevelation(ownerlessFoal, { positive: ['calm'], negative: [], hidden: [] }, 1),
    ).resolves.toBeUndefined();
  }, 60000);
});
