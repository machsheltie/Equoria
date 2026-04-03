// Tests for Breeding Color Prediction Service (Story 31E-5).
// Validates per-locus Mendelian probabilities, lethal filtering, breed restrictions,
// phenotype aggregation, full pipeline, legacy handling, and statistical accuracy.

import { jest } from '@jest/globals';

// Mock logger to suppress output
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// Import service functions (no prisma mock needed — pure functions)
const {
  generateLocusProbabilities,
  generateAllGenotypeProbabilities,
  filterLethalGenotypes,
  applyBreedRestrictions,
  aggregateByPhenotype,
  predictBreedingColors,
} = await import('../modules/horses/services/breedingColorPredictionService.mjs');

const { calculatePhenotype } = await import('../modules/horses/services/phenotypeCalculationService.mjs');

const { GENERIC_DEFAULTS } = await import('../modules/horses/services/genotypeGenerationService.mjs');

// ---------------------------------------------------------------------------
// T4.1: generateLocusProbabilities
// ---------------------------------------------------------------------------

describe('generateLocusProbabilities', () => {
  test('Ee x Ee → 25% EE, 50% Ee (normalized), 25% ee — max 3 outcomes', () => {
    const result = generateLocusProbabilities('E/e', 'E/e');

    // With normalization, E/e and e/E collapse into one entry
    expect(result).toHaveLength(3);

    const map = Object.fromEntries(result.map(r => [r.pair, r.prob]));
    expect(map['E/E']).toBeCloseTo(0.25, 4);
    expect(map['E/e']).toBeCloseTo(0.5, 4); // e/E merged into E/e
    expect(map['e/e']).toBeCloseTo(0.25, 4);

    // Total probability must sum to 1.0
    const total = result.reduce((sum, r) => sum + r.prob, 0);
    expect(total).toBeCloseTo(1.0, 4);
  });

  test('EE x ee → 100% Ee (all heterozygous)', () => {
    const result = generateLocusProbabilities('E/E', 'e/e');

    // All 4 cells produce E/e
    expect(result).toHaveLength(1);
    expect(result[0].pair).toBe('E/e');
    expect(result[0].prob).toBeCloseTo(1.0, 4);
  });

  test('ee x ee → 100% ee (all homozygous recessive)', () => {
    const result = generateLocusProbabilities('e/e', 'e/e');

    expect(result).toHaveLength(1);
    expect(result[0].pair).toBe('e/e');
    expect(result[0].prob).toBeCloseTo(1.0, 4);
  });

  test('multi-character alleles work (nd2/nd2 x D/nd2)', () => {
    const result = generateLocusProbabilities('nd2/nd2', 'D/nd2');

    // sire=[nd2,nd2], dam=[D,nd2]
    // Cells: nd2/D, nd2/nd2, nd2/D, nd2/nd2
    // Normalized: D/nd2 (50%) and nd2/nd2 (50%)
    const map = Object.fromEntries(result.map(r => [r.pair, r.prob]));
    expect(map['D/nd2']).toBeCloseTo(0.5, 4);
    expect(map['nd2/nd2']).toBeCloseTo(0.5, 4);
  });
});

// ---------------------------------------------------------------------------
// T4.2: filterLethalGenotypes
// ---------------------------------------------------------------------------

describe('filterLethalGenotypes', () => {
  test('O/O Frame Overo is removed from output', () => {
    const input = [
      { genotype: { O_FrameOvero: 'O/n', E_Extension: 'E/e' }, prob: 0.5 },
      { genotype: { O_FrameOvero: 'O/O', E_Extension: 'E/e' }, prob: 0.25 },
      { genotype: { O_FrameOvero: 'n/n', E_Extension: 'e/e' }, prob: 0.25 },
    ];

    const { filtered, lethalCount } = filterLethalGenotypes(input);

    expect(lethalCount).toBe(1);
    expect(filtered).toHaveLength(2);
    expect(filtered.some(f => f.genotype.O_FrameOvero === 'O/O')).toBe(false);
  });

  test('probabilities are renormalized after lethal removal', () => {
    const input = [
      { genotype: { O_FrameOvero: 'O/n' }, prob: 0.5 },
      { genotype: { O_FrameOvero: 'O/O' }, prob: 0.25 },
      { genotype: { O_FrameOvero: 'n/n' }, prob: 0.25 },
    ];

    const { filtered } = filterLethalGenotypes(input);

    const total = filtered.reduce((sum, f) => sum + f.prob, 0);
    expect(total).toBeCloseTo(1.0, 4);

    // O/n was 0.5 out of 0.75 remaining = 0.6667
    const on = filtered.find(f => f.genotype.O_FrameOvero === 'O/n');
    expect(on.prob).toBeCloseTo(0.6667, 3);
  });

  test('no lethals present → no filtering, same probabilities', () => {
    const input = [
      { genotype: { E_Extension: 'E/e' }, prob: 0.5 },
      { genotype: { E_Extension: 'e/e' }, prob: 0.5 },
    ];

    const { filtered, lethalCount } = filterLethalGenotypes(input);

    expect(lethalCount).toBe(0);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].prob).toBeCloseTo(0.5, 4);
  });
});

// ---------------------------------------------------------------------------
// T4.3: applyBreedRestrictions
// ---------------------------------------------------------------------------

describe('applyBreedRestrictions', () => {
  test('restricted allele pair is replaced with breed default', () => {
    const input = [
      { genotype: { TO_Tobiano: 'TO/to', E_Extension: 'E/e' }, prob: 0.5 },
      { genotype: { TO_Tobiano: 'to/to', E_Extension: 'E/e' }, prob: 0.5 },
    ];

    const profile = {
      allowed_alleles: {
        TO_Tobiano: ['to/to'], // Tobiano not allowed in this breed
      },
    };

    const result = applyBreedRestrictions(input, profile);

    // TO/to should be replaced with to/to
    expect(result[0].genotype.TO_Tobiano).toBe('to/to');
    expect(result[1].genotype.TO_Tobiano).toBe('to/to');
  });

  test('null breed profile → no restrictions applied', () => {
    const input = [{ genotype: { TO_Tobiano: 'TO/to' }, prob: 1.0 }];

    const result = applyBreedRestrictions(input, null);
    expect(result[0].genotype.TO_Tobiano).toBe('TO/to');
  });

  test('allowed allele pair is not replaced', () => {
    const input = [{ genotype: { E_Extension: 'E/e' }, prob: 1.0 }];

    const profile = {
      allowed_alleles: {
        E_Extension: ['E/E', 'E/e', 'e/e'],
      },
    };

    const result = applyBreedRestrictions(input, profile);
    expect(result[0].genotype.E_Extension).toBe('E/e');
  });
});

// ---------------------------------------------------------------------------
// T4.4: aggregateByPhenotype
// ---------------------------------------------------------------------------

describe('aggregateByPhenotype', () => {
  test('multiple genotypes producing same color are aggregated', () => {
    // Both E/E and E/e with A_Agouti A/a produce "Bay"
    const bayGenotype1 = { ...GENERIC_DEFAULTS, E_Extension: 'E/E', A_Agouti: 'A/a' };
    const bayGenotype2 = { ...GENERIC_DEFAULTS, E_Extension: 'E/e', A_Agouti: 'A/a' };

    // Verify both produce the same color
    const pheno1 = calculatePhenotype(bayGenotype1);
    const pheno2 = calculatePhenotype(bayGenotype2);
    expect(pheno1.colorName).toBe(pheno2.colorName);

    const input = [
      { genotype: bayGenotype1, prob: 0.3 },
      { genotype: bayGenotype2, prob: 0.4 },
    ];

    const result = aggregateByPhenotype(input, null);

    // Should have one entry with combined probability
    const bayEntry = result.find(r => r.colorName === pheno1.colorName);
    expect(bayEntry).toBeDefined();
    expect(bayEntry.probability).toBeCloseTo(0.7, 2);
  });

  test('results are sorted by probability descending', () => {
    const chestnutGenotype = { ...GENERIC_DEFAULTS, E_Extension: 'e/e', A_Agouti: 'A/a' };
    const blackGenotype = { ...GENERIC_DEFAULTS, E_Extension: 'E/E', A_Agouti: 'a/a' };

    const input = [
      { genotype: chestnutGenotype, prob: 0.3 },
      { genotype: blackGenotype, prob: 0.7 },
    ];

    const result = aggregateByPhenotype(input, null);

    expect(result[0].probability).toBeGreaterThanOrEqual(result[1].probability);
  });

  test('percentage format is correct', () => {
    const genotype = { ...GENERIC_DEFAULTS, E_Extension: 'e/e' };
    const input = [{ genotype, prob: 0.375 }];

    const result = aggregateByPhenotype(input, null);
    expect(result[0].percentage).toBe('37.5%');
  });
});

// ---------------------------------------------------------------------------
// T4.5: predictBreedingColors — full pipeline
// ---------------------------------------------------------------------------

describe('predictBreedingColors', () => {
  test('EE x ee sire/dam with same defaults → produces valid prediction', () => {
    const sire = { ...GENERIC_DEFAULTS, E_Extension: 'E/E', A_Agouti: 'A/A' };
    const dam = { ...GENERIC_DEFAULTS, E_Extension: 'e/e', A_Agouti: 'a/a' };

    const result = predictBreedingColors(sire, dam, null);

    expect(result).toHaveProperty('possibleColors');
    expect(result).toHaveProperty('totalCombinations');
    expect(result).toHaveProperty('lethalCombinationsFiltered');
    expect(Array.isArray(result.possibleColors)).toBe(true);
    expect(result.possibleColors.length).toBeGreaterThan(0);

    // All offspring should be E/e (heterozygous) at Extension
    // and A/a at Agouti — all should produce "Bay"
    // (since all other loci are identical defaults, total combos = 1)
    expect(result.totalCombinations).toBeGreaterThanOrEqual(1);

    // Probabilities should sum to ~1.0
    const totalProb = result.possibleColors.reduce((s, c) => s + c.probability, 0);
    expect(totalProb).toBeCloseTo(1.0, 2);
  });

  test('response shape matches AC8 format', () => {
    const sire = { ...GENERIC_DEFAULTS };
    const dam = { ...GENERIC_DEFAULTS };

    const result = predictBreedingColors(sire, dam, null);

    // Shape check
    expect(result).toHaveProperty('possibleColors');
    expect(result).toHaveProperty('totalCombinations');
    expect(result).toHaveProperty('lethalCombinationsFiltered');

    for (const color of result.possibleColors) {
      expect(color).toHaveProperty('colorName');
      expect(color).toHaveProperty('probability');
      expect(color).toHaveProperty('percentage');
      expect(typeof color.colorName).toBe('string');
      expect(typeof color.probability).toBe('number');
      expect(typeof color.percentage).toBe('string');
    }
  });

  test('O/n x O/n cross filters lethal O/O offspring', () => {
    const sire = { ...GENERIC_DEFAULTS, O_FrameOvero: 'O/n' };
    const dam = { ...GENERIC_DEFAULTS, O_FrameOvero: 'O/n' };

    const result = predictBreedingColors(sire, dam, null);

    expect(result.lethalCombinationsFiltered).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T4.6: legacy null genotype handling (tested at controller level)
// ---------------------------------------------------------------------------

describe('legacy null genotype handling', () => {
  test('predictBreedingColors works with minimal genotype objects', () => {
    // Only E_Extension set, everything else falls back to GENERIC_DEFAULTS
    const sire = { E_Extension: 'E/e' };
    const dam = { E_Extension: 'E/e' };

    const result = predictBreedingColors(sire, dam, null);

    expect(result.possibleColors.length).toBeGreaterThan(0);
    const totalProb = result.possibleColors.reduce((s, c) => s + c.probability, 0);
    expect(totalProb).toBeCloseTo(1.0, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.8: Statistical — Ee x Ee cross Mendelian ratios
// ---------------------------------------------------------------------------

describe('Statistical: Mendelian ratios', () => {
  test('Ee x Ee at Extension locus → 25% EE, 50% Ee (normalized), 25% ee', () => {
    const result = generateLocusProbabilities('E/e', 'E/e');

    // With normalization, only 3 entries: E/E, E/e, e/e
    const map = Object.fromEntries(result.map(r => [r.pair, r.prob]));
    expect(map['E/E']).toBeCloseTo(0.25, 4);
    expect(map['E/e']).toBeCloseTo(0.5, 4);
    expect(map['e/e']).toBeCloseTo(0.25, 4);
  });

  test('Aa x Aa at Agouti locus → 25% AA, 50% Aa (normalized), 25% aa', () => {
    const result = generateLocusProbabilities('A/a', 'A/a');

    const map = Object.fromEntries(result.map(r => [r.pair, r.prob]));
    expect(map['A/A']).toBeCloseTo(0.25, 4);
    expect(map['A/a']).toBeCloseTo(0.5, 4);
    expect(map['a/a']).toBeCloseTo(0.25, 4);
  });
});

// ---------------------------------------------------------------------------
// AC7 Performance: fixed-locus optimization and timing
// ---------------------------------------------------------------------------

describe('AC7 Performance optimizations', () => {
  test('fixed loci (both parents homozygous same) do not increase combinatorial count', () => {
    // Both parents fully homozygous at all loci → 1 combination total
    // Note: GENERIC_DEFAULTS has E/e and A/a (heterozygous), so override those
    const homoGenotype = {
      ...GENERIC_DEFAULTS,
      E_Extension: 'E/E',
      A_Agouti: 'A/A',
    };
    const sire = { ...homoGenotype };
    const dam = { ...homoGenotype };

    const result = generateAllGenotypeProbabilities(sire, dam);

    // All loci are fixed (1 outcome each) → only 1 genotype combination
    expect(result).toHaveLength(1);
    expect(result[0].prob).toBeCloseTo(1.0, 4);
  });

  test('only variable loci contribute to branching', () => {
    // Make 2 loci heterozygous, rest homozygous
    const sire = { ...GENERIC_DEFAULTS, E_Extension: 'E/e', A_Agouti: 'A/a' };
    const dam = { ...GENERIC_DEFAULTS, E_Extension: 'E/e', A_Agouti: 'A/a' };

    const result = generateAllGenotypeProbabilities(sire, dam);

    // 2 het loci × 3 outcomes each (normalized) = 9 combinations
    expect(result).toHaveLength(9);
  });

  test('allele normalization reduces Ee x Ee from 4 to 3 outcomes', () => {
    const result = generateLocusProbabilities('E/e', 'E/e');

    // Without normalization: E/E, E/e, e/E, e/e = 4 outcomes
    // With normalization: E/E, E/e, e/e = 3 outcomes
    expect(result).toHaveLength(3);
  });

  test('full prediction with GENERIC_DEFAULTS parents completes in <500ms', () => {
    const sire = { ...GENERIC_DEFAULTS, E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/n' };
    const dam = { ...GENERIC_DEFAULTS, E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/n' };

    const start = performance.now();
    const result = predictBreedingColors(sire, dam, null);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.possibleColors.length).toBeGreaterThan(0);
  });

  test('highly heterozygous cross (8 het loci) completes in <500ms', () => {
    const sire = {
      ...GENERIC_DEFAULTS,
      E_Extension: 'E/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'Cr/n',
      D_Dun: 'D/nd2',
      Z_Silver: 'Z/n',
      Ch_Champagne: 'Ch/n',
      G_Gray: 'G/g',
      Rn_Roan: 'Rn/rn',
    };
    const dam = { ...sire }; // identical heterozygous

    const start = performance.now();
    const result = predictBreedingColors(sire, dam, null);
    const elapsed = performance.now() - start;

    // 3^8 = 6561 combinations — should be fast
    expect(elapsed).toBeLessThan(500);
    expect(result.possibleColors.length).toBeGreaterThan(0);
    expect(result.totalCombinations).toBe(6561);
  });
});
