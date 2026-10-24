/**
 * Ghostwalker's youth window is game age 3 = 21 game days (Equoria-fjgzp).
 * Old contract: the window was 1095 days. Stored ageInDays is the horse's age
 * in game days (one game week = one game year), so a bond logged at 100 game
 * days is a 14-year-old's bond and is not "youth".
 */
import { describe, it, expect } from '@jest/globals';
import { evaluateGhostwalkerConditions } from '../../../utils/exoticTriggerEvaluators.mjs';

const base = {
  bondScore: 10,
  epigeneticFlags: ['resilient'],
  milestoneTraitLogs: [{ reasoning: 'withdrawn and isolated', finalTrait: null }],
};

describe('evaluateGhostwalkerConditions youth window', () => {
  it('ignores a high bond logged after game age 3', async () => {
    const horse = {
      ...base,
      traitHistoryLogs: [
        { bondScore: 10, ageInDays: 10 },
        { bondScore: 90, ageInDays: 100 },
      ],
    };
    expect(await evaluateGhostwalkerConditions(horse, {})).toBe(true);
  });

  it('counts a high bond logged inside the first 21 game days', async () => {
    const horse = {
      ...base,
      traitHistoryLogs: [{ bondScore: 90, ageInDays: 20 }],
    };
    expect(await evaluateGhostwalkerConditions(horse, {})).toBe(false);
  });

  it('treats exactly game age 3 (21 days) as no longer youth', async () => {
    const horse = {
      ...base,
      traitHistoryLogs: [{ bondScore: 90, ageInDays: 21 }],
    };
    expect(await evaluateGhostwalkerConditions(horse, {})).toBe(true);
  });
});
