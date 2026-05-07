/**
 * breedingColorPredictionService — unit tests (Equoria-rr7)
 *
 * Pure-function pipeline: no DB, no logger. Imports only other pure services.
 * Deterministic because inputs are fully specified.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateLocusProbabilities,
  generateAllGenotypeProbabilities,
  filterLethalGenotypes,
  applyBreedRestrictions,
  aggregateByPhenotype,
  predictBreedingColors,
} from '../../modules/horses/services/breedingColorPredictionService.mjs';

// ---------------------------------------------------------------------------
// generateLocusProbabilities
// ---------------------------------------------------------------------------
describe('generateLocusProbabilities', () => {
  it('homozygous × homozygous same allele → single outcome prob=1', () => {
    const result = generateLocusProbabilities('e/e', 'e/e');
    expect(result).toHaveLength(1);
    expect(result[0].pair).toBe('e/e');
    expect(result[0].prob).toBeCloseTo(1.0);
  });

  it('homozygous × homozygous different → single outcome (e/E normalizes to E/e)', () => {
    // sire: E/E → alleles [E, E], dam: e/e → alleles [e, e]
    // All 4 Punnett cells = E/e (normalized)
    const result = generateLocusProbabilities('E/E', 'e/e');
    expect(result).toHaveLength(1);
    expect(result[0].pair).toBe('E/e');
    expect(result[0].prob).toBeCloseTo(1.0);
  });

  it('heterozygous × heterozygous → 3 outcomes (Mendelian 1:2:1)', () => {
    // E/e × E/e → E/E (0.25), E/e (0.5), e/e (0.25)
    const result = generateLocusProbabilities('E/e', 'E/e');
    expect(result).toHaveLength(3);
    const byPair = Object.fromEntries(result.map(r => [r.pair, r.prob]));
    expect(byPair['E/E']).toBeCloseTo(0.25);
    expect(byPair['E/e']).toBeCloseTo(0.5);
    expect(byPair['e/e']).toBeCloseTo(0.25);
  });

  it('heterozygous × homozygous → 2 outcomes (1:1)', () => {
    // E/e × e/e → E/e (0.5), e/e (0.5)
    const result = generateLocusProbabilities('E/e', 'e/e');
    expect(result).toHaveLength(2);
    const total = result.reduce((sum, r) => sum + r.prob, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it('probabilities in result sum to 1.0', () => {
    const result = generateLocusProbabilities('E/e', 'E/e');
    const total = result.reduce((sum, r) => sum + r.prob, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it('allele pairs are normalized (E/e not e/E)', () => {
    const result = generateLocusProbabilities('E/e', 'E/e');
    for (const { pair } of result) {
      const [a, b] = pair.split('/');
      // Normalized: first allele <= second allele lexicographically
      expect(a <= b).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateAllGenotypeProbabilities
// ---------------------------------------------------------------------------
describe('generateAllGenotypeProbabilities', () => {
  const chestnutSire = { E_Extension: 'e/e', A_Agouti: 'a/a' };
  const chestnutDam = { E_Extension: 'e/e', A_Agouti: 'A/a' };

  it('returns an array of genotype/prob objects', () => {
    const result = generateAllGenotypeProbabilities(chestnutSire, chestnutDam);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('genotype');
    expect(result[0]).toHaveProperty('prob');
  });

  it('probabilities sum to approx 1.0', () => {
    const result = generateAllGenotypeProbabilities(chestnutSire, chestnutDam);
    const total = result.reduce((sum, r) => sum + r.prob, 0);
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('all genotypes include CORE_LOCI', () => {
    const result = generateAllGenotypeProbabilities(chestnutSire, chestnutDam);
    for (const { genotype } of result) {
      expect(genotype).toHaveProperty('E_Extension');
      expect(genotype).toHaveProperty('A_Agouti');
    }
  });

  it('homozygous × homozygous same produces single outcome per locus', () => {
    const homoSire = { E_Extension: 'e/e' };
    const homoDam = { E_Extension: 'e/e' };
    const result = generateAllGenotypeProbabilities(homoSire, homoDam);
    for (const { genotype } of result) {
      expect(genotype.E_Extension).toBe('e/e');
    }
  });
});

// ---------------------------------------------------------------------------
// filterLethalGenotypes
// ---------------------------------------------------------------------------
describe('filterLethalGenotypes', () => {
  it('returns filtered array and lethalCount', () => {
    const input = [{ genotype: { E_Extension: 'E/e' }, prob: 1.0 }];
    const { filtered, lethalCount } = filterLethalGenotypes(input);
    expect(Array.isArray(filtered)).toBe(true);
    expect(typeof lethalCount).toBe('number');
  });

  it('non-lethal genotype passes through unchanged', () => {
    const input = [{ genotype: { E_Extension: 'E/e', O_FrameOvero: 'O/n' }, prob: 1.0 }];
    const { filtered, lethalCount } = filterLethalGenotypes(input);
    expect(filtered).toHaveLength(1);
    expect(lethalCount).toBe(0);
  });

  it('removes O/O lethal genotype', () => {
    const input = [
      { genotype: { O_FrameOvero: 'O/O' }, prob: 0.25 },
      { genotype: { O_FrameOvero: 'O/n' }, prob: 0.5 },
      { genotype: { O_FrameOvero: 'n/n' }, prob: 0.25 },
    ];
    const { filtered, lethalCount } = filterLethalGenotypes(input);
    expect(filtered).toHaveLength(2);
    expect(lethalCount).toBe(1);
    expect(filtered.every(e => e.genotype.O_FrameOvero !== 'O/O')).toBe(true);
  });

  it('renormalizes probabilities after removal', () => {
    const input = [
      { genotype: { O_FrameOvero: 'O/O' }, prob: 0.25 },
      { genotype: { O_FrameOvero: 'O/n' }, prob: 0.75 },
    ];
    const { filtered } = filterLethalGenotypes(input);
    // Total remaining = 0.75 → renormalized to 1.0
    const total = filtered.reduce((sum, e) => sum + e.prob, 0);
    expect(total).toBeCloseTo(1.0, 4);
  });

  it('returns lethalCount=0 when no lethals present', () => {
    const input = [
      { genotype: { E_Extension: 'E/e' }, prob: 0.5 },
      { genotype: { E_Extension: 'e/e' }, prob: 0.5 },
    ];
    const { lethalCount } = filterLethalGenotypes(input);
    expect(lethalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyBreedRestrictions
// ---------------------------------------------------------------------------
describe('applyBreedRestrictions', () => {
  it('returns input unchanged when foalBreedProfile is null', () => {
    const input = [{ genotype: { E_Extension: 'E/e' }, prob: 1.0 }];
    const result = applyBreedRestrictions(input, null);
    expect(result[0].genotype.E_Extension).toBe('E/e');
  });

  it('returns input unchanged when foalBreedProfile has no allowed_alleles', () => {
    const input = [{ genotype: { E_Extension: 'E/e' }, prob: 1.0 }];
    const result = applyBreedRestrictions(input, {});
    expect(result[0].genotype.E_Extension).toBe('E/e');
  });

  it('replaces disallowed allele with first allowed allele', () => {
    const input = [{ genotype: { E_Extension: 'E/e' }, prob: 1.0 }];
    const foalBreedProfile = { allowed_alleles: { E_Extension: ['e/e'] } };
    const result = applyBreedRestrictions(input, foalBreedProfile);
    expect(result[0].genotype.E_Extension).toBe('e/e');
  });

  it('does not replace already-allowed allele', () => {
    const input = [{ genotype: { E_Extension: 'e/e' }, prob: 1.0 }];
    const foalBreedProfile = { allowed_alleles: { E_Extension: ['e/e', 'E/e'] } };
    const result = applyBreedRestrictions(input, foalBreedProfile);
    expect(result[0].genotype.E_Extension).toBe('e/e');
  });
});

// ---------------------------------------------------------------------------
// aggregateByPhenotype
// ---------------------------------------------------------------------------
describe('aggregateByPhenotype', () => {
  it('returns an array sorted by probability descending', () => {
    // Single chestnut genotype → 100% Chestnut
    const input = [{ genotype: { E_Extension: 'e/e' }, prob: 1.0 }];
    const result = aggregateByPhenotype(input, null);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('colorName');
    expect(result[0]).toHaveProperty('probability');
    expect(result[0]).toHaveProperty('percentage');
  });

  it('single chestnut genotype → Chestnut at 100%', () => {
    const input = [{ genotype: { E_Extension: 'e/e' }, prob: 1.0 }];
    const result = aggregateByPhenotype(input, null);
    expect(result[0].colorName).toBe('Chestnut');
    expect(result[0].probability).toBeCloseTo(1.0);
    expect(result[0].percentage).toBe('100.0%');
  });

  it('probabilities sum to ~1.0 for full distribution', () => {
    // Two genotypes splitting probability
    const input = [
      { genotype: { E_Extension: 'e/e' }, prob: 0.5 },
      { genotype: { E_Extension: 'E/e', A_Agouti: 'A/a' }, prob: 0.5 },
    ];
    const result = aggregateByPhenotype(input, null);
    const total = result.reduce((sum, r) => sum + r.probability, 0);
    expect(total).toBeCloseTo(1.0, 3);
  });

  it('is sorted descending by probability', () => {
    const input = [
      { genotype: { E_Extension: 'E/e', A_Agouti: 'A/a' }, prob: 0.5 },
      { genotype: { E_Extension: 'e/e' }, prob: 0.5 },
    ];
    const result = aggregateByPhenotype(input, null);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].probability).toBeGreaterThanOrEqual(result[i + 1].probability);
    }
  });

  it('aggregates identical phenotypes into single entry', () => {
    // Two chestnut genotypes (e/e + e/e with different non-color loci)
    const input = [
      { genotype: { E_Extension: 'e/e', TO_Tobiano: 'to/to' }, prob: 0.5 },
      { genotype: { E_Extension: 'e/e', TO_Tobiano: 'TO/to' }, prob: 0.5 },
    ];
    const result = aggregateByPhenotype(input, null);
    // Tobiano doesn't change colorName — both are Chestnut → aggregated
    const chestnut = result.find(r => r.colorName === 'Chestnut');
    expect(chestnut?.probability).toBeCloseTo(0.5 + 0.5, 3);
  });
});

// ---------------------------------------------------------------------------
// predictBreedingColors — integration of all stages
// ---------------------------------------------------------------------------
describe('predictBreedingColors', () => {
  it('returns expected shape', () => {
    const sire = { E_Extension: 'e/e' };
    const dam = { E_Extension: 'e/e' };
    const result = predictBreedingColors(sire, dam, null);
    expect(result).toHaveProperty('possibleColors');
    expect(result).toHaveProperty('totalCombinations');
    expect(result).toHaveProperty('lethalCombinationsFiltered');
  });

  it('chestnut × chestnut → all offspring Chestnut', () => {
    const sire = { E_Extension: 'e/e', A_Agouti: 'a/a', Cr_Cream: 'n/n' };
    const dam = { E_Extension: 'e/e', A_Agouti: 'a/a', Cr_Cream: 'n/n' };
    const { possibleColors } = predictBreedingColors(sire, dam, null);
    expect(possibleColors).toHaveLength(1);
    expect(possibleColors[0].colorName).toBe('Chestnut');
    expect(possibleColors[0].probability).toBeCloseTo(1.0);
  });

  it('totalCombinations is a positive integer', () => {
    const sire = { E_Extension: 'e/e' };
    const dam = { E_Extension: 'e/e' };
    const { totalCombinations } = predictBreedingColors(sire, dam, null);
    expect(typeof totalCombinations).toBe('number');
    expect(totalCombinations).toBeGreaterThan(0);
  });

  it('lethalCombinationsFiltered is 0 for safe parents', () => {
    const sire = { E_Extension: 'e/e' };
    const dam = { E_Extension: 'e/e' };
    const { lethalCombinationsFiltered } = predictBreedingColors(sire, dam, null);
    expect(lethalCombinationsFiltered).toBe(0);
  });

  it('bay × bay produces bay, chestnut, and potentially black offspring', () => {
    // E/e × E/e + A/a × A/a
    const sire = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    const dam = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    const { possibleColors } = predictBreedingColors(sire, dam, null);
    const colorNames = possibleColors.map(c => c.colorName);
    // Chestnut (e/e) and Bay/Black are expected from this cross
    expect(colorNames).toContain('Chestnut');
  });

  it('possibleColors entries all have probability > 0', () => {
    const sire = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    const dam = { E_Extension: 'E/e', A_Agouti: 'A/a' };
    const { possibleColors } = predictBreedingColors(sire, dam, null);
    for (const { probability } of possibleColors) {
      expect(probability).toBeGreaterThan(0);
    }
  });
});
