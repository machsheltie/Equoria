/**
 * compatibilityFromPrediction unit tests (Equoria-to87r)
 *
 * Proves CompatibilityPreview data is derived from the REAL backend
 * genetic-probability + inbreeding-analysis response shapes, NOT from
 * client-side hardcoded math (no 0.95/0.7 trait constants, no 0.02
 * inbreeding fallback, no synthetic "Shared Paternal Grandsire" pedigree).
 */

import { describe, it, expect } from 'vitest';
import {
  mapPredictionToCompatibilityData,
  INBREEDING_WARNING_THRESHOLD,
  type BackendGeneticProbability,
  type BackendInbreedingAnalysis,
} from '../compatibilityFromPrediction';

// Shape mirrors backend/services/enhancedGeneticProbabilityService.mjs output.
const realGenetic: BackendGeneticProbability = {
  statProbabilities: {
    speed: {
      expectedValue: 64,
      expectedRange: { min: 54, max: 74 },
      variance: 10,
    },
    stamina: {
      expectedValue: 58,
      expectedRange: { min: 48, max: 68 },
      variance: 10,
    },
  },
  traitProbabilities: {
    positive: [{ trait: 'athletic', probability: 75, inheritancePattern: 'dominant' }],
    negative: [{ trait: 'nervous', probability: 32, inheritancePattern: 'heterozygous' }],
    hidden: [{ trait: 'legendary_bloodline', probability: 12, inheritancePattern: 'recessive' }],
  },
};

// Shape mirrors backend/services/geneticDiversityTrackingService.mjs
// calculateDetailedInbreedingCoefficient output.
const realInbreeding: BackendInbreedingAnalysis = {
  coefficient: 0.1875,
  commonAncestors: [
    { id: 42, name: 'Old Thunder', contribution: 0.125 },
    { id: 7, name: 'Silver Mare', contribution: 0.0625 },
  ],
  recommendations: ['Consider an outcross to reduce shared ancestry'],
};

describe('mapPredictionToCompatibilityData (Equoria-to87r)', () => {
  it('derives stat ranges straight from backend statProbabilities (no (s+d)/2 math)', () => {
    const data = mapPredictionToCompatibilityData(realGenetic, realInbreeding);
    expect(data).not.toBeNull();
    expect(data!.statRanges.speed).toEqual({ min: 54, avg: 64, max: 74 });
    expect(data!.statRanges.stamina).toEqual({ min: 48, avg: 58, max: 68 });
  });

  it('uses real per-trait probabilities (percent→0-1), not hardcoded 0.95/0.7', () => {
    const data = mapPredictionToCompatibilityData(realGenetic, realInbreeding)!;
    const athletic = data.traits.find((t) => t.name === 'athletic')!;
    const nervous = data.traits.find((t) => t.name === 'nervous')!;
    const legendary = data.traits.find((t) => t.name === 'legendary_bloodline')!;
    expect(athletic.probability).toBeCloseTo(0.75, 5);
    expect(nervous.probability).toBeCloseTo(0.32, 5);
    expect(legendary.probability).toBeCloseTo(0.12, 5);
    // None of the legacy hardcoded constants should appear.
    for (const t of data.traits) {
      expect(t.probability).not.toBe(0.95);
      expect(t.probability).not.toBe(0.7);
    }
    expect(athletic.source).toBe('both'); // dominant pattern
    expect(legendary.source).toBe('recessive');
  });

  it('uses the real path-analysis inbreeding coefficient (no 0.02 fabrication)', () => {
    const data = mapPredictionToCompatibilityData(realGenetic, realInbreeding)!;
    expect(data.inbreedingCoefficient).toBeCloseTo(0.1875, 5);
    expect(data.inbreedingCoefficient).not.toBe(0.02);
    expect(data.inbreedingCoefficient).toBeGreaterThan(INBREEDING_WARNING_THRESHOLD);
  });

  it('builds pedigree overlap from real commonAncestors, not synthetic labels', () => {
    const data = mapPredictionToCompatibilityData(realGenetic, realInbreeding)!;
    const names = data.pedigreeOverlap.map((p) => p.ancestorName);
    expect(names).toEqual(['Old Thunder', 'Silver Mare']);
    expect(names).not.toContain('Shared Paternal Grandsire');
    expect(names).not.toContain('Shared Maternal Granddam');
  });

  it('returns null when genetic prediction is unavailable (honest, no fake numbers)', () => {
    expect(mapPredictionToCompatibilityData(null, realInbreeding)).toBeNull();
    expect(mapPredictionToCompatibilityData({}, realInbreeding)).toBeNull();
    expect(
      mapPredictionToCompatibilityData({ statProbabilities: undefined }, realInbreeding)
    ).toBeNull();
  });

  it('does not fabricate an inbreeding value when inbreeding analysis is missing', () => {
    const data = mapPredictionToCompatibilityData(realGenetic, null)!;
    expect(data.inbreedingCoefficient).toBe(0);
    expect(data.inbreedingCoefficient).not.toBe(0.02);
    expect(data.pedigreeOverlap).toEqual([]);
  });
});
