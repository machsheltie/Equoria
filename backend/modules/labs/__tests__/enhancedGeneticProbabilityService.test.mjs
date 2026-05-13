/**
 * enhancedGeneticProbabilityService — unit tests (Equoria-rr7)
 *
 * Pure functions: only logger + HORSE_STAT_VALUES (constants). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateEnhancedGeneticProbabilities,
  calculateGeneticCompatibilityScore,
  simulateBreedingOutcomes,
  calculateMultiGenerationalPredictions,
  calculateGeneticDiversityImpact,
  calculateTraitInteractions,
  generateBreedingRecommendations,
  predictOffspringPerformance,
} from '../../../services/enhancedGeneticProbabilityService.mjs';

const stallion = {
  id: 1,
  traits: {
    positive: ['athletic', 'intelligent'],
    negative: [],
    hidden: ['trainabilityBoost'],
  },
  stats: { speed: 80, stamina: 70, agility: 75, endurance: 65, strength: 60 },
  disciplines: ['Dressage', 'Show Jumping'],
};

const mare = {
  id: 2,
  traits: {
    positive: ['calm', 'athletic'],
    negative: ['nervous'],
    hidden: [],
  },
  stats: { speed: 65, stamina: 80, agility: 70, endurance: 75, strength: 55 },
  disciplines: ['Dressage', 'Endurance'],
};

const minimalHorse = { id: 3, traits: { positive: [], negative: [], hidden: [] }, stats: {} };

// ---------------------------------------------------------------------------
// calculateEnhancedGeneticProbabilities
// ---------------------------------------------------------------------------
describe('calculateEnhancedGeneticProbabilities', () => {
  it('returns expected shape', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(result).toHaveProperty('traitProbabilities');
    expect(result).toHaveProperty('statProbabilities');
    expect(result).toHaveProperty('disciplineProbabilities');
    expect(result).toHaveProperty('overallGeneticScore');
    expect(result).toHaveProperty('calculatedAt');
  });

  it('calculatedAt is an ISO date string', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(typeof result.calculatedAt).toBe('string');
    expect(() => new Date(result.calculatedAt)).not.toThrow();
  });

  it('traitProbabilities has positive, negative, hidden arrays', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(Array.isArray(result.traitProbabilities.positive)).toBe(true);
    expect(Array.isArray(result.traitProbabilities.negative)).toBe(true);
    expect(Array.isArray(result.traitProbabilities.hidden)).toBe(true);
  });

  it('works with minimal horse objects', () => {
    const result = calculateEnhancedGeneticProbabilities(minimalHorse, minimalHorse);
    expect(typeof result.overallGeneticScore).toBe('number');
  });

  it('overallGeneticScore is a number', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(typeof result.overallGeneticScore).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticCompatibilityScore
// ---------------------------------------------------------------------------
describe('calculateGeneticCompatibilityScore', () => {
  it('returns expected shape', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('traitCompatibility');
    expect(result).toHaveProperty('statCompatibility');
    expect(result).toHaveProperty('disciplineCompatibility');
    expect(result).toHaveProperty('diversityScore');
  });

  it('overallScore is a number between 0 and 100', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('traitCompatibility includes score and compatibilityLevel', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof result.traitCompatibility.score).toBe('number');
    expect(typeof result.traitCompatibility.compatibilityLevel).toBe('string');
  });

  it('shared positive traits increase compatibility', () => {
    const matchStallion = { ...stallion, traits: { positive: ['athletic', 'calm'], negative: [], hidden: [] } };
    const matchMare = { ...mare, traits: { positive: ['athletic', 'calm'], negative: [], hidden: [] } };
    const single = calculateGeneticCompatibilityScore(stallion, minimalHorse);
    const match = calculateGeneticCompatibilityScore(matchStallion, matchMare);
    expect(match.traitCompatibility.score).toBeGreaterThanOrEqual(single.traitCompatibility.score);
  });

  it('works with minimal horses', () => {
    const result = calculateGeneticCompatibilityScore(minimalHorse, minimalHorse);
    expect(typeof result.overallScore).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// simulateBreedingOutcomes
// ---------------------------------------------------------------------------
describe('simulateBreedingOutcomes', () => {
  it('returns expected shape', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 42 });
    expect(result).toHaveProperty('outcomes');
    expect(result).toHaveProperty('statistics');
    expect(result).toHaveProperty('confidenceIntervals');
    expect(result).toHaveProperty('simulationParameters');
  });

  it('outcomes array has length = iterations', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 10, seed: 1 });
    expect(result.outcomes).toHaveLength(10);
  });

  it('each outcome has traits and stats', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 3, seed: 1 });
    for (const outcome of result.outcomes) {
      expect(outcome).toHaveProperty('traits');
      expect(outcome).toHaveProperty('stats');
    }
  });

  it('is deterministic with same seed', () => {
    const r1 = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 77 });
    const r2 = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 77 });
    expect(r1.outcomes).toEqual(r2.outcomes);
  });

  it('defaults to 100 iterations when not specified', () => {
    const result = simulateBreedingOutcomes(stallion, mare);
    expect(result.outcomes.length).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateMultiGenerationalPredictions
// ---------------------------------------------------------------------------
describe('calculateMultiGenerationalPredictions', () => {
  const lineage = [{ horses: [minimalHorse] }, { horses: [minimalHorse, minimalHorse] }];

  it('returns an object for valid lineage', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, lineage);
    expect(typeof result).toBe('object');
  });

  it('accepts empty lineage array', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, []);
    expect(typeof result).toBe('object');
  });

  it('accepts lineage as object with generations property', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, { generations: lineage });
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticDiversityImpact
// ---------------------------------------------------------------------------
describe('calculateGeneticDiversityImpact', () => {
  it('returns an object', () => {
    const result = calculateGeneticDiversityImpact(stallion, mare, []);
    expect(typeof result).toBe('object');
  });

  it('does not throw for empty lineage', () => {
    expect(() => calculateGeneticDiversityImpact(stallion, mare, [])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateTraitInteractions
// ---------------------------------------------------------------------------
describe('calculateTraitInteractions', () => {
  it('returns expected shape with synergisticPairs and antagonisticPairs', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(result).toHaveProperty('synergisticPairs');
    expect(result).toHaveProperty('antagonisticPairs');
    expect(result).toHaveProperty('interactionScore');
  });

  it('synergisticPairs and antagonisticPairs are arrays', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(Array.isArray(result.synergisticPairs)).toBe(true);
    expect(Array.isArray(result.antagonisticPairs)).toBe(true);
  });

  it('interactionScore is a number', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(typeof result.interactionScore).toBe('number');
  });

  it('works with minimal horses', () => {
    const result = calculateTraitInteractions(minimalHorse, minimalHorse);
    expect(result.synergisticPairs).toHaveLength(0);
    expect(result.antagonisticPairs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateBreedingRecommendations
// ---------------------------------------------------------------------------
describe('generateBreedingRecommendations', () => {
  it('returns an object with recommendations', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(result).toHaveProperty('overallRecommendation');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('concerns');
    expect(result).toHaveProperty('compatibilityScore');
  });

  it('strengths and concerns are arrays', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it('overallRecommendation is a string', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(typeof result.overallRecommendation).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// predictOffspringPerformance
// ---------------------------------------------------------------------------
describe('predictOffspringPerformance', () => {
  it('returns expected shape', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(result).toHaveProperty('disciplinePredictions');
    expect(result).toHaveProperty('overallPotential');
    expect(result).toHaveProperty('strengthAreas');
    expect(result).toHaveProperty('developmentAreas');
  });

  it('overallPotential is a number between 0 and 100', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(typeof result.overallPotential).toBe('number');
    expect(result.overallPotential).toBeGreaterThanOrEqual(0);
    expect(result.overallPotential).toBeLessThanOrEqual(100);
  });

  it('strengthAreas is an array', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(Array.isArray(result.strengthAreas)).toBe(true);
  });

  it('works with minimal horses', () => {
    const result = predictOffspringPerformance(minimalHorse, minimalHorse);
    expect(typeof result).toBe('object');
  });
});

// ── calculateGeneticDiversityImpact — riskLevel + recommendations branches (Equoria-jkht) ──
// Drives getRiskLevel 'high' / 'moderate' / 'low' and all four generateDiversityRecommendations
// branches by constructing lineage fixtures with controllable inbreeding coefficients.

describe('calculateGeneticDiversityImpact() — riskLevel + recommendations branches (Equoria-jkht)', () => {
  it('returns riskLevel=high when shared sireId causes coefficient > 0.25', () => {
    // stallionAncestors={anc-A,anc-B,lin-X,lin-Y}, mareAncestors={anc-A,anc-C,lin-X,lin-Y}
    // sharedAncestors=[anc-A,lin-X,lin-Y]=3, total=8 → coefficient=3/8=0.375 > 0.25 → 'high'
    const s = { sireId: 'anc-A', damId: 'anc-B', traits: { positive: [], negative: [], hidden: [] } };
    const m = { sireId: 'anc-A', damId: 'anc-C', traits: { positive: [], negative: [], hidden: [] } };
    const lineage = [
      { horses: [{ id: 'lin-X', traits: { positive: [], negative: [], hidden: [] } }] },
      { horses: [{ id: 'lin-Y', traits: { positive: [], negative: [], hidden: [] } }] },
    ];
    const result = calculateGeneticDiversityImpact(s, m, lineage);
    expect(result.riskLevel).toBe('high');
    expect(result.inbreedingCoefficient).toBeGreaterThan(0.25);
  });

  it('returns riskLevel=moderate when coefficient is 0.25 (> 0.125 but not > 0.25)', () => {
    // Different parents but 2 shared lineage horses → coefficient=2/8=0.25 → 'moderate'
    const s = { sireId: 'sire-A', damId: 'dam-B', traits: { positive: ['calm'], negative: [], hidden: [] } };
    const m = { sireId: 'sire-C', damId: 'dam-D', traits: { positive: ['patient'], negative: [], hidden: [] } };
    const lineage = [
      { horses: [{ id: 'lin-1', traits: { positive: [], negative: [], hidden: [] } }] },
      { horses: [{ id: 'lin-2', traits: { positive: [], negative: [], hidden: [] } }] },
    ];
    const result = calculateGeneticDiversityImpact(s, m, lineage);
    expect(result.riskLevel).toBe('moderate');
    expect(result.inbreedingCoefficient).toBe(0.25);
  });

  it('returns riskLevel=low with fully diverse parents and empty lineage', () => {
    // coefficient=0 (no lineage), diversityScore=80 (all unique traits), healthScore=95 → 'low'
    const s = { traits: { positive: ['brave', 'athletic'], negative: [], hidden: [] } };
    const m = { traits: { positive: ['calm', 'patient'], negative: [], hidden: [] } };
    const result = calculateGeneticDiversityImpact(s, m, []);
    expect(result.riskLevel).toBe('low');
    expect(result.inbreedingCoefficient).toBe(0);
  });

  it('includes outcrossing recommendation when inbreedingCoefficient > 0.125', () => {
    const s = { sireId: 'anc-A', damId: 'anc-B', traits: { positive: ['nervous'], negative: [], hidden: [] } };
    const m = { sireId: 'anc-A', damId: 'anc-C', traits: { positive: ['nervous'], negative: [], hidden: [] } };
    const lineage = [
      { horses: [{ id: 'lx', traits: { positive: [], negative: [], hidden: [] } }] },
      { horses: [{ id: 'ly', traits: { positive: [], negative: [], hidden: [] } }] },
    ];
    const result = calculateGeneticDiversityImpact(s, m, lineage);
    expect(result.diversityRecommendations).toEqual(expect.arrayContaining([expect.stringMatching(/outcrossing/i)]));
  });

  it('includes diversity recommendation when diversityScore < 40', () => {
    // All same traits → diversityRatio=0 → diversityScore=0 < 40 → 'Seek breeding partners'
    const s = { traits: { positive: ['nervous', 'stubborn'], negative: [], hidden: [] } };
    const m = { traits: { positive: ['nervous', 'stubborn'], negative: [], hidden: [] } };
    const result = calculateGeneticDiversityImpact(s, m, []);
    expect(result.diversityRecommendations).toEqual(
      expect.arrayContaining([expect.stringMatching(/different trait profiles/i)]),
    );
  });

  it('includes excellent-diversity recommendation when diversityScore > 80 and coefficient < 0.05', () => {
    // All unique traits + 1 lineage gen (lineageBonus=2) → diversityScore=82 > 80, coeff=0 < 0.05
    const s = { traits: { positive: ['brave', 'athletic', 'bold', 'focused'], negative: [], hidden: [] } };
    const m = { traits: { positive: ['calm', 'patient', 'resilient', 'curious'], negative: [], hidden: [] } };
    const lineage = [{ horses: [{ id: 'u1', traits: { positive: ['special'], negative: [], hidden: [] } }] }];
    const result = calculateGeneticDiversityImpact(s, m, lineage);
    expect(result.diversityRecommendations).toEqual(
      expect.arrayContaining([expect.stringMatching(/excellent genetic diversity/i)]),
    );
  });
});

// ── generateBreedingRecommendations — 'Highly Recommended' / 'Not Recommended' (Equoria-jkht) ──

describe('generateBreedingRecommendations() — tier branches (Equoria-jkht)', () => {
  it('returns Highly Recommended for pair with 5 shared positive traits and complementary stats', () => {
    // traitScore=90, statScore=85 (all complementary), disciplineScore=88, diversityScore=62 → overall≈83
    const s = {
      traits: {
        positive: ['athletic', 'intelligent', 'calm', 'bold', 'resilient', 'focused'],
        negative: [],
        hidden: ['h1', 'h2', 'h3'],
      },
      stats: {
        speed: 70,
        stamina: 80,
        agility: 60,
        balance: 75,
        precision: 65,
        intelligence: 80,
        boldness: 70,
        flexibility: 75,
        obedience: 65,
        focus: 80,
      },
      disciplineScores: { racing: 90, dressage: 85 },
    };
    const m = {
      traits: {
        positive: ['athletic', 'intelligent', 'calm', 'bold', 'resilient', 'curious'],
        negative: [],
        hidden: ['hA', 'hB', 'hC'],
      },
      stats: {
        speed: 80,
        stamina: 65,
        agility: 75,
        balance: 60,
        precision: 80,
        intelligence: 65,
        boldness: 80,
        flexibility: 60,
        obedience: 80,
        focus: 65,
      },
      disciplineScores: { racing: 85, dressage: 90 },
    };
    const result = generateBreedingRecommendations(s, m);
    expect(result.overallRecommendation).toBe('Highly Recommended');
  });

  it('returns Not Recommended for conflicting-trait pair with incompatible stats', () => {
    // 6 trait conflicts (3 each direction) → traitScore=0, extreme stat diffs → statScore=40
    const s = {
      traits: {
        positive: ['nervous', 'stubborn', 'lazy'],
        negative: ['athletic', 'calm', 'bold'],
        hidden: [],
      },
      stats: { speed: 20, stamina: 90 },
    };
    const m = {
      traits: {
        positive: ['athletic', 'calm', 'bold'],
        negative: ['nervous', 'stubborn', 'lazy'],
        hidden: [],
      },
      stats: { speed: 90, stamina: 20 },
    };
    const result = generateBreedingRecommendations(s, m);
    expect(result.overallRecommendation).toBe('Not Recommended');
  });
});

// ── calculateMultiGenerationalPredictions — analyzeLineagePatterns weaknesses (Equoria-jkht) ──

describe('calculateMultiGenerationalPredictions() — lineageWeaknesses branch (Equoria-jkht)', () => {
  it('returns non-empty lineageWeaknesses when lineage horses have nervous/stubborn/lazy traits', () => {
    const s = { traits: { positive: [], negative: [], hidden: [] } };
    const m = { traits: { positive: [], negative: [], hidden: [] } };
    const lineage = [
      {
        horses: [
          { id: 1, traits: { positive: [], negative: ['nervous', 'stubborn'], hidden: [] } },
          { id: 2, traits: { positive: [], negative: ['lazy'], hidden: [] } },
        ],
      },
    ];
    const result = calculateMultiGenerationalPredictions(s, m, lineage);
    expect(Array.isArray(result.lineageWeaknesses)).toBe(true);
    expect(result.lineageWeaknesses.length).toBeGreaterThan(0);
    const weaknessTraits = result.lineageWeaknesses.map(w => w.trait);
    expect(weaknessTraits).toEqual(expect.arrayContaining(['nervous']));
  });

  it('returns overallLineageScore reduced by weaknesses (score = max(0, 75 - weaknesses*10 + strengths*5))', () => {
    const s = { traits: { positive: [], negative: [], hidden: [] } };
    const m = { traits: { positive: [], negative: [], hidden: [] } };
    // 4 horses: each negative trait appears 1/4=25% < 30% threshold → NOT counted as strengths
    // weaknesses=3 (nervous/stubborn/lazy appear at least once), strengths=0 → score = max(0,75-30+0)=45
    const lineage = [
      {
        horses: [
          { id: 3, traits: { positive: [], negative: ['nervous', 'stubborn', 'lazy'], hidden: [] } },
          { id: 6, traits: { positive: ['athletic'], negative: [], hidden: [] } },
          { id: 7, traits: { positive: ['brave'], negative: [], hidden: [] } },
          { id: 8, traits: { positive: ['calm'], negative: [], hidden: [] } },
        ],
      },
    ];
    const result = calculateMultiGenerationalPredictions(s, m, lineage);
    // 3 weaknesses, 0 strengths → score = max(0, 75 - 30 + 0) = 45
    expect(result.overallLineageScore).toBe(45);
    expect(result.lineageWeaknesses).toHaveLength(3);
  });

  it('returns lineageStrengths when trait appears in > 30% of horses', () => {
    const s = { traits: { positive: [], negative: [], hidden: [] } };
    const m = { traits: { positive: [], negative: [], hidden: [] } };
    const lineage = [
      {
        horses: [
          { id: 4, traits: { positive: ['athletic'], negative: [], hidden: [] } },
          { id: 5, traits: { positive: ['athletic'], negative: [], hidden: [] } },
        ],
      },
    ];
    const result = calculateMultiGenerationalPredictions(s, m, lineage);
    // 2/2 = 100% > 30% → 'athletic' in strengths
    expect(Array.isArray(result.lineageStrengths)).toBe(true);
    expect(result.lineageStrengths.map(s => s.trait)).toContain('athletic');
  });
});

// ── calculateTraitCompatibility — compatibilityLevel 'excellent' / 'poor' (Equoria-jkht) ──

describe('calculateGeneticCompatibilityScore() — compatibilityLevel branches (Equoria-jkht)', () => {
  it('traitCompatibility.compatibilityLevel is excellent when score > 75 (5+ shared positives)', () => {
    const s = { traits: { positive: ['brave', 'athletic', 'bold', 'calm', 'resilient'], negative: [], hidden: [] } };
    const m = { traits: { positive: ['brave', 'athletic', 'bold', 'calm', 'resilient'], negative: [], hidden: [] } };
    const result = calculateGeneticCompatibilityScore(s, m);
    expect(result.traitCompatibility.compatibilityLevel).toBe('excellent');
  });

  it('traitCompatibility.compatibilityLevel is poor when score <= 50 (many conflicts)', () => {
    const s = { traits: { positive: ['nervous', 'stubborn'], negative: ['calm', 'athletic'], hidden: [] } };
    const m = { traits: { positive: ['calm', 'athletic'], negative: ['nervous', 'stubborn'], hidden: [] } };
    const result = calculateGeneticCompatibilityScore(s, m);
    // 4 conflicts → score = 50 - 60 = max(0,-10)=0 → NOT > 50 → 'poor'
    expect(result.traitCompatibility.compatibilityLevel).toBe('poor');
  });
});

// ── calculateStatCompatibility — allStats.size === 0 early return (Equoria-jkht) ──

describe('calculateGeneticCompatibilityScore() — empty stats balanceScore=50 branch (Equoria-jkht)', () => {
  it('statCompatibility.balanceScore is 50 when both horses have no stats', () => {
    const s = { traits: { positive: ['brave'], negative: [], hidden: [] } };
    const m = { traits: { positive: ['calm'], negative: [], hidden: [] } };
    // no stats property → calculateStatCompatibility({},{}) → allStats.size=0 → {balanceScore:50}
    const result = calculateGeneticCompatibilityScore(s, m);
    expect(result.statCompatibility.balanceScore).toBe(50);
  });
});

// ── catch-block coverage via Proxy (Equoria-jkht) ─────────────────────────────
// Each function has a try/catch that re-throws. Passing a Proxy that throws on
// property access causes the catch to fire and then re-throw.

describe('catch blocks — Proxy-triggered error paths (Equoria-jkht)', () => {
  const makeBomb = () =>
    new Proxy(
      {},
      {
        get(_t, _prop) {
          throw new Error('property access bomb');
        },
      },
    );

  it('calculateEnhancedGeneticProbabilities catch (lines 59-60)', () => {
    expect(() => calculateEnhancedGeneticProbabilities(makeBomb(), {})).toThrow('property access bomb');
  });

  it('calculateGeneticCompatibilityScore catch (lines 275-276)', () => {
    expect(() => calculateGeneticCompatibilityScore(makeBomb(), {})).toThrow('property access bomb');
  });

  it('simulateBreedingOutcomes catch (lines 1212-1213)', () => {
    expect(() => simulateBreedingOutcomes(makeBomb(), {}, { iterations: 1 })).toThrow('property access bomb');
  });

  it('calculateMultiGenerationalPredictions catch (lines 1302-1303)', () => {
    expect(() => calculateMultiGenerationalPredictions(makeBomb(), {}, [])).toThrow('property access bomb');
  });

  it('calculateGeneticDiversityImpact catch (lines 1338-1339)', () => {
    expect(() => calculateGeneticDiversityImpact(makeBomb(), {}, [])).toThrow('property access bomb');
  });

  it('calculateTraitInteractions catch (lines 1423-1424)', () => {
    expect(() => calculateTraitInteractions(makeBomb(), {})).toThrow('property access bomb');
  });

  it('generateBreedingRecommendations catch (lines 1496-1497)', () => {
    expect(() => generateBreedingRecommendations(makeBomb(), {})).toThrow('property access bomb');
  });

  it('predictOffspringPerformance catch (lines 1536-1537)', () => {
    expect(() => predictOffspringPerformance(makeBomb(), {})).toThrow('property access bomb');
  });
});

// ── identifyStrengthAreas — predictedScore > 75 (Equoria-jkht) ───────────────
// predictOffspringPerformance → identifyStrengthAreas: line 1100 strengths.push
// fires when predictedScore > 75. Achieved by giving both parents speed=90,
// stamina=90, agility=90 (racing relevant stats) → expectedValue=90 each →
// baseScore = 50 + (40+40+40)*0.3 = 86 > 75.

describe('predictOffspringPerformance — identifyStrengthAreas strengths push (Equoria-jkht)', () => {
  it('strengthAreas is non-empty when both parents have high racing stats (line 1100)', () => {
    const s = {
      id: 1,
      traits: { positive: [], negative: [], hidden: [] },
      speed: 90,
      stamina: 90,
      agility: 90,
    };
    const m = {
      id: 2,
      traits: { positive: [], negative: [], hidden: [] },
      speed: 90,
      stamina: 90,
      agility: 90,
    };
    const result = predictOffspringPerformance(s, m);
    expect(Array.isArray(result.strengthAreas)).toBe(true);
    expect(result.strengthAreas.length).toBeGreaterThan(0);
    expect(result.strengthAreas[0]).toHaveProperty('area');
    expect(result.strengthAreas[0]).toHaveProperty('score');
    expect(result.strengthAreas[0].score).toBeGreaterThan(75);
  });
});

// ── generateBreedingRecommendations — 'Acceptable' tier (Equoria-jkht) ────────
// overallRecommendation = 'Acceptable' fires when 45 ≤ overallScore < 65 (line 1441).
// 3 shared positive traits → traitScore = 74, no stats/disciplines → statScore=50,
// disciplineScore=50, diversityScore=0 (all traits shared).
// overallScore = round(74*0.3 + 50*0.25 + 50*0.25 + 0*0.2) = round(47.2) = 47 ∈ [45,65).

describe('generateBreedingRecommendations — Acceptable tier (Equoria-jkht)', () => {
  it('returns Acceptable for moderate pair with 3 shared positive traits (line 1441)', () => {
    const s = {
      id: 1,
      traits: { positive: ['calm', 'brave', 'athletic'], negative: [], hidden: [] },
    };
    const m = {
      id: 2,
      traits: { positive: ['calm', 'brave', 'athletic'], negative: [], hidden: [] },
    };
    const result = generateBreedingRecommendations(s, m);
    expect(result.overallRecommendation).toBe('Acceptable');
  });
});
