/**
 * Shadow-Follower late-bond boundary is game age 2 (Equoria-x7gw6).
 *
 * Owner ruling: 7 real days = 1 game year, so "after age 2" is day 14, not the
 * old real-day constant 730. A bond log's ageInDays is the horse's age in days.
 * Real evaluator over plain horse data (the evaluator does no database access).
 */
import { describe, it, expect } from '@jest/globals';
import { evaluateShadowFollowerConditions } from '../../../utils/exoticTriggerEvaluators.mjs';
import { age2Days } from '../../../utils/ultraRareTriggerHelpers.mjs';

const conditions = { missedSocializationEvents: 1 };

const horseWith = bondLogs => ({
  milestoneTraitLogs: [{ milestoneType: 'socialization', score: 10, ageInDays: 5 }, ...bondLogs],
  traitHistoryLogs: [],
});

describe('Shadow-Follower late-bond boundary (game age 2)', () => {
  it('is 14 days, game age 2', () => {
    expect(age2Days).toBe(14);
  });

  it('fires when a low early bond is followed by a high bond after game age 2', async () => {
    const horse = horseWith([
      { milestoneType: 'bond', bondScore: 20, ageInDays: 7 },
      { milestoneType: 'bond', bondScore: 80, ageInDays: 15 },
    ]);
    expect(await evaluateShadowFollowerConditions(horse, conditions)).toBe(true);
  });

  it('does not fire when the high bond arrives before game age 2', async () => {
    const horse = horseWith([
      { milestoneType: 'bond', bondScore: 20, ageInDays: 3 },
      { milestoneType: 'bond', bondScore: 80, ageInDays: 13 },
    ]);
    expect(await evaluateShadowFollowerConditions(horse, conditions)).toBe(false);
  });
});
