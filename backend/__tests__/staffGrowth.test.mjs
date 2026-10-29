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

  // Owner ruling 2026-10-29 (q279) replaced "100 / 200 / 300 / 400 MORE shows per step"
  // (Expert at 1000 in all) with running totals: Novice 100, Intermediate 200,
  // Advanced 300, Expert 400.
  it('q279: the thresholds are running totals, Novice 100 / Intermediate 200 / Advanced 300 / Expert 400', () => {
    expect(['rookie', 'novice', 'intermediate', 'advanced', 'expert'].map(growthShowsForNextLevel)).toEqual([
      100,
      100,
      100,
      100,
      null,
    ]);
    const items = drawGrowthItems(pools, seeded(7));
    const levelAt = total => applyGrowthShows({ starLevel: 'rookie', showsAtLevel: 0, items }, total, seeded(9));
    expect([99, 100, 199, 200, 299, 300, 399].map(t => levelAt(t).starLevel)).toEqual([
      'rookie',
      'novice',
      'novice',
      'intermediate',
      'intermediate',
      'advanced',
      'advanced',
    ]);
    const all = levelAt(400);
    expect(all.starLevel).toBe('expert');
    expect(all.levelsGained).toEqual(['novice', 'intermediate', 'advanced', 'expert']);
    expect(all.items.every(i => i.revealed)).toBe(true);
    const short = levelAt(399);
    expect([short.starLevel, short.showsAtLevel]).toEqual(['advanced', 99]);
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
