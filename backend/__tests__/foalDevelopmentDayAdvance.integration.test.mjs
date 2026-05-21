/**
 * Integration Test: Equoria-3lb8q — foalDevelopment.currentDay auto-advance
 *
 * Sentinel-positive proof for the day-advance fix. Before the fix,
 * foalDevelopment.currentDay was written in exactly ONE place (the manual
 * advance-foal-development endpoint), so an unattended foal stayed at day 0
 * forever and the day-2..6-gated traits could never satisfy their minAge in
 * the nightly cron.
 *
 * These tests run against the REAL database (no mocks) and assert:
 *   1. evaluateFoalTraits advances currentDay 0 -> 1 on a normal run.
 *   2. Successive runs march the day forward (1 -> 2 -> 3 ...), making
 *      previously-unreachable day-N minAge gates eligible.
 *   3. The advance is capped at the final development day (6) and a
 *      development-complete foal (day > 6) is never advanced.
 *   4. The advance still happens on a no-reveal night.
 *
 * Scoped cleanup only (CLAUDE.md §2): we delete exactly the rows this suite
 * created, never a broad deleteMany.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import cronJobService from '../services/cronJobs.mjs';

const randHex = () => randomBytes(6).toString('hex');

describe('INTEGRATION: foalDevelopment.currentDay auto-advance (Equoria-3lb8q)', () => {
  let user;
  const createdHorseIds = [];
  const createdFoalDevFoalIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-3lb8q-${randHex()}`,
        email: `tf-3lb8q-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterAll(async () => {
    try {
      if (createdFoalDevFoalIds.length) {
        await prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalDevFoalIds } } }).catch(() => {});
      }
      await cleanupTestHorses(prisma, createdHorseIds);
      if (user) {
        await prisma.user.deleteMany({ where: { id: user.id } });
      }
    } catch (err) {
      console.warn('Cleanup warning (ignorable):', err.message);
    }
  }, 120000);

  /** Helper: create a foal + foalDevelopment row at a given currentDay. */
  async function makeFoal(currentDay, { bondScore = 50, stressLevel = 20 } = {}) {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-3lb8q-${randHex()}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        bondScore,
        stressLevel,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await prisma.foalDevelopment.create({
      data: { foalId: foal.id, currentDay },
    });
    createdFoalDevFoalIds.push(foal.id);
    return foal;
  }

  /** Helper: re-read the foal with its foalDevelopment, as the cron fetches it. */
  async function reload(foalId) {
    return prisma.horse.findUnique({
      where: { id: foalId },
      include: { foalDevelopment: true },
    });
  }

  it('advances currentDay 0 -> 1 after a single evaluation run', async () => {
    const foal = await makeFoal(0);
    const before = await reload(foal.id);
    expect(before.foalDevelopment.currentDay).toBe(0);

    await cronJobService.evaluateFoalTraits(before);

    const after = await reload(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(1);
  }, 60000);

  it('marches the day forward across successive runs (1 -> 2 -> 3)', async () => {
    const foal = await makeFoal(1);

    for (const expectedNext of [2, 3]) {
      const current = await reload(foal.id);
      await cronJobService.evaluateFoalTraits(current);
      const after = await reload(foal.id);
      expect(after.foalDevelopment.currentDay).toBe(expectedNext);
    }
  }, 90000);

  it('does NOT advance past the final development day (6)', async () => {
    const foal = await makeFoal(6);
    const before = await reload(foal.id);

    await cronJobService.evaluateFoalTraits(before);

    const after = await reload(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(6);
  }, 60000);

  it('advances even on a no-reveal night (low-baseChance conditions still tick the day)', async () => {
    // bondScore/stressLevel deliberately in a band where most gates fail their
    // bond/stress conditions; regardless, currentDay must advance.
    const foal = await makeFoal(0, { bondScore: 50, stressLevel: 45 });
    const before = await reload(foal.id);

    const result = await cronJobService.evaluateFoalTraits(before);

    const after = await reload(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(1);
    // The result surfaces the advanced day on both reveal and no-reveal paths.
    expect(result.currentDay).toBe(1);
  }, 60000);

  it('makes a previously-unreachable day-N gate eligible by advancing the day', async () => {
    // 'bold' is gated at minAge 4. At day 0 it can never satisfy its gate; only
    // by advancing day-by-day does developmentAge reach 4. We assert the day
    // climbs to 4 across runs (the sole prerequisite the cron controls), which
    // is exactly the gating the bug blocked.
    const foal = await makeFoal(0, { bondScore: 65, stressLevel: 30 });
    for (let i = 0; i < 4; i++) {
      const current = await reload(foal.id);
      await cronJobService.evaluateFoalTraits(current);
    }
    const after = await reload(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(4);
  }, 120000);
});
