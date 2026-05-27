/**
 * lineageTraitCheck — unit tests (Equoria-rr7)
 *
 * Pure lineage analysis functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  checkLineageForDisciplineAffinity,
  checkLineageForDisciplineAffinityDetailed,
  checkSpecificDisciplineAffinity,
  getAncestorPreferredDiscipline,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
} from '../../../utils/lineageTraitCheck.mjs';

const makeAncestor = discipline => ({ name: 'Anc', discipline });
const makeAncestors = (discipline, count) => Array.from({ length: count }, () => makeAncestor(discipline));

// ---------------------------------------------------------------------------
// checkLineageForDisciplineAffinity
// ---------------------------------------------------------------------------
describe('checkLineageForDisciplineAffinity', () => {
  it('returns { affinity: false } for empty ancestors', () => {
    expect(checkLineageForDisciplineAffinity([])).toEqual({ affinity: false });
  });

  it('returns { affinity: false } for null ancestors', () => {
    expect(checkLineageForDisciplineAffinity(null)).toEqual({ affinity: false });
  });

  it('returns affinity=false when fewer than 3 share a discipline', () => {
    const ancestors = [makeAncestor('Racing'), makeAncestor('Racing'), makeAncestor('Dressage')];
    expect(checkLineageForDisciplineAffinity(ancestors).affinity).toBe(false);
  });

  it('returns affinity=true with discipline when 3+ share the same discipline', () => {
    const ancestors = makeAncestors('Racing', 3);
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Racing');
  });

  it('picks the dominant discipline when multiple disciplines present', () => {
    const ancestors = [...makeAncestors('Racing', 3), makeAncestor('Dressage'), makeAncestor('Dressage')];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Racing');
  });

  it('returns affinity=false when all ancestors have no discipline', () => {
    const ancestors = [{ name: 'NoDisc' }, { name: 'NoDisc2' }];
    expect(checkLineageForDisciplineAffinity(ancestors).affinity).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkLineageForDisciplineAffinityDetailed
// ---------------------------------------------------------------------------
describe('checkLineageForDisciplineAffinityDetailed', () => {
  it('returns detailed shape for empty ancestors', () => {
    const result = checkLineageForDisciplineAffinityDetailed([]);
    expect(result).toHaveProperty('affinity');
    expect(result).toHaveProperty('totalAnalyzed', 0);
    expect(result).toHaveProperty('disciplineBreakdown');
    expect(result).toHaveProperty('affinityStrength');
  });

  it('counts totalAnalyzed correctly', () => {
    const ancestors = makeAncestors('Racing', 4);
    const result = checkLineageForDisciplineAffinityDetailed(ancestors);
    expect(result.totalAnalyzed).toBe(4);
  });

  it('counts totalWithDisciplines only for ancestors that have a discipline', () => {
    const ancestors = [...makeAncestors('Racing', 3), { name: 'NoDisc' }];
    const result = checkLineageForDisciplineAffinityDetailed(ancestors);
    expect(result.totalWithDisciplines).toBe(3);
  });

  it('reports disciplineBreakdown accurately', () => {
    const ancestors = [...makeAncestors('Racing', 3), makeAncestor('Dressage')];
    const result = checkLineageForDisciplineAffinityDetailed(ancestors);
    expect(result.disciplineBreakdown.Racing).toBe(3);
    expect(result.disciplineBreakdown.Dressage).toBe(1);
  });

  it('affinityStrength is 100 when all ancestors share one discipline', () => {
    const result = checkLineageForDisciplineAffinityDetailed(makeAncestors('Racing', 3));
    expect(result.affinityStrength).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// checkSpecificDisciplineAffinity
// ---------------------------------------------------------------------------
describe('checkSpecificDisciplineAffinity', () => {
  it('returns hasAffinity=false for empty ancestors', () => {
    const result = checkSpecificDisciplineAffinity([], 'Racing');
    expect(result.hasAffinity).toBe(false);
    expect(result.count).toBe(0);
  });

  it('returns hasAffinity=true when count meets minimum', () => {
    const result = checkSpecificDisciplineAffinity(makeAncestors('Racing', 3), 'Racing', 3);
    expect(result.hasAffinity).toBe(true);
    expect(result.count).toBe(3);
  });

  it('returns hasAffinity=false when count is below minimum', () => {
    const result = checkSpecificDisciplineAffinity(makeAncestors('Racing', 2), 'Racing', 3);
    expect(result.hasAffinity).toBe(false);
  });

  it('uses default minimum of 3', () => {
    const result = checkSpecificDisciplineAffinity(makeAncestors('Racing', 3), 'Racing');
    expect(result.hasAffinity).toBe(true);
  });

  it('only counts ancestors matching targetDiscipline', () => {
    const ancestors = [...makeAncestors('Racing', 3), makeAncestor('Dressage')];
    const result = checkSpecificDisciplineAffinity(ancestors, 'Dressage', 2);
    expect(result.count).toBe(1);
    expect(result.hasAffinity).toBe(false);
  });

  it('returns percentage relative to total ancestors', () => {
    const ancestors = [...makeAncestors('Racing', 3), makeAncestor('Dressage')];
    const result = checkSpecificDisciplineAffinity(ancestors, 'Racing');
    expect(result.percentage).toBe(75); // 3/4 = 75%
  });
});

// ---------------------------------------------------------------------------
// getAncestorPreferredDiscipline
// ---------------------------------------------------------------------------
describe('getAncestorPreferredDiscipline', () => {
  it('returns direct discipline field first', () => {
    expect(getAncestorPreferredDiscipline({ discipline: 'Racing' })).toBe('Racing');
  });

  it('falls back to competitionHistory', () => {
    const ancestor = {
      competitionHistory: [{ discipline: 'Dressage' }, { discipline: 'Dressage' }],
    };
    expect(getAncestorPreferredDiscipline(ancestor)).toBe('Dressage');
  });

  it('falls back to disciplineScores', () => {
    const ancestor = { disciplineScores: { Racing: 80, Dressage: 95 } };
    expect(getAncestorPreferredDiscipline(ancestor)).toBe('Dressage');
  });

  it('falls back to specialty', () => {
    const ancestor = { specialty: 'Polo' };
    expect(getAncestorPreferredDiscipline(ancestor)).toBe('Polo');
  });

  it('returns null when no discipline info present', () => {
    expect(getAncestorPreferredDiscipline({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMostCommonDisciplineFromHistory
// ---------------------------------------------------------------------------
describe('getMostCommonDisciplineFromHistory', () => {
  it('returns null for empty history', () => {
    expect(getMostCommonDisciplineFromHistory([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
  });

  it('returns the most frequent discipline', () => {
    const history = [{ discipline: 'Racing' }, { discipline: 'Racing' }, { discipline: 'Dressage' }];
    expect(getMostCommonDisciplineFromHistory(history)).toBe('Racing');
  });

  it('returns null when no entry has discipline field', () => {
    expect(getMostCommonDisciplineFromHistory([{ noDisc: true }])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getHighestScoringDiscipline
// ---------------------------------------------------------------------------
describe('getHighestScoringDiscipline', () => {
  it('returns null for null input', () => {
    expect(getHighestScoringDiscipline(null)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(getHighestScoringDiscipline({})).toBeNull();
  });

  it('returns the discipline with the highest score', () => {
    expect(getHighestScoringDiscipline({ Racing: 70, Dressage: 95, Polo: 85 })).toBe('Dressage');
  });

  it('handles single entry', () => {
    expect(getHighestScoringDiscipline({ Racing: 60 })).toBe('Racing');
  });

  it('ignores non-numeric values', () => {
    expect(getHighestScoringDiscipline({ Racing: 80, Dressage: 'high' })).toBe('Racing');
  });
});

// ---------------------------------------------------------------------------
// getAncestorPreferredDiscipline — competitions fallback (line 101)
// ---------------------------------------------------------------------------
describe('getAncestorPreferredDiscipline — competitions field', () => {
  it('falls back to competitions array when no discipline/competitionHistory/disciplineScores (line 101)', () => {
    const ancestor = {
      competitions: [{ discipline: 'Jumping' }, { discipline: 'Jumping' }, { discipline: 'Racing' }],
    };
    expect(getAncestorPreferredDiscipline(ancestor)).toBe('Jumping');
  });
});

// ---------------------------------------------------------------------------
// catch-block coverage — non-iterable input triggers for...of TypeError
// ---------------------------------------------------------------------------
describe('checkLineageForDisciplineAffinity — error catch branch (line 73-74)', () => {
  it('returns { affinity: false } when ancestors is non-iterable (triggers catch)', () => {
    // A plain number passes the !ancestors guard but throws in for...of
    expect(checkLineageForDisciplineAffinity(42)).toEqual({ affinity: false });
  });
});

describe('checkLineageForDisciplineAffinityDetailed — error catch branch (line 209-212)', () => {
  it('returns error shape when ancestors is non-iterable (triggers catch)', () => {
    const result = checkLineageForDisciplineAffinityDetailed(42);
    expect(result.affinity).toBe(false);
    expect(result.totalAnalyzed).toBe(0);
    expect(result.affinityStrength).toBe(0);
  });
});

describe('checkSpecificDisciplineAffinity — error catch branch (line 267-268)', () => {
  it('returns error shape when ancestors is non-iterable (triggers catch)', () => {
    // 42 passes !ancestors and targetDiscipline guards but throws in for...of
    const result = checkSpecificDisciplineAffinity(42, 'Racing');
    expect(result.hasAffinity).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ancestor.id fallback (lines 39, 248) + zero-disciplines ternary (line 198)
// ---------------------------------------------------------------------------
describe('ancestor.id fallback when name is absent (lines 39, 248)', () => {
  it('checkLineageForDisciplineAffinity uses ancestor.id when name is missing (line 39)', () => {
    const ancestors = [
      { id: 'h1', discipline: 'Racing' },
      { id: 'h2', discipline: 'Racing' },
      { id: 'h3', discipline: 'Racing' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Racing');
  });

  it('checkSpecificDisciplineAffinity uses ancestor.id when name is missing (line 248)', () => {
    const ancestors = [
      { id: 'h1', discipline: 'Racing' },
      { id: 'h2', discipline: 'Racing' },
      { id: 'h3', discipline: 'Racing' },
    ];
    const result = checkSpecificDisciplineAffinity(ancestors, 'Racing');
    expect(result.hasAffinity).toBe(true);
    expect(result.matchingAncestors).toEqual(['h1', 'h2', 'h3']);
  });
});

describe('checkLineageForDisciplineAffinityDetailed — zero disciplines ternary (line 198)', () => {
  it('affinityStrength is 0 when no ancestor has any discipline (line 198 ternary false)', () => {
    const ancestors = [{ id: 'x' }, { id: 'y' }];
    const result = checkLineageForDisciplineAffinityDetailed(ancestors);
    expect(result.affinityStrength).toBe(0);
    expect(result.totalWithDisciplines).toBe(0);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// All-non-numeric-scores, undefined-ancestors, and circular-reference robustness
// cases not covered above.
describe('lineageTraitCheck — robustness edge cases (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('getHighestScoringDiscipline returns null when ALL scores are non-numeric', () => {
    expect(getHighestScoringDiscipline({ Racing: 'high', Dressage: 'medium', 'Show Jumping': 'low' })).toBeNull();
  });

  it('checkLineageForDisciplineAffinity returns { affinity: false } for undefined ancestors (no arg)', () => {
    expect(checkLineageForDisciplineAffinity().affinity).toBe(false);
  });

  it('checkLineageForDisciplineAffinity handles ancestors with circular references gracefully', () => {
    const circularAncestor = { id: 1, name: 'Test' };
    circularAncestor.self = circularAncestor;
    expect(checkLineageForDisciplineAffinity([circularAncestor]).affinity).toBe(false);
  });
});
