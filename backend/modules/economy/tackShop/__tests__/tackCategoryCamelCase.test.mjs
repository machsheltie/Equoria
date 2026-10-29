/**
 * Tack categories are camelCase (Equoria-pjvp8.4 phase 3i).
 *
 * Owner ruling 2026-10-21: Equoria names are camelCase, stored values included.
 * A tack item's category is stored as a Horse.tack slot key and as the
 * category of an inventory record, so the catalogue's categories, the shop's
 * group headings and every crafted result category must be camelCase
 * (saddlePad, legWraps; never saddle_pad, leg_wraps).
 *
 * Real catalogue and controller, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { allTackItems } from '../services/tackInventory.mjs';
import { getTackInventory } from '../controllers/tackShopController.mjs';

const camel = /^[a-z][A-Za-z]*$/;

describe('tack categories are camelCase', () => {
  it('every catalogue item, legacy aliases included, has a camelCase category', () => {
    const offenders = allTackItems()
      .filter(item => !camel.test(item.category))
      .map(item => `${item.id}:${item.category}`);
    expect(offenders).toEqual([]);
    expect(allTackItems().some(item => item.category === 'saddlePad')).toBe(true);
    expect(allTackItems().some(item => item.category === 'legWraps')).toBe(true);
  });

  it('the shop groups and names its categories by the camelCase key', async () => {
    let body;
    const res = {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    await getTackInventory({}, res);
    expect(Object.keys(body.data.categoryDisplayNames).filter(key => !camel.test(key))).toEqual([]);
    expect(Object.keys(body.data.categories).filter(key => !camel.test(key))).toEqual([]);
    expect(body.data.categoryDisplayNames.saddlePad).toBe('Saddle Pads');
    expect(body.data.categoryDisplayNames.legWraps).toBe('Leg Wraps & Boots');
  });
});
