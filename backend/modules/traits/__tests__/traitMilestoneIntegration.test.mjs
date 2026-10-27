/**
 * Trait Milestone Integration Tests
 *
 * Tests the integration of foal task log persistence with getFoalCareSummary.
 * Uses real DB. No mocks of any kind.
 *
 * getFoalCareSummary is deterministic for totalTaskCompletions,
 * uniqueTasksCompleted and consecutiveDaysOfCare — all of these are fully
 * asserted. (hasBurnoutImmunity was removed: owner ruling 2026-10-23,
 * Equoria-0gl9o — there is no burnout.)
 *
 * Fixtures: prefix TestFixture-TraitMilestone-  Cleaned in beforeAll/afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getFoalCareSummary } from '../../../utils/foalTaskLogManager.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const PREFIX = 'TestFixture-TraitMilestone-';
const USER_ID = `${PREFIX}user`;

// ─── fixtures ─────────────────────────────────────────────────────────────────

let testFoal;

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });

  await prisma.user.create({
    data: {
      id: USER_ID,
      username: `${PREFIX}user`,
      email: `${PREFIX}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Milestone',
      lastName: 'Tester',
      money: 1000,
    },
  });

  testFoal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Foal`,
      sex: 'Colt',
      dateOfBirth: gameCalendarDate(new Date(), -360),
      age: 360,
      user: { connect: { id: USER_ID } },
      bondScore: 75,
      taskLog: null,
      lastGroomed: null,
      daysGroomedInARow: 0,
    },
  });
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

async function setFoalTaskLog(taskLog, daysGroomedInARow = 0, age = 360) {
  await prisma.horse.update({
    where: { id: testFoal.id },
    data: { taskLog, daysGroomedInARow, age, lastGroomed: new Date() },
  });
  return prisma.horse.findUnique({ where: { id: testFoal.id } });
}

// ─── getFoalCareSummary — deterministic ───────────────────────────────────────

describe('getFoalCareSummary from persisted taskLog', () => {
  it('counts totalTaskCompletions correctly for a comprehensive task log', async () => {
    const taskLog = {
      trust_building: 12,
      desensitization: 8,
      showground_exposure: 5,
      early_touch: 10,
      hoof_handling: 6,
      sponge_bath: 4,
      coat_check: 3,
    };

    const foal = await setFoalTaskLog(taskLog, 10);
    const summary = getFoalCareSummary(foal);

    expect(summary.totalTaskCompletions).toBe(48); // 12+8+5+10+6+4+3
    expect(summary.uniqueTasksCompleted).toBe(7);
    expect(summary.consecutiveDaysOfCare).toBe(10);
  });

  it('counts totalTaskCompletions correctly for a minimal task log', async () => {
    const taskLog = { trust_building: 2, early_touch: 1 };

    const foal = await setFoalTaskLog(taskLog, 3);
    const summary = getFoalCareSummary(foal);

    expect(summary.totalTaskCompletions).toBe(3);
    expect(summary.uniqueTasksCompleted).toBe(2);
    expect(summary.consecutiveDaysOfCare).toBe(3);
  });

  it('returns zero totals for an empty task log', async () => {
    const foal = await setFoalTaskLog({}, 0);
    const summary = getFoalCareSummary(foal);

    expect(summary.totalTaskCompletions).toBe(0);
    expect(summary.uniqueTasksCompleted).toBe(0);
  });

  // Old contract: hasBurnoutImmunity true from 7 consecutive days. Owner ruling
  // 2026-10-23 (Equoria-0gl9o): no burnout; the summary keeps the streak only.
  it('reports a 7-day streak with no burnout immunity label', async () => {
    const foal = await setFoalTaskLog({ trust_building: 1 }, 7);
    const summary = getFoalCareSummary(foal);

    expect(summary.consecutiveDaysOfCare).toBe(7);
    expect(summary).not.toHaveProperty('hasBurnoutImmunity');
  });
});

// ─── taskLog persistence ──────────────────────────────────────────────────────

describe('taskLog persistence round-trip', () => {
  it('stores and retrieves taskLog correctly from the DB', async () => {
    const taskLog = {
      trust_building: 5,
      desensitization: 3,
      early_touch: 4,
    };

    const foal = await setFoalTaskLog(taskLog, 0);

    expect(foal.taskLog).toEqual(taskLog);
  });

  it('stores a null taskLog and retrieves it as null', async () => {
    await prisma.horse.update({
      where: { id: testFoal.id },
      data: { taskLog: null },
    });

    const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
    expect(foal.taskLog).toBeNull();
  });
});
