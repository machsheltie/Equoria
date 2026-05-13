/**
 * breedingColorInheritanceService — unit tests (Equoria-rr7)
 *
 * Pure exports: splitAlleles, isLethalCombination, drawAllele,
 * assembleAllelePair, inheritLocus, inheritColorGenotype.
 * Imports only logger + genotypeGenerationService — no DB.
 */

import { describe, it, expect } from '@jest/globals';
import {
  splitAlleles,
  isLethalCombination,
  drawAllele,
  assembleAllelePair,
  inheritLocus,
  inheritColorGenotype,
  LETHAL_COMBINATIONS,
} from '../../modules/horses/services/breedingColorInheritanceService.mjs';
import { CORE_LOCI } from '../../modules/horses/services/genotypeGenerationService.mjs';

// ---------------------------------------------------------------------------
// splitAlleles
// ---------------------------------------------------------------------------
describe('splitAlleles', () => {
  it('splits E/e correctly', () => {
    expect(splitAlleles('E/e')).toEqual(['E', 'e']);
  });

  it('splits homozygous E/E correctly', () => {
    expect(splitAlleles('E/E')).toEqual(['E', 'E']);
  });

  it('splits nd2/nd2 correctly', () => {
    expect(splitAlleles('nd2/nd2')).toEqual(['nd2', 'nd2']);
  });

  it('returns ["n", "n"] for null', () => {
    expect(splitAlleles(null)).toEqual(['n', 'n']);
  });

  it('returns ["n", "n"] for undefined', () => {
    expect(splitAlleles(undefined)).toEqual(['n', 'n']);
  });

  it('returns ["n", "n"] for empty string', () => {
    expect(splitAlleles('')).toEqual(['n', 'n']);
  });

  it('returns homozygous fallback for malformed input (no slash)', () => {
    const result = splitAlleles('BadAllele');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(result[1]); // homozygous fallback
  });
});

// ---------------------------------------------------------------------------
// isLethalCombination
// ---------------------------------------------------------------------------
describe('isLethalCombination', () => {
  it('returns false for non-lethal locus', () => {
    expect(isLethalCombination('E_Extension', 'e/e')).toBe(false);
  });

  it('returns false for locus not in LETHAL_COMBINATIONS', () => {
    expect(isLethalCombination('A_Agouti', 'a/a')).toBe(false);
  });

  it('returns true for O/O (lethal white overo)', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/O')).toBe(true);
  });

  it('returns false for O/n (carrier, not lethal)', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/n')).toBe(false);
  });

  it('returns true for lethal dominant white W5/W5', () => {
    expect(isLethalCombination('W_DominantWhite', 'W5/W5')).toBe(true);
  });

  it('returns false for W5/w (heterozygous — not lethal)', () => {
    expect(isLethalCombination('W_DominantWhite', 'W5/w')).toBe(false);
  });

  it('returns true for SW3/SW3 (lethal splash white)', () => {
    expect(isLethalCombination('SW_SplashWhite', 'SW3/SW3')).toBe(true);
  });

  it('returns true for EDXW1/EDXW1 (lethal extended white)', () => {
    expect(isLethalCombination('EDXW', 'EDXW1/EDXW1')).toBe(true);
  });

  it('LETHAL_COMBINATIONS exports a map of Sets', () => {
    for (const [locus, lethalSet] of Object.entries(LETHAL_COMBINATIONS)) {
      expect(typeof locus).toBe('string');
      expect(lethalSet).toBeInstanceOf(Set);
    }
  });
});

// ---------------------------------------------------------------------------
// drawAllele
// ---------------------------------------------------------------------------
describe('drawAllele', () => {
  it('draws first allele when rng < 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.0)).toBe('E');
    expect(drawAllele(['E', 'e'], () => 0.4)).toBe('E');
  });

  it('draws second allele when rng >= 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.5)).toBe('e');
    expect(drawAllele(['E', 'e'], () => 0.9)).toBe('e');
  });

  it('draws from homozygous pair consistently', () => {
    expect(drawAllele(['E', 'E'], () => 0.3)).toBe('E');
    expect(drawAllele(['E', 'E'], () => 0.7)).toBe('E');
  });
});

// ---------------------------------------------------------------------------
// assembleAllelePair
// ---------------------------------------------------------------------------
describe('assembleAllelePair', () => {
  it('assembles sire/dam in order', () => {
    expect(assembleAllelePair('E', 'e')).toBe('E/e');
  });

  it('assembles homozygous pair', () => {
    expect(assembleAllelePair('E', 'E')).toBe('E/E');
  });

  it('assembles multi-char alleles', () => {
    expect(assembleAllelePair('nd2', 'nd1')).toBe('nd2/nd1');
  });
});

// ---------------------------------------------------------------------------
// inheritLocus
// ---------------------------------------------------------------------------
describe('inheritLocus', () => {
  it('produces a non-lethal allele pair for safe locus (E_Extension)', () => {
    const result = inheritLocus('E_Extension', 'E/e', 'E/e', () => 0.3);
    expect(typeof result).toBe('string');
    expect(result).toContain('/');
    expect(isLethalCombination('E_Extension', result)).toBe(false);
  });

  it('avoids O/O lethal by rerolling (both parents O/O — fallback)', () => {
    // Both parents homozygous lethal: every draw will produce O/O
    // After MAX_REROLL_ATTEMPTS, uses heterozygous fallback
    const result = inheritLocus('O_FrameOvero', 'O/O', 'O/O', () => 0.3);
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });

  it('succeeds when parents are O/n (carrier) with rng=0 (draws first allele each time)', () => {
    // First allele from 'O/n' is 'O'; second is 'n'
    // rng=0 → draws first from both → O/O → lethal → reroll
    // With alternating rng, or with rng=0.6 (second allele), avoids lethal
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', () => 0.6);
    // rng=0.6 >= 0.5 → draws second allele ('n') from both → n/n — not lethal
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });

  it('returns a string with a slash', () => {
    const result = inheritLocus('Cr_Cream', 'Cr/n', 'n/n', () => 0.3);
    expect(result).toMatch(/\//);
  });
});

// ---------------------------------------------------------------------------
// inheritColorGenotype — fallback paths
// ---------------------------------------------------------------------------
describe('inheritColorGenotype — fallback paths', () => {
  const rng = () => 0.5;

  it('falls back to generateGenotype when sire is null', () => {
    const result = inheritColorGenotype(null, { E_Extension: 'E/e' }, null, rng);
    expect(typeof result).toBe('object');
    for (const locus of CORE_LOCI) {
      expect(result).toHaveProperty(locus);
    }
  });

  it('falls back to generateGenotype when dam is null', () => {
    const result = inheritColorGenotype({ E_Extension: 'e/e' }, null, null, rng);
    expect(typeof result).toBe('object');
  });

  it('falls back to generateGenotype when sire is empty object', () => {
    const result = inheritColorGenotype({}, { E_Extension: 'e/e' }, null, rng);
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// inheritColorGenotype — Mendelian inheritance
// ---------------------------------------------------------------------------
describe('inheritColorGenotype — Mendelian inheritance', () => {
  const rng = () => 0.3; // always draws first allele

  const sire = { E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'n/n' };
  const dam = { E_Extension: 'e/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n' };

  it('returns an object with all CORE_LOCI', () => {
    const result = inheritColorGenotype(sire, dam, null, rng);
    for (const locus of CORE_LOCI) {
      expect(result).toHaveProperty(locus);
    }
  });

  it('foal allele at each locus comes from a parent', () => {
    const result = inheritColorGenotype(sire, dam, null, rng);
    // rng=0.3 draws first allele from each parent
    // E_Extension: sire='E/e'→'E', dam='e/e'→'e' → foal 'E/e'
    expect(result.E_Extension).toBe('E/e');
    // A_Agouti: sire='A/a'→'A', dam='a/a'→'a' → foal 'A/a'
    expect(result.A_Agouti).toBe('A/a');
  });

  it('all loci in result have a string value with a slash', () => {
    const result = inheritColorGenotype(sire, dam, null, rng);
    for (const locus of CORE_LOCI) {
      expect(typeof result[locus]).toBe('string');
      expect(result[locus]).toMatch(/\//);
    }
  });

  it('is deterministic with same rng + parents', () => {
    const r1 = inheritColorGenotype(sire, dam, null, rng);
    const r2 = inheritColorGenotype(sire, dam, null, rng);
    expect(r1).toEqual(r2);
  });

  it('no locus in result is a lethal combination', () => {
    const result = inheritColorGenotype(sire, dam, null, () => 0.5);
    for (const [locus, allelePair] of Object.entries(result)) {
      expect(isLethalCombination(locus, allelePair)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// inheritColorGenotype — breed restrictions
// ---------------------------------------------------------------------------
describe('inheritColorGenotype — breed restrictions (enforceBreedRestrictions)', () => {
  const rng = () => 0.3;
  const sire = { E_Extension: 'E/e', A_Agouti: 'A/a' };
  const dam = { E_Extension: 'E/e', A_Agouti: 'A/a' };

  it('overrides a disallowed allele with first allowed allele', () => {
    const foalBreedProfile = {
      allowed_alleles: {
        E_Extension: ['e/e'], // Force chestnut only
      },
    };
    const result = inheritColorGenotype(sire, dam, foalBreedProfile, rng);
    // With rng=0.3 (first alleles drawn: 'E' + 'E' = 'E/E'), 'E/E' is not in ['e/e']
    // → replaced with 'e/e'
    expect(result.E_Extension).toBe('e/e');
  });

  it('does not change a locus that is already allowed', () => {
    const foalBreedProfile = {
      allowed_alleles: {
        E_Extension: ['E/e', 'E/E', 'e/e'],
      },
    };
    const result = inheritColorGenotype(sire, dam, foalBreedProfile, rng);
    // E/E is in the allowed list → not changed
    expect(result.E_Extension).toBe('E/E');
  });

  it('applies no restrictions when foalBreedProfile is null', () => {
    const result = inheritColorGenotype(sire, dam, null, rng);
    // Should inherit E/E from E/e × E/e with rng drawing first alleles
    expect(result.E_Extension).toBe('E/E');
  });
});

// ---------------------------------------------------------------------------
// Branch-coverage additions (Equoria-rr7)
// ---------------------------------------------------------------------------

describe('isLethalCombination — line 109: no-slash allele pair returns false (Equoria-rr7)', () => {
  it('returns false when locus is in LETHAL_COMBINATIONS but allele pair has no slash', () => {
    // lethalSet exists for 'O_FrameOvero'; 'OO'.split('/') has length 1 ≠ 2 → line 109 return false
    expect(isLethalCombination('O_FrameOvero', 'OO')).toBe(false);
  });
});

describe('inheritLocus — line 147: heterozygous fallback when sireAllele ≠ damAllele (Equoria-rr7)', () => {
  it('exhausts rerolls with O/n × O/n and rng=0 → buildHeterozygousFallback sire≠dam arm', () => {
    // rng=0 always draws alleles[0]='O' from both O/n parents → pair is always 'O/O' (lethal)
    // After 100 exhausted attempts: buildHeterozygousFallback('O', 'n') → 'O' ≠ 'n' → line 147
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', () => 0);
    expect(result).toBe('O/n');
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });
});

describe('inheritColorGenotype — enforceBreedRestrictions line 212 + 219-222 (Equoria-rr7)', () => {
  it('line 212 continue: non-array allowed_alleles entry is skipped, locus value unchanged', () => {
    // allowed is null → !Array.isArray(null) = true → continue (line 212)
    // E_Extension not overridden; inherited as E/E with rng=0.3
    const s = { E_Extension: 'E/e' };
    const d = { E_Extension: 'E/e' };
    const bp = { allowed_alleles: { E_Extension: null } };
    const result = inheritColorGenotype(s, d, bp, () => 0.3);
    expect(result.E_Extension).toBe('E/E');
  });

  it('line 212 continue: empty-array allowed_alleles entry is skipped, locus value unchanged', () => {
    // allowed.length === 0 → continue (line 212)
    const s = { E_Extension: 'E/e' };
    const d = { E_Extension: 'E/e' };
    const bp = { allowed_alleles: { E_Extension: [] } };
    const result = inheritColorGenotype(s, d, bp, () => 0.3);
    expect(result.E_Extension).toBe('E/E');
  });

  it('lines 219-222: lethal replacement skipped — breed requires lethal allele, non-lethal value preserved', () => {
    // sire=O/n, dam=n/n; rng=0 draws first allele each time: sire→'O', dam→'n' → pair='O/n'
    // 'O/n' not lethal → first iteration succeeds; foal.O_FrameOvero = 'O/n'
    // enforceBreedRestrictions: 'O/n' not in ['O/O'] → replacement = 'O/O'
    // isLethalCombination('O_FrameOvero', 'O/O') = true → logger.warn + continue (lines 219-222)
    // O_FrameOvero stays 'O/n'
    const s = { O_FrameOvero: 'O/n' };
    const d = { O_FrameOvero: 'n/n' };
    const bp = { allowed_alleles: { O_FrameOvero: ['O/O'] } };
    const result = inheritColorGenotype(s, d, bp, () => 0);
    expect(result.O_FrameOvero).toBe('O/n');
    expect(isLethalCombination('O_FrameOvero', result.O_FrameOvero)).toBe(false);
  });
});
