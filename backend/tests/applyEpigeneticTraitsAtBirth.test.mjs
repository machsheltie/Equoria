/**
 * Unit Test: Apply Epigenetic Traits At Birth — Breeding Condition Analysis
 *
 * applyEpigeneticTraitsAtBirth() is a pure function (no DB). Tests exercise
 * real business logic against plain JS inputs.  Probabilistic trait-presence
 * assertions use a retry loop so tests are statistically near-deterministic
 * without controlling Math.random.
 */

import { describe, beforeEach, expect, it } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../utils/applyEpigeneticTraitsAtBirth.mjs';

/**
 * Run fn up to maxRuns times. Return true if traitName appears in result[category]
 * at least once. With typical probabilities (0.30–0.80) and 25 runs the chance
 * of a false-negative is ≤ (1 - p)^25 ≤ 0.70^25 ≈ 1.3e-4 — acceptable flakiness.
 */
function traitAppears(fn, traitName, category = 'positive', maxRuns = 25) {
  for (let i = 0; i < maxRuns; i++) {
    const result = fn();
    if (result[category].includes(traitName)) {
      return true;
    }
  }
  return false;
}

describe('Apply Epigenetic Traits At Birth — Breeding Condition Analysis', () => {
  describe('Input Validation', () => {
    it('throws when mare is not provided', () => {
      expect(() => {
        applyEpigeneticTraitsAtBirth({ lineage: [], feedQuality: 50, stressLevel: 50 });
      }).toThrow('Mare object is required');
    });

    it('handles missing optional parameters', () => {
      const mare = { stressLevel: 30 };
      const result = applyEpigeneticTraitsAtBirth({ mare });

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });
  });

  describe('Low Stress and Premium Feed Conditions', () => {
    it('assigns resilient trait with low stress and premium feed', () => {
      const mare = { stressLevel: 15 };
      expect(
        traitAppears(() => applyEpigeneticTraitsAtBirth({ mare, feedQuality: 85, stressLevel: 15 }), 'resilient'),
      ).toBe(true);
    });

    it('assigns peopleTrusting trait with low stress and premium feed', () => {
      const mare = { stressLevel: 20 };
      expect(
        traitAppears(() => applyEpigeneticTraitsAtBirth({ mare, feedQuality: 80, stressLevel: 20 }), 'peopleTrusting'),
      ).toBe(true);
    });

    it('does not assign positive traits with high stress', () => {
      const mare = { stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({ mare, feedQuality: 85, stressLevel: 50 });
      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('peopleTrusting');
    });

    it('does not assign positive traits with poor feed quality', () => {
      const mare = { stressLevel: 15 };
      const result = applyEpigeneticTraitsAtBirth({ mare, feedQuality: 60, stressLevel: 15 });
      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('peopleTrusting');
    });
  });

  describe('Inbreeding Detection and Negative Traits', () => {
    const highInbreedingLineage = [
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 2, name: 'Other Horse' },
    ];
    const moderateInbreedingLineage = [
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 2, name: 'Other Horse' },
    ];
    const mare = { stressLevel: 50 };

    it('assigns fragile trait with high inbreeding', () => {
      expect(
        traitAppears(
          () =>
            applyEpigeneticTraitsAtBirth({ mare, lineage: highInbreedingLineage, feedQuality: 50, stressLevel: 50 }),
          'fragile',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns reactive trait with moderate inbreeding', () => {
      expect(
        traitAppears(
          () =>
            applyEpigeneticTraitsAtBirth({
              mare,
              lineage: moderateInbreedingLineage,
              feedQuality: 50,
              stressLevel: 50,
            }),
          'reactive',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns low_immunity trait with inbreeding', () => {
      expect(
        traitAppears(
          () =>
            applyEpigeneticTraitsAtBirth({
              mare,
              lineage: moderateInbreedingLineage,
              feedQuality: 50,
              stressLevel: 50,
            }),
          'low_immunity',
          'negative',
        ),
      ).toBe(true);
    });

    it('does not assign inbreeding traits without common ancestors', () => {
      const diverseLineage = [
        { id: 1, name: 'Horse 1' },
        { id: 2, name: 'Horse 2' },
        { id: 3, name: 'Horse 3' },
        { id: 4, name: 'Horse 4' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: diverseLineage, feedQuality: 50, stressLevel: 50 });
      expect(result.negative).not.toContain('fragile');
      expect(result.negative).not.toContain('reactive');
      expect(result.negative).not.toContain('low_immunity');
    });
  });

  describe('Discipline Specialization', () => {
    const mare = { stressLevel: 50 };

    it('assigns discipline affinity trait with 3+ ancestors in same discipline', () => {
      const lineage = [
        { id: 1, discipline: 'Racing' },
        { id: 2, discipline: 'Racing' },
        { id: 3, discipline: 'Racing' },
        { id: 4, discipline: 'Dressage' },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 50 }),
          'discipline_affinity_racing',
        ),
      ).toBe(true);
    });

    it('assigns legacy_talent trait with 4+ ancestors in same discipline', () => {
      const lineage = [
        { id: 1, discipline: 'Show Jumping' },
        { id: 2, discipline: 'Show Jumping' },
        { id: 3, discipline: 'Show Jumping' },
        { id: 4, discipline: 'Show Jumping' },
        { id: 5, discipline: 'Dressage' },
      ];
      const foundAffinity = traitAppears(
        () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 50 }),
        'discipline_affinity_show_jumping',
      );
      const foundLegacy = traitAppears(
        () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 50 }),
        'legacy_talent',
      );
      expect(foundAffinity).toBe(true);
      expect(foundLegacy).toBe(true);
    });

    it('uses disciplineScores when discipline field is not available', () => {
      const lineage = [
        { id: 1, disciplineScores: { Racing: 85, Dressage: 60 } },
        { id: 2, disciplineScores: { Racing: 90, Jumping: 55 } },
        { id: 3, disciplineScores: { Racing: 78, Dressage: 70 } },
        { id: 4, disciplineScores: { Dressage: 80, Racing: 65 } },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 50 }),
          'discipline_affinity_racing',
        ),
      ).toBe(true);
    });

    it('does not assign discipline traits without sufficient specialization', () => {
      const lineage = [
        { id: 1, discipline: 'Racing' },
        { id: 2, discipline: 'Dressage' },
        { id: 3, discipline: 'Show Jumping' },
        { id: 4, discipline: 'Racing' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 50 });
      expect(result.positive.filter(trait => trait.startsWith('discipline_affinity_'))).toHaveLength(0);
      expect(result.positive).not.toContain('legacy_talent');
    });
  });

  describe('Additional Stress and Nutrition Effects', () => {
    it('assigns nervous trait with very high mare stress', () => {
      const mare = { stressLevel: 85 };
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 50, stressLevel: 85 }),
          'nervous',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns low_immunity trait with poor nutrition', () => {
      const mare = { stressLevel: 50 };
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 25, stressLevel: 50 }),
          'low_immunity',
          'negative',
        ),
      ).toBe(true);
    });

    it('does not duplicate traits', () => {
      const mare = { stressLevel: 50 };
      const lineage = [
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
        { id: 1, name: 'Common Ancestor' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 25, stressLevel: 50 });
      const immunityCount = result.negative.filter(trait => trait === 'low_immunity').length;
      expect(immunityCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Return Value Structure', () => {
    const mare = { stressLevel: 50 };

    it('returns object with positive and negative arrays', () => {
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 50, stressLevel: 50 });
      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });

    it('handles empty lineage gracefully', () => {
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 50, stressLevel: 50 });
      expect(result.positive).toEqual([]);
      expect(result.negative).toEqual([]);
    });

    it('handles null lineage gracefully', () => {
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: null, feedQuality: 50, stressLevel: 50 });
      expect(result.positive).toEqual([]);
      expect(result.negative).toEqual([]);
    });
  });
});
