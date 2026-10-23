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
 * Purpose) and the crafted items' recipes. Crafted items whose discipline is
 * ambiguous count as All Purpose until the owner rules (k1p62 audit note).
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

/** slot -> item id -> its own disciplines, or allPurpose. */
const expectedClassification = {
  saddle: {
    'dressage-saddle': ['Dressage'],
    'jumping-saddle': ['Show Jumping', 'Cross Country'],
    'all-purpose-saddle': allPurpose,
    'basic-all-purpose-saddle': allPurpose,
    'western-saddle': ['Western Pleasure', 'Reining', 'Barrel Racing', 'Cutting', 'Roping'],
    'endurance-saddle': ['Endurance'],
    'racing-exercise-saddle': ['Racing', 'Steeplechase'],
    // Crafted, ambiguous -> All Purpose until the owner rules.
    'crafted-event-saddle': allPurpose,
    'crafted-legacy-tack-set': allPurpose,
  },
  bridle: {
    'all-purpose-bridle': allPurpose,
    'standard-bridle': allPurpose,
    'snaffle-bridle': ['Dressage', 'Show Jumping'],
    hackamore: ['Western Pleasure', 'Endurance'],
    'double-bridle': ['Dressage'],
    'figure-eight-bridle': ['Show Jumping', 'Cross Country', 'Eventing'],
    'racing-bridle': ['Racing', 'Steeplechase', 'Harness Racing'],
    'crafted-precision-bridle': ['Dressage'],
    // Crafted, ambiguous -> All Purpose until the owner rules.
    'crafted-simple-bridle': allPurpose,
    'crafted-dyed-bridle': allPurpose,
  },
};

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
      const ownBridle = ['Show Jumping', 'Cross Country', 'Eventing'].includes(discipline) ? 5 : 0;
      expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'figure-eight-bridle' }, discipline)).toBe(
        ownSaddle + ownBridle,
      );
    }
  });

  it('All Purpose tack scores +2 each in every discipline, legacy aliases included', () => {
    for (const discipline of disciplines) {
      expect(tackPoints({ saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' }, discipline)).toBe(4);
      expect(tackPoints({ saddle: 'basic-all-purpose-saddle', bridle: 'standard-bridle' }, discipline)).toBe(4);
    }
  });

  it('caps at +10: one saddle and one bridle', () => {
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'double-bridle' }, 'Dressage')).toBe(10);
  });

  it('mixes discipline and All Purpose tack', () => {
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' }, 'Dressage')).toBe(7);
    expect(tackPoints({ saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' }, 'Racing')).toBe(2);
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
    expect(tackPoints({ saddle: 'racing-exercise-saddle', saddleBonus: 7 }, 'Racing')).toBe(5);
  });

  it('scores nothing for missing, malformed or unknown tack, or a non-competition discipline', () => {
    for (const tack of [null, undefined, 'dressage-saddle', ['dressage-saddle'], 42, {}]) {
      expect(tackPoints(tack, 'Dressage')).toBe(0);
    }
    expect(tackPoints({ saddle: 'no-such-saddle', bridle: 7 }, 'Dressage')).toBe(0);
    expect(tackPoints({ saddle: 'all-purpose-saddle' }, 'Obedience Training')).toBe(0);
  });
});
