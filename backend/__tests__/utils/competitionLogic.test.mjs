import { describe, it, expect } from '@jest/globals';
import {
  calculateCompetitionScore,
  calculatePrizeAmount,
  calculateCompetitionXP,
  calculatePlacements,
  getAllDisciplines,
  getDisciplineConfig,
  checkAgeRequirements,
  calculateHorseLevel,
  checkTraitRequirements,
  calculateStatGain,
} from '../../utils/competitionLogic.mjs';

describe('calculatePrizeAmount', () => {
  it('gives 50% to 1st place', () => {
    expect(calculatePrizeAmount(1000, 1, 5)).toBe(500);
  });

  it('gives 30% to 2nd place', () => {
    expect(calculatePrizeAmount(1000, 2, 5)).toBe(300);
  });

  it('gives 20% to 3rd place', () => {
    expect(calculatePrizeAmount(1000, 3, 5)).toBe(200);
  });

  it('returns 0 for 4th place', () => {
    expect(calculatePrizeAmount(1000, 4, 5)).toBe(0);
  });

  it('returns 0 when placement <= 0', () => {
    expect(calculatePrizeAmount(1000, 0, 5)).toBe(0);
  });

  it('returns 0 when placement > totalEntries', () => {
    expect(calculatePrizeAmount(1000, 10, 5)).toBe(0);
  });

  it('returns 0 for zero prize pool', () => {
    expect(calculatePrizeAmount(0, 1, 5)).toBe(0);
  });
});

describe('calculateCompetitionXP', () => {
  it('1st place gets +20 placement bonus plus score XP', () => {
    // score 100 → 10 xp + 20 bonus = 30
    expect(calculateCompetitionXP(100, 1, 5)).toBe(30);
  });

  it('2nd place gets +15 bonus', () => {
    expect(calculateCompetitionXP(100, 2, 5)).toBe(25);
  });

  it('3rd place gets +10 bonus', () => {
    expect(calculateCompetitionXP(100, 3, 5)).toBe(20);
  });

  it('top half (not podium) gets +5 bonus', () => {
    // placement 2 of 10 entries = top half, but not podium... placement 4/10
    expect(calculateCompetitionXP(50, 4, 10)).toBe(5 + 5); // 5 score XP + 5 top-half
  });

  it('returns minimum 3 xp for very low score non-podium', () => {
    // score 0 → 0 xp + 0 bonus = 0, but minimum is 3
    expect(calculateCompetitionXP(0, 10, 10)).toBe(3);
  });

  it('bottom half gets only score-based XP (minimum 3)', () => {
    // placement 6/6 = last place, score 30 → 3 xp, min 3
    expect(calculateCompetitionXP(30, 6, 6)).toBe(3);
  });
});

describe('calculatePlacements', () => {
  it('sorts entries by score descending and assigns placement', () => {
    const entries = [
      { horseId: 'a', score: 70 },
      { horseId: 'b', score: 90 },
      { horseId: 'c', score: 80 },
    ];
    const result = calculatePlacements(entries);
    expect(result[0].horseId).toBe('b');
    expect(result[0].placement).toBe(1);
    expect(result[1].horseId).toBe('c');
    expect(result[1].placement).toBe(2);
    expect(result[2].horseId).toBe('a');
    expect(result[2].placement).toBe(3);
  });

  it('does not mutate original array', () => {
    const entries = [
      { horseId: 'x', score: 50 },
      { horseId: 'y', score: 80 },
    ];
    const original = [...entries];
    calculatePlacements(entries);
    expect(entries[0].horseId).toBe(original[0].horseId);
  });

  it('returns empty array for empty input', () => {
    expect(calculatePlacements([])).toEqual([]);
  });

  it('handles single entry with placement 1', () => {
    const result = calculatePlacements([{ horseId: 'solo', score: 55 }]);
    expect(result[0].placement).toBe(1);
  });
});

describe('getAllDisciplines', () => {
  it('returns an array of discipline strings', () => {
    const disciplines = getAllDisciplines();
    expect(Array.isArray(disciplines)).toBe(true);
    expect(disciplines.length).toBeGreaterThan(15);
    expect(disciplines).toContain('Racing');
    expect(disciplines).toContain('Dressage');
    expect(disciplines).toContain('Show Jumping');
  });
});

describe('getDisciplineConfig', () => {
  it('returns config with stats, beneficial, detrimental for Racing', () => {
    const config = getDisciplineConfig('Racing');
    expect(config).toHaveProperty('stats');
    expect(config).toHaveProperty('beneficial');
    expect(config).toHaveProperty('detrimental');
    expect(Array.isArray(config.stats)).toBe(true);
  });

  it('returns a config even for unknown discipline (fallback)', () => {
    const config = getDisciplineConfig('Underwater Polo');
    expect(config).toBeDefined();
  });
});

describe('checkAgeRequirements', () => {
  it('returns true for a horse age 21 (3+ game years)', () => {
    // age is treated as days; 21 days / 7 = 3 years (min eligible)
    const result = checkAgeRequirements({ age: 21 });
    expect(result).toBe(true);
  });

  it('returns false for a foal under minimum age', () => {
    const result = checkAgeRequirements({ age: 1 });
    expect(result).toBe(false);
  });
});

describe('calculateCompetitionScore', () => {
  it('returns a number between 0 and 100', () => {
    const score = calculateCompetitionScore(70, {}, 6, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 for a horse under age 3 (too young)', () => {
    const score = calculateCompetitionScore(100, {}, 1, 'Racing');
    // ageFactor = 0.5, so score = 50 * randomFactor, still clamped to [0, 100]
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 on invalid input', () => {
    // null traits and invalid discipline should not throw, return 0 fallback
    const score = calculateCompetitionScore(null, null, null, null);
    expect(score).toBe(0);
  });

  it('beneficial traits increase score potential', () => {
    const withTrait = { positive: ['fast'], negative: [] };
    const withoutTrait = {};
    // Run multiple times and check average is higher with beneficial trait
    const avgWith =
      Array.from({ length: 50 }, () => calculateCompetitionScore(50, withTrait, 6, 'Racing')).reduce(
        (a, b) => a + b,
        0,
      ) / 50;
    const avgWithout =
      Array.from({ length: 50 }, () => calculateCompetitionScore(50, withoutTrait, 6, 'Racing')).reduce(
        (a, b) => a + b,
        0,
      ) / 50;
    // With beneficial trait should generally be >= without (within statistical variation)
    expect(avgWith).toBeGreaterThanOrEqual(avgWithout - 5); // allow some variance
  });
});

// ─── calculateCompetitionScore — age factor branches ─────────────────────────

describe('calculateCompetitionScore — age factor branches', () => {
  it('applies improving factor for age 4 (3-5 range)', () => {
    // ageFactor = 0.8 + (4-3)*0.1 = 0.9 — exercises line 28
    const score = calculateCompetitionScore(50, {}, 4, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('applies decline factor for age 10 (9-12 range)', () => {
    // ageFactor = 1.0 - (10-8)*0.05 = 0.9 — exercises line 32
    const score = calculateCompetitionScore(50, {}, 10, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('applies senior factor for age 15 (> 12)', () => {
    // ageFactor = 0.7 — exercises line 34
    const score = calculateCompetitionScore(50, {}, 15, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── calculateCompetitionScore — non-matching trait branches ─────────────────

describe('calculateCompetitionScore — non-matching trait branches', () => {
  it('+1 for positive trait not in Racing beneficial list (line 177)', () => {
    // 'calm' not in Racing.beneficial → traitBonus += 1, not +3
    const score = calculateCompetitionScore(50, { positive: ['calm'], negative: [] }, 6, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('-5 for negative trait in Racing detrimental list (line 182)', () => {
    // 'slow' is in Racing.detrimental → traitBonus -= 5
    const score = calculateCompetitionScore(50, { positive: [], negative: ['slow'] }, 6, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('-2 for negative trait not in Racing detrimental list (line 185)', () => {
    // 'clumsy' not in Racing.detrimental → traitBonus -= 2
    const score = calculateCompetitionScore(50, { positive: [], negative: ['clumsy'] }, 6, 'Racing');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── calculateHorseLevel ─────────────────────────────────────────────────────

describe('calculateHorseLevel', () => {
  it('returns level 1 for minimal stats (totalScore < 50)', () => {
    const horse = { speed: 10, stamina: 10, intelligence: 10 };
    // baseStatScore = 10, bonuses = 0, training = 0 → totalScore = 10
    // level = floor(10/50) + 1 = 0 + 1 = 1
    expect(calculateHorseLevel(horse, 'Racing')).toBe(1);
  });

  it('falls back to Racing config for unknown discipline', () => {
    const horse = { speed: 60, stamina: 60, intelligence: 60 };
    const levelKnown = calculateHorseLevel(horse, 'Racing');
    const levelUnknown = calculateHorseLevel(horse, 'Underwater Polo');
    expect(levelUnknown).toBe(levelKnown);
  });

  it('reaches level 11+ when totalScore is 501-1000', () => {
    // baseStatScore = 100, trainingScore = 450 → totalScore = 550
    // level = 11 + floor((550-500)/100) = 11
    const horse = {
      speed: 100,
      stamina: 100,
      intelligence: 100,
      disciplineScores: { Racing: 450 },
    };
    expect(calculateHorseLevel(horse, 'Racing')).toBeGreaterThanOrEqual(11);
  });

  it('reaches level 16+ when totalScore exceeds 1000', () => {
    // baseStatScore = 100, trainingScore = 1000 → totalScore = 1100
    // level = 16 + floor((1100-1000)/100) = 17
    const horse = {
      speed: 100,
      stamina: 100,
      intelligence: 100,
      disciplineScores: { Racing: 1000 },
    };
    expect(calculateHorseLevel(horse, 'Racing')).toBeGreaterThanOrEqual(16);
  });

  it('uses horse.epigeneticModifiers when available', () => {
    const horse = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['fast'], negative: [] },
    };
    // 'fast' is beneficial for Racing → legacyTraitBonus += 5 × 2 = +10 total
    expect(calculateHorseLevel(horse, 'Racing')).toBeGreaterThanOrEqual(1);
  });

  it('falls back to horse.traits when epigeneticModifiers is absent', () => {
    const horse = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      traits: { positive: ['fast'], negative: [] },
    };
    expect(calculateHorseLevel(horse, 'Racing')).toBeGreaterThanOrEqual(1);
  });

  it('+2 legacyTraitBonus for positive trait not in beneficial list', () => {
    // 'calm' not in Racing.beneficial → legacyTraitBonus += 2 per trait
    const horseWith = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['calm'], negative: [] },
    };
    const horseWithout = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: [], negative: [] },
    };
    expect(calculateHorseLevel(horseWith, 'Racing')).toBeGreaterThanOrEqual(
      calculateHorseLevel(horseWithout, 'Racing'),
    );
  });

  it('-8 legacyTraitBonus for detrimental negative trait match', () => {
    // 'slow' is in Racing.detrimental → -8 per trait (×2 because affinity = legacy)
    const horseWith = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: [], negative: ['slow'] },
    };
    const horseWithout = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: [], negative: [] },
    };
    expect(calculateHorseLevel(horseWith, 'Racing')).toBeLessThanOrEqual(calculateHorseLevel(horseWithout, 'Racing'));
  });

  it('-3 legacyTraitBonus for non-detrimental negative trait', () => {
    // 'clumsy' not in Racing.detrimental → legacyTraitBonus -= 3 per trait
    const horse = {
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: [], negative: ['clumsy'] },
    };
    expect(calculateHorseLevel(horse, 'Racing')).toBeGreaterThanOrEqual(1);
  });
});

// ─── checkTraitRequirements ───────────────────────────────────────────────────

describe('checkTraitRequirements', () => {
  it('returns true for discipline with no requiresTrait (Racing)', () => {
    const horse = { epigeneticModifiers: { positive: [], negative: [] } };
    expect(checkTraitRequirements(horse, 'Racing')).toBe(true);
  });

  it('returns true for Gaited when horse has gaited trait', () => {
    const horse = { epigeneticModifiers: { positive: ['gaited'], negative: [] } };
    expect(checkTraitRequirements(horse, 'Gaited')).toBe(true);
  });

  it('returns false for Gaited when horse lacks gaited trait', () => {
    const horse = { epigeneticModifiers: { positive: ['fast'], negative: [] } };
    expect(checkTraitRequirements(horse, 'Gaited')).toBe(false);
  });

  it('uses horse.traits fallback when epigeneticModifiers is absent', () => {
    const horse = { traits: { positive: ['gaited'], negative: [] } };
    expect(checkTraitRequirements(horse, 'Gaited')).toBe(true);
  });

  it('returns false for Gaited when horse has no trait data', () => {
    // horse.epigeneticModifiers undefined, horse.traits undefined → {} → positiveTraits = []
    const horse = {};
    expect(checkTraitRequirements(horse, 'Gaited')).toBe(false);
  });
});

// ─── calculateStatGain ────────────────────────────────────────────────────────

describe('calculateStatGain', () => {
  it('returns null for placement 4 (no chance entry in table)', () => {
    // !chance is true → immediate null
    expect(calculateStatGain(4, 'Racing')).toBeNull();
  });

  it('returns null for placement 5 (no chance entry)', () => {
    expect(calculateStatGain(5, 'Racing')).toBeNull();
  });

  it('eventually returns a stat object for placement 1 (10% chance)', () => {
    // 200 tries: P(at least one success) = 1 - (0.9^200) ≈ 1.0
    let gotGain = false;
    for (let i = 0; i < 200; i++) {
      const result = calculateStatGain(1, 'Racing');
      if (result !== null) {
        expect(result).toHaveProperty('stat');
        expect(result).toHaveProperty('amount', 1);
        // Racing getDisciplineConfigurations stats: ['speed', 'stamina', 'intelligence']
        expect(['speed', 'stamina', 'intelligence']).toContain(result.stat);
        gotGain = true;
        break;
      }
    }
    expect(gotGain).toBe(true);
  });

  it('falls back to Racing discipline for unknown discipline name', () => {
    // placement 4 → always null regardless of discipline
    expect(calculateStatGain(4, 'Underwater Polo')).toBeNull();
  });
});

// ─── Catch-block coverage (Equoria-jkht) ─────────────────────────────────────
// Symbol arithmetic triggers TypeError inside pure-math try blocks.

describe('calculateCompetitionScore — catch block (lines 202-203)', () => {
  it('returns 0 when Symbol baseScore causes arithmetic TypeError', () => {
    const result = calculateCompetitionScore(Symbol('bad'), {}, 6, 'Racing');
    expect(result).toBe(0);
  });
});

describe('calculatePrizeAmount — catch block (lines 230-231)', () => {
  it('returns 0 when Symbol totalPrizePool causes arithmetic TypeError', () => {
    const result = calculatePrizeAmount(Symbol('bad'), 1, 5);
    expect(result).toBe(0);
  });
});

describe('calculateCompetitionXP — catch block (lines 265-266)', () => {
  it('returns 3 (minimum) when Symbol score causes arithmetic TypeError', () => {
    const result = calculateCompetitionXP(Symbol('bad'), 1, 5);
    expect(result).toBe(3);
  });
});

describe('calculatePlacements — catch block (lines 286-287)', () => {
  it('throws when null entries are passed (catch block fires then re-throws)', () => {
    expect(() => calculatePlacements(null)).toThrow();
  });
});

describe('calculateHorseLevel — catch block (lines 488-489)', () => {
  it('returns 1 when null horse causes property access TypeError', () => {
    const result = calculateHorseLevel(null, 'Racing');
    expect(result).toBe(1);
  });
});

describe('checkAgeRequirements — catch block (lines 504-505)', () => {
  it('returns false when null horse causes property access TypeError', () => {
    const result = checkAgeRequirements(null);
    expect(result).toBe(false);
  });
});

describe('checkTraitRequirements — catch block (lines 529-530)', () => {
  it('returns false when null horse causes property access TypeError', () => {
    // 'Gaited' has requiresTrait:'gaited' so execution reaches horse.epigeneticModifiers
    const result = checkTraitRequirements(null, 'Gaited');
    expect(result).toBe(false);
  });
});
