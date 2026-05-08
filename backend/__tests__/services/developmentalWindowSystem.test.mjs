/**
 * developmentalWindowSystem service unit tests (Equoria-rr7 coverage sprint).
 *
 * All 8 exported async functions tested with a real DB fixture.
 * Newborn foal (age 0) exercises zero-interaction code paths;
 * window names are taken from the DEVELOPMENTAL_WINDOWS constant in the service.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  identifyDevelopmentalWindows,
  calculateWindowSensitivity,
  evaluateTraitDevelopmentOpportunity,
  trackDevelopmentalMilestones,
  assessWindowClosure,
  coordinateMultiWindowDevelopment,
  analyzeCriticalPeriodSensitivity,
  generateDevelopmentalForecast,
} from '../../services/developmentalWindowSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `devwindow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `devwindow${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'DevWindow',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-DevWindowHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── identifyDevelopmentalWindows ──────────────────────────────────────────────

describe('identifyDevelopmentalWindows', () => {
  it('throws for non-existent horse', async () => {
    await expect(identifyDevelopmentalWindows(999999999)).rejects.toThrow();
  });

  it('returns expected shape for newborn foal', async () => {
    const result = await identifyDevelopmentalWindows(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.currentAge).toBe('number');
    expect(Array.isArray(result.activeWindows)).toBe(true);
    expect(Array.isArray(result.upcomingWindows)).toBe(true);
    expect(Array.isArray(result.closedWindows)).toBe(true);
    expect(typeof result.criticalityScore).toBe('number');
    expect(result.analysisTimestamp).toBeInstanceOf(Date);
  });

  it('includes imprinting window as active for a newborn', async () => {
    const result = await identifyDevelopmentalWindows(horse.id);
    const activeNames = result.activeWindows.map(w => w.name);
    expect(activeNames).toContain('imprinting');
  });
});

// ── calculateWindowSensitivity ────────────────────────────────────────────────

describe('calculateWindowSensitivity', () => {
  it('throws for unknown window name', async () => {
    await expect(calculateWindowSensitivity(horse.id, 'totally_fake_window')).rejects.toThrow();
  });

  it('returns sensitivity shape for valid window', async () => {
    const result = await calculateWindowSensitivity(horse.id, 'imprinting');
    expect(result.horseId).toBe(horse.id);
    expect(result.windowName).toBe('imprinting');
    expect(typeof result.baseSensitivity).toBe('number');
    expect(typeof result.finalSensitivity).toBe('number');
    expect(typeof result.sensitivityLevel).toBe('string');
    expect(result.analysisTimestamp).toBeInstanceOf(Date);
  });

  it('finalSensitivity is between 0 and 1', async () => {
    const result = await calculateWindowSensitivity(horse.id, 'imprinting');
    expect(result.finalSensitivity).toBeGreaterThanOrEqual(0);
    expect(result.finalSensitivity).toBeLessThanOrEqual(1);
  });
});

// ── evaluateTraitDevelopmentOpportunity ───────────────────────────────────────

describe('evaluateTraitDevelopmentOpportunity', () => {
  it('throws for unknown window name', async () => {
    await expect(evaluateTraitDevelopmentOpportunity(horse.id, 'trusting', 'not_a_window')).rejects.toThrow();
  });

  it('returns opportunity shape for target trait in matching window', async () => {
    const result = await evaluateTraitDevelopmentOpportunity(horse.id, 'trusting', 'imprinting');
    expect(result.horseId).toBe(horse.id);
    expect(result.traitName).toBe('trusting');
    expect(result.windowName).toBe('imprinting');
    expect(typeof result.overallOpportunity).toBe('number');
    expect(typeof result.windowAlignment).toBe('number');
    expect(typeof result.developmentPotential).toBe('number');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });

  it('overallOpportunity is clamped between 0 and 1', async () => {
    const result = await evaluateTraitDevelopmentOpportunity(horse.id, 'trusting', 'imprinting');
    expect(result.overallOpportunity).toBeGreaterThanOrEqual(0);
    expect(result.overallOpportunity).toBeLessThanOrEqual(1);
  });
});

// ── trackDevelopmentalMilestones ──────────────────────────────────────────────

describe('trackDevelopmentalMilestones', () => {
  it('returns milestone tracking shape for newborn foal', async () => {
    const result = await trackDevelopmentalMilestones(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.achievedMilestones)).toBe(true);
    expect(Array.isArray(result.pendingMilestones)).toBe(true);
    expect(typeof result.milestoneProgress).toBe('object');
    expect(typeof result.developmentalScore).toBe('number');
    expect(Array.isArray(result.nextMilestones)).toBe(true);
  });
});

// ── assessWindowClosure ───────────────────────────────────────────────────────

describe('assessWindowClosure', () => {
  it('throws for unknown window name', async () => {
    await expect(assessWindowClosure(horse.id, 'bad_window')).rejects.toThrow();
  });

  it('returns open closure status for imprinting on a newborn', async () => {
    const result = await assessWindowClosure(horse.id, 'imprinting');
    expect(result.horseId).toBe(horse.id);
    expect(result.windowName).toBe('imprinting');
    expect(result.closureStatus).toBe('open');
    expect(Array.isArray(result.missedOpportunities)).toBe(true);
    expect(Array.isArray(result.compensatoryMechanisms)).toBe(true);
  });

  it('returns upcoming closure status for late-starting window on newborn', async () => {
    const result = await assessWindowClosure(horse.id, 'independence_development');
    expect(result.closureStatus).toBe('upcoming');
  });
});

// ── coordinateMultiWindowDevelopment ─────────────────────────────────────────

describe('coordinateMultiWindowDevelopment', () => {
  it('returns coordination shape for newborn foal', async () => {
    const result = await coordinateMultiWindowDevelopment(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.activeWindows)).toBe(true);
    expect(Array.isArray(result.windowInteractions)).toBe(true);
    expect(typeof result.priorityMatrix).toBe('object');
    expect(typeof result.coordinatedPlan).toBe('object');
    expect(typeof result.conflictResolution).toBe('object');
  });
});

// ── analyzeCriticalPeriodSensitivity ──────────────────────────────────────────

describe('analyzeCriticalPeriodSensitivity', () => {
  it('returns sensitivity analysis shape for newborn foal', async () => {
    const result = await analyzeCriticalPeriodSensitivity(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.criticalPeriods)).toBe(true);
    expect(typeof result.sensitivityProfile).toBe('object');
    expect(typeof result.sensitivityProfile.overallSensitivity).toBe('number');
    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(Array.isArray(result.protectiveFactors)).toBe(true);
    expect(Array.isArray(result.interventionRecommendations)).toBe(true);
  });
});

// ── generateDevelopmentalForecast ─────────────────────────────────────────────

describe('generateDevelopmentalForecast', () => {
  it('returns forecast shape for 30-day window', async () => {
    const result = await generateDevelopmentalForecast(horse.id, 30);
    expect(result.horseId).toBe(horse.id);
    expect(result.forecastPeriod).toBe(30);
    expect(Array.isArray(result.upcomingWindows)).toBe(true);
    expect(Array.isArray(result.developmentalTrajectory)).toBe(true);
    expect(Array.isArray(result.traitDevelopmentPredictions)).toBe(true);
    expect(Array.isArray(result.milestoneProjections)).toBe(true);
    expect(typeof result.riskAssessment).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
