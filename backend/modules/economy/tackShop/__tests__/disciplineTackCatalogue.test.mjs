/**
 * disciplineTackCatalogue.test.mjs (Equoria-k1p62, Equoria-cv3if)
 *
 * Owner rulings 2026-10-23:
 *   q02  each saddle or bridle is for ONE discipline; only the All Purpose pair
 *        covers every discipline.
 *   q03  one +5 saddle and one +5 bridle for EVERY discipline; the driving
 *        disciplines wear a harness where the others use a saddle.
 *   q05  Handcrafted Bridle, Dyed Leather Bridle, Artisan Event Saddle and
 *        Legacy Tack Set are deleted.
 *   q32  tack that does not score is "Coming soon" and carries no effect text.
 *
 * Real catalogue and recipe data, no mocks. Discipline names come from the one
 * discipline list (constants/schema.mjs).
 */

import { describe, it, expect } from '@jest/globals';
import { DISCIPLINES } from '../../../../constants/schema.mjs';
import { allTackItems, tackCatalogItems } from '../services/tackInventory.mjs';
import { craftedItemRecipes } from '../../../crafting/index.mjs';

const disciplineNames = Object.values(DISCIPLINES);
const allRecipes = ['saddle', 'bridle', 'halter', 'blanket', 'cosmetic'].flatMap(craftedItemRecipes);
const drivingDisciplines = ['Combined Driving', 'Fine Harness', 'Harness Racing', 'Pleasure Driving'];
const visible = items => items.filter(item => !item.isLegacyAlias);
const discipline5 = items => visible(items).filter(item => item.disciplines.length > 0);

describe('one +5 saddle or harness and one +5 bridle per discipline (q02, q03)', () => {
  it('has exactly one discipline saddle or harness per discipline, each for that discipline alone', () => {
    const saddles = discipline5(tackCatalogItems('saddle'));
    expect(saddles.every(item => item.disciplines.length === 1)).toBe(true);
    expect(saddles.map(item => item.disciplines[0]).sort()).toEqual([...disciplineNames].sort());
  });

  it('has exactly one discipline bridle per discipline, each for that discipline alone', () => {
    const bridles = discipline5(tackCatalogItems('bridle'));
    expect(bridles.every(item => item.disciplines.length === 1)).toBe(true);
    expect(bridles.map(item => item.disciplines[0]).sort()).toEqual([...disciplineNames].sort());
  });

  it('names a harness for the driving disciplines and a saddle for the rest', () => {
    for (const item of discipline5(tackCatalogItems('saddle'))) {
      const [name] = item.disciplines;
      const noun = drivingDisciplines.includes(name) ? 'Harness' : 'Saddle';
      expect(item.name).toBe(name.endsWith(noun) ? name : `${name} ${noun}`);
    }
    for (const item of discipline5(tackCatalogItems('bridle'))) {
      expect(item.name).toBe(`${item.disciplines[0]} Bridle`);
    }
  });

  it('keeps the All Purpose saddle and bridle as the only items for every discipline', () => {
    const allPurpose = ['saddle', 'bridle'].flatMap(slot =>
      visible(tackCatalogItems(slot)).filter(item => item.disciplines.length === 0),
    );
    expect(allPurpose.map(item => item.id).sort()).toEqual(['all-purpose-bridle', 'all-purpose-saddle']);
  });

  it('labels every scoring item with what it scores', () => {
    for (const item of [...tackCatalogItems('saddle'), ...tackCatalogItems('bridle')]) {
      expect(item.bonus).toBe(
        item.disciplines.length === 0 ? '+2 all disciplines' : `+5 in ${item.disciplines[0]} shows`,
      );
    }
  });

  it('gives every item an unique id', () => {
    const ids = allTackItems().map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the four hallucinated crafted items are gone (q05)', () => {
  const retiredResults = [
    'crafted-simple-bridle',
    'crafted-dyed-bridle',
    'crafted-event-saddle',
    'crafted-legacy-tack-set',
  ];
  const retiredNames = ['Handcrafted Bridle', 'Dyed Leather Bridle', 'Artisan Event Saddle', 'Legacy Tack Set'];

  it('has no recipe for them', () => {
    expect(allRecipes.filter(r => retiredResults.includes(r.result))).toEqual([]);
    expect(allRecipes.filter(r => retiredNames.includes(r.resultName) || retiredNames.includes(r.name))).toEqual([]);
  });

  it('has no shop item with those names', () => {
    expect(allTackItems().filter(item => retiredNames.includes(item.name))).toEqual([]);
  });
});

describe('tack that does not score is Coming soon with no effect text (q32)', () => {
  const scoringOrDecorative = ['saddle', 'bridle', 'decorative'];

  it('marks every non-scoring shop item comingSoon and strips effect fields', () => {
    const items = allTackItems().filter(item => !scoringOrDecorative.includes(item.category));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.comingSoon).toBe(true);
      expect(item.bonus).toBeUndefined();
      expect(item.numericBonus).toBeUndefined();
    }
  });

  it('marks non-scoring crafted recipes comingSoon and strips effect text', () => {
    const recipes = allRecipes.filter(r => !['saddle', 'bridle'].includes(r.resultCategory));
    expect(recipes.length).toBeGreaterThan(0);
    for (const recipe of recipes) {
      expect(recipe.comingSoon).toBe(true);
      expect(recipe.bonus).toBeUndefined();
    }
  });

  it('does not mark saddles or bridles comingSoon', () => {
    for (const item of [...tackCatalogItems('saddle'), ...tackCatalogItems('bridle')]) {
      expect(item.comingSoon).toBeUndefined();
    }
  });
});

describe('the Saddle Seat saddle shows the owner image (Equoria-wa0xz)', () => {
  it('points the Saddleseat saddle at saddleseatsaddle.png, and the file is on disk', async () => {
    const { existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const item = tackCatalogItems('saddle').find(i => i.disciplines.join() === 'Saddleseat');
    expect(item.image).toBe('/images/tack/saddleseatsaddle.png');
    const publicDir = new URL('../../../../../frontend/public/', import.meta.url);
    expect(existsSync(fileURLToPath(new URL(item.image.slice(1), publicDir)))).toBe(true);
  });
});
