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

// Owner ruling 2026-10-26 (q98, Equoria-2d55z): traits from the birth stages are
// born hidden, so "the foal gets X" means X is among the traits it carries.
const carried = r => [...r.positive, ...r.negative, ...r.hidden];

// `fn` receives a run number (1..maxRuns) that a caller may use as the seed.
function traitAppears(fn, traitName, category = 'positive', maxRuns = 25) {
  for (let i = 1; i <= maxRuns; i++) {
    const result = fn(i);
    // q98: stage traits are born hidden, so a carried trait counts wherever it sits.
    if ([...result[category], ...result.hidden].includes(traitName)) {
      return true;
    }
  }
  return false;
}

describe('Apply Epigenetic Traits At Birth Unit — Pure Logic Validation', () => {
  // Owner ruling 2026-10-28 (q175): a well-kept mare gives a 10% Resilient chance
  // (bible 08). Old contract: 75% Resilient + 60% People Trusting with unseeded
  // retries; at 10% the runs are seeded so the checks stay deterministic.
  describe('Well-kept mare → resilient', () => {
    it('assigns resilient trait for a well-kept mare', () => {
      const mare = { id: 1, name: 'Premium Mare' };
      expect(
        traitAppears(seed => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 85, seed }), 'resilient'),
      ).toBe(true);
    });

    it('never assigns peopleTrusting for a well-kept mare (old contract: it did)', () => {
      const mare = { id: 1, name: 'Premium Mare' };
      expect(
        traitAppears(
          seed => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 80, seed }),
          'peopleTrusting',
        ),
      ).toBe(false);
    });

    it('optimal conditions give resilient and nothing else from feed', () => {
      const mare = { id: 1, name: 'Optimal Mare' };
      const fn = seed => applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 95, seed });
      expect(traitAppears(fn, 'resilient')).toBe(true);
      expect(traitAppears(fn, 'peopleTrusting')).toBe(false);
    });

    it('does not assign positive traits when feed quality is too low', () => {
      const mare = { id: 1, name: 'Underfed Mare' };
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 60 });
      expect(carried(result)).not.toContain('resilient');
      expect(carried(result)).not.toContain('peopleTrusting');
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
    const mare = { id: 1, name: 'Inbred Mare' };

    it('assigns fragile trait with high inbreeding (4+ repeated ancestors)', () => {
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage: highLineage, feedQuality: 50 }),
          'fragile',
          'negative',
        ),
      ).toBe(true);
    });

    // Old contract: inbreeding could also assign reactive and lowImmunity. Owner
    // ruling 2026-10-27 (q117) took both off the roster; fragile is the only
    // inbreeding trait now.
    it('never assigns reactive or lowImmunity, however inbred', () => {
      for (let seed = 1; seed <= 200; seed++) {
        const result = applyEpigeneticTraitsAtBirth({ mare, lineage: moderateLineage, feedQuality: 50, seed });
        expect(carried(result)).not.toContain('reactive');
        expect(carried(result)).not.toContain('lowImmunity');
      }
    });

    it('assigns multiple negative traits with severe inbreeding', () => {
      const severeLineage = [
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
        { id: 400, name: 'Common Ancestor' },
      ];
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage: severeLineage, feedQuality: 50 });
      expect(traitAppears(fn, 'fragile', 'negative')).toBe(true);
      // q117: reactive and lowImmunity are no longer traits.
      expect(traitAppears(fn, 'reactive', 'negative')).toBe(false);
      expect(traitAppears(fn, 'lowImmunity', 'negative')).toBe(false);
    });

    it('does not assign inbreeding traits without repeated ancestor IDs', () => {
      const diverseLineage = [
        { id: 501, name: 'Horse 1' },
        { id: 502, name: 'Horse 2' },
        { id: 503, name: 'Horse 3' },
        { id: 504, name: 'Horse 4' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: diverseLineage, feedQuality: 50 });
      expect(carried(result)).not.toContain('fragile');
      expect(carried(result)).not.toContain('reactive');
      expect(carried(result)).not.toContain('lowImmunity');
    });
  });

  // Owner rulings 2026-10-20/21 (Equoria-n7ph5): the +5 birth discipline is a horse's one
  // discipline trait and replaces the 23 lineage discipline affinities, so no lineage gives
  // a disciplineAffinity<Discipline> trait at birth. Old contract: 3+ same-discipline
  // ancestors gave it 70% of the time.
  describe('3+ ancestors with same discipline → no affinity (Equoria-n7ph5; legacyTalent removed, q117)', () => {
    const mare = { id: 1, name: 'Racing Mare' };

    it('never assigns disciplineAffinityRacing with 3+ racing ancestors', () => {
      const lineage = [
        { id: 601, name: 'Racing Champion 1', mostCompetedDiscipline: 'Racing' },
        { id: 602, name: 'Racing Champion 2', mostCompetedDiscipline: 'Racing' },
        { id: 603, name: 'Racing Champion 3', mostCompetedDiscipline: 'Racing' },
        { id: 604, name: 'Dressage Horse', mostCompetedDiscipline: 'Dressage' },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 60 }),
          'disciplineAffinityRacing',
        ),
      ).toBe(false);
    });

    it('assigns neither the affinity nor legacyTalent with 4+ ancestors in same discipline', () => {
      const lineage = [
        { id: 701, name: 'Show Jumper 1', mostCompetedDiscipline: 'Show Jumping' },
        { id: 702, name: 'Show Jumper 2', mostCompetedDiscipline: 'Show Jumping' },
        { id: 703, name: 'Show Jumper 3', mostCompetedDiscipline: 'Show Jumping' },
        { id: 704, name: 'Show Jumper 4', mostCompetedDiscipline: 'Show Jumping' },
        { id: 705, name: 'Racing Horse', mostCompetedDiscipline: 'Racing' },
      ];
      const fn = () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 65 });
      expect(traitAppears(fn, 'disciplineAffinityShowJumping')).toBe(false);
      // Old contract: legacyTalent also appeared. Owner ruling 2026-10-27 (q117)
      // removed it from the roster.
      expect(traitAppears(fn, 'legacyTalent')).toBe(false);
    });

    it('never assigns disciplineAffinityDressage with dressage specialization', () => {
      const lineage = [
        { id: 801, name: 'Dressage Master 1', mostCompetedDiscipline: 'Dressage' },
        { id: 802, name: 'Dressage Master 2', mostCompetedDiscipline: 'Dressage' },
        { id: 803, name: 'Dressage Master 3', mostCompetedDiscipline: 'Dressage' },
        { id: 804, name: 'Trail Horse', mostCompetedDiscipline: 'Trail' },
        { id: 805, name: 'Endurance Horse', mostCompetedDiscipline: 'Endurance' },
      ];
      expect(
        traitAppears(
          () => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 70 }),
          'disciplineAffinityDressage',
        ),
      ).toBe(false);
    });

    it('does not assign discipline traits without sufficient specialization', () => {
      const lineage = [
        { id: 901, name: 'Racing Horse', mostCompetedDiscipline: 'Racing' },
        { id: 902, name: 'Dressage Horse', mostCompetedDiscipline: 'Dressage' },
        { id: 903, name: 'Show Jumper', mostCompetedDiscipline: 'Show Jumping' },
        { id: 904, name: 'Trail Horse', mostCompetedDiscipline: 'Trail' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 55 });
      expect(carried(result).filter(t => t.startsWith('disciplineAffinity'))).toHaveLength(0);
      expect(carried(result)).not.toContain('legacyTalent');
    });

    it('handles ancestors without mostCompetedDiscipline field', () => {
      const lineage = [
        { id: 1001, name: 'Horse 1' },
        { id: 1002, name: 'Horse 2' },
        { id: 1003, name: 'Horse 3' },
        { id: 1004, name: 'Horse 4' },
      ];
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 50 });
      expect(carried(result).filter(t => t.startsWith('disciplineAffinity'))).toHaveLength(0);
      expect(carried(result)).not.toContain('legacyTalent');
    });
  });

  describe('Return value structure', () => {
    it('always returns positive and negative arrays', () => {
      const mare = { id: 1 };
      const result = applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 50 });
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
    });

    it('optimal conditions can produce positive traits (probabilistic smoke test)', () => {
      const mare = { id: 1 };
      const lineage = [
        { id: 1101, name: 'Racing Horse 1', mostCompetedDiscipline: 'Racing' },
        { id: 1102, name: 'Racing Horse 2', mostCompetedDiscipline: 'Racing' },
        { id: 1103, name: 'Racing Horse 3', mostCompetedDiscipline: 'Racing' },
        { id: 1104, name: 'Racing Horse 4', mostCompetedDiscipline: 'Racing' },
      ];
      const fn = seed => applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality: 85, seed });
      expect(traitAppears(fn, 'resilient')).toBe(true);
      // Equoria-n7ph5: no lineage affinity at birth. Old contract: true.
      expect(traitAppears(fn, 'disciplineAffinityRacing')).toBe(false);
    });
  });
});
