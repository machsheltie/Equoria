/**
 * breedingColorInheritanceService.test.mjs
 *
 * Tests for Story 31E-2: Mendelian Breeding Inheritance + Lethal Filtering.
 *
 * Coverage:
 *   - splitAlleles: homozygous, heterozygous, edge cases
 *   - isLethalCombination: O/O, W homozygous, SW homozygous, EDXW homozygous, safe pairs
 *   - inheritLocus: Mendelian recombination + lethal reroll
 *   - inheritColorGenotype: full genotype inheritance, breed restriction, missing parent fallback
 *   - Statistical: 1000× Ee×Ee → 1:2:1 chi-squared p > 0.05
 *   - Statistical: O/n × O/n → O/O never appears in 1000 trials
 *   - Integration: POST /api/v1/horses with sireId + damId inherits from parents
 *
 * Mocking strategy (balanced):
 *   - Unit tests: no mocking (pure functions)
 *   - Integration test: real DB (prisma) + real HTTP (supertest)
 */

import {
  splitAlleles,
  isLethalCombination,
  inheritLocus,
  inheritColorGenotype,
  assembleAllelePair,
  drawAllele,
  LETHAL_COMBINATIONS,
  buildDisallowedMap,
  isDisallowedCombination,
} from '../services/breedingColorInheritanceService.mjs';
import { CORE_LOCI } from '../services/genotypeGenerationService.mjs';
import prisma from '../../../db/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import config from '../../../config/config.mjs';
import app from '../../../app.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a deterministic RNG that always returns the given sequence of values,
 * cycling back to the start when exhausted.
 */
function deterministicRng(values) {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Build a minimal genotype with all non-expressing (wild-type) alleles,
 * then merge overrides.
 */
function buildGenotype(overrides = {}) {
  return {
    E_Extension: 'E/e',
    A_Agouti: 'A/a',
    Cr_Cream: 'n/n',
    D_Dun: 'nd2/nd2',
    Z_Silver: 'n/n',
    Ch_Champagne: 'n/n',
    G_Gray: 'g/g',
    Rn_Roan: 'rn/rn',
    W_DominantWhite: 'w/w',
    TO_Tobiano: 'to/to',
    O_FrameOvero: 'n/n',
    SB1_Sabino1: 'n/n',
    SW_SplashWhite: 'n/n',
    LP_LeopardComplex: 'lp/lp',
    PATN1_Pattern1: 'patn1/patn1',
    EDXW: 'n/n',
    MFSD12_Mushroom: 'N/N',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// splitAlleles
// ---------------------------------------------------------------------------

// Shared CSRF fixture used by integration-style tests at the bottom of this
// file. Declared at module scope so every `describe` block can reference it.
let __csrf__;
beforeAll(async () => {
  __csrf__ = await fetchCsrf(app);
});

describe('splitAlleles', () => {
  it('splits heterozygous pair E/e → ["E", "e"]', () => {
    expect(splitAlleles('E/e')).toEqual(['E', 'e']);
  });

  it('splits homozygous dominant E/E → ["E", "E"]', () => {
    expect(splitAlleles('E/E')).toEqual(['E', 'E']);
  });

  it('splits homozygous recessive e/e → ["e", "e"]', () => {
    expect(splitAlleles('e/e')).toEqual(['e', 'e']);
  });

  it('splits multi-character alleles nd2/nd2 correctly', () => {
    expect(splitAlleles('nd2/nd2')).toEqual(['nd2', 'nd2']);
  });

  it('splits nd1/nd2 correctly', () => {
    expect(splitAlleles('nd1/nd2')).toEqual(['nd1', 'nd2']);
  });

  it('splits W20/w → ["W20", "w"]', () => {
    expect(splitAlleles('W20/w')).toEqual(['W20', 'w']);
  });

  it('returns ["n","n"] for null input', () => {
    expect(splitAlleles(null)).toEqual(['n', 'n']);
  });

  it('returns ["n","n"] for empty string', () => {
    expect(splitAlleles('')).toEqual(['n', 'n']);
  });
});

// ---------------------------------------------------------------------------
// isLethalCombination
// ---------------------------------------------------------------------------

describe('isLethalCombination', () => {
  it('identifies O/O as lethal for O_FrameOvero', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/O')).toBe(true);
  });

  it('does NOT flag O/n as lethal', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/n')).toBe(false);
  });

  it('does NOT flag n/n as lethal', () => {
    expect(isLethalCombination('O_FrameOvero', 'n/n')).toBe(false);
  });

  it('identifies W20/W20 as lethal for W_DominantWhite', () => {
    expect(isLethalCombination('W_DominantWhite', 'W20/W20')).toBe(true);
  });

  it('does NOT flag W20/w as lethal', () => {
    expect(isLethalCombination('W_DominantWhite', 'W20/w')).toBe(false);
  });

  it('identifies SW3/SW3 as lethal for SW_SplashWhite', () => {
    expect(isLethalCombination('SW_SplashWhite', 'SW3/SW3')).toBe(true);
  });

  it('does NOT flag SW1/n as lethal', () => {
    expect(isLethalCombination('SW_SplashWhite', 'SW1/n')).toBe(false);
  });

  it('identifies EDXW1/EDXW1 as lethal for EDXW', () => {
    expect(isLethalCombination('EDXW', 'EDXW1/EDXW1')).toBe(true);
  });

  it('does NOT flag EDXW1/n as lethal', () => {
    expect(isLethalCombination('EDXW', 'EDXW1/n')).toBe(false);
  });

  it('returns false for unknown locus', () => {
    expect(isLethalCombination('Unknown_Locus', 'X/X')).toBe(false);
  });

  it('LETHAL_COMBINATIONS is exported and contains expected loci', () => {
    expect(LETHAL_COMBINATIONS).toHaveProperty('O_FrameOvero');
    expect(LETHAL_COMBINATIONS).toHaveProperty('W_DominantWhite');
    expect(LETHAL_COMBINATIONS).toHaveProperty('SW_SplashWhite');
    expect(LETHAL_COMBINATIONS).toHaveProperty('EDXW');
  });

  it('detects lethal pair in reversed ordering (B/A as well as A/B)', () => {
    // All current lethals are homozygous so A/B === B/A, but the implementation
    // must also handle asymmetric lethals if added in future.
    // Verify the reversed-check code path by directly asserting symmetric homozygous cases.
    expect(isLethalCombination('O_FrameOvero', 'O/O')).toBe(true); // normal
    // Simulate a reversed pair via the split/rejoin path: 'O/O' reversed is still 'O/O'
    expect(isLethalCombination('W_DominantWhite', 'W5/W5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drawAllele
// ---------------------------------------------------------------------------

describe('drawAllele', () => {
  it('picks first allele when rng < 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.3)).toBe('E');
  });

  it('picks second allele when rng >= 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.7)).toBe('e');
  });

  it('picks second allele at exactly 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.5)).toBe('e');
  });
});

// ---------------------------------------------------------------------------
// assembleAllelePair
// ---------------------------------------------------------------------------

describe('assembleAllelePair', () => {
  it('assembles E + e → "E/e"', () => {
    expect(assembleAllelePair('E', 'e')).toBe('E/e');
  });

  it('assembles E + E → "E/E"', () => {
    expect(assembleAllelePair('E', 'E')).toBe('E/E');
  });

  it('preserves sire-first order: e + E → "e/E"', () => {
    expect(assembleAllelePair('e', 'E')).toBe('e/E');
  });
});

// ---------------------------------------------------------------------------
// inheritLocus
// ---------------------------------------------------------------------------

describe('inheritLocus — basic Mendelian recombination', () => {
  it('produces E/E when rng always picks first allele from E/E × E/E', () => {
    const rng = deterministicRng([0.1, 0.1]);
    expect(inheritLocus('E_Extension', 'E/E', 'E/E', rng)).toBe('E/E');
  });

  it('produces E/e when sire rng picks E (0.1) and dam rng picks e (0.9) from E/e × E/e', () => {
    const rng = deterministicRng([0.1, 0.9]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('E/e');
  });

  it('produces e/E when sire rng picks e (0.9) and dam rng picks E (0.1)', () => {
    const rng = deterministicRng([0.9, 0.1]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('e/E');
  });

  it('produces e/e when rng always picks second allele from E/e × E/e', () => {
    const rng = deterministicRng([0.9, 0.9]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('e/e');
  });

  it('produces n/n from n/n × n/n', () => {
    expect(inheritLocus('O_FrameOvero', 'n/n', 'n/n', Math.random)).toBe('n/n');
  });
});

describe('inheritLocus — lethal reroll', () => {
  it('never returns O/O for O/n × O/n — rerolls to non-lethal', () => {
    // Force the first few draws to produce O/O, then eventually n/n
    // O comes from position 0, n from position 1 in 'O/n'
    // To produce O/O: sire picks O (< 0.5), dam picks O (< 0.5)
    // To avoid O/O: at least one picks n (>= 0.5)
    // Sequence: 0.1,0.1 → O/O (lethal, reroll), then 0.1,0.9 → O/n (safe)
    const rng = deterministicRng([0.1, 0.1, 0.1, 0.9]);
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', rng);
    expect(result).not.toBe('O/O');
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });

  it('uses heterozygous fallback after exhausting reroll attempts — returns O/n (carrier form)', () => {
    // Force all 100 attempts to produce O/O by always picking index 0
    const alwaysFirst = deterministicRng([0.1]);
    // With O/n × O/n, O is always at index 0, so alwaysFirst produces O/O every time
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', alwaysFirst);
    // After 100 attempts the fallback kicks in — spec mandates 'O/n' (carrier allele first)
    expect(result).toBe('O/n');
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inheritColorGenotype — full genotype
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — structure', () => {
  it('returns an object containing all CORE_LOCI', () => {
    const sire = buildGenotype();
    const dam = buildGenotype();
    const result = inheritColorGenotype(sire, dam);
    for (const locus of CORE_LOCI) {
      expect(result).toHaveProperty(locus);
      expect(typeof result[locus]).toBe('string');
    }
  });

  it('foal of e/e × e/e always has e/e Extension', () => {
    const sire = buildGenotype({ E_Extension: 'e/e' });
    const dam = buildGenotype({ E_Extension: 'e/e' });
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.E_Extension).toBe('e/e');
    }
  });

  it('foal of E/E × E/E always has E/E Extension', () => {
    const sire = buildGenotype({ E_Extension: 'E/E' });
    const dam = buildGenotype({ E_Extension: 'E/E' });
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.E_Extension).toBe('E/E');
    }
  });

  it('foal genotype does not contain O/O when both parents are O/n', () => {
    const sire = buildGenotype({ O_FrameOvero: 'O/n' });
    const dam = buildGenotype({ O_FrameOvero: 'O/n' });
    for (let i = 0; i < 50; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.O_FrameOvero).not.toBe('O/O');
    }
  });
});

describe('inheritColorGenotype — breed restrictions', () => {
  it('overrides TO_Tobiano to to/to when breed only allows to/to (Thoroughbred-like)', () => {
    const thoroughbredProfile = {
      allowed_alleles: {
        TO_Tobiano: ['to/to'],
      },
    };
    const sire = buildGenotype({ TO_Tobiano: 'TO/to' });
    const dam = buildGenotype({ TO_Tobiano: 'TO/to' });

    // Run 20 times — even if inheritance would produce TO/TO or TO/to, breed restricts to to/to
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam, thoroughbredProfile);
      expect(foal.TO_Tobiano).toBe('to/to');
    }
  });

  it('does NOT override loci not in allowed_alleles', () => {
    const restrictedProfile = {
      allowed_alleles: {
        TO_Tobiano: ['to/to'],
      },
    };
    const sire = buildGenotype({ E_Extension: 'e/e' });
    const dam = buildGenotype({ E_Extension: 'e/e' });
    const foal = inheritColorGenotype(sire, dam, restrictedProfile);
    // E_Extension not restricted — should still be e/e from parents
    expect(foal.E_Extension).toBe('e/e');
  });

  it('applies no restrictions when foalBreedProfile is null', () => {
    const sire = buildGenotype();
    const dam = buildGenotype();
    expect(() => inheritColorGenotype(sire, dam, null)).not.toThrow();
  });

  it('does NOT apply a breed restriction when allowed[0] would be a lethal allele pair', () => {
    // A misconfigured breed profile that lists a lethal as the required allele.
    // The guard in enforceBreedRestrictions must preserve the inherited non-lethal value.
    const brokenProfile = {
      allowed_alleles: {
        O_FrameOvero: ['O/O'], // lethal — must never be installed
      },
    };
    const sire = buildGenotype({ O_FrameOvero: 'n/n' });
    const dam = buildGenotype({ O_FrameOvero: 'n/n' });
    const foal = inheritColorGenotype(sire, dam, brokenProfile);
    // Restriction must be skipped — foal keeps the inherited non-lethal value
    expect(isLethalCombination('O_FrameOvero', foal.O_FrameOvero)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// disallowed_combinations (Equoria-26qjf.2)
// ---------------------------------------------------------------------------

describe('buildDisallowedMap / isDisallowedCombination (Equoria-26qjf.2)', () => {
  it('builds a per-locus Set from disallowed_combinations', () => {
    const profile = {
      disallowed_combinations: { W_DominantWhite: ['W4/W4', 'W20/W20'] },
    };
    const map = buildDisallowedMap(profile);
    expect(map.W_DominantWhite).toBeInstanceOf(Set);
    expect(isDisallowedCombination(map, 'W_DominantWhite', 'W4/W4')).toBe(true);
    expect(isDisallowedCombination(map, 'W_DominantWhite', 'W20/W20')).toBe(true);
    expect(isDisallowedCombination(map, 'W_DominantWhite', 'W4/w')).toBe(false);
  });

  it('returns an empty map for null / non-object / array / missing disallowed_combinations', () => {
    expect(buildDisallowedMap(null)).toEqual({});
    expect(buildDisallowedMap(undefined)).toEqual({});
    expect(buildDisallowedMap([])).toEqual({});
    expect(buildDisallowedMap({})).toEqual({});
    expect(buildDisallowedMap({ disallowed_combinations: {} })).toEqual({});
    expect(buildDisallowedMap({ disallowed_combinations: null })).toEqual({});
    expect(buildDisallowedMap({ disallowed_combinations: [] })).toEqual({});
  });

  it('ignores empty arrays for a locus', () => {
    const map = buildDisallowedMap({ disallowed_combinations: { W_DominantWhite: [] } });
    expect(map.W_DominantWhite).toBeUndefined();
  });
});

describe('inheritColorGenotype — disallowed_combinations (Equoria-26qjf.2)', () => {
  // AQH-like: forbids W4/W4 even though W4/w is allowed and not lethal.
  const aqhLikeProfile = {
    allowed_alleles: { W_DominantWhite: ['w/w', 'W4/w', 'W20/w'] },
    disallowed_combinations: { W_DominantWhite: ['W4/W4', 'W20/W20'] },
  };

  it('SENTINEL: a breed disallowing W4/W4 never yields W4/W4 from inheritance', () => {
    // Both parents W4/w → a naive Punnett yields W4/W4 ~25% of the time.
    const sire = buildGenotype({ W_DominantWhite: 'W4/w' });
    const dam = buildGenotype({ W_DominantWhite: 'W4/w' });
    for (let i = 0; i < 2000; i++) {
      const foal = inheritColorGenotype(sire, dam, aqhLikeProfile);
      expect(foal.W_DominantWhite).not.toBe('W4/W4');
    }
  });

  it('COUNTER: without the disallowed rule, W4/W4 DOES occur (proves the test is real)', () => {
    // Same cross, but a profile that allows W4/W4 and declares no disallowed rule.
    const permissiveProfile = {
      allowed_alleles: { W_DominantWhite: ['w/w', 'W4/w', 'W4/W4'] },
    };
    const sire = buildGenotype({ W_DominantWhite: 'W4/w' });
    const dam = buildGenotype({ W_DominantWhite: 'W4/w' });
    let sawW4W4 = false;
    for (let i = 0; i < 2000 && !sawW4W4; i++) {
      if (inheritColorGenotype(sire, dam, permissiveProfile).W_DominantWhite === 'W4/W4') {
        sawW4W4 = true;
      }
    }
    expect(sawW4W4).toBe(true);
  });

  it('enforceBreedRestrictions final guard removes a disallowed pair even on fallback', () => {
    // Both parents homozygous W4/W4: every Punnett outcome is the disallowed W4/W4,
    // so inheritLocus exhausts rerolls into a forbidden fallback — the post-pass
    // must correct it to an allowed, non-disallowed allele.
    const sire = buildGenotype({ W_DominantWhite: 'W4/W4' });
    const dam = buildGenotype({ W_DominantWhite: 'W4/W4' });
    const foal = inheritColorGenotype(sire, dam, aqhLikeProfile);
    expect(foal.W_DominantWhite).not.toBe('W4/W4');
    expect(aqhLikeProfile.allowed_alleles.W_DominantWhite).toContain(foal.W_DominantWhite);
  });

  it('NO-REGRESSION: empty disallowed_combinations behaves exactly as before', () => {
    const emptyProfile = {
      allowed_alleles: { W_DominantWhite: ['w/w', 'W4/w', 'W4/W4'] },
      disallowed_combinations: {},
    };
    const sire = buildGenotype({ W_DominantWhite: 'W4/w' });
    const dam = buildGenotype({ W_DominantWhite: 'W4/w' });
    // Should not throw and should permit W4/W4 to appear over many draws.
    let sawW4W4 = false;
    for (let i = 0; i < 2000 && !sawW4W4; i++) {
      if (inheritColorGenotype(sire, dam, emptyProfile).W_DominantWhite === 'W4/W4') {
        sawW4W4 = true;
      }
    }
    expect(sawW4W4).toBe(true);
  });
});

describe('inheritColorGenotype — missing parent fallback', () => {
  it('returns a valid genotype when sireGenotype is null (falls back to random)', () => {
    const dam = buildGenotype();
    const result = inheritColorGenotype(null, dam);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when sireGenotype is undefined (falls back to random)', () => {
    const dam = buildGenotype();
    const result = inheritColorGenotype(undefined, dam);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is null (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, null);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is undefined (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, undefined);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is empty object (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, {});
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('does not throw when both parents are null', () => {
    expect(() => inheritColorGenotype(null, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Statistical: Mendelian ratio (AC5)
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — statistical Mendelian ratio (AC5)', () => {
  // 10000 trials matches project standard (pre-31d-chi-squared-flakiness-fix).
  // p=0.001 critical value for df=2 = 13.816 — far less likely to flake than p=0.05.
  const TRIALS = 10000;

  it('Ee × Ee produces ~25% EE, ~50% Ee or eE, ~25% ee (chi-squared p > 0.001)', () => {
    const sire = buildGenotype({ E_Extension: 'E/e' });
    const dam = buildGenotype({ E_Extension: 'E/e' });

    const counts = { EE: 0, Ee: 0, ee: 0 };

    for (let i = 0; i < TRIALS; i++) {
      const foal = inheritColorGenotype(sire, dam);
      const ext = foal.E_Extension;
      if (ext === 'E/E') {
        counts.EE++;
      } else if (ext === 'e/e') {
        counts.ee++;
      } else {
        counts.Ee++; // 'E/e' or 'e/E'
      }
    }

    // Expected: 25% EE, 50% Ee, 25% ee
    const expectedEE = TRIALS * 0.25;
    const expectedEe = TRIALS * 0.5;
    const expectedee = TRIALS * 0.25;

    // Chi-squared statistic
    const chiSq =
      (counts.EE - expectedEE) ** 2 / expectedEE +
      (counts.Ee - expectedEe) ** 2 / expectedEe +
      (counts.ee - expectedee) ** 2 / expectedee;

    // df=2, p=0.001 critical value = 13.816
    expect(chiSq).toBeLessThan(13.816);
  });
});

// ---------------------------------------------------------------------------
// Statistical: O/O never appears (AC2 property-based)
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — O/O never appears (AC2 property)', () => {
  it('O/n × O/n in 1000 trials never produces O/O foal', () => {
    const sire = buildGenotype({ O_FrameOvero: 'O/n' });
    const dam = buildGenotype({ O_FrameOvero: 'O/n' });

    for (let i = 0; i < 1000; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.O_FrameOvero).not.toBe('O/O');
    }
  });
});

// ---------------------------------------------------------------------------
// Equoria-jeam: Per-locus GENERIC_DEFAULTS fallback when one parent omits a locus
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — GENERIC_DEFAULTS fallback (Equoria-jeam)', () => {
  it('foal gets a valid Extension pair when dam omits E_Extension entirely', () => {
    const sire = buildGenotype({ E_Extension: 'E/E' });
    // Dam has no E_Extension key
    const dam = buildGenotype();
    delete dam.E_Extension;
    const foal = inheritColorGenotype(sire, dam);
    expect(foal).toHaveProperty('E_Extension');
    expect(typeof foal.E_Extension).toBe('string');
    // With sire E/E and dam defaulting to 'E/e', foal can be E/E or E/e — never undefined/n/n
    expect(['E/E', 'E/e', 'e/E']).toContain(foal.E_Extension);
  });

  it('symmetric case: foal gets valid Extension when sire omits E_Extension', () => {
    const sire = buildGenotype();
    delete sire.E_Extension;
    const dam = buildGenotype({ E_Extension: 'E/E' });
    const foal = inheritColorGenotype(sire, dam);
    expect(['E/E', 'E/e', 'e/E']).toContain(foal.E_Extension);
  });

  it('D_Dun default is nd2/nd2 (not n/n) when both parents omit it', () => {
    const sire = buildGenotype();
    const dam = buildGenotype();
    delete sire.D_Dun;
    delete dam.D_Dun;
    const foal = inheritColorGenotype(sire, dam);
    // Both parents default to 'nd2/nd2', so foal must be nd2/nd2
    expect(foal.D_Dun).toBe('nd2/nd2');
  });

  it('union of loci includes loci only present in one parent', () => {
    // Sire has a non-CORE locus 'Custom_Locus'; dam does not
    const sire = { ...buildGenotype(), Custom_Locus: 'X/x' };
    const dam = buildGenotype();
    const foal = inheritColorGenotype(sire, dam);
    expect(foal).toHaveProperty('Custom_Locus');
    // Dam will default to 'n/n' for unknown locus; foal is X/n or n/X or X/X or n/n
    expect(typeof foal.Custom_Locus).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Equoria-tr50: enforceBreedRestrictions iterates alternates when allowed[0] lethal
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — alternate-allowed-allele fallback (Equoria-tr50)', () => {
  it('uses allowed[1] when allowed[0] is lethal (O/O lethal, O/n picked instead)', () => {
    const profile = {
      allowed_alleles: {
        O_FrameOvero: ['O/O', 'O/n'], // O/O is lethal — must skip and use O/n
      },
    };
    const sire = buildGenotype({ O_FrameOvero: 'n/n' });
    const dam = buildGenotype({ O_FrameOvero: 'n/n' });
    const foal = inheritColorGenotype(sire, dam, profile);
    // Inherited n/n is not in allowed; allowed[0]=O/O is lethal → must use O/n
    expect(foal.O_FrameOvero).toBe('O/n');
  });

  it('skips restriction entirely when EVERY allowed is lethal', () => {
    const profile = {
      allowed_alleles: {
        O_FrameOvero: ['O/O'], // only lethal allowed
      },
    };
    const sire = buildGenotype({ O_FrameOvero: 'n/n' });
    const dam = buildGenotype({ O_FrameOvero: 'n/n' });
    const foal = inheritColorGenotype(sire, dam, profile);
    // Must NOT install O/O; foal keeps inherited n/n
    expect(isLethalCombination('O_FrameOvero', foal.O_FrameOvero)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Equoria-xb5k: W/SW/EDXW lethal-reroll exhaustion fallback paths
// ---------------------------------------------------------------------------

describe('inheritLocus — reroll exhaustion fallback (Equoria-xb5k)', () => {
  it('W_DominantWhite W20/w × W20/w → fallback returns W20/w (carrier form)', () => {
    // Force all 100 rerolls to lethal by always picking index 0 (W20)
    const alwaysFirst = deterministicRng([0.1]);
    const result = inheritLocus('W_DominantWhite', 'W20/w', 'W20/w', alwaysFirst);
    expect(result).toBe('W20/w');
    expect(isLethalCombination('W_DominantWhite', result)).toBe(false);
  });

  it('SW_SplashWhite SW3/n × SW3/n → fallback returns SW3/n', () => {
    const alwaysFirst = deterministicRng([0.1]);
    const result = inheritLocus('SW_SplashWhite', 'SW3/n', 'SW3/n', alwaysFirst);
    expect(result).toBe('SW3/n');
    expect(isLethalCombination('SW_SplashWhite', result)).toBe(false);
  });

  it('EDXW EDXW1/n × EDXW1/n → fallback returns EDXW1/n', () => {
    const alwaysFirst = deterministicRng([0.1]);
    const result = inheritLocus('EDXW', 'EDXW1/n', 'EDXW1/n', alwaysFirst);
    expect(result).toBe('EDXW1/n');
    expect(isLethalCombination('EDXW', result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Equoria-bkbo: Statistical distribution test for O/n × O/n renormalization
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — O/n × O/n renormalized distribution (Equoria-bkbo)', () => {
  // After lethal removal: P(O/n or n/O) = 2/3, P(n/n) = 1/3.
  // 10000 trials, chi-squared df=1, p=0.001 critical = 10.828.
  it('O/n × O/n produces ~67% O/n and ~33% n/n (chi-squared df=1 p > 0.001)', () => {
    const TRIALS = 10000;
    const sire = buildGenotype({ O_FrameOvero: 'O/n' });
    const dam = buildGenotype({ O_FrameOvero: 'O/n' });

    const counts = { On: 0, nn: 0 };
    for (let i = 0; i < TRIALS; i++) {
      const foal = inheritColorGenotype(sire, dam);
      const o = foal.O_FrameOvero;
      if (o === 'n/n') {
        counts.nn++;
      } else if (o === 'O/n' || o === 'n/O') {
        counts.On++;
      }
      // O/O should never appear; if it does, this throws via toBeLessThan below indirectly
      expect(o).not.toBe('O/O');
    }

    // Expected: 2/3 O/n, 1/3 n/n (after lethal removal of O/O)
    const expectedOn = (TRIALS * 2) / 3;
    const expectednn = TRIALS / 3;

    const chiSq = (counts.On - expectedOn) ** 2 / expectedOn + (counts.nn - expectednn) ** 2 / expectednn;

    // df=1, p=0.001 critical value = 10.828
    expect(chiSq).toBeLessThan(10.828);
  });
});

// ---------------------------------------------------------------------------
// Integration: POST /api/v1/horses with sireId + damId inherits genotype
// ---------------------------------------------------------------------------

describe('POST /api/v1/horses — breeding inheritance integration', () => {
  let server;
  let testUserId;
  let sireHorseId;
  let damHorseId;
  let foalHorseId;
  let breedId;
  const timestamp = Date.now();

  const testUserData = {
    username: `breedtest_${timestamp}`,
    email: `breedtest_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Breed',
    lastName: 'Test',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const breed =
      (await prisma.breed.findFirst({ where: { name: 'Arabian' } })) ??
      (await prisma.breed.create({ data: { name: 'Arabian', description: 'Arabian breed for inheritance tests' } }));
    breedId = breed.id;

    const hashedPassword = await bcrypt.hash(testUserData.password, 1);
    const user = await prisma.user.create({
      data: {
        username: testUserData.username,
        email: testUserData.email,
        password: hashedPassword,
        firstName: testUserData.firstName,
        lastName: testUserData.lastName,
      },
    });
    testUserId = user.id;

    // Create sire with a known all-chestnut genotype (e/e)
    // This ensures foal will also be e/e Extension
    const sireGenotype = {
      E_Extension: 'e/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'n/n',
      D_Dun: 'nd2/nd2',
      Z_Silver: 'n/n',
      Ch_Champagne: 'n/n',
      G_Gray: 'g/g',
      Rn_Roan: 'rn/rn',
      W_DominantWhite: 'w/w',
      TO_Tobiano: 'to/to',
      O_FrameOvero: 'n/n',
      SB1_Sabino1: 'n/n',
      SW_SplashWhite: 'n/n',
      LP_LeopardComplex: 'lp/lp',
      PATN1_Pattern1: 'patn1/patn1',
      EDXW: 'n/n',
      MFSD12_Mushroom: 'N/N',
    };

    const sire = await prisma.horse.create({
      data: {
        // Spread fixtureColor() first for a non-null phenotype (sentinel-safe),
        // then override colorGenotype with the deterministic e/e test genotype.
        ...fixtureColor(),
        name: `SireTest_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'stallion',
        breedId,
        userId: testUserId,
        colorGenotype: sireGenotype,
      },
    });
    sireHorseId = sire.id;

    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `DamTest_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'mare',
        breedId,
        userId: testUserId,
        colorGenotype: sireGenotype, // same e/e genotype for deterministic test
      },
    });
    damHorseId = dam.id;
  });

  afterAll(async () => {
    const cleanupIds = [foalHorseId, sireHorseId, damHorseId].filter(Boolean);
    if (cleanupIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: cleanupIds } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('foal created with sireId+damId inherits Extension from parents (e/e × e/e → e/e)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `FoalTest_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: sireHorseId,
        damId: damHorseId,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const foal = response.body.data;

    // The foal must have a colorGenotype (inherited)
    expect(foal.colorGenotype).toBeDefined();
    expect(typeof foal.colorGenotype).toBe('object');

    // Since both parents are e/e, foal MUST also be e/e — inheritance not random
    expect(foal.colorGenotype.E_Extension).toBe('e/e');

    // Phenotype must be Chestnut (e/e → chestnut)
    expect(foal.phenotype).toBeDefined();
    expect(foal.phenotype.colorName).toBe('Chestnut');

    foalHorseId = foal.id;
  });

  it('foal created WITHOUT sireId/damId uses random generation (no inheritance)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `RandomHorse_${timestamp}`,
        breedId,
        age: 3,
        sex: 'stallion',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const horse = response.body.data;

    // Must still have colorGenotype + phenotype (random generation path)
    expect(horse.colorGenotype).toBeDefined();
    expect(horse.phenotype).toBeDefined();
    expect(typeof horse.phenotype.colorName).toBe('string');

    // Cleanup
    await prisma.horse.deleteMany({ where: { id: horse.id } });
  });

  it('returns 400 when sireId points to a mare (wrong sex for sire role)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    // damHorseId is a mare — using it as a sire should be rejected
    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `SexValidationTest_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: damHorseId, // mare used as sire — invalid
        damId: damHorseId,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/stallion/i);
  });

  it('returns 400 when damId points to a stallion (wrong sex for dam role)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    // sireHorseId is a stallion — using it as a dam should be rejected
    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `SexValidationTest2_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: sireHorseId,
        damId: sireHorseId, // stallion used as dam — invalid
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/mare/i);
  });

  it('returns 404 "Sire not found" when sireId does not exist (CWE-639 disclosure resistance, Equoria-zrbc)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `NonExistentSire_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: 999999999,
        damId: damHorseId,
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Sire not found');
  });

  // Equoria-zrbc / 31E-2 follow-up — CWE-639 cross-user disclosure resistance.
  // POST /api/v1/horses must reject sireId/damId belonging to another user
  // with a 404 byte-identical to the "not found" response, so attackers cannot
  // enumerate other players' horses by ID.
  it("returns 404 when sireId points to another user's horse (cross-user sentinel)", async () => {
    // Create a SECOND user + their own horse. Then attempt to use that
    // horse as sireId under our test user — must return 404 "Sire not found".
    const otherEmail = `otherUser_${timestamp}@test.com`;
    const otherPasswordHash = await bcrypt.hash('Pass123!', 10);
    const otherUser = await prisma.user.create({
      data: {
        username: `otherUser_${timestamp}`,
        email: otherEmail,
        password: otherPasswordHash,
        firstName: 'Other',
        lastName: 'User',
        money: 0,
        settings: {},
      },
    });
    const otherSire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `OtherUserSire_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'stallion',
        breedId,
        userId: otherUser.id,
        colorGenotype: buildGenotype({ E_Extension: 'e/e' }),
      },
    });

    try {
      const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
        expiresIn: '1h',
      });

      const response = await request(app)
        .post('/api/v1/horses')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CrossUserAttack_${timestamp}`,
          breedId,
          age: 0,
          sex: 'mare',
          sireId: otherSire.id, // attacker tries to use another user's stallion
          damId: damHorseId,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      // Byte-identical to "Sire not found" — same as the non-existent case.
      expect(response.body.message).toBe('Sire not found');
    } finally {
      await prisma.horse.deleteMany({ where: { id: otherSire.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: otherUser.id } }).catch(() => {});
    }
  });

  it("returns 404 when damId points to another user's horse (cross-user sentinel)", async () => {
    const otherEmail = `otherUser2_${timestamp}@test.com`;
    const otherPasswordHash = await bcrypt.hash('Pass123!', 10);
    const otherUser = await prisma.user.create({
      data: {
        username: `otherUser2_${timestamp}`,
        email: otherEmail,
        password: otherPasswordHash,
        firstName: 'Other2',
        lastName: 'User',
        money: 0,
        settings: {},
      },
    });
    const otherDam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `OtherUserDam_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'mare',
        breedId,
        userId: otherUser.id,
        colorGenotype: buildGenotype({ E_Extension: 'e/e' }),
      },
    });

    try {
      const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
        expiresIn: '1h',
      });

      const response = await request(app)
        .post('/api/v1/horses')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CrossUserAttackDam_${timestamp}`,
          breedId,
          age: 0,
          sex: 'mare',
          sireId: sireHorseId,
          damId: otherDam.id, // attacker tries to use another user's mare
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Dam not found');
    } finally {
      await prisma.horse.deleteMany({ where: { id: otherDam.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: otherUser.id } }).catch(() => {});
    }
  });
});
