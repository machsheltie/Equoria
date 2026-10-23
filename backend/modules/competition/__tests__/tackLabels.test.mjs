/**
 * tackLabels.test.mjs (Equoria-k1p62.4)
 *
 * A saddle or bridle's player-facing bonus label must say what the ridden show
 * score really does with it (owner decision A, 2026-10-23, epic Equoria-k1p62):
 * discipline tack +5 in its own disciplines, All Purpose tack +2 in any
 * discipline, flat. Old labels ('+7 racing score', '+2 obedience', '+2 comfort
 * score', '+4 jumping score', '+2 dressage score', '+1 agility', '+2 prestige',
 * 'Cosmetic - no stat bonus', '+1 all disciplines') promised numbers and stats the
 * score never used.
 *
 * Real data, no mocks: every shop and crafted saddle/bridle, the label's number
 * checked against what tackPoints actually awards, and the label's disciplines
 * against the item's own disciplines list.
 */

import { describe, it, expect } from '@jest/globals';
import { tackCatalogItems } from '../../economy/index.mjs';
import { craftedItemRecipes } from '../../crafting/index.mjs';
import { tackBonusLabel, tackPoints } from '../rules/tackScoring.mjs';

const slots = ['saddle', 'bridle'];

const shopItems = slots.flatMap(slot =>
  tackCatalogItems(slot).map(item => ({ slot, id: item.id, label: item.bonus, disciplines: item.disciplines })),
);
const craftedItems = slots.flatMap(slot =>
  craftedItemRecipes(slot).map(recipe => ({
    slot,
    id: recipe.result,
    label: recipe.bonus,
    disciplines: recipe.disciplines,
  })),
);

describe('tackBonusLabel', () => {
  it('names the disciplines for discipline tack and says "any discipline" for All Purpose', () => {
    expect(tackBonusLabel([])).toBe('+2 all disciplines');
    expect(tackBonusLabel(['Dressage'])).toBe('+5 in Dressage shows');
    expect(tackBonusLabel(['Show Jumping', 'Cross Country'])).toBe('+5 in Show Jumping and Cross Country shows');
    expect(tackBonusLabel(['Racing', 'Steeplechase', 'Harness Racing'])).toBe(
      '+5 in Racing, Steeplechase and Harness Racing shows',
    );
  });
});

describe.each([
  ['tack shop', shopItems],
  ['crafted', craftedItems],
])('%s saddle and bridle labels match the scoring', (_name, items) => {
  it('has items to check', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it.each(items.map(item => [item.id, item]))('%s: label starts with what its disciplines score', (_id, item) => {
    expect(typeof item.label).toBe('string');
    expect(item.label.startsWith(tackBonusLabel(item.disciplines))).toBe(true);
  });

  it.each(items.map(item => [item.id, item]))('%s: the number in the label is what tackPoints awards', (_id, item) => {
    const labelled = Number(/^\+(\d+)/.exec(item.label)?.[1]);
    const inItsDiscipline = item.disciplines[0] ?? 'Dressage';
    expect(tackPoints({ [item.slot]: item.id }, inItsDiscipline)).toBe(labelled);
  });
});
