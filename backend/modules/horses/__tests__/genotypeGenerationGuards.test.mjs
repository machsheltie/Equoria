/**
 * genotypeGenerationGuards.test.mjs
 *
 * Equoria-piiof (GEN-03): a store, starter or new horse is never minted with a
 * lethal pair, a pair its breed forbids, or a pair outside its breed's
 * allowedAlleles, even when the breed's alleleWeights give that pair weight.
 *
 * Pure function, real code, seeded RNG.
 */

import { generateGenotype } from '../services/genotypeGenerationService.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const draws = 2000;

function collect(profile, locus, seed) {
  const rng = seededRng(seed);
  const seen = new Map();
  for (let i = 0; i < draws; i++) {
    const pair = generateGenotype(profile, rng)[locus];
    seen.set(pair, (seen.get(pair) ?? 0) + 1);
  }
  return seen;
}

describe('Equoria-piiof: generateGenotype never mints a forbidden pair', () => {
  it('a profile weighting O/O never mints O/O (lethal)', () => {
    const profile = { alleleWeights: { O_FrameOvero: { 'O/O': 0.5, 'O/n': 0.3, 'n/n': 0.2 } } };
    const seen = collect(profile, 'O_FrameOvero', 0x0a);
    expect(seen.has('O/O')).toBe(false);
    // The other weights keep their 3:2 proportion (expected 1200 / 800).
    expect(seen.get('O/n')).toBeGreaterThan(1080);
    expect(seen.get('n/n')).toBeGreaterThan(680);
  });

  it('a pair in disallowedCombinations is never minted, in either spelling', () => {
    const profile = {
      alleleWeights: { W_DominantWhite: { 'w/w': 0.5, 'W4/W4': 0.3, 'W4/w': 0.2 } },
      disallowedCombinations: { W_DominantWhite: ['W4/W4'] },
    };
    expect(collect(profile, 'W_DominantWhite', 0x0b).has('W4/W4')).toBe(false);
  });

  it('a weighted pair outside allowedAlleles is never minted', () => {
    const profile = {
      allowedAlleles: { TO_Tobiano: ['to/to', 'TO/to'] },
      alleleWeights: { TO_Tobiano: { 'to/to': 0.4, 'TO/to': 0.3, 'TO/TO': 0.3 } },
    };
    const seen = collect(profile, 'TO_Tobiano', 0x0c);
    expect([...seen.keys()].sort()).toEqual(['TO/to', 'to/to']);
  });

  it('allowedAlleles spelled the other way round still allow the weighted pair', () => {
    const profile = {
      allowedAlleles: { Cr_Cream: ['n/n', 'n/Cr'] },
      alleleWeights: { Cr_Cream: { 'n/n': 0.5, 'Cr/n': 0.5 } },
    };
    const seen = collect(profile, 'Cr_Cream', 0x0d);
    expect(seen.get('Cr/n')).toBeGreaterThan(900);
  });

  it('a profile with no weights and a lethal first allowed entry mints the next usable one', () => {
    const profile = { allowedAlleles: { O_FrameOvero: ['O/O', 'O/n', 'n/n'] } };
    expect(generateGenotype(profile, seededRng(1)).O_FrameOvero).toBe('O/n');
  });

  it('when every weighted pair is forbidden the locus falls back to its wild type', () => {
    const profile = { alleleWeights: { O_FrameOvero: { 'O/O': 1 } } };
    expect(generateGenotype(profile, seededRng(2)).O_FrameOvero).toBe('n/n');
  });

  it('a valid profile draws exactly as before (same seed, same genotype)', () => {
    const profile = {
      allowedAlleles: { E_Extension: ['e/e', 'E/e', 'E/E'] },
      alleleWeights: { E_Extension: { 'e/e': 0.25, 'E/e': 0.5, 'E/E': 0.25 } },
    };
    const rng = seededRng(0x77);
    const expected = [];
    const replay = seededRng(0x77);
    for (let i = 0; i < 50; i++) {
      // One rng() draw per weighted locus: only E_Extension is weighted here.
      const roll = replay();
      expected.push(roll <= 0.25 ? 'e/e' : roll <= 0.75 ? 'E/e' : 'E/E');
    }
    const actual = Array.from({ length: 50 }, () => generateGenotype(profile, rng).E_Extension);
    expect(actual).toEqual(expected);
  });
});
