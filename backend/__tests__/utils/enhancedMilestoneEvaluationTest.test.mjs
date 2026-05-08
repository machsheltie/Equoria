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

import { describe, it, expect, afterAll } from '@jest/globals';
import { evaluateEnhancedMilestone } from '../../utils/enhancedMilestoneEvaluation.mjs';
import cronJobService from '../../services/cronJobs.mjs';

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
