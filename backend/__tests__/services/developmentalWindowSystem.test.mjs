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

// ── closed windows + coordinateMultiWindowDevelopment early return (Equoria-jkht) ──
// 35-day horse: only social_hierarchy (30-60) is active; all earlier windows closed.
// compensationPossible=false for imprinting (daysSinceClosure=32 > 30).
// activeWindows.length=1 → coordinateMultiWindowDevelopment early return path.

describe('developmentalWindowSystem — closed windows + coordinateMultiWindowDevelopment early return (Equoria-jkht)', () => {
  let oldUser;
  let oldHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    oldUser = await prisma.user.create({
      data: {
        email: `dw-old-${ts}-${rand()}@test.com`,
        username: `dwold${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DW',
        lastName: 'Old',
        money: 1000,
      },
    });

    oldHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DevWindowOld-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(ts - 35 * 24 * 60 * 60 * 1000),
        age: 35,
        userId: oldUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: oldHorse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: oldUser.id } }).catch(() => {});
  }, 30000);

  it('identifyDevelopmentalWindows: closedWindows.length > 0 for 35-day horse', async () => {
    const result = await identifyDevelopmentalWindows(oldHorse.id);
    expect(result.closedWindows.length).toBeGreaterThan(0);
  });

  it('identifyDevelopmentalWindows: imprinting in closedWindows with compensationPossible=false (daysSinceClosure=32 > 30)', async () => {
    const result = await identifyDevelopmentalWindows(oldHorse.id);
    const closed = result.closedWindows.find(w => w.name === 'imprinting');
    expect(closed).toBeDefined();
    expect(closed.compensationPossible).toBe(false);
  });

  it('assessWindowClosure: closureStatus=closed and closureDate set for imprinting on 35-day horse', async () => {
    const result = await assessWindowClosure(oldHorse.id, 'imprinting');
    expect(result.closureStatus).toBe('closed');
    expect(result.closureDate).not.toBeNull();
    expect(result.closureDate).toBeInstanceOf(Date);
  });

  it('assessWindowClosure: futureImpact=significant when daysSinceClosure=32 (range 31-60)', async () => {
    const result = await assessWindowClosure(oldHorse.id, 'imprinting');
    expect(result.futureImpact).toBe('significant');
  });

  it('coordinateMultiWindowDevelopment: early return with empty windowInteractions when activeWindows.length <= 1', async () => {
    const result = await coordinateMultiWindowDevelopment(oldHorse.id);
    expect(result.horseId).toBe(oldHorse.id);
    expect(result.windowInteractions).toHaveLength(0);
    expect(result.coordinatedPlan).toEqual({ phases: [] });
    expect(result.conflictResolution).toEqual({
      identifiedConflicts: [],
      resolutionStrategies: [],
    });
  });

  it('calculateWindowSensitivity: sensitivityLevel=minimal for closed imprinting (ageModifier=0.05)', async () => {
    const result = await calculateWindowSensitivity(oldHorse.id, 'imprinting');
    expect(result.sensitivityLevel).toBe('minimal');
    expect(result.ageModifier).toBe(0.05);
  });

  it('calculateWindowSensitivity: sensitivityLevel=moderate for active social_hierarchy on 35-day horse', async () => {
    const result = await calculateWindowSensitivity(oldHorse.id, 'social_hierarchy');
    expect(result.sensitivityLevel).toBe('moderate');
  });
});

// ── fear_period branches: 9-day horse (Equoria-jkht) ─────────────────────────
// fear_period_1 (6-12 days) is active at peak (peakDay=9).
// calculateWindowSensitivity: windowName.includes('fear_period') branch fires.
// evaluateTraitDevelopmentOpportunity: fearful → 0.95, brave (target trait) → 0.9,
// fearful in non-fear window (imprinting) → 0.2.

describe('developmentalWindowSystem — fear_period branches + evaluateTraitDevelopmentOpportunity (Equoria-jkht)', () => {
  let fearUser;
  let fearHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    fearUser = await prisma.user.create({
      data: {
        email: `dw-fear-${ts}-${rand()}@test.com`,
        username: `dwfear${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DW',
        lastName: 'Fear',
        money: 1000,
      },
    });

    fearHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DevWindowFear-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(ts - 9 * 24 * 60 * 60 * 1000),
        age: 9,
        userId: fearUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: fearHorse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: fearUser.id } }).catch(() => {});
  }, 30000);

  it('calculateWindowSensitivity: fear_period branch fires → sensitivityLevel=critical (finalSensitivity >= 0.8)', async () => {
    const result = await calculateWindowSensitivity(fearHorse.id, 'fear_period_1');
    // baseSensitivity=0.8, at peakDay=9 → ageModifier=1.0, environmentalModifier=1.1+(stress*0.05)
    // finalSensitivity = 0.8 * 1.0 * 1.1 = 0.88 → critical
    expect(result.sensitivityLevel).toBe('critical');
    expect(result.finalSensitivity).toBeGreaterThanOrEqual(0.8);
  });

  it('evaluateTraitDevelopmentOpportunity: fearful in fear_period_1 → windowAlignment=0.95', async () => {
    const result = await evaluateTraitDevelopmentOpportunity(fearHorse.id, 'fearful', 'fear_period_1');
    expect(result.windowAlignment).toBe(0.95);
  });

  it('evaluateTraitDevelopmentOpportunity: brave in fear_period_1 → windowAlignment=0.9 (target trait branch)', async () => {
    // brave is in fear_period_1.targetTraits → first if branch → windowAlignment=0.9
    const result = await evaluateTraitDevelopmentOpportunity(fearHorse.id, 'brave', 'fear_period_1');
    expect(result.windowAlignment).toBe(0.9);
  });

  it('evaluateTraitDevelopmentOpportunity: fearful in imprinting (non-fear window) → windowAlignment=0.2', async () => {
    // fearful IS in imprinting.riskTraits; window is NOT fear_period → second else → 0.2
    const result = await evaluateTraitDevelopmentOpportunity(fearHorse.id, 'fearful', 'imprinting');
    expect(result.windowAlignment).toBe(0.2);
  });
});

// ── analyzeCriticalPeriodSensitivity — risk factors (Equoria-jkht) ────────────
// Newborn with stressLevel=8 and bondScore=10 triggers all four risk-factor branches:
//   stressLevel > 5   → 'High stress environment'
//   bondScore < 20    → 'Poor bonding relationship'
//   currentAge < 30 && fearful flag → 'Early fear trait development'
//   currentAge < 14 && stressLevel > 4 → 'Stress during critical early development'

describe('analyzeCriticalPeriodSensitivity — risk factor branches (Equoria-jkht)', () => {
  let stressUser;
  let stressHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    stressUser = await prisma.user.create({
      data: {
        email: `dw-stress-${ts}-${rand()}@test.com`,
        username: `dwstress${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DW',
        lastName: 'Stress',
        money: 1000,
      },
    });

    stressHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DevWindowStress-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: stressUser.id,
        stressLevel: 8,
        bondScore: 10,
        epigeneticFlags: ['fearful'],
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: stressHorse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: stressUser.id } }).catch(() => {});
  }, 30000);

  it('riskFactors includes "High stress environment" when stressLevel=8 (> 5)', async () => {
    const result = await analyzeCriticalPeriodSensitivity(stressHorse.id);
    expect(result.riskFactors).toContain('High stress environment');
  });

  it('riskFactors includes "Poor bonding relationship" when bondScore=10 (< 20)', async () => {
    const result = await analyzeCriticalPeriodSensitivity(stressHorse.id);
    expect(result.riskFactors).toContain('Poor bonding relationship');
  });

  it('riskFactors includes "Early fear trait development" for newborn with fearful flag', async () => {
    const result = await analyzeCriticalPeriodSensitivity(stressHorse.id);
    expect(result.riskFactors).toContain('Early fear trait development');
  });

  it('riskFactors includes "Stress during critical early development" for newborn with stressLevel=8 (> 4)', async () => {
    const result = await analyzeCriticalPeriodSensitivity(stressHorse.id);
    expect(result.riskFactors).toContain('Stress during critical early development');
  });
});
