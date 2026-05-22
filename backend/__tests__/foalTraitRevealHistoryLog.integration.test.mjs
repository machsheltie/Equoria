/**
 * Integration Test: Equoria-bfo1t — daily cron persists revealed traits to TraitHistoryLog
 *
 * Sentinel-positive proof for the trait-history persistence fix. Before the
 * fix, the daily cron's audit path (logTraitRevelation) only emitted a Winston
 * line; the DB persistence was a commented-out `prisma.traitAuditLog.create`
 * stub for a model that never existed. This suite drives the REAL persister
 * path (CronJobService.logTraitRevelation, the exact method evaluateFoalTraits
 * calls) against the REAL database (no mocks) and asserts:
 *   1. One TraitHistoryLog row per revealed trait (positive + negative + hidden).
 *   2. sourceType reflects the daily-cron origin ('daily_evaluation').
 *   3. bondScore / stressLevel / ageInDays are persisted.
 *   4. A run that reveals nothing writes no rows.
 *
 * Scoped cleanup only (CLAUDE.md §2).
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import cronJobService from '../services/cronJobs.mjs';

const randHex = () => randomBytes(6).toString('hex');

describe('INTEGRATION: daily cron persists revealed traits to TraitHistoryLog (Equoria-bfo1t)', () => {
  let user;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-bfo1t-${randHex()}`,
        email: `tf-bfo1t-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterAll(async () => {
    try {
      if (createdHorseIds.length) {
        await prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }).catch(() => {});
      }
      await cleanupTestHorses(prisma, createdHorseIds);
      if (user) {
        await prisma.user.deleteMany({ where: { id: user.id } });
      }
    } catch (err) {
      console.warn('Cleanup warning (ignorable):', err.message);
    }
  }, 120000);

  async function makeFoal({ bondScore = 70, stressLevel = 25 } = {}) {
    return createTestHorse(
      prisma,
      {
        name: `TestFixture-bfo1t-${randHex()}`,
        sex: 'Colt',
        dateOfBirth: new Date('2026-05-15T00:00:00.000Z'),
        age: 0,
        userId: user.id,
        bondScore,
        stressLevel,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
  }

  it('writes one TraitHistoryLog row per revealed trait with daily_evaluation source', async () => {
    const foal = await makeFoal({ bondScore: 72, stressLevel: 18 });

    await cronJobService.logTraitRevelation(
      foal.id,
      foal.name,
      { positive: ['resilient'], negative: ['nervous'], hidden: ['intelligent'] },
      4,
      foal,
    );

    const rows = await prisma.traitHistoryLog.findMany({
      where: { horseId: foal.id },
      orderBy: { traitName: 'asc' },
    });

    expect(rows).toHaveLength(3);
    const names = rows.map(r => r.traitName).sort();
    expect(names).toEqual(['intelligent', 'nervous', 'resilient']);
    for (const row of rows) {
      expect(row.sourceType).toBe('daily_evaluation');
      expect(row.bondScore).toBe(72);
      expect(row.stressLevel).toBe(18);
      expect(row.isEpigenetic).toBe(true);
      // ageInDays is computed from dateOfBirth — a non-negative integer.
      expect(Number.isInteger(row.ageInDays)).toBe(true);
      expect(row.ageInDays).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it('writes no rows when no traits are revealed', async () => {
    const foal = await makeFoal();

    await cronJobService.logTraitRevelation(foal.id, foal.name, { positive: [], negative: [], hidden: [] }, 2, foal);

    const rows = await prisma.traitHistoryLog.findMany({ where: { horseId: foal.id } });
    expect(rows).toHaveLength(0);
  }, 60000);
});
