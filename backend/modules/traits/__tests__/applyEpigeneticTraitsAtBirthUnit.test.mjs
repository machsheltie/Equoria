/**
 * Unit Test: Apply Epigenetic Traits At Birth — Pure Logic Validation
 *
 * applyEpigeneticTraitsAtBirth() is a pure function (no DB). Tests exercise
 * real business logic against plain JS inputs. Probabilistic trait-presence
 * assertions use a retry loop so tests are statistically near-deterministic
 * without controlling Math.random.
 */

import { describe, expect, it } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

function traitAppears(fn, traitName, category = 'positive', maxRuns = 25) {
  for (let i = 0; i < maxRuns; i++) {
    const result = fn();
    if (result[category].includes(traitName)) {
      return true;
    }
  }
  return false;
}

describe('Apply Epigenetic Traits At Birth Unit — Pure Logic Validation', () => {
  describe('Low-stress mare with premium feed → positive traits', () => {
    it('assigns resilient trait when mare has low stress and premium feed', () => {
      const mare = { id: 1, name: 'Premium Mare', stressLevel: 15 };
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 85, stressLevel: 15 }),
          'resilient',
        ),
      ).toBe(true);
    });

    it('assigns peopleTrusting trait when mare has low stress and premium feed', () => {
      const mare = { id: 1, name: 'Premium Mare', stressLevel: 20 };
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 80, stressLevel: 20 }),
          'peopleTrusting',
        ),
      ).toBe(true);
    });

    it('assigns both positive traits with optimal conditions', () => {
      const mare = { id: 1, name: 'Optimal Mare', stressLevel: 10 };
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 95, stressLevel: 10 });
      expect(traitAppears(fn, 'resilient')).toBe(true);
      expect(traitAppears(fn, 'peopleTrusting')).toBe(true);
    });

    it('does not assign positive traits when stress is too high', () => {
      const mare = { id: 1, name: 'Stressed Mare', stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 85, stressLevel: 50 });
      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('peopleTrusting');
    });

    it('does not assign positive traits when feed quality is too low', () => {
      const mare = { id: 1, name: 'Underfed Mare', stressLevel: 15 };
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 60, stressLevel: 15 });
      expect(result.positive).not.toContain('resilient');
      expect(result.positive).not.toContain('peopleTrusting');
    });
  });

  describe('Inbreeding (repeated ancestor IDs) → negative traits', () => {
    const highLineage = [
      { id: 100, name: 'Common Ancestor' },
      { id: 100, name: 'Common Ancestor' },
      { id: 100, name: 'Common Ancestor' },
      { id: 100, name: 'Common Ancestor' },
      { id: 101, name: 'Other Horse' },
    ];
    const moderateLineage = [
      { id: 200, name: 'Common Ancestor' },
      { id: 200, name: 'Common Ancestor' },
      { id: 200, name: 'Common Ancestor' },
      { id: 201, name: 'Other Horse' },
      { id: 202, name: 'Another Horse' },
    ];
    const mare = { id: 1, name: 'Inbred Mare', stressLevel: 50 };

    it('assigns fragile trait with high inbreeding (4+ repeated ancestors)', () => {
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: highLineage, feedQuality: 50, stressLevel: 50 }),
          'fragile',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns reactive trait with moderate inbreeding (3 repeated ancestors)', () => {
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: moderateLineage, feedQuality: 50, stressLevel: 50 }),
          'reactive',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns lowImmunity trait with inbreeding', () => {
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: moderateLineage, feedQuality: 50, stressLevel: 50 }),
          'lowImmunity',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns multiple negative traits with severe inbreeding', () => {
      const severeLineage = [
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
      ];
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage: severeLineage, feedQuality: 50, stressLevel: 50 });
      expect(traitAppears(fn, 'fragile', 'negative')).toBe(true);
      expect(traitAppears(fn, 'reactive', 'negative')).toBe(true);
      expect(traitAppears(fn, 'lowImmunity', 'negative')).toBe(true);
    });

    it('does not assign inbreeding traits without repeated ancestor IDs', () => {
      const diverseLineage = [
        { id: 501, name: 'Horse 1' },
        { id: 502, name: 'Horse 2' },
        { id: 503, name: 'Horse 3' },
        { id: 504, name: 'Horse 4' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: diverseLineage, feedQuality: 50, stressLevel: 50 });
      expect(result.negative).not.toContain('fragile');
      expect(result.negative).not.toContain('reactive');
      expect(result.negative).not.toContain('lowImmunity');
    });
  });

  describe('3+ ancestors with same discipline → affinity + legacyTalent', () => {
    const mare = { id: 1, name: 'Racing Mare', stressLevel: 30 };

    it('assigns discipline_affinity_racing with 3+ racing ancestors', () => {
      const lineage = [
        { id: 601, name: 'Racing Champion 1', mostCompetedDiscipline: 'Racing' },
        { id: 602, name: 'Racing Champion 2', mostCompetedDiscipline: 'Racing' },
        { id: 603, name: 'Racing Champion 3', mostCompetedDiscipline: 'Racing' },
        { id: 604, name: 'Dressage Horse', mostCompetedDiscipline: 'Dressage' },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 60, stressLevel: 30 }),
          'discipline_affinity_racing',
        ),
      ).toBe(true);
    });

    it('assigns legacyTalent with 4+ ancestors in same discipline', () => {
      const lineage = [
        { id: 701, name: 'Show Jumper 1', mostCompetedDiscipline: 'Show Jumping' },
        { id: 702, name: 'Show Jumper 2', mostCompetedDiscipline: 'Show Jumping' },
        { id: 703, name: 'Show Jumper 3', mostCompetedDiscipline: 'Show Jumping' },
        { id: 704, name: 'Show Jumper 4', mostCompetedDiscipline: 'Show Jumping' },
        { id: 705, name: 'Racing Horse', mostCompetedDiscipline: 'Racing' },
      ];
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 65, stressLevel: 25 });
      expect(traitAppears(fn, 'discipline_affinity_show_jumping')).toBe(true);
      expect(traitAppears(fn, 'legacyTalent')).toBe(true);
    });

    it('assigns discipline_affinity_dressage with dressage specialization', () => {
      const lineage = [
        { id: 801, name: 'Dressage Master 1', mostCompetedDiscipline: 'Dressage' },
        { id: 802, name: 'Dressage Master 2', mostCompetedDiscipline: 'Dressage' },
        { id: 803, name: 'Dressage Master 3', mostCompetedDiscipline: 'Dressage' },
        { id: 804, name: 'Trail Horse', mostCompetedDiscipline: 'Trail' },
        { id: 805, name: 'Endurance Horse', mostCompetedDiscipline: 'Endurance' },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 70, stressLevel: 35 }),
          'discipline_affinity_dressage',
        ),
      ).toBe(true);
    });

    it('does not assign discipline traits without sufficient specialization', () => {
      const lineage = [
        { id: 901, name: 'Racing Horse', mostCompetedDiscipline: 'Racing' },
        { id: 902, name: 'Dressage Horse', mostCompetedDiscipline: 'Dressage' },
        { id: 903, name: 'Show Jumper', mostCompetedDiscipline: 'Show Jumping' },
        { id: 904, name: 'Trail Horse', mostCompetedDiscipline: 'Trail' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 55, stressLevel: 40 });
      expect(result.positive.filter(t => t.startsWith('discipline_affinity_'))).toHaveLength(0);
      expect(result.positive).not.toContain('legacyTalent');
    });

    it('handles ancestors without mostCompetedDiscipline field', () => {
      const lineage = [
        { id: 1001, name: 'Horse 1' },
        { id: 1002, name: 'Horse 2' },
        { id: 1003, name: 'Horse 3' },
        { id: 1004, name: 'Horse 4' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50, stressLevel: 45 });
      expect(result.positive.filter(t => t.startsWith('discipline_affinity_'))).toHaveLength(0);
      expect(result.positive).not.toContain('legacyTalent');
    });
  });

  describe('Return value structure', () => {
    it('always returns positive and negative arrays', () => {
      const mare = { id: 1, stressLevel: 50 };
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 50, stressLevel: 50 });
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });

    it('optimal conditions can produce positive traits (probabilistic smoke test)', () => {
      const mare = { id: 1, stressLevel: 10 };
      const lineage = [
        { id: 1101, name: 'Racing Horse 1', mostCompetedDiscipline: 'Racing' },
        { id: 1102, name: 'Racing Horse 2', mostCompetedDiscipline: 'Racing' },
        { id: 1103, name: 'Racing Horse 3', mostCompetedDiscipline: 'Racing' },
        { id: 1104, name: 'Racing Horse 4', mostCompetedDiscipline: 'Racing' },
      ];
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 85, stressLevel: 10 });
      expect(traitAppears(fn, 'resilient')).toBe(true);
      expect(traitAppears(fn, 'discipline_affinity_racing')).toBe(true);
    });
  });
});
