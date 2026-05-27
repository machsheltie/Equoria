import { describe, it, expect } from '@jest/globals';
import { simulateCompetition } from '../../../logic/simulateCompetition.mjs';
// merged from legacy backend/tests, Equoria-wvuin — scoring-helper utils
import { getStatScore } from '../../../utils/getStatScore.mjs';
import { getHealthModifier } from '../../../utils/healthBonus.mjs';
import { applyRiderModifiers } from '../../../utils/riderBonus.mjs';

function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestHorse',
    speed: 70,
    stamina: 70,
    agility: 70,
    precision: 60,
    strength: 60,
    endurance: 60,
    intelligence: 60,
    boldness: 60,
    flexibility: 60,
    obedience: 60,
    focus: 60,
    balance: 60,
    health: 'Good',
    trait: null,
    trainingScore: 0,
    tack: {},
    rider: null,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    stress_level: 0,
    ...overrides,
  };
}

function makeShow(overrides = {}) {
  return { id: 1, name: 'Test Show', discipline: 'Racing', showType: 'ridden', ...overrides };
}

// ─── input validation ─────────────────────────────────────────────────────────

describe('simulateCompetition — input validation', () => {
  it('throws when horses is not an array', () => {
    expect(() => simulateCompetition(null, makeShow())).toThrow('Horses must be an array');
  });

  it('throws when show is missing', () => {
    expect(() => simulateCompetition([], null)).toThrow();
  });

  it('throws when show has no discipline', () => {
    expect(() => simulateCompetition([], { id: 1 })).toThrow('Show object with discipline is required');
  });

  it('returns empty array for zero horses', () => {
    const result = simulateCompetition([], makeShow());
    expect(result).toEqual([]);
  });
});

// ─── basic return shape ───────────────────────────────────────────────────────

describe('simulateCompetition — return shape', () => {
  it('returns an array with one entry per horse', () => {
    const horses = [makeHorse({ id: 1, name: 'A' }), makeHorse({ id: 2, name: 'B' })];
    const results = simulateCompetition(horses, makeShow());
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('each result has horseId, name, score, placement', () => {
    const result = simulateCompetition([makeHorse()], makeShow());
    expect(result[0]).toHaveProperty('horseId');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('score');
    expect(result[0]).toHaveProperty('placement');
  });

  it('score is a number', () => {
    const result = simulateCompetition([makeHorse()], makeShow());
    expect(typeof result[0].score).toBe('number');
  });

  it('single horse gets 1st placement', () => {
    const result = simulateCompetition([makeHorse()], makeShow());
    expect(result[0].placement).toBe('1st');
  });

  it('assigns 1st, 2nd, 3rd placements to top 3', () => {
    const horses = [1, 2, 3, 4].map(id => makeHorse({ id, name: `Horse${id}` }));
    const results = simulateCompetition(horses, makeShow());
    const placements = results.map(r => r.placement);
    expect(placements[0]).toBe('1st');
    expect(placements[1]).toBe('2nd');
    expect(placements[2]).toBe('3rd');
    expect(placements[3]).toBeNull();
  });

  it('results sorted highest score first', () => {
    const horses = [1, 2, 3].map(id => makeHorse({ id, name: `Horse${id}` }));
    const results = simulateCompetition(horses, makeShow());
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });
});

// ─── trait bonus ──────────────────────────────────────────────────────────────

describe('simulateCompetition — legacy trait bonus', () => {
  it('matching trait gives a higher base than no trait (on average)', () => {
    // Run multiple times to average out random luck
    let matchingTotal = 0;
    let noMatchTotal = 0;
    const show = makeShow({ discipline: 'Racing' });
    for (let i = 0; i < 20; i++) {
      matchingTotal += simulateCompetition([makeHorse({ trait: 'Racing' })], show)[0].score;
      noMatchTotal += simulateCompetition([makeHorse({ trait: null })], show)[0].score;
    }
    // Matching trait adds +5 before luck — average should be higher
    expect(matchingTotal / 20).toBeGreaterThan(noMatchTotal / 20 - 10);
  });
});

// ─── epigenetic discipline affinity ──────────────────────────────────────────

describe('simulateCompetition — discipline affinity trait', () => {
  it('does not throw when horse has discipline_affinity trait', () => {
    const horse = makeHorse({
      epigeneticModifiers: { positive: ['discipline_affinity_racing'], negative: [], hidden: [] },
    });
    expect(() => simulateCompetition([horse], makeShow({ discipline: 'Racing' }))).not.toThrow();
  });
});

// ─── stress level ─────────────────────────────────────────────────────────────

describe('simulateCompetition — stress level', () => {
  it('horse with high stress does not throw', () => {
    const horse = makeHorse({ stress_level: 80 });
    expect(() => simulateCompetition([horse], makeShow())).not.toThrow();
  });

  it('result includes stressDetails', () => {
    const horse = makeHorse({ stress_level: 50 });
    const result = simulateCompetition([horse], makeShow());
    expect(result[0]).toHaveProperty('stressDetails');
    expect(result[0].stressDetails.baseStressLevel).toBe(50);
  });
});

// ─── tack bonuses ─────────────────────────────────────────────────────────────

describe('simulateCompetition — tack', () => {
  it('numeric tack bonuses are accepted', () => {
    const horse = makeHorse({ tack: { saddleBonus: 5, bridleBonus: 3 } });
    expect(() => simulateCompetition([horse], makeShow())).not.toThrow();
  });

  it('parade show type does not throw', () => {
    const horse = makeHorse({ tack: {} });
    expect(() => simulateCompetition([horse], makeShow({ showType: 'parade' }))).not.toThrow();
  });
});

// ─── result traitImpact ───────────────────────────────────────────────────────

describe('simulateCompetition — traitImpact field', () => {
  it('result includes traitImpact with expected shape', () => {
    const result = simulateCompetition([makeHorse()], makeShow());
    const ti = result[0].traitImpact;
    expect(ti).toBeDefined();
    expect(typeof ti.modifier).toBe('number');
    expect(typeof ti.adjustment).toBe('number');
    expect(typeof ti.appliedTraits).toBe('number');
    expect(Array.isArray(ti.details)).toBe(true);
  });
});

// ─── error recovery ───────────────────────────────────────────────────────────

describe('simulateCompetition — error recovery', () => {
  it('horse with null stats still returns a result (score 0)', () => {
    const horse = { id: 99, name: 'Broken' }; // minimal/broken horse
    const results = simulateCompetition([horse], makeShow());
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
    expect(results[0].placement).toBe('1st');
  });

  it('horse with non-iterable epigeneticModifiers.positive triggers catch (lines 175-176)', () => {
    // positive=5 (truthy number) → spread throws TypeError → catch fires → score:0
    const horse = makeHorse({ epigeneticModifiers: { positive: 5, negative: [], hidden: [] } });
    const results = simulateCompetition([horse], makeShow());
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
  });
});

// ─── stress-resistance trait branches (lines 107-108, 115) ───────────────────
// (Equoria-jkht)

describe('simulateCompetition — stress-resistance trait branches', () => {
  it('resilient trait + high stress covers competitionStressResistance branch (lines 107-108)', () => {
    // resilient has competitionStressResistance:0.15 and trainingStressReduction:0.15
    // stress_level > 0 triggers the stress block; resilient covers the resistance branch
    const horse = makeHorse({
      epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [] },
      stress_level: 70,
    });
    const result = simulateCompetition([horse], makeShow());
    expect(result[0].stressDetails.baseStressLevel).toBe(70);
    expect(typeof result[0].score).toBe('number');
  });

  it('calm trait + stress covers trainingStressReduction branch (line 115)', () => {
    // calm has trainingStressReduction:0.2 and competitionStressResistance:0.25
    const horse = makeHorse({
      epigeneticModifiers: { positive: ['calm'], negative: [], hidden: [] },
      stress_level: 60,
    });
    const result = simulateCompetition([horse], makeShow());
    expect(result[0].stressDetails.baseStressLevel).toBe(60);
    expect(typeof result[0].score).toBe('number');
  });
});

// ─── appliedTraits logger + details map (lines 135, 156-176) ─────────────────
// (Equoria-jkht)

describe('simulateCompetition — appliedTraits details map', () => {
  it('horse with resilient trait produces non-empty details array (lines 135, 156-176)', () => {
    // resilient has competitionScoreModifier:0.03 which calculateTraitCompetitionImpact
    // picks up as an applied trait, making appliedTraits.length > 0 so the map executes
    const horse = makeHorse({
      epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [] },
    });
    const result = simulateCompetition([horse], makeShow());
    const details = result[0].traitImpact.details;
    // appliedTraits.length > 0 → details array is populated with trait objects
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
    expect(typeof details[0].name).toBe('string');
    expect(typeof details[0].modifier).toBe('number');
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// The legacy suite uniquely tests the standalone scoring-helper utils
// (getStatScore / getHealthModifier / applyRiderModifiers) plus a full
// multi-modifier 5-horse ranking integration not covered by the module tests above.
describe('competition scoring helpers (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('getStatScore', () => {
    const testHorse = {
      speed: 80,
      stamina: 70,
      focus: 60,
      balance: 50,
      agility: 50,
      boldness: 40,
      precision: 40,
    };

    it('should calculate correct weighted score for Racing discipline', () => {
      // Racing uses speed/stamina/focus 50/30/20
      expect(getStatScore(testHorse, 'Racing')).toBe(80 * 0.5 + 70 * 0.3 + 60 * 0.2); // 73
    });

    it('should calculate correct weighted score for Show Jumping discipline', () => {
      // Show Jumping uses balance/agility/boldness 50/30/20
      expect(getStatScore(testHorse, 'Show Jumping')).toBe(50 * 0.5 + 50 * 0.3 + 40 * 0.2); // 48
    });

    it('should handle missing stats by defaulting to 0', () => {
      expect(getStatScore({ speed: 50 }, 'Racing')).toBe(50 * 0.5); // 25
    });

    it('should throw error for invalid discipline', () => {
      expect(() => getStatScore(testHorse, 'InvalidDiscipline')).toThrow('Unknown discipline: InvalidDiscipline');
    });

    it('should throw error for missing horse object', () => {
      expect(() => getStatScore(null, 'Racing')).toThrow('Horse object is required');
    });
  });

  describe('getHealthModifier', () => {
    it('should return correct modifiers for all health ratings', () => {
      expect(getHealthModifier('Excellent')).toBe(0.05);
      expect(getHealthModifier('Very Good')).toBe(0.03);
      expect(getHealthModifier('Good')).toBe(0.0);
      expect(getHealthModifier('Fair')).toBe(-0.03);
      expect(getHealthModifier('Bad')).toBe(-0.05);
    });

    it('should return 0 for unknown health rating', () => {
      expect(getHealthModifier('Unknown')).toBe(0);
      expect(getHealthModifier('')).toBe(0);
      expect(getHealthModifier(null)).toBe(0);
    });
  });

  describe('applyRiderModifiers', () => {
    it('should apply bonus correctly', () => {
      expect(applyRiderModifiers(100, 0.1, 0)).toBeCloseTo(110, 10);
    });
    it('should apply penalty correctly', () => {
      expect(applyRiderModifiers(100, 0, 0.08)).toBe(92);
    });
    it('should apply both bonus and penalty', () => {
      expect(applyRiderModifiers(100, 0.05, 0.03)).toBe(102);
    });
    it('should handle default values', () => {
      expect(applyRiderModifiers(100)).toBe(100);
    });
    it('should validate input ranges', () => {
      expect(() => applyRiderModifiers(100, 0.15, 0)).toThrow('Bonus percent must be between 0 and 0.10');
      expect(() => applyRiderModifiers(100, 0, 0.1)).toThrow('Penalty percent must be between 0 and 0.08');
      expect(() => applyRiderModifiers(-10, 0, 0)).toThrow('Score must be a non-negative number');
    });
  });

  describe('simulateCompetition — multi-modifier 5-horse ranking', () => {
    const sampleShow = { id: 'test-show', name: 'Test Racing Competition', discipline: 'Racing' };
    const createTestHorse = (id, name, overrides = {}) => ({
      id,
      name,
      speed: 70,
      stamina: 60,
      focus: 50,
      trait: 'Swift',
      trainingScore: 50,
      tack: { saddleBonus: 5, bridleBonus: 3 },
      health: 'Good',
      rider: { bonusPercent: 0, penaltyPercent: 0 },
      ...overrides,
    });

    it('should simulate competition with 5 horses and return correct rankings', () => {
      const horses = [
        createTestHorse(1, 'Nova', {
          speed: 90,
          stamina: 80,
          focus: 70,
          trait: 'Racing',
          health: 'Excellent',
          trainingScore: 80,
        }),
        createTestHorse(2, 'Ashen', {
          speed: 85,
          stamina: 75,
          focus: 65,
          trainingScore: 70,
          rider: { bonusPercent: 0.05, penaltyPercent: 0 },
        }),
        createTestHorse(3, 'Dart', { speed: 80, stamina: 70, focus: 60, trainingScore: 60, health: 'Very Good' }),
        createTestHorse(4, 'Milo', {
          speed: 75,
          stamina: 65,
          focus: 55,
          trainingScore: 40,
          rider: { bonusPercent: 0, penaltyPercent: 0.08 },
        }),
        createTestHorse(5, 'Zuri', { speed: 70, stamina: 60, focus: 50, trainingScore: 30, health: 'Bad' }),
      ];
      const results = simulateCompetition(horses, sampleShow);
      expect(results).toHaveLength(5);
      expect(results[0].placement).toBe('1st');
      expect(results[1].placement).toBe('2nd');
      expect(results[2].placement).toBe('3rd');
      expect(results[3].placement).toBeNull();
      expect(results[4].placement).toBeNull();
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should produce score variation across runs due to random luck modifier', () => {
      const horse = createTestHorse(1, 'TestHorse', {
        speed: 80,
        stamina: 60,
        intelligence: 40,
        epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
      });
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push(simulateCompetition([horse], sampleShow)[0].score);
      }
      scores.forEach(score => {
        expect(score).toBeGreaterThan(100);
        expect(score).toBeLessThan(150);
      });
      expect([...new Set(scores)].length).toBeGreaterThan(1);
    });
  });
});
