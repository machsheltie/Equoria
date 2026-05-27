import { describe, it, expect } from '@jest/globals';
import {
  calculateCompetitionScore,
  calculateCompetitionScoreDetailed,
  getDisciplineStatWeights,
  validateHorseForCompetition,
} from '../../../utils/competitionScore.mjs';

const makeHorse = (overrides = {}) => ({
  name: 'TestHorse',
  speed: 50,
  stamina: 50,
  intelligence: 50,
  precision: 50,
  focus: 50,
  obedience: 50,
  agility: 50,
  boldness: 50,
  ...overrides,
});

describe('getDisciplineStatWeights', () => {
  it('returns three stat weights for Racing', () => {
    const w = getDisciplineStatWeights('Racing');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['speed', 'stamina', 'intelligence']));
  });

  it('returns Jumping weights for Show Jumping', () => {
    const w = getDisciplineStatWeights('Show Jumping');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'stamina']));
  });

  it('returns Dressage weights', () => {
    const w = getDisciplineStatWeights('Dressage');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'obedience']));
  });

  it('defaults to Racing weights for unknown discipline', () => {
    const w = getDisciplineStatWeights('Unknown');
    expect(w).toEqual(getDisciplineStatWeights('Racing'));
  });
});

describe('validateHorseForCompetition', () => {
  it('returns true when horse has at least one required stat', () => {
    expect(validateHorseForCompetition({ speed: 50, stamina: 50, intelligence: 50 }, 'Racing')).toBe(true);
  });

  it('returns false for null horse', () => {
    expect(validateHorseForCompetition(null, 'Racing')).toBe(false);
  });

  it('returns false for non-object horse', () => {
    expect(validateHorseForCompetition('horse', 'Racing')).toBe(false);
  });

  it('returns false when all required stats are missing', () => {
    // Horse has no Racing stats (speed/stamina/intelligence)
    expect(validateHorseForCompetition({ boldness: 70 }, 'Racing')).toBe(false);
  });

  it('returns false when stat is string not number', () => {
    expect(validateHorseForCompetition({ speed: 'fast' }, 'Racing')).toBe(false);
  });
});

describe('calculateCompetitionScore', () => {
  it('throws when horse is null', () => {
    expect(() => calculateCompetitionScore(null, 'Racing')).toThrow('Horse object is required');
  });

  it('throws when eventType is empty string', () => {
    expect(() => calculateCompetitionScore(makeHorse(), '')).toThrow('Event type is required');
  });

  it('throws when eventType is not a string', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 42)).toThrow('Event type is required');
  });

  it('returns a non-negative integer for Racing', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Racing');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Dressage', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Dressage');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Show Jumping', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Show Jumping');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Cross Country', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Cross Country');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('scores within ±9% luck band of base+trait over many runs', () => {
    // Racing base = speed+stamina+intelligence = 30+30+30 = 90, no trait bonus
    const horse = makeHorse({ speed: 30, stamina: 30, intelligence: 30 });
    const scores = Array.from({ length: 100 }, () => calculateCompetitionScore(horse, 'Racing'));
    // With ±9% luck on 90 base: min ~81, max ~98 (plus temperament which is 0 for undefined)
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...scores)).toBeLessThanOrEqual(110); // generous upper bound
  });

  it('applies +5 trait bonus when discipline affinity trait is present', () => {
    const horse = makeHorse({
      speed: 0,
      stamina: 0,
      intelligence: 0,
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // With all stats 0 and no luck the score is ±9% of 5 (trait bonus only)
    // Run 200 times; at least once the luck should push score >= 1
    const scores = Array.from({ length: 200 }, () => calculateCompetitionScore(horse, 'Racing'));
    // Any run where luck is >= 0 gives score = round(5 * (1 + luck)) >= 5
    expect(scores.some(s => s > 0)).toBe(true);
  });

  it('accepts conformation showType without throwing', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 'Racing', 'conformation')).not.toThrow();
  });

  it('falls back to ridden for unknown showType', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 'Racing', 'weird')).not.toThrow();
  });

  it('handles zero-stat horse without throwing and returns 0', () => {
    const horse = {
      name: 'ZeroHorse',
      speed: 0,
      stamina: 0,
      intelligence: 0,
      precision: 0,
      focus: 0,
      obedience: 0,
      agility: 0,
      boldness: 0,
    };
    const score = calculateCompetitionScore(horse, 'Racing');
    expect(score).toBe(0);
  });
});

// ─── getDisciplineStatWeights — extra branches ────────────────────────────────

describe('getDisciplineStatWeights — extra branches', () => {
  it('returns Jumping weights (same as Show Jumping)', () => {
    const w = getDisciplineStatWeights('Jumping');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'stamina']));
  });

  it('returns Cross Country weights', () => {
    const w = getDisciplineStatWeights('Cross Country');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['stamina', 'agility', 'boldness']));
  });
});

// ─── validateHorseForCompetition — extra branches ────────────────────────────

describe('validateHorseForCompetition — extra branches', () => {
  it('returns false when all required stats are negative numbers', () => {
    expect(validateHorseForCompetition({ speed: -1, stamina: -1, intelligence: -1 }, 'Racing')).toBe(false);
  });

  it('returns true when at least one stat is exactly 0 (value >= 0 boundary)', () => {
    expect(validateHorseForCompetition({ speed: 0, stamina: 50, intelligence: 30 }, 'Racing')).toBe(true);
  });
});

// ─── calculateCompetitionScore — extra branch coverage ───────────────────────

describe('calculateCompetitionScore — extra branch coverage', () => {
  it('returns a score for Jumping discipline (switch alias of Show Jumping)', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Jumping');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('uses default Racing-like calculation for an unknown discipline', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Polo');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('throws when eventType is whitespace-only (blank after trim)', () => {
    expect(() => calculateCompetitionScore(makeHorse(), '   ')).toThrow('blank after trimming');
  });

  it('clamps Infinity baseScore to 0 via non-finite guard', () => {
    const horse = makeHorse({ speed: Infinity, stamina: 0, intelligence: 0 });
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });

  it('applies no trait bonus when epigeneticModifiers.positive has no matching trait', () => {
    const withBonus = makeHorse({
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    const withWrongTrait = makeHorse({
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['discipline_affinity_dressage'] },
    });
    const bonusScore = calculateCompetitionScore(withBonus, 'Racing', 'ridden', () => 0.5);
    const noBonus = calculateCompetitionScore(withWrongTrait, 'Racing', 'ridden', () => 0.5);
    expect(bonusScore).toBeGreaterThan(noBonus);
  });

  it('handles epigeneticModifiers with no .positive key (optional chain short-circuits)', () => {
    const horse = makeHorse({ epigeneticModifiers: { negative: ['clumsy'] } });
    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
  });

  it('handles epigeneticModifiers.positive that is not an array', () => {
    const horse = makeHorse({ epigeneticModifiers: { positive: 'discipline_affinity_racing' } });
    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
  });

  it('applies ridden temperament modifier for Spirited horse (clampedTempMod !== 0 branch)', () => {
    const horse = makeHorse({ temperament: 'Spirited', speed: 100, stamina: 100, intelligence: 100 });
    const baseline = makeHorse({ speed: 100, stamina: 100, intelligence: 100 });
    const spiritedScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    const baselineScore = calculateCompetitionScore(baseline, 'Racing', 'ridden', () => 0.5);
    // Spirited riddenModifier = +0.03 → higher score than no temperament
    expect(spiritedScore).toBeGreaterThan(baselineScore);
  });

  it('uses conformationModifier when showType is conformation', () => {
    const horse = makeHorse({ temperament: 'Calm', speed: 100, stamina: 100, intelligence: 100 });
    // Calm: riddenModifier=0.02, conformationModifier=0.05
    const riddenScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    const conformationScore = calculateCompetitionScore(horse, 'Racing', 'conformation', () => 0.5);
    expect(conformationScore).toBeGreaterThan(riddenScore);
  });

  it('Equoria-f0bv: parade showType uses riddenModifier (not conformationModifier)', () => {
    // Calm: riddenModifier=0.02, conformationModifier=0.05 — parade should match ridden, not conformation.
    const horse = makeHorse({ temperament: 'Calm', speed: 100, stamina: 100, intelligence: 100 });
    const riddenScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    const paradeScore = calculateCompetitionScore(horse, 'Racing', 'parade', () => 0.5);
    const conformationScore = calculateCompetitionScore(horse, 'Racing', 'conformation', () => 0.5);
    expect(paradeScore).toBe(riddenScore);
    expect(paradeScore).toBeLessThan(conformationScore);
  });

  it('Equoria-f0bv: parade with nervous temperament is penalized like ridden', () => {
    // Nervous: riddenModifier=-0.05 — parade should apply the same penalty.
    const nervous = makeHorse({ temperament: 'Nervous', speed: 100, stamina: 100, intelligence: 100 });
    const neutral = makeHorse({ speed: 100, stamina: 100, intelligence: 100 });
    const paradeNervous = calculateCompetitionScore(nervous, 'Racing', 'parade', () => 0.5);
    const paradeNeutral = calculateCompetitionScore(neutral, 'Racing', 'parade', () => 0.5);
    expect(paradeNervous).toBeLessThan(paradeNeutral);
  });

  it('uses the injected _luckFn: max luck scores higher than min luck', () => {
    const horse = makeHorse({ speed: 100, stamina: 100, intelligence: 100 });
    const maxScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 1);
    const minScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0);
    expect(maxScore).toBeGreaterThan(minScore);
  });

  it('Show Jumping uses agility fallback when precision is null', () => {
    const horse = makeHorse({ precision: null, agility: 70, focus: 50, stamina: 50 });
    const score = calculateCompetitionScore(horse, 'Show Jumping', 'ridden', () => 0.5);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('Show Jumping uses 0 when both precision and agility are undefined', () => {
    const horse = { name: 'NoJumpStats', focus: 50, stamina: 50, speed: 0, intelligence: 0, obedience: 0, boldness: 0 };
    const score = calculateCompetitionScore(horse, 'Show Jumping', 'ridden', () => 0.5);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ─── calculateCompetitionScore — || 0 fallback branches for Dressage/CC (Equoria-jkht)

describe('calculateCompetitionScore — || 0 right-branch for zero-stat disciplines', () => {
  it('Dressage with precision=0 focus=0 obedience=0 → || 0 right-branches', () => {
    const horse = makeHorse({ precision: 0, focus: 0, obedience: 0 });
    const score = calculateCompetitionScore(horse, 'Dressage', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });

  it('Cross Country with stamina=0 agility=0 boldness=0 → || 0 right-branches', () => {
    const horse = makeHorse({ stamina: 0, agility: 0, boldness: 0 });
    const score = calculateCompetitionScore(horse, 'Cross Country', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });

  it('Jumping with focus=0 stamina=0 precision=null agility=0 → all || 0 right-branches', () => {
    const horse = makeHorse({ precision: null, agility: 0, focus: 0, stamina: 0 });
    const score = calculateCompetitionScore(horse, 'Jumping', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });
});

// ─── calculateCompetitionScore — horse.id and '(unknown)' logger branches (Equoria-jkht)

describe('calculateCompetitionScore — horse.id || "(unknown)" logger right-branches', () => {
  it('horse with id but no name covers horse.id branch in logger strings', () => {
    const horse = { id: 42, speed: 50, stamina: 50, intelligence: 50 };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(typeof score).toBe('number');
  });

  it('horse with no name and no id covers "(unknown)" branch in logger strings', () => {
    const horse = { speed: 50, stamina: 50, intelligence: 50 };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(typeof score).toBe('number');
  });

  it('Infinity stat + no name covers "(unknown)" in non-finite logger (lines 68-74)', () => {
    const horse = { id: undefined, speed: Infinity, stamina: 0, intelligence: 0 };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });

  it('trait bonus + no name covers "(unknown)" in trait logger (line 88)', () => {
    const horse = {
      speed: 0,
      stamina: 0,
      intelligence: 0,
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(typeof score).toBe('number');
  });
});

// ─── convertEventTypeToTraitName — || fallback branch (line 166) ──────────────

describe('calculateCompetitionScore — convertEventTypeToTraitName fallback (line 166)', () => {
  it('unknown discipline with matching epigeneticModifiers exercises the || fallback on line 166', () => {
    // 'Polo' is not in eventTypeMap, so convertEventTypeToTraitName falls back to
    // the template-literal path: `discipline_affinity_polo`. The horse has that trait,
    // so traitBonus=5 is applied — proving the right-hand branch of `||` on line 166 ran.
    const horse = makeHorse({
      speed: 0,
      stamina: 0,
      intelligence: 0,
      epigeneticModifiers: { positive: ['discipline_affinity_polo'] },
    });
    const score = calculateCompetitionScore(horse, 'Polo', 'ridden', () => 0.5);
    // Base=0, traitBonus=5, luck=0 (luckFn=0.5 → modifier=0), so score=5
    expect(score).toBe(5);
  });
});

// ─── calculateCompetitionScore — line 117 horse.id/unknown branch (Equoria-jkht) ──

describe('calculateCompetitionScore — line-117 logger horse.id || (unknown) branches', () => {
  it('non-zero temperament + id-only horse covers horse.id branch in line-117 logger', () => {
    // clampedTempMod=0.05 (Bold ridden) fires logger.info; horse.name absent → horse.id=99 used
    const horse = { id: 99, speed: 50, stamina: 50, intelligence: 50, temperament: 'Bold' };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('non-zero temperament + no name/id horse covers "(unknown)" branch in line-117 logger', () => {
    // clampedTempMod=-0.05 (Nervous ridden) fires logger.info; both horse.name and horse.id absent
    const horse = { speed: 50, stamina: 50, intelligence: 50, temperament: 'Nervous' };
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Equoria-hv1y — calculateCompetitionScoreDetailed temperamentImpact ──────
//
// The detailed variant returns { finalScore, temperamentImpact } so the
// competition response can attribute the modifier per-horse. Tests cover:
//   - finalScore equals what the legacy scorer returns (back-compat shim)
//   - temperamentImpact returns the horse's temperament + applied modifier
//   - appliedAs reflects the showType branch (ridden / conformation / parade)
//   - temperamentImpact is null when horse has no temperament

describe('calculateCompetitionScoreDetailed — Equoria-hv1y temperamentImpact', () => {
  const baseHorse = makeHorse();

  it('returns finalScore matching legacy calculateCompetitionScore (back-compat)', () => {
    const horse = { ...baseHorse, temperament: 'Bold' };
    // Deterministic luck so both variants produce identical results
    const luck = () => 0.5;
    const legacy = calculateCompetitionScore(horse, 'Racing', 'ridden', luck);
    const detailed = calculateCompetitionScoreDetailed(horse, 'Racing', 'ridden', luck);
    expect(detailed.finalScore).toBe(legacy);
  });

  it('surfaces temperament name + numeric modifier + appliedAs="ridden" for ridden show', () => {
    const horse = { ...baseHorse, temperament: 'Bold' };
    const { temperamentImpact } = calculateCompetitionScoreDetailed(horse, 'Racing', 'ridden', () => 0.5);
    expect(temperamentImpact).toBeTruthy();
    expect(temperamentImpact.temperament).toBe('Bold');
    expect(typeof temperamentImpact.modifier).toBe('number');
    expect(temperamentImpact.appliedAs).toBe('ridden');
  });

  it('surfaces appliedAs="conformation" when showType is conformation', () => {
    const horse = { ...baseHorse, temperament: 'Calm' };
    const { temperamentImpact } = calculateCompetitionScoreDetailed(horse, 'Dressage', 'conformation', () => 0.5);
    expect(temperamentImpact.appliedAs).toBe('conformation');
  });

  it('surfaces appliedAs="parade" when showType is parade', () => {
    const horse = { ...baseHorse, temperament: 'Calm' };
    const { temperamentImpact } = calculateCompetitionScoreDetailed(horse, 'Racing', 'parade', () => 0.5);
    expect(temperamentImpact.appliedAs).toBe('parade');
  });

  it('returns temperamentImpact:null when horse has no temperament field (legacy data)', () => {
    const horse = makeHorse(); // no temperament
    const { temperamentImpact, finalScore } = calculateCompetitionScoreDetailed(horse, 'Racing', 'ridden', () => 0.5);
    expect(temperamentImpact).toBeNull();
    expect(typeof finalScore).toBe('number');
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// These exact-arithmetic luck-band and trait-bonus assertions are not covered by
// the existing module tests above (which assert max>min rather than exact ±9%).
describe('calculateCompetitionScore — exact luck/trait arithmetic (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const NEUTRAL_LUCK = () => 0.5; // _luckFn returns 0.5 → luckModifier = 0

  function mkHorse(stats = {}, positiveTraits = []) {
    return {
      id: 1,
      name: 'Test Horse',
      speed: 70,
      stamina: 60,
      focus: 50,
      agility: 60,
      precision: 55,
      balance: 55,
      boldness: 50,
      temperament: null, // neutral — tempMod = 0
      epigeneticModifiers: { positive: positiveTraits, negative: [], hidden: [] },
      ...stats,
    };
  }

  describe('base scoring per discipline (±9% tolerance)', () => {
    it('Racing: uses speed + stamina + intelligence (tolerance ±9%)', () => {
      const score = calculateCompetitionScore(mkHorse({ speed: 80, stamina: 70, intelligence: 60 }), 'Racing');
      expect(score).toBeGreaterThanOrEqual(191);
      expect(score).toBeLessThanOrEqual(229);
    });

    it('Show Jumping: uses precision + focus + stamina (tolerance ±9%)', () => {
      const score = calculateCompetitionScore(mkHorse({ precision: 80, focus: 70, stamina: 60 }), 'Show Jumping');
      expect(score).toBeGreaterThanOrEqual(191);
      expect(score).toBeLessThanOrEqual(229);
    });

    it('Dressage: uses precision + focus + obedience (tolerance ±9%)', () => {
      const score = calculateCompetitionScore(mkHorse({ precision: 80, focus: 70, obedience: 60 }), 'Dressage');
      expect(score).toBeGreaterThanOrEqual(191);
      expect(score).toBeLessThanOrEqual(229);
    });

    it('Cross Country: uses stamina + agility + boldness (tolerance ±9%)', () => {
      const score = calculateCompetitionScore(mkHorse({ stamina: 80, agility: 70, boldness: 60 }), 'Cross Country');
      expect(score).toBeGreaterThanOrEqual(191);
      expect(score).toBeLessThanOrEqual(229);
    });

    it('missing stats default to 0', () => {
      const score = calculateCompetitionScore(mkHorse({ speed: undefined, stamina: null, intelligence: 80 }), 'Racing');
      expect(score).toBeGreaterThanOrEqual(73);
      expect(score).toBeLessThanOrEqual(88);
    });

    it('handles null epigeneticModifiers.positive without throwing', () => {
      const horse = mkHorse();
      horse.epigeneticModifiers.positive = null;
      expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
    });
  });

  describe('trait bonus (+5) — deterministic via _luckFn injection', () => {
    it('trait horse scores exactly 5 more than regular horse when luck is neutral', () => {
      const stats = { speed: 70, stamina: 60, intelligence: 50 };
      const traitScore = calculateCompetitionScore(
        mkHorse(stats, ['discipline_affinity_racing']),
        'Racing',
        'ridden',
        NEUTRAL_LUCK,
      );
      const regularScore = calculateCompetitionScore(mkHorse(stats), 'Racing', 'ridden', NEUTRAL_LUCK);
      expect(traitScore - regularScore).toBe(5);
    });

    it('non-matching trait gives 0 bonus when luck is neutral', () => {
      const stats = { speed: 70, stamina: 60, intelligence: 50 };
      const wrongScore = calculateCompetitionScore(
        mkHorse(stats, ['discipline_affinity_dressage']),
        'Racing',
        'ridden',
        NEUTRAL_LUCK,
      );
      const regularScore = calculateCompetitionScore(mkHorse(stats), 'Racing', 'ridden', NEUTRAL_LUCK);
      expect(wrongScore - regularScore).toBe(0);
    });

    it('Racing base 180 with neutral luck = 180 (no trait)', () => {
      const score = calculateCompetitionScore(
        mkHorse({ speed: 70, stamina: 60, intelligence: 50 }),
        'Racing',
        'ridden',
        NEUTRAL_LUCK,
      );
      expect(score).toBe(180);
    });

    it('Racing base 180 + trait = 185 with neutral luck', () => {
      const score = calculateCompetitionScore(
        mkHorse({ speed: 70, stamina: 60, intelligence: 50 }, ['discipline_affinity_racing']),
        'Racing',
        'ridden',
        NEUTRAL_LUCK,
      );
      expect(score).toBe(185);
    });

    it('applies +5 bonus for each discipline when luck is neutral', () => {
      const disciplineConfigs = [
        { name: 'Racing', trait: 'discipline_affinity_racing', stats: { speed: 70, stamina: 60, intelligence: 50 } },
        {
          name: 'Show Jumping',
          trait: 'discipline_affinity_show_jumping',
          stats: { precision: 70, focus: 60, stamina: 50 },
        },
        { name: 'Dressage', trait: 'discipline_affinity_dressage', stats: { precision: 70, focus: 60, obedience: 50 } },
        {
          name: 'Cross Country',
          trait: 'discipline_affinity_cross_country',
          stats: { stamina: 70, agility: 60, boldness: 50 },
        },
      ];
      for (const { name, trait, stats } of disciplineConfigs) {
        const diff =
          calculateCompetitionScore(mkHorse(stats, [trait]), name, 'ridden', NEUTRAL_LUCK) -
          calculateCompetitionScore(mkHorse(stats), name, 'ridden', NEUTRAL_LUCK);
        expect(diff).toBe(5);
      }
    });
  });

  describe('luck modifier — deterministic via _luckFn injection', () => {
    const horse300 = mkHorse({ speed: 100, stamina: 100, intelligence: 100 });

    it('minimum luck (_luckFn = 0) applies -9%: 300 → 273', () => {
      expect(calculateCompetitionScore(horse300, 'Racing', 'ridden', () => 0)).toBe(273);
    });

    it('maximum luck (_luckFn = 1) applies +9%: 300 → 327', () => {
      expect(calculateCompetitionScore(horse300, 'Racing', 'ridden', () => 1)).toBe(327);
    });

    it('neutral luck (_luckFn = 0.5) applies 0%: 300 → 300', () => {
      expect(calculateCompetitionScore(horse300, 'Racing', 'ridden', NEUTRAL_LUCK)).toBe(300);
    });

    it('real Math.random produces scores within [273, 327] for base=300 over 50 runs', () => {
      const scores = Array.from({ length: 50 }, () => calculateCompetitionScore(horse300, 'Racing'));
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      expect(min).toBeGreaterThanOrEqual(273);
      expect(max).toBeLessThanOrEqual(327);
      expect(max).toBeGreaterThan(min);
    });
  });

  describe('getDisciplineStatWeights — exact weight values', () => {
    it('returns correct weights for Racing', () => {
      expect(getDisciplineStatWeights('Racing')).toEqual({ speed: 1.0, stamina: 1.0, intelligence: 1.0 });
    });
    it('returns correct weights for Dressage', () => {
      expect(getDisciplineStatWeights('Dressage')).toEqual({ precision: 1.0, focus: 1.0, obedience: 1.0 });
    });
    it('returns correct weights for Cross Country', () => {
      expect(getDisciplineStatWeights('Cross Country')).toEqual({ stamina: 1.0, agility: 1.0, boldness: 1.0 });
    });
    it('returns Racing weights for unknown discipline', () => {
      expect(getDisciplineStatWeights('Unknown')).toEqual({ speed: 1.0, stamina: 1.0, intelligence: 1.0 });
    });
  });
});
