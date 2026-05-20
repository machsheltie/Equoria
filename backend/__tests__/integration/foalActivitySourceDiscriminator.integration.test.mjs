/**
 * FoalActivity source-discriminator enforcement — real-DB sentinel tests
 * (Equoria-8yhe3).
 *
 * Background: FoalActivity has two DISJOINT-BY-DESIGN writers (Equoria-2emg):
 *   - groomController.recordInteraction -> taskLog-driving GROOM stream
 *   - foalModel.completeActivity         -> legacy foal ENRICHMENT-day stream
 * Pre-8yhe3, deriveTaskCountsFromActivities did a blind groupBy(activityType)
 * with NO source filter, so the disjointness was an UNENFORCED naming
 * convention. If an enrichment activityType ever collided with a groom
 * interactionType, the enrichment rows would inflate that taskLog key via the
 * reconcile Math.max merge — a real double-count vector into trait-driving
 * counts.
 *
 * 8yhe3 adds a `source` discriminator and filters the derivation to the groom
 * stream (NULL legacy rows count as groom; enrichment rows are EXCLUDED). These
 * sentinels PROVE the enforcement fires: a planted enrichment-source row with
 * an activityType that COLLIDES with a counted groom key is NOT counted.
 *
 * Real canonical DB, no mocks (CLAUDE.md Testing Philosophy). Cleanup is
 * strictly id-scoped (CLAUDE.md §2).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import {
  FOAL_ACTIVITY_SOURCE,
  deriveTaskCountsFromActivities,
  deriveTotalActivityCount,
  reconcileTaskLogFromActivities,
} from '../../utils/foalActivityStore.mjs';

let user;
let foal;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `8yhe3-${randomBytes(4).toString('hex')}@test.com`,
      username: `u8yhe3${randomBytes(5).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Source',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-8yhe3-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
      taskLog: {},
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.foalActivity.deleteMany({ where: { foalId: foal.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

describe('FoalActivity source-discriminator enforcement (Equoria-8yhe3)', () => {
  // The collision activityType: deliberately use the SAME string for a groom
  // row and an enrichment row. Pre-8yhe3 the blind groupBy would have summed
  // both into one count. The discriminator must exclude the enrichment row.
  const COLLISION_TASK = 'trust_building';

  it('SENTINEL: a planted enrichment-source row is NOT counted, even when its activityType collides with a counted groom key', async () => {
    // Two groom-source rows for the collision task → these SHOULD be counted.
    for (let i = 0; i < 2; i += 1) {
      await prisma.foalActivity.create({
        data: {
          foalId: foal.id,
          day: 0,
          activityType: COLLISION_TASK,
          outcome: 'good',
          bondingChange: 2,
          stressChange: -1,
          description: 'groom-stream event',
          source: FOAL_ACTIVITY_SOURCE.GROOM_INTERACTION,
        },
      });
    }
    // One ENRICHMENT-source row with the SAME activityType → MUST be excluded.
    await prisma.foalActivity.create({
      data: {
        foalId: foal.id,
        day: 0,
        activityType: COLLISION_TASK,
        outcome: 'good',
        bondingChange: 1,
        stressChange: 0,
        description: 'enrichment-stream collision event',
        source: FOAL_ACTIVITY_SOURCE.ENRICHMENT_ACTIVITY,
      },
    });

    const derived = await deriveTaskCountsFromActivities(foal.id);
    // Enforcement fires: count is 2 (groom rows only), NOT 3.
    // Without the source filter this would be 3 — the planted enrichment row
    // would have leaked into the trait-driving count.
    expect(derived[COLLISION_TASK]).toBe(2);

    // deriveTotalActivityCount is also source-scoped: 2 groom rows, NOT 3.
    // (3 FoalActivity rows physically exist for this foal — 1 is enrichment.)
    expect(await deriveTotalActivityCount(foal.id)).toBe(2);
    expect(await prisma.foalActivity.count({ where: { foalId: foal.id } })).toBe(3);
  });

  it('legacy NULL-source rows are still counted (treated as groom-origin)', async () => {
    // Pre-8yhe3 rows carry source = NULL. Write one directly (mirrors the
    // canonical integration test which omits source) and confirm it counts.
    await prisma.foalActivity.create({
      data: {
        foalId: foal.id,
        day: 1,
        activityType: 'legacy_null_task',
        outcome: 'good',
        bondingChange: 1,
        stressChange: 0,
        description: 'pre-8yhe3 legacy row (no source column written)',
        // source intentionally omitted → NULL
      },
    });

    const derived = await deriveTaskCountsFromActivities(foal.id);
    expect(derived.legacy_null_task).toBe(1);
    // And the collision groom count is still exactly 2 (enrichment still excluded).
    expect(derived[COLLISION_TASK]).toBe(2);
  });

  it('reconcile derives the groom-only floor (enrichment collision does NOT inflate taskLog) and is idempotent', async () => {
    const first = await reconcileTaskLogFromActivities(foal.id);
    expect(first.changed).toBe(true);
    // taskLog reflects groom-only counts: the collision key is 2, NOT 3.
    expect(first.after[COLLISION_TASK]).toBe(2);
    expect(first.after.legacy_null_task).toBe(1);

    // Persisted cache matches the source-filtered derivation (no double-count).
    const horse = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { taskLog: true },
    });
    const derived = await deriveTaskCountsFromActivities(foal.id);
    for (const [task, count] of Object.entries(derived)) {
      expect(horse.taskLog[task]).toBe(count);
    }

    // Idempotent: a second reconcile is a no-op.
    const second = await reconcileTaskLogFromActivities(foal.id);
    expect(second.changed).toBe(false);
    expect(second.before).toEqual(second.after);
  });
});
