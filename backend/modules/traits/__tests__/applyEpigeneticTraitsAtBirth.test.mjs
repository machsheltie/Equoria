/**
 * applyEpigeneticTraitsAtBirth — unit tests (Equoria-rr7)
 *
 * Pure function, logger import only. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';
import { isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

// Owner ruling 2026-10-26 (q98, Equoria-2d55z): traits from the birth stages are
// born hidden, so "the foal gets X" means X is among the traits it carries.
const carried = r => [...r.positive, ...r.negative, ...r.hidden];

// Owner ruling 2026-10-27 (q117): only roster traits are generated; the
// discipline trait (disciplineAffinity<Discipline>) is ruled separately.
const offRoster = r => carried(r).filter(t => !isRosterTrait(t) && !t.startsWith('disciplineAffinity'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseMare = () => ({ id: 1 });
const emptyLineage = () => [];

const lineageWithDiscipline = (discipline, count = 3) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 100, discipline }));

const lineageWithInbreeding = (id, count = 2) => Array.from({ length: count }, () => ({ id })); // same id repeated = common ancestor

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — return shape', () => {
  it('returns object with positive and negative arrays', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: emptyLineage(),
      feedQuality: 50,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });

  it('no duplicates in positive array', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: emptyLineage(),
      feedQuality: 50,
    });
    const unique = new Set(result.positive);
    expect(unique.size).toBe(result.positive.length);
  });

  it('no duplicates in negative array', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: lineageWithInbreeding(999, 5),
      feedQuality: 10,
    });
    const unique = new Set(result.negative);
    expect(unique.size).toBe(result.negative.length);
  });
});

// ---------------------------------------------------------------------------
// Feed conditions
// ---------------------------------------------------------------------------
// Owner ruling 2026-10-28 (q175): a well-kept mare (feedQuality >= 80) gives a 10%
// Resilient chance (bible 08). Old contract: 75% Resilient + 60% People Trusting, so
// these used unseeded retry loops; at 10% they are seeded to stay deterministic.
describe('applyEpigeneticTraitsAtBirth — feed conditions', () => {
  it('a well-kept mare grants a positive trait for some seeds', () => {
    let foundPositive = false;
    for (let i = 1; i <= 50; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 90,
        seed: i,
      });
      if (carried(result).length > 0) {
        foundPositive = true;
        break;
      }
    }
    expect(foundPositive).toBe(true);
  });

  it('the positive trait from a well-kept mare is resilient', () => {
    let found = false;
    for (let i = 1; i <= 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 100,
        seed: i,
      });
      if (carried(result).includes('resilient')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  // Old contract: poor feed (<=30) could produce lowImmunity. Owner ruling
  // 2026-10-27 (q117) removed lowImmunity from the roster, so poor feed now
  // produces no trait at all.
  it('poor feed quality (<=30) produces no trait off the roster (lowImmunity is gone)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 10,
        seed,
      });
      expect(carried(result)).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Inbreeding detection
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — inbreeding', () => {
  it('inbreeding (repeated ancestor) can produce fragile or reactive trait', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(42, 4), // high severity (count >= 4)
        feedQuality: 50,
      });
      if (carried(result).includes('fragile') || carried(result).includes('reactive')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('no inbreeding (empty lineage) does not trigger inbreeding effects', () => {
    // With empty lineage, inbreeding can't occur deterministically
    let inbreedingTraitFound = false;
    for (let i = 0; i < 20; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: emptyLineage(),
        feedQuality: 60,
      });
      if (carried(result).includes('fragile') || carried(result).includes('reactive')) {
        inbreedingTraitFound = true;
        break;
      }
    }
    // With no lineage, fragile/reactive from inbreeding should be zero
    expect(inbreedingTraitFound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Discipline specialization
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — discipline specialization', () => {
  // Owner rulings 2026-10-20/21 (Equoria-n7ph5): every horse has exactly one discipline
  // trait, the +5 birth discipline, which replaces the 23 lineage discipline affinities, so
  // no disciplineAffinity<Discipline> trait is given at birth any more. Old contract: a
  // lineage of 3+ ancestors in one discipline gave it 70% of the time.
  it('3+ ancestors with same discipline never produce a discipline affinity trait', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Dressage', 4),
        feedQuality: 50,
        seed,
      });
      expect(carried(result).filter(t => t.includes('disciplineAffinity'))).toEqual([]);
    }
  });

  // Old contract: 4+ same-discipline ancestors could add legacyTalent. Owner
  // ruling 2026-10-27 (q117) removed it from the roster.
  it('4+ ancestors with same discipline never produce legacyTalent or any off-roster trait', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Racing', 6),
        feedQuality: 50,
        seed,
      });
      expect(offRoster(result)).toEqual([]);
    }
  });

  it('high inbreeding and poor feed together still produce only roster traits', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(42, 5),
        feedQuality: 10,
        seed,
      });
      expect(offRoster(result)).toEqual([]);
      expect(carried(result)).not.toContain('reactive');
      expect(carried(result)).not.toContain('lowImmunity');
    }
  });

  it('fewer than 3 ancestors with same discipline does not trigger specialization', () => {
    let affinityFound = false;
    for (let i = 0; i < 20; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithDiscipline('Jumping', 2),
        feedQuality: 50,
      });
      if (carried(result).some(t => t.includes('disciplineAffinity'))) {
        affinityFound = true;
        break;
      }
    }
    expect(affinityFound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — error handling', () => {
  it('throws when mare is not provided', () => {
    expect(() => applyEpigeneticTraitsAtBirth({ mare: null, lineage: [], feedQuality: 50 })).toThrow();
  });

  it('handles null lineage gracefully (treated as empty)', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: null,
      feedQuality: 50,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });

  it('handles missing feedQuality (defaults to 50)', () => {
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: [],
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inbreeding severity branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — inbreeding severity branches', () => {
  it('moderate severity (3 occurrences): exercises second ternary true-branch (fragileChance=0.5)', () => {
    // maxCount=3: first ternary (>=4) false → second ternary (>=3) true → severity='moderate'
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(55, 3),
        feedQuality: 50,
      });
      if (carried(result).includes('fragile') || carried(result).includes('reactive')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('low severity (2 occurrences): exercises both ternary false-branches (fragileChance=0.25, reactiveChance=0.2)', () => {
    // maxCount=2: first ternary (>=4) false → second ternary (>=3) false → severity='low'
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = applyEpigeneticTraitsAtBirth({
        mare: baseMare(),
        lineage: lineageWithInbreeding(66, 2),
        feedQuality: 50,
      });
      if (
        carried(result).includes('fragile') ||
        carried(result).includes('reactive') ||
        carried(result).includes('lowImmunity')
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('null ancestor in lineage exercises ancestor&&ancestor.id false-branch in analyzeInbreeding', () => {
    // null ancestor → `ancestor && ancestor.id` is false → skipped
    const lineageWithNull = [null, { id: 10 }, { id: 10 }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage: lineageWithNull,
      feedQuality: 50,
    });
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeDisciplineSpecialization branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — analyzeDisciplineSpecialization branches', () => {
  it('3 ancestors with mostCompetedDiscipline exercises that true-branch in analyzeDisciplineSpecialization', () => {
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 200,
      mostCompetedDiscipline: 'Racing',
    }));
    // Owner rulings 2026-10-20/21 (Equoria-n7ph5): every horse has exactly one discipline
    // trait, the +5 birth discipline, which replaces the 23 lineage discipline affinities, so
    // no disciplineAffinity<Discipline> trait is given at birth any more. Old contract: a
    // lineage of 3+ ancestors in one discipline gave it 70% of the time.
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({ mare: baseMare(), lineage, feedQuality: 50, seed });
      expect(carried(result).some(t => t.includes('disciplineAffinity') || t === 'legacyTalent')).toBe(false);
    }
  });

  it('3 ancestors with disciplineScores exercises that true-branch and calls getHighestScoringDiscipline', () => {
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 300,
      disciplineScores: { Dressage: 90, Racing: 50 },
    }));
    // Equoria-n7ph5: no lineage affinity at birth (see the discipline specialization block).
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({ mare: baseMare(), lineage, feedQuality: 50, seed });
      expect(carried(result).some(t => t.includes('disciplineAffinity'))).toBe(false);
    }
  });

  it('null ancestor exercises ancestor&&ancestor.discipline false-branch in analyzeDisciplineSpecialization', () => {
    // null → all three `ancestor && ancestor.X` checks in analyzeDisciplineSpecialization are false
    const lineage = [null, { id: 20, discipline: 'Jumping' }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage,
      feedQuality: 50,
    });
    expect(Array.isArray(result.positive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getHighestScoringDiscipline branches
// ---------------------------------------------------------------------------
describe('applyEpigeneticTraitsAtBirth — getHighestScoringDiscipline branches', () => {
  it('string disciplineScores exercises typeof!==object guard true-branch → returns null, no affinity', () => {
    // ancestor.disciplineScores = 'Racing' (string) → typeof 'Racing' !== 'object' is true → null returned
    const lineage = [{ id: 400, disciplineScores: 'Racing' }];
    const result = applyEpigeneticTraitsAtBirth({
      mare: baseMare(),
      lineage,
      feedQuality: 50,
    });
    // Only 1 ancestor → count < 3 → no specialization
    expect(carried(result).some(t => t.includes('disciplineAffinity'))).toBe(false);
  });

  it('mixed score types exercise typeof score===number false-branch for non-number entries', () => {
    // disciplineScores: { Racing: 'fast', Dressage: 90 }
    // Racing: typeof 'fast' !== 'number' → false branch (skip)
    // Dressage: typeof 90 === 'number' → true branch (counted as highest)
    // 3 ancestors → Dressage count = 3 → specialization triggers
    const lineage = Array.from({ length: 3 }, (_, i) => ({
      id: i + 500,
      disciplineScores: { Racing: 'fast', Dressage: 90 },
    }));
    // Equoria-n7ph5: no lineage affinity at birth (see the discipline specialization block).
    for (let seed = 1; seed <= 200; seed++) {
      const result = applyEpigeneticTraitsAtBirth({ mare: baseMare(), lineage, feedQuality: 50, seed });
      expect(carried(result).some(t => t.includes('disciplineAffinity'))).toBe(false);
    }
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Deterministic negative-condition assertions, peopleTrusting/low_immunity
// presence, and disciplineScores-fallback specialization not covered above.
describe('applyEpigeneticTraitsAtBirth — condition coverage (merged from legacy backend/tests, Equoria-wvuin)', () => {
  // DETERMINISTIC seed-sweep helper (Equoria-fefh2.43 item 5).
  //
  // CI-CONTEXT ROOT CAUSE: the legacy form ran `fn()` 25 times relying on the
  // default Math.random rng inside applyEpigeneticTraitsAtBirth and returned
  // true if the probabilistic trait appeared at least once. Each assignment
  // path has p≈0.3 (Stage-4 poor-nutrition roll, the discipline-affinity roll,
  // etc.), so the 25-run loop carried a (1-p)^25 ≈ (0.7)^25 ≈ 1.3e-4
  // false-negative tail — a true statistical flake that fired only
  // occasionally, and the CI shard-overlap (Equoria-2ixd1) doubled the exposure
  // by running these module suites twice per run. Locally it (almost) always
  // passed; in CI it intermittently went red. NOT a behavior bug — a
  // nondeterministic ORACLE.
  //
  // FIX (fix the cause, never skip): applyEpigeneticTraitsAtBirth already
  // accepts a `seed` that routes every roll through a reproducible LCG
  // (makeRng). We sweep seeds 1..N and pass `seed` into the call, so the rng is
  // deterministic and the assertion is byte-identical in every environment —
  // the flake tail is gone (no Math.random anywhere in the path). The sweep
  // (vs. a single hard-coded seed) keeps the original "this assignment path is
  // REACHABLE under these conditions" semantics and stays robust to a future
  // rng-call-ordering change, while retaining full teeth: if the assignment
  // path is ever removed, NO seed produces the trait → the test goes red.
  // `fnForSeed` receives the seed and must thread it into the call under test.
  function traitAppears(fnForSeed, traitName, category = 'positive', maxSeeds = 50) {
    for (let seed = 1; seed <= maxSeeds; seed++) {
      // q98: stage traits are born hidden, so a carried trait counts wherever it sits.
      const result = fnForSeed(seed);
      if ([...result[category], ...result.hidden].includes(traitName)) {
        return true;
      }
    }
    return false;
  }

  // q175: old contract "assigns peopleTrusting trait with premium feed"; the bible
  // bonus names only Resilient, so a well-kept mare never gives People Trusting.
  it('never assigns peopleTrusting from a well-kept mare', () => {
    const mare = {};
    expect(traitAppears(seed => applyEpigeneticTraitsAtBirth({ mare, feedQuality: 80, seed }), 'peopleTrusting')).toBe(
      false,
    );
  });

  it('does not assign positive traits with poor feed quality (deterministic)', () => {
    const result = applyEpigeneticTraitsAtBirth({ mare: {}, feedQuality: 60 });
    expect(carried(result)).not.toContain('resilient');
    expect(carried(result)).not.toContain('peopleTrusting');
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
        seed => applyEpigeneticTraitsAtBirth({ mare: {}, lineage, feedQuality: 50, seed }),
        'disciplineAffinityRacing',
      ),
      // Equoria-n7ph5: no lineage affinity at birth. Old contract: true.
    ).toBe(false);
  });

  it('does not assign discipline traits without sufficient specialization (deterministic)', () => {
    const lineage = [
      { id: 1, discipline: 'Racing' },
      { id: 2, discipline: 'Dressage' },
      { id: 3, discipline: 'Show Jumping' },
      { id: 4, discipline: 'Racing' },
    ];
    const result = applyEpigeneticTraitsAtBirth({
      mare: {},
      lineage,
      feedQuality: 50,
    });
    expect(carried(result).filter(t => t.startsWith('disciplineAffinity'))).toHaveLength(0);
    expect(carried(result)).not.toContain('legacyTalent');
  });

  // Old contract: poor nutrition assigned lowImmunity. Owner ruling 2026-10-27
  // (q117) removed it from the roster: no seed produces it now.
  it('never assigns lowImmunity with poor nutrition', () => {
    expect(
      traitAppears(
        seed =>
          applyEpigeneticTraitsAtBirth({
            mare: {},
            lineage: [],
            feedQuality: 25,
            seed,
          }),
        'lowImmunity',
        'negative',
        200,
      ),
    ).toBe(false);
  });

  it('does not duplicate low_immunity even with repeated common ancestor', () => {
    const lineage = [
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
      { id: 1, name: 'Common Ancestor' },
    ];
    const result = applyEpigeneticTraitsAtBirth({
      mare: {},
      lineage,
      feedQuality: 25,
    });
    expect(carried(result).filter(t => t === 'lowImmunity').length).toBeLessThanOrEqual(1);
  });
});
