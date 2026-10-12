/**
 * disciplineTraitIndicators tests
 *
 * Trait badges are derived from the horse's actual traits. The ranking and
 * match-score cases that lived in disciplineRecommendation.test.ts were
 * removed by owner ruling 2026-10-07: the game never ranks or recommends
 * disciplines.
 */

import { describe, it, expect } from 'vitest';
import { disciplineTraitIndicators } from '../disciplineTraitIndicators';

describe('disciplineTraitIndicators', () => {
  it('surfaces a bonus indicator only where the trait applies', () => {
    const ind = disciplineTraitIndicators({ traits: ['Athletic'] });
    // Athletic is a physical-discipline bonus → Racing shows it
    expect(ind.Racing).toEqual([{ trait: 'athletic', kind: 'bonus' }]);
    // Dressage is a mental discipline → Athletic does not apply there
    expect(ind.Dressage).toBeUndefined();
  });

  it('surfaces a negative trait as a penalty indicator on physical disciplines', () => {
    const ind = disciplineTraitIndicators({ traits: ['Stubborn'] });
    expect(ind.Racing).toEqual([{ trait: 'stubborn', kind: 'penalty' }]);
  });

  it('returns no indicators when the horse is missing or has no traits', () => {
    expect(disciplineTraitIndicators(null)).toEqual({});
    expect(disciplineTraitIndicators(undefined)).toEqual({});
    expect(disciplineTraitIndicators({ traits: [] })).toEqual({});
  });
});
