/**
 * staffGrowth.test.mjs — the pure staff growth rules (Equoria-xlw03), owner rulings
 * 2026-10-28 (q160, q177, q244). Seeded randomness; no database.
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyGrowthShows,
  drawGrowthItems,
  growthItemTotal,
  growthRevealedCountForLevel,
  growthShowsForNextLevel,
  revealRandomGrowthItems,
  staffGrowthModifierBonus,
  staffGrowthModifierEffectsEnabled,
} from '../constants/staffGrowth.mjs';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const pools = {
  traits: ['brave', 'curious', 'fearful', 'aloof', 'focused', 'heart'],
  disciplines: ['Dressage', 'Racing', 'Hunter', 'Polo', 'Reining'],
  temperaments: ['Calm', 'Bold', 'Lazy'],
  breedIds: [1, 2, 3],
};

describe('staff growth rules (Equoria-xlw03)', () => {
  it('draws 4 traits, 4 disciplines, 2 temperaments (signed) and 2 positive breeds, none revealed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const items = drawGrowthItems(pools, seeded(seed));
      expect(items).toHaveLength(12);
      const count = kind => items.filter(i => i.kind === kind).length;
      expect([count('trait'), count('discipline'), count('temperament'), count('breed')]).toEqual([4, 4, 2, 2]);
      expect(items.every(i => i.revealed === false)).toBe(true);
      expect(items.filter(i => i.kind === 'breed').every(i => i.sign === 'positive')).toBe(true);
      for (const kind of ['trait', 'discipline', 'temperament', 'breed']) {
        const values = items.filter(i => i.kind === kind).map(i => i.value);
        expect(new Set(values).size).toBe(values.length);
      }
    }
    const signs = new Set(
      Array.from({ length: 50 }, (_, s) => drawGrowthItems(pools, seeded(s + 1)))
        .flat()
        .filter(i => i.kind !== 'breed')
        .map(i => i.sign),
    );
    expect(signs).toEqual(new Set(['positive', 'negative']));
  });

  it('shows 0 / 3 / 6 / 9 / all items from Rookie to Expert', () => {
    expect(growthItemTotal).toBe(12);
    expect(['rookie', 'novice', 'intermediate', 'advanced', 'expert'].map(growthRevealedCountForLevel)).toEqual([
      0, 3, 6, 9, 12,
    ]);
  });

  it('each step needs 100 / 200 / 300 / 400 more shows; Expert has no next step', () => {
    expect(['rookie', 'novice', 'intermediate', 'advanced', 'expert'].map(growthShowsForNextLevel)).toEqual([
      100,
      200,
      300,
      400,
      null,
    ]);
    const items = drawGrowthItems(pools, seeded(7));
    const all = applyGrowthShows({ starLevel: 'rookie', showsAtLevel: 0, items }, 1000, seeded(9));
    expect(all.starLevel).toBe('expert');
    expect(all.levelsGained).toEqual(['novice', 'intermediate', 'advanced', 'expert']);
    expect(all.items.every(i => i.revealed)).toBe(true);
    const short = applyGrowthShows({ starLevel: 'rookie', showsAtLevel: 0, items }, 999, seeded(9));
    expect([short.starLevel, short.showsAtLevel]).toEqual(['advanced', 399]);
    expect(short.items.filter(i => i.revealed)).toHaveLength(9);
  });

  it('a reveal picks only hidden items and never un-reveals one', () => {
    const items = drawGrowthItems(pools, seeded(3));
    const once = revealRandomGrowthItems(items, 3, seeded(4));
    const twice = revealRandomGrowthItems(once, 3, seeded(5));
    expect(twice.filter(i => i.revealed)).toHaveLength(6);
    once.forEach((item, i) => {
      if (item.revealed) {
        expect(twice[i].revealed).toBe(true);
      }
    });
  });

  it('q244: the hidden items have no effect while the switch is off', () => {
    expect(staffGrowthModifierEffectsEnabled).toBe(false);
    expect(staffGrowthModifierBonus()).toBe(0);
  });
});
