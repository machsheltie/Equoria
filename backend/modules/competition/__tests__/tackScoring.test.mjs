/**
 * tackScoring.test.mjs (Equoria-k1p62.2)
 *
 * Owner decision A + D (2026-10-23, epic Equoria-k1p62): only the saddle and
 * bridle slots score. Discipline tack gives +5 each, ONLY in its own
 * discipline (0 in any other); All Purpose tack gives +2 each in any
 * discipline. Flat points, so the most tack can add is +10. Decorations score
 * nothing in a discipline show.
 *
 * The table below pins how every saddle and bridle that exists today is
 * classified: the tack shop catalogue's `disciplines` list (empty = All
 * Purpose) and the crafted items' recipes.
 * Pure: no database.
 */

import { describe, it, expect } from '@jest/globals';
import { tackCatalogItems } from '../../economy/index.mjs';
import { craftedItemRecipes } from '../../crafting/index.mjs';
import { isKnownDiscipline } from '../rules/disciplineRules.mjs';
import { allPurposeTackPoints, disciplineTackPoints, tackItemDisciplines, tackPoints } from '../rules/tackScoring.mjs';

const allPurpose = 'All Purpose';

/** The 24 competition disciplines (bible Vol 13 table + Pleasure Driving). */
const disciplines = [
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Roping',
  'Team Penning',
  'Rodeo',
  'Hunter',
  'Saddleseat',
  'Endurance',
  'Eventing',
  'Dressage',
  'Show Jumping',
  'Vaulting',
  'Polo',
  'Cross Country',
  'Combined Driving',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Steeplechase',
  'Racing',
  'Harness Racing',
  'Pleasure Driving',
];

/**
 * Owner rulings q02/q03/q05 (2026-10-23): every saddle, harness and bridle is
 * for ONE discipline; each of the 24 disciplines has one of each (a harness for
 * the driving disciplines, in the saddle slot); the four hallucinated crafted
 * items are gone. Items sold before the ruling as multi-discipline tack stay as
 * hidden aliases of one discipline, so a horse wearing one keeps a valid item.
 */
const drivingDisciplines = ['Combined Driving', 'Fine Harness', 'Harness Racing', 'Pleasure Driving'];
const slugOf = name => name.toLowerCase().replaceAll(' ', '-');
const saddleIdFor = discipline => {
  if (drivingDisciplines.includes(discipline)) {
    return discipline === 'Fine Harness' ? 'fine-harness' : `${slugOf(discipline)}-harness`;
  }
  return `${slugOf(discipline)}-saddle`;
};

const expectedClassification = { saddle: {}, bridle: {} };
for (const discipline of disciplines) {
  expectedClassification.saddle[saddleIdFor(discipline)] = [discipline];
  expectedClassification.bridle[`${slugOf(discipline)}-bridle`] = [discipline];
}
Object.assign(expectedClassification.saddle, {
  'all-purpose-saddle': allPurpose,
  // Sold as multi-discipline saddles; now the first discipline they listed.
  'jumping-saddle': ['Show Jumping'],
  'western-saddle': ['Western Pleasure'],
  'racing-exercise-saddle': ['Racing'],
});
Object.assign(expectedClassification.bridle, {
  'all-purpose-bridle': allPurpose,
  'snaffle-bridle': ['Dressage'],
  hackamore: ['Western Pleasure'],
  'double-bridle': ['Dressage'],
  'figure-eight-bridle': ['Show Jumping'],
  // The one crafted bridle that scores.
  'crafted-precision-bridle': ['Dressage'],
});

const asExpected = own => (own.length === 0 ? allPurpose : own);

describe('tack item classification (decision A)', () => {
  it('classifies every saddle and bridle in the shop catalogue and the crafting recipes', () => {
    const shopItems = [...tackCatalogItems('saddle'), ...tackCatalogItems('bridle')];
    const craftedItems = [...craftedItemRecipes('saddle'), ...craftedItemRecipes('bridle')];
    const actual = { saddle: {}, bridle: {} };
    for (const item of shopItems) {
      actual[item.category][item.id] = asExpected(tackItemDisciplines(item.category, item.id));
    }
    for (const recipe of craftedItems) {
      actual[recipe.resultCategory][recipe.result] = asExpected(
        tackItemDisciplines(recipe.resultCategory, recipe.result),
      );
    }
    expect(actual).toEqual(expectedClassification);
  });

  it('every listed discipline is a competition discipline', () => {
    for (const slot of Object.keys(expectedClassification)) {
      for (const own of Object.values(expectedClassification[slot])) {
        if (own !== allPurpose) {
          for (const discipline of own) {
            expect(disciplines).toContain(discipline);
          }
        }
      }
    }
  });

  it('an item in the wrong slot, or an unknown id, is not tack', () => {
    expect(tackItemDisciplines('bridle', 'dressage-saddle')).toBeNull();
    expect(tackItemDisciplines('saddle', 'leather-halter')).toBeNull();
    expect(tackItemDisciplines('saddle', 'no-such-saddle')).toBeNull();
  });
});

describe('tackPoints (decision A, flat points)', () => {
  it('pins the owner numbers', () => {
    expect(disciplineTackPoints).toBe(5);
    expect(allPurposeTackPoints).toBe(2);
  });

  it('the test list is the 24 competition disciplines', () => {
    expect(new Set(disciplines).size).toBe(24);
    expect(disciplines.every(isKnownDiscipline)).toBe(true);
  });

  it('discipline tack scores +5 each in its own disciplines and 0 in every other', () => {
    for (const discipline of disciplines) {
      const ownSaddle = discipline === 'Dressage' ? 5 : 0;
      const ownBridle = discipline === 'Show Jumping' ? 5 : 0;
      expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'show-jumping-bridle' }, discipline)).toBe(
        ownSaddle + ownBridle,
      );
    }
  });

  it('All Purpose tack scores +2 each in every discipline', () => {
    for (const discipline of disciplines) {
      expect(tackPoints({ saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' }, discipline)).toBe(4);
    }
  });

  it('caps at +10: one saddle and one bridle', () => {
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'dressage-bridle' }, 'Dressage')).toBe(10);
  });

  it('mixes discipline and All Purpose tack', () => {
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' }, 'Dressage')).toBe(7);
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' }, 'Racing')).toBe(2);
  });

  it('a harness takes the saddle slot and scores +5 in its own driving discipline only', () => {
    expect(tackPoints({ saddle: 'pleasure-driving-harness' }, 'Pleasure Driving')).toBe(5);
    expect(tackPoints({ saddle: 'pleasure-driving-harness' }, 'Combined Driving')).toBe(0);
    expect(
      tackPoints({ saddle: 'pleasure-driving-harness', bridle: 'pleasure-driving-bridle' }, 'Pleasure Driving'),
    ).toBe(10);
  });

  it('an item deleted by owner ruling q05 scores nothing', () => {
    for (const id of [
      'crafted-simple-bridle',
      'crafted-dyed-bridle',
      'crafted-event-saddle',
      'crafted-legacy-tack-set',
    ]) {
      expect(tackPoints({ saddle: id, bridle: id }, 'Dressage')).toBe(0);
      expect(tackItemDisciplines('saddle', id)).toBeNull();
      expect(tackItemDisciplines('bridle', id)).toBeNull();
    }
  });

  it('ignores the stored bonus mirrors, decorations and every other slot', () => {
    expect(tackPoints({ saddleBonus: 7, bridleBonus: 5 }, 'Racing')).toBe(0);
    expect(
      tackPoints(
        {
          halter: 'show-halter',
          reins: 'laced-reins',
          breastplate: 'hunting-breastplate',
          decorations: ['parade-blanket', 'show-ribbon'],
        },
        'Hunter',
      ),
    ).toBe(0);
    // The mirror never overrides the item in the slot.
    expect(tackPoints({ saddle: 'racing-saddle', saddleBonus: 7 }, 'Racing')).toBe(5);
  });

  it('scores nothing for missing, malformed or unknown tack, or a non-competition discipline', () => {
    for (const tack of [null, undefined, 'dressage-saddle', ['dressage-saddle'], 42, {}]) {
      expect(tackPoints(tack, 'Dressage')).toBe(0);
    }
    expect(tackPoints({ saddle: 'no-such-saddle', bridle: 7 }, 'Dressage')).toBe(0);
    expect(tackPoints({ saddle: 'all-purpose-saddle' }, 'Obedience Training')).toBe(0);
  });
});
