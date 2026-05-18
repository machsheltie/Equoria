/**
 * enhancedMilestoneEvaluation (utils) + cronJobs (service) unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * enhancedMilestoneEvaluation.evaluateEnhancedMilestone takes a horse object
 * (not an ID), so no DB fixture is needed:
 *   - Old horse (>= 1095 days): early return from baseMilestone, no DB calls.
 *   - Young horse (newborn) with fake ID: ultra-rare trigger calls fail gracefully
 *     (caught internally), function still returns full result shape.
 *
 * cronJobs: tests the exported singleton's start/stop lifecycle — does not
 * actually schedule background work (cron schedules but jobs don't run in tests).
 */

import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { evaluateEnhancedMilestone } from '../../../utils/enhancedMilestoneEvaluation.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

afterAll(() => {
  // Stop any accidentally-started cron service
  if (cronJobService.isRunning) {
    cronJobService.stop();
  }
});

// ── enhancedMilestoneEvaluation ───────────────────────────────────────────────

const makeMilestoneData = () => ({
  type: 'imprinting',
  completed: true,
  score: 80,
});

describe('evaluateEnhancedMilestone — mature horse (age >= 3 years)', () => {
  const matureHorse = {
    id: 999999997,
    name: 'TestMatureHorse',
    dateOfBirth: new Date(Date.now() - 1200 * 24 * 60 * 60 * 1000), // 1200 days old
    age: 3,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    bondScore: 50,
    stressLevel: 30,
  };

  it('returns base milestone shape without DB calls for mature horse', async () => {
    const result = await evaluateEnhancedMilestone(matureHorse, {}, null, makeMilestoneData());
    expect(typeof result).toBe('object');
    expect(result.milestoneReached).toBe(true);
    expect(Array.isArray(result.recommendedTraits)).toBe(true);
    expect(typeof result.ageCategory).toBe('string');
    expect(result.ageCategory).toBe('mature');
  });
});

describe('evaluateEnhancedMilestone — newborn foal (graceful ultra-rare failure)', () => {
  const newbornHorse = {
    id: 999999996, // fake ID — ultra-rare trigger fails gracefully via try-catch
    name: 'TestNewbornHorse',
    dateOfBirth: new Date(), // today
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    bondScore: 0,
    stressLevel: 0,
  };

  it('returns full result shape even when ultra-rare triggers fail gracefully', async () => {
    const result = await evaluateEnhancedMilestone(newbornHorse, { interactions: [] }, null, makeMilestoneData());
    expect(typeof result).toBe('object');
    expect(result.milestoneReached).toBe(true);
    expect(typeof result.epigeneticFlags).toBe('object');
    expect(typeof result.careConsistencyBonus).toBe('number');
    expect(typeof result.ultraRareEvaluation).toBe('object');
    expect(Array.isArray(result.ultraRareEvaluation.ultraRareTriggered)).toBe(true);
    expect(Array.isArray(result.ultraRareEvaluation.exoticUnlocked)).toBe(true);
    expect(typeof result.ultraRareEvaluation.totalRareTraits).toBe('number');
  });

  it('enhancementFactors are present in result', async () => {
    const result = await evaluateEnhancedMilestone(newbornHorse, { interactions: [] }, null, makeMilestoneData());
    expect(typeof result.enhancementFactors).toBe('object');
    expect(typeof result.enhancementFactors.careQuality).toBe('string');
    expect(typeof result.enhancementFactors.bondStability).toBe('string');
  });

  it('returns ageCategory foal for newborn', async () => {
    const result = await evaluateEnhancedMilestone(newbornHorse, { interactions: [] }, null, makeMilestoneData());
    expect(result.ageCategory).toBe('foal');
  });
});

describe('evaluateEnhancedMilestone — with groom object', () => {
  const youngHorse = {
    id: 999999995,
    name: 'TestYoungHorse',
    dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    bondScore: 40,
    stressLevel: 20,
  };

  const groom = {
    id: 1,
    name: 'TestGroom',
    epigeneticInfluenceType: 'gentle',
    personality: 'gentle',
  };

  it('returns result with personalityBonuses when groom is provided', async () => {
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions: [] }, groom, makeMilestoneData());
    expect(typeof result).toBe('object');
    expect(typeof result.personalityBonuses).toBe('object');
  });
});

// ── age categories (getAgeCategory + getDevelopmentalStage branches) ──────────

const milestoneData = { type: 'growth', completed: true, score: 70 };
const daysAgo = d => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

describe('evaluateEnhancedMilestone — age category branches', () => {
  it('weanling + juvenile at 200 days', async () => {
    const horse = {
      id: -1,
      dateOfBirth: daysAgo(200),
      age: 0,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const result = await evaluateEnhancedMilestone(horse, {}, null, milestoneData);
    expect(result.ageCategory).toBe('weanling');
    expect(result.developmentalStage).toBe('juvenile');
  });

  it('yearling + adolescent at 400 days', async () => {
    const horse = {
      id: -1,
      dateOfBirth: daysAgo(400),
      age: 1,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const result = await evaluateEnhancedMilestone(horse, {}, null, milestoneData);
    expect(result.ageCategory).toBe('yearling');
    expect(result.developmentalStage).toBe('adolescent');
  });

  it('two_year_old + young_adult at 800 days', async () => {
    const horse = {
      id: -1,
      dateOfBirth: daysAgo(800),
      age: 2,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const result = await evaluateEnhancedMilestone(horse, {}, null, milestoneData);
    expect(result.ageCategory).toBe('two_year_old');
    expect(result.developmentalStage).toBe('young_adult');
  });

  it('foal + fear_period at 100 days', async () => {
    const horse = {
      id: -1,
      dateOfBirth: daysAgo(100),
      age: 0,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const result = await evaluateEnhancedMilestone(horse, {}, null, milestoneData);
    expect(result.ageCategory).toBe('foal');
    expect(result.developmentalStage).toBe('fear_period');
  });
});

// ── care consistency bonus branches ──────────────────────────────────────────

describe('evaluateEnhancedMilestone — care consistency bonus', () => {
  const youngHorse = {
    id: -1,
    dateOfBirth: daysAgo(50),
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  };

  it('careConsistencyBonus is 0.8 when all interactions are >30 days old', async () => {
    const oldInteraction = { timestamp: daysAgo(40).toISOString(), quality: 'good', type: 'grooming' };
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions: [oldInteraction] }, null, milestoneData);
    expect(result.careConsistencyBonus).toBe(0.8);
  });

  it('careConsistencyBonus is in [0.8,1.3] range with recent interactions', async () => {
    const recentInteractions = [
      { timestamp: new Date().toISOString(), quality: 'excellent', type: 'grooming' },
      { timestamp: daysAgo(1).toISOString(), quality: 'excellent', type: 'feeding' },
      { timestamp: daysAgo(2).toISOString(), quality: 'good', type: 'grooming' },
    ];
    const result = await evaluateEnhancedMilestone(
      youngHorse,
      { interactions: recentInteractions },
      null,
      milestoneData,
    );
    expect(result.careConsistencyBonus).toBeGreaterThanOrEqual(0.8);
    expect(result.careConsistencyBonus).toBeLessThanOrEqual(1.3);
  });
});

// ── care quality branches (calculateCareQuality) ─────────────────────────────

describe('evaluateEnhancedMilestone — care quality thresholds', () => {
  const youngHorse = {
    id: -1,
    dateOfBirth: daysAgo(60),
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  };

  it('careQuality is excellent with all excellent interactions', async () => {
    const interactions = [
      { timestamp: new Date().toISOString(), quality: 'excellent' },
      { timestamp: daysAgo(1).toISOString(), quality: 'excellent' },
    ];
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions }, null, milestoneData);
    expect(result.enhancementFactors.careQuality).toBe('excellent');
  });

  it('careQuality is good with all good interactions', async () => {
    const interactions = [
      { timestamp: new Date().toISOString(), quality: 'good' },
      { timestamp: daysAgo(1).toISOString(), quality: 'good' },
    ];
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions }, null, milestoneData);
    expect(result.enhancementFactors.careQuality).toBe('good');
  });

  it('careQuality is fair with all fair interactions', async () => {
    const interactions = [
      { timestamp: new Date().toISOString(), quality: 'fair' },
      { timestamp: daysAgo(1).toISOString(), quality: 'fair' },
    ];
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions }, null, milestoneData);
    expect(result.enhancementFactors.careQuality).toBe('fair');
  });

  it('careQuality is poor with all poor interactions', async () => {
    const interactions = [
      { timestamp: new Date().toISOString(), quality: 'poor' },
      { timestamp: daysAgo(1).toISOString(), quality: 'poor' },
    ];
    const result = await evaluateEnhancedMilestone(youngHorse, { interactions }, null, milestoneData);
    expect(result.enhancementFactors.careQuality).toBe('poor');
  });

  it('careQuality is unknown when interactions array is absent', async () => {
    const result = await evaluateEnhancedMilestone(youngHorse, {}, null, milestoneData);
    expect(result.enhancementFactors.careQuality).toBe('unknown');
  });
});

// ── bond stability branches (calculateBondStability) ─────────────────────────

describe('evaluateEnhancedMilestone — bond stability branches', () => {
  const youngHorse = {
    id: -1,
    dateOfBirth: daysAgo(70),
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  };

  it('bondStability is stable when bondHistory is absent', async () => {
    const result = await evaluateEnhancedMilestone(youngHorse, {}, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('stable');
  });

  it('bondStability is stable with a single bondHistory entry', async () => {
    const history = { bondHistory: [{ bondScore: 75 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('stable');
  });

  it('bondStability is very_stable with low-variance bond scores', async () => {
    // variance([80,82]) = 1 < 5 → very_stable
    const history = { bondHistory: [{ bondScore: 80 }, { bondScore: 82 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('very_stable');
  });

  it('bondStability is stable with medium-low variance bond scores', async () => {
    // variance([70,76]) = 9, between 5 and 15 → stable
    const history = { bondHistory: [{ bondScore: 70 }, { bondScore: 76 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('stable');
  });

  it('bondStability is fluctuating with medium variance bond scores', async () => {
    // variance([70,80]) = 25, between 15 and 30 → fluctuating
    const history = { bondHistory: [{ bondScore: 70 }, { bondScore: 80 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('fluctuating');
  });

  it('bondStability is unstable with high variance bond scores', async () => {
    // variance([40,80]) = 400 >= 30 → unstable
    const history = { bondHistory: [{ bondScore: 40 }, { bondScore: 80 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.bondStability).toBe('unstable');
  });
});

// ── stress management branches (calculateStressManagement) ───────────────────

describe('evaluateEnhancedMilestone — stress management branches', () => {
  const youngHorse = {
    id: -1,
    dateOfBirth: daysAgo(80),
    age: 0,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  };

  it('stressManagement is good when stressHistory is absent', async () => {
    const result = await evaluateEnhancedMilestone(youngHorse, {}, null, milestoneData);
    expect(result.enhancementFactors.stressManagement).toBe('good');
  });

  it('stressManagement is excellent with very low avg stress', async () => {
    const history = { stressHistory: [{ stressLevel: 1 }, { stressLevel: 2 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.stressManagement).toBe('excellent');
  });

  it('stressManagement is good with moderate stress (3-4)', async () => {
    const history = { stressHistory: [{ stressLevel: 3 }, { stressLevel: 4 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.stressManagement).toBe('good');
  });

  it('stressManagement is fair with stress around 5-6', async () => {
    const history = { stressHistory: [{ stressLevel: 5 }, { stressLevel: 6 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.stressManagement).toBe('fair');
  });

  it('stressManagement is poor with high avg stress (>= 7)', async () => {
    const history = { stressHistory: [{ stressLevel: 7 }, { stressLevel: 8 }] };
    const result = await evaluateEnhancedMilestone(youngHorse, history, null, milestoneData);
    expect(result.enhancementFactors.stressManagement).toBe('poor');
  });
});

// ── personality bonus branches (calculatePersonalityBonuses) ─────────────────

describe('evaluateEnhancedMilestone — personality bonus branches', () => {
  const youngHorse = {
    id: -1,
    dateOfBirth: daysAgo(45),
    age: 0,
    temperament: 'nervous',
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  };

  it('personalityBonuses is {} when groom has no epigeneticInfluenceType', async () => {
    const groom = { id: 5, name: 'NoTypeGroom' };
    const result = await evaluateEnhancedMilestone(youngHorse, {}, groom, milestoneData);
    expect(result.personalityBonuses).toEqual({});
  });

  it('personalityBonuses is {} for unknown personality type', async () => {
    const groom = { id: 5, name: 'UnknownGroom', epigeneticInfluenceType: 'mythical_unicorn_handler' };
    const result = await evaluateEnhancedMilestone(youngHorse, {}, groom, milestoneData);
    expect(result.personalityBonuses).toEqual({});
  });

  it('personalityBonuses has trait keys for a valid gentle groom', async () => {
    const groom = { id: 5, name: 'GentleGroom', epigeneticInfluenceType: 'gentle' };
    const result = await evaluateEnhancedMilestone(youngHorse, {}, groom, milestoneData);
    expect(typeof result.personalityBonuses).toBe('object');
    // GENTLE personality has AFFECTIONATE, CONFIDENT, RESILIENT bonuses
    expect('AFFECTIONATE' in result.personalityBonuses || 'CONFIDENT' in result.personalityBonuses).toBe(true);
  });

  it('temperament synergy is applied when horse.temperament matches personality', async () => {
    // GENTLE.temperamentSynergy has nervous: +0.2
    const groom = { id: 5, name: 'GentleGroom', epigeneticInfluenceType: 'gentle' };
    const noSynergyHorse = { ...youngHorse, temperament: undefined };
    const synergyHorse = { ...youngHorse, temperament: 'nervous' };

    const withoutSynergy = await evaluateEnhancedMilestone(noSynergyHorse, {}, groom, milestoneData);
    const withSynergy = await evaluateEnhancedMilestone(synergyHorse, {}, groom, milestoneData);

    // With synergy bonus applied, all bonuses should be higher
    const noSynergySum = Object.values(withoutSynergy.personalityBonuses).reduce((a, b) => a + b, 0);
    const synergySum = Object.values(withSynergy.personalityBonuses).reduce((a, b) => a + b, 0);
    expect(synergySum).toBeGreaterThan(noSynergySum);
  });

  it('care duration multiplier is applied when groomCareHistory has assignments', async () => {
    const groom = { id: 7, name: 'AssignedGroom', epigeneticInfluenceType: 'gentle' };
    const historyWithAssignment = {
      assignments: [{ groomId: 7, startDate: daysAgo(30).toISOString() }],
    };
    const historyNoAssignment = {};

    const withDuration = await evaluateEnhancedMilestone(youngHorse, historyWithAssignment, groom, milestoneData);
    const withoutDuration = await evaluateEnhancedMilestone(youngHorse, historyNoAssignment, groom, milestoneData);

    // Duration multiplier = 1 + 30/90 = 1.33 → bonuses should be higher with assignment
    const durSum = Object.values(withDuration.personalityBonuses).reduce((a, b) => a + b, 0);
    const noDurSum = Object.values(withoutDuration.personalityBonuses).reduce((a, b) => a + b, 0);
    expect(durSum).toBeGreaterThan(noDurSum);
  });
});

// ── evaluateEnhancedMilestone — real DB horse: ultra-rare success path (lines 70-80) ──
//
// Using a real DB horse (stressLevel:51) ensures evaluateUltraRareTriggers succeeds
// (returns an array instead of throwing), covering lines 70-80 where the ultraRareEvaluation
// object is assigned from both successful ultra-rare and exotic results.
// Also covers lines 34-37 in ultraRareTriggerEngine (PhoenixBorn triggered).

let dbMilestoneUser;
let dbMilestoneHorse;

beforeAll(async () => {
  dbMilestoneUser = await prisma.user.create({
    data: {
      email: `enhancedmilestone-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `enhancedmilestone${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EnhancedMilestone',
      lastName: 'DBTester',
      money: 1000,
    },
  });
  dbMilestoneHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnhancedMilestoneDBHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: dbMilestoneUser.id,
      stressLevel: 51,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: dbMilestoneHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: dbMilestoneUser.id } }).catch(() => {});
}, 30000);

describe('evaluateEnhancedMilestone — real DB horse (ultra-rare success path, lines 70-80)', () => {
  const milestoneDataForDB = { type: 'imprinting', completed: true, score: 75 };

  it('ultraRareEvaluation success path: totalRareTraits > 0 for stressLevel:51 horse', async () => {
    // Phoenix-Born conditions: (stressEvents>=1 || hasHighStress=51>50=true) && recoveries>=0 → true
    const result = await evaluateEnhancedMilestone(
      { ...dbMilestoneHorse, epigeneticModifiers: { positive: [], negative: [], hidden: [] } },
      { interactions: [] },
      null,
      milestoneDataForDB,
    );
    expect(typeof result.ultraRareEvaluation).toBe('object');
    expect(Array.isArray(result.ultraRareEvaluation.ultraRareTriggered)).toBe(true);
    expect(Array.isArray(result.ultraRareEvaluation.exoticUnlocked)).toBe(true);
    // Phoenix-Born is triggered for stressLevel:51 → totalRareTraits >= 1
    expect(result.ultraRareEvaluation.totalRareTraits).toBeGreaterThanOrEqual(1);
    expect(result.ultraRareEvaluation.ultraRareTriggered.length).toBeGreaterThan(0);
    expect(result.ultraRareEvaluation.ultraRareTriggered[0].name).toBe('Phoenix-Born');
  });
});

// ── cronJobs ──────────────────────────────────────────────────────────────────

describe('cronJobService', () => {
  it('is not running at import time', () => {
    expect(cronJobService.isRunning).toBe(false);
  });

  it('start() sets isRunning to true', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);
    cronJobService.stop(); // clean up immediately
    expect(cronJobService.isRunning).toBe(false);
  });

  it('calling start() twice (idempotent — already running warning)', () => {
    cronJobService.start();
    expect(() => cronJobService.start()).not.toThrow();
    cronJobService.stop();
  });

  it('calling stop() when not running does not throw', () => {
    expect(() => cronJobService.stop()).not.toThrow();
  });
});
