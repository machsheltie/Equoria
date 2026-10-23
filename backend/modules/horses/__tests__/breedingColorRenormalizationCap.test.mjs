// Renormalized colour-prediction probabilities never exceed 1 (Equoria-gbpig).
//
// Both filters divide each surviving probability by the surviving total. The
// documented invariant is Math.min(1, probability / total). The case is not
// reachable from the real Mendelian inputs (every probability there is a share of
// the total, so it cannot exceed it), which is why this calls the pure filters
// directly with an out-of-range probability instead of inventing a route to it.
// The service functions are pure (no DB, no mocks).

import { filterLethalGenotypes, filterDisallowedGenotypes } from '../services/breedingColorPredictionService.mjs';

// A 1.5 share next to a -0.8 share totals 0.7, so 1.5 / 0.7 is 2.14 uncapped.
const outOfRange = () => [
  { genotype: { O_FrameOvero: 'O/n' }, prob: 1.5 },
  { genotype: { O_FrameOvero: 'n/n' }, prob: -0.8 },
  { genotype: { O_FrameOvero: 'O/O' }, prob: 0.25 },
];

describe('renormalization cap (Equoria-gbpig)', () => {
  test('filterLethalGenotypes caps a renormalized probability at 1', () => {
    const { filtered } = filterLethalGenotypes(outOfRange());
    expect(filtered.length).toBeGreaterThan(0);
    for (const entry of filtered) {
      expect(entry.prob).toBeLessThanOrEqual(1);
    }
  });

  test('filterDisallowedGenotypes caps a renormalized probability at 1', () => {
    const profile = { disallowedCombinations: { O_FrameOvero: ['O/O'] } };
    const { filtered } = filterDisallowedGenotypes(outOfRange(), profile);
    expect(filtered.length).toBeGreaterThan(0);
    for (const entry of filtered) {
      expect(entry.prob).toBeLessThanOrEqual(1);
    }
  });

  test('ordinary renormalization is unchanged (sums to 1, none above 1)', () => {
    const input = [
      { genotype: { O_FrameOvero: 'O/n' }, prob: 0.5 },
      { genotype: { O_FrameOvero: 'O/O' }, prob: 0.25 },
      { genotype: { O_FrameOvero: 'n/n' }, prob: 0.25 },
    ];
    const { filtered } = filterLethalGenotypes(input);
    expect(filtered.reduce((sum, f) => sum + f.prob, 0)).toBeCloseTo(1, 6);
    expect(filtered.find(f => f.genotype.O_FrameOvero === 'O/n').prob).toBeCloseTo(0.6667, 3);
  });

  test('all genotypes removed still returns an empty list', () => {
    const { filtered } = filterLethalGenotypes([{ genotype: { O_FrameOvero: 'O/O' }, prob: 1 }]);
    expect(filtered).toEqual([]);
  });
});
