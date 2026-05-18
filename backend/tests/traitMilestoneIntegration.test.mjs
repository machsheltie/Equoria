/**
 * Trait Milestone Integration Tests
 *
 * Tests the integration of foal task log persistence with
 * evaluateEpigeneticTagsFromFoalTasks and getFoalCareSummary.
 * Uses real DB. No mocks of any kind.
 *
 * evaluateEpigeneticTagsFromFoalTasks uses Math.random() internally.
 * Assertions on its output are limited to structural guarantees (always
 * returns an array, no duplicates, correct empty output for empty/no-op
 * inputs). Assertions that require specific random outcomes are omitted.
 *
 * getFoalCareSummary is deterministic for totalTaskCompletions,
 * uniqueTasksCompleted, consecutiveDaysOfCare, and hasBurnoutImmunity —
 * all of these are fully asserted.
 *
 * Fixtures: prefix TestFixture-TraitMilestone-  Cleaned in beforeAll/afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../db/index.mjs';
import { evaluateEpigeneticTagsFromFoalTasks } from '../utils/traitEvaluation.mjs';
import { getFoalCareSummary } from '../utils/foalTaskLogManager.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from './helpers/fixtureColor.mjs';

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
      dateOfBirth: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000),
      age: 360,
      user: { connect: { id: USER_ID } },
      bondScore: 75,
      stressLevel: 15,
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
    expect(summary.hasBurnoutImmunity).toBe(true);
  });

  it('counts totalTaskCompletions correctly for a minimal task log', async () => {
    const taskLog = { trust_building: 2, early_touch: 1 };

    const foal = await setFoalTaskLog(taskLog, 3);
    const summary = getFoalCareSummary(foal);

    expect(summary.totalTaskCompletions).toBe(3);
    expect(summary.uniqueTasksCompleted).toBe(2);
    expect(summary.consecutiveDaysOfCare).toBe(3);
    expect(summary.hasBurnoutImmunity).toBe(false);
  });

  it('returns zero totals for an empty task log', async () => {
    const foal = await setFoalTaskLog({}, 0);
    const summary = getFoalCareSummary(foal);

    expect(summary.totalTaskCompletions).toBe(0);
    expect(summary.uniqueTasksCompleted).toBe(0);
    expect(summary.hasBurnoutImmunity).toBe(false);
  });

  it('returns hasBurnoutImmunity true at exactly 7 consecutive days', async () => {
    const foal = await setFoalTaskLog({ trust_building: 1 }, 7);
    const summary = getFoalCareSummary(foal);

    expect(summary.hasBurnoutImmunity).toBe(true);
    expect(summary.consecutiveDaysOfCare).toBe(7);
  });

  it('returns hasBurnoutImmunity false at 6 consecutive days', async () => {
    const foal = await setFoalTaskLog({ trust_building: 1 }, 6);
    const summary = getFoalCareSummary(foal);

    expect(summary.hasBurnoutImmunity).toBe(false);
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

// ─── evaluateEpigeneticTagsFromFoalTasks — structural ────────────────────────

describe('evaluateEpigeneticTagsFromFoalTasks with real persisted data', () => {
  it('returns [] when taskLog is null (no development)', async () => {
    await prisma.horse.update({
      where: { id: testFoal.id },
      data: { taskLog: null, daysGroomedInARow: 0 },
    });
    const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

    const traits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, foal.daysGroomedInARow);

    expect(traits).toEqual([]);
  });

  it('returns [] when taskLog is empty (no tasks completed)', async () => {
    const foal = await setFoalTaskLog({}, 0);

    const traits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, foal.daysGroomedInARow);

    expect(traits).toEqual([]);
  });

  it('returns an array without duplicates for a comprehensive task log', async () => {
    const foal = await setFoalTaskLog(
      { trust_building: 12, desensitization: 8, showground_exposure: 5, early_touch: 10 },
      10,
    );

    const traits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, foal.daysGroomedInARow);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('returns an array without duplicates for a minimal task log', async () => {
    const foal = await setFoalTaskLog({ trust_building: 2, early_touch: 1 }, 3);

    const traits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, foal.daysGroomedInARow);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('evaluates traits consistently from a fully progressed development at age 365', async () => {
    const foal = await setFoalTaskLog(
      { trust_building: 8, desensitization: 6, early_touch: 5, hoof_handling: 2 },
      0,
      365,
    );

    expect(foal.age).toBe(365);

    const traits = evaluateEpigeneticTagsFromFoalTasks(foal.taskLog, 0);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });
});
