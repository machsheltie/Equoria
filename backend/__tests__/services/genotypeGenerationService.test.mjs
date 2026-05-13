/**
 * genotypeGenerationService — unit tests (Equoria-rr7)
 *
 * No imports at all in the source file — 100% pure, no DB, no logger.
 * RNG is injectable for deterministic testing.
 */

import { describe, it, expect } from '@jest/globals';
import {
  sampleWeightedAllele,
  generateGenotype,
  CORE_LOCI,
  GENERIC_DEFAULTS,
} from '../../modules/horses/services/genotypeGenerationService.mjs';

// ---------------------------------------------------------------------------
// CORE_LOCI and GENERIC_DEFAULTS shape
// ---------------------------------------------------------------------------
describe('CORE_LOCI', () => {
  it('has 17 loci', () => {
    expect(CORE_LOCI).toHaveLength(17);
  });

  it('includes E_Extension, A_Agouti, Cr_Cream', () => {
    expect(CORE_LOCI).toContain('E_Extension');
    expect(CORE_LOCI).toContain('A_Agouti');
    expect(CORE_LOCI).toContain('Cr_Cream');
  });
});

describe('GENERIC_DEFAULTS', () => {
  it('has a default for every CORE_LOCI entry', () => {
    for (const locus of CORE_LOCI) {
      expect(GENERIC_DEFAULTS).toHaveProperty(locus);
    }
  });

  it('E_Extension default is E/e', () => {
    expect(GENERIC_DEFAULTS.E_Extension).toBe('E/e');
  });

  it('Cr_Cream default is n/n (non-expressing)', () => {
    expect(GENERIC_DEFAULTS.Cr_Cream).toBe('n/n');
  });
});

// ---------------------------------------------------------------------------
// sampleWeightedAllele
// ---------------------------------------------------------------------------
describe('sampleWeightedAllele', () => {
  it('returns null for empty weights', () => {
    expect(sampleWeightedAllele({}, () => 0.5)).toBeNull();
  });

  it('returns the sole entry regardless of rng value', () => {
    const weights = { 'E/E': 1.0 };
    expect(sampleWeightedAllele(weights, () => 0)).toBe('E/E');
    expect(sampleWeightedAllele(weights, () => 0.999)).toBe('E/E');
  });

  it('returns first entry when rng returns 0', () => {
    const weights = { 'E/E': 0.25, 'E/e': 0.5, 'e/e': 0.25 };
    expect(sampleWeightedAllele(weights, () => 0)).toBe('E/E');
  });

  it('returns last entry when rng returns 1 (floating-point fallback)', () => {
    const weights = { 'E/E': 0.25, 'E/e': 0.5, 'e/e': 0.25 };
    // rng > sum due to floating-point → last entry
    expect(sampleWeightedAllele(weights, () => 1.0)).toBe('e/e');
  });

  it('returns correct bucket for a mid-range rng value', () => {
    // 'E/E'=0.25, 'E/e'=0.50 → cumulative after 'E/e' = 0.75
    // rng=0.5 → 0.5 <= 0.75 → 'E/e'
    const weights = { 'E/E': 0.25, 'E/e': 0.5, 'e/e': 0.25 };
    expect(sampleWeightedAllele(weights, () => 0.5)).toBe('E/e');
  });

  it('returns correct bucket at exact cumulative threshold', () => {
    const weights = { 'E/E': 0.25, 'E/e': 0.5, 'e/e': 0.25 };
    // rng=0.25 → 0.25 <= 0.25 → 'E/E'
    expect(sampleWeightedAllele(weights, () => 0.25)).toBe('E/E');
  });

  it('is deterministic for the same rng return value', () => {
    const weights = { 'E/E': 0.25, 'E/e': 0.5, 'e/e': 0.25 };
    const r = () => 0.7;
    expect(sampleWeightedAllele(weights, r)).toBe(sampleWeightedAllele(weights, r));
  });

  it('floating-point fallback (line 85): roll > sum(weights) returns last entry (Equoria-rr7)', () => {
    // weights sum to 0.6, roll=0.9 → loop never satisfies roll<=cumulative → line 85 fallback
    const weights = { 'a/a': 0.3, 'b/b': 0.3 };
    expect(sampleWeightedAllele(weights, () => 0.9)).toBe('b/b');
  });

  it('default rng branch (line 68): omitting rng uses Math.random and returns a string (Equoria-rr7)', () => {
    // Covers the default-parameter branch: rng = Math.random
    const weights = { 'E/E': 0.5, 'E/e': 0.5 };
    const result = sampleWeightedAllele(weights);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// generateGenotype
// ---------------------------------------------------------------------------
describe('generateGenotype', () => {
  const deterministicRng = () => 0.5;

  it('returns an object', () => {
    expect(typeof generateGenotype(null, deterministicRng)).toBe('object');
  });

  it('includes all 17 CORE_LOCI when profile is null', () => {
    const genotype = generateGenotype(null, deterministicRng);
    for (const locus of CORE_LOCI) {
      expect(genotype).toHaveProperty(locus);
    }
  });

  it('falls back to GENERIC_DEFAULTS for null profile', () => {
    const genotype = generateGenotype(null, deterministicRng);
    // deterministicRng=0.5, but null profile means no weights → use GENERIC_DEFAULTS
    expect(genotype.E_Extension).toBe(GENERIC_DEFAULTS.E_Extension);
    expect(genotype.Cr_Cream).toBe(GENERIC_DEFAULTS.Cr_Cream);
  });

  it('falls back to GENERIC_DEFAULTS for empty profile', () => {
    const genotype = generateGenotype({}, deterministicRng);
    expect(genotype.E_Extension).toBe(GENERIC_DEFAULTS.E_Extension);
  });

  it('uses allele_weights when present in profile', () => {
    const profile = {
      allele_weights: {
        E_Extension: { 'e/e': 1.0 }, // always chestnut
      },
    };
    const genotype = generateGenotype(profile, deterministicRng);
    expect(genotype.E_Extension).toBe('e/e');
  });

  it('uses first entry of allowed_alleles when no weights present', () => {
    const profile = {
      allowed_alleles: {
        E_Extension: ['E/E', 'E/e', 'e/e'],
      },
    };
    const genotype = generateGenotype(profile, deterministicRng);
    expect(genotype.E_Extension).toBe('E/E');
  });

  it('allele_weights takes priority over allowed_alleles for the same locus', () => {
    const profile = {
      allele_weights: { E_Extension: { 'e/e': 1.0 } },
      allowed_alleles: { E_Extension: ['E/E'] },
    };
    const genotype = generateGenotype(profile, deterministicRng);
    expect(genotype.E_Extension).toBe('e/e'); // weights win
  });

  it('includes extra loci from the breed profile beyond CORE_LOCI', () => {
    const profile = {
      allowed_alleles: {
        ExtraLocus: ['X/x'],
      },
    };
    const genotype = generateGenotype(profile, deterministicRng);
    expect(genotype).toHaveProperty('ExtraLocus');
    expect(genotype.ExtraLocus).toBe('X/x');
  });

  it('is deterministic for the same rng + profile', () => {
    const profile = { allele_weights: { E_Extension: { 'E/e': 0.5, 'e/e': 0.5 } } };
    const rng = () => 0.3;
    expect(generateGenotype(profile, rng).E_Extension).toBe(generateGenotype(profile, rng).E_Extension);
  });

  it('value at each locus is a string', () => {
    const genotype = generateGenotype(null, deterministicRng);
    for (const locus of CORE_LOCI) {
      expect(typeof genotype[locus]).toBe('string');
      expect(genotype[locus].length).toBeGreaterThan(0);
    }
  });

  it('default rng branch (line 101): omitting rng uses Math.random and returns object (Equoria-rr7)', () => {
    // Covers the default-parameter branch: rng = Math.random
    const result = generateGenotype(null);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('E_Extension');
  });

  it('unknown-locus fallback ?? n/n (line 123): empty allowed_alleles entry returns n/n (Equoria-rr7)', () => {
    // allowed_alleles: { CustomLocus: [] } → allowed is [], allowed.length=0 → else branch
    // GENERIC_DEFAULTS['CustomLocus'] = undefined → ?? 'n/n' → 'n/n'
    const profile = { allowed_alleles: { CustomLocus: [] } };
    const result = generateGenotype(profile, deterministicRng);
    expect(result.CustomLocus).toBe('n/n');
  });
});
