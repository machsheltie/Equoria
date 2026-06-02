/**
 * FoalActivity canonical store — real-DB invariant tests (Equoria-2emg)
 *
 * Game-design decision: "FoalActivity canonical". FoalActivity rows are the
 * single source of truth for foal-activity events; Horse.taskLog is a derived
 * O(1) count cache that MUST agree with an aggregate count over FoalActivity.
 *
 * These tests run against the real canonical DB (no mocks per CLAUDE.md
 * Testing Philosophy). Cleanup is strictly id-scoped (CLAUDE.md §2).
 *
 * Covered:
 *  1. Creating FoalActivity rows → deriveTaskCountsFromActivities returns the
 *     correct per-task counts (event creation produces canonical rows).
 *  2. Derived count equals what taskLog reports after reconcile (cache ==
 *     canonical floor) — no double-count.
 *  3. reconcileTaskLogFromActivities is idempotent (second run is a no-op).
 *  4. Legacy taskLog keys with no FoalActivity rows are preserved by reconcile
 *     (historical derivation tolerates the gap; counts not lost).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The old afterAll swallowed each
// delete with an empty catch arm, so a leaked foalActivity/horse/user
// (Horse.userId onDelete:Restrict, schema:282) stayed hidden and could trip
// the canonical NULL-phenotype sentinel (Equoria-a429/lfj5).
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import {
  deriveTaskCountsFromActivities,
  deriveTotalActivityCount,
  reconcileTaskLogFromActivities,
} from '../../utils/foalActivityStore.mjs';

const cleanup = createCleanupTracker();
let user;
let foal;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `2emg-${randomBytes(4).toString('hex')}@test.com`,
      username: `u2emg${randomBytes(5).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Canon',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-2emg-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
      taskLog: {},
    },
  });

  // Equoria-1ohys: FK order — foalActivity -> foal horse -> user.
  cleanup.add(async () => {
    await prisma.foalActivity.deleteMany({ where: { foalId: foal.id } });
    await prisma.horse.delete({ where: { id: foal.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, 'foalActivity + foal + user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('FoalActivity canonical store (Equoria-2emg)', () => {
  it('event creation produces FoalActivity rows; derived counts are correct', async () => {
    // Three "early_touch" events + two "desensitization" events.
    for (let i = 0; i < 3; i += 1) {
      await prisma.foalActivity.create({
        data: {
          foalId: foal.id,
          day: 0,
          activityType: 'early_touch',
          outcome: 'good',
          bondingChange: 2,
          stressChange: -1,
          description: 'test event',
        },
      });
    }
    for (let i = 0; i < 2; i += 1) {
      await prisma.foalActivity.create({
        data: {
          foalId: foal.id,
          day: 0,
          activityType: 'desensitization',
          outcome: 'good',
          bondingChange: 1,
          stressChange: 0,
          description: 'test event',
        },
      });
    }

    const derived = await deriveTaskCountsFromActivities(foal.id);
    expect(derived.early_touch).toBe(3);
    expect(derived.desensitization).toBe(2);

    const total = await deriveTotalActivityCount(foal.id);
    expect(total).toBe(5);
  });

  it('reconcile makes taskLog cache equal the canonical derived counts (no double-count)', async () => {
    const result = await reconcileTaskLogFromActivities(foal.id);
    expect(result.changed).toBe(true);
    expect(result.after.early_touch).toBe(3);
    expect(result.after.desensitization).toBe(2);

    // Cache invariant: persisted taskLog == derived from canonical log.
    const horse = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { taskLog: true },
    });
    const derived = await deriveTaskCountsFromActivities(foal.id);
    for (const [task, count] of Object.entries(derived)) {
      expect(horse.taskLog[task]).toBe(count);
    }
    // No double-count: total cached == total rows.
    const cachedTotal = Object.values(horse.taskLog).reduce((s, c) => s + c, 0);
    expect(cachedTotal).toBe(await deriveTotalActivityCount(foal.id));
  });

  it('reconcile is idempotent (second run is a no-op)', async () => {
    const second = await reconcileTaskLogFromActivities(foal.id);
    expect(second.changed).toBe(false);
    expect(second.before).toEqual(second.after);
  });

  it('preserves legacy taskLog keys that have no FoalActivity rows', async () => {
    // Simulate a pre-Equoria-2emg legacy count with no canonical rows.
    await prisma.horse.update({
      where: { id: foal.id },
      data: { taskLog: { early_touch: 3, desensitization: 2, legacy_only_task: 7 } },
    });

    const result = await reconcileTaskLogFromActivities(foal.id);
    // legacy_only_task has no FoalActivity rows → preserved, not dropped.
    expect(result.after.legacy_only_task).toBe(7);
    // canonical keys still equal their derived floor.
    expect(result.after.early_touch).toBe(3);
    expect(result.after.desensitization).toBe(2);
  });
});
