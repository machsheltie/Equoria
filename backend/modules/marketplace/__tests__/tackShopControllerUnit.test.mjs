import { describe, it, expect } from '@jest/globals';
import { tackInventory } from '../../../modules/economy/index.mjs';

// ─── tackInventory ──────────────────────────────────────────────────────────

describe('tackInventory', () => {
  it('is an array', () => {
    expect(Array.isArray(tackInventory)).toBe(true);
  });

  it('has at least 10 items', () => {
    expect(tackInventory.length).toBeGreaterThanOrEqual(10);
  });

  it('every item has an id string', () => {
    for (const item of tackInventory) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
    }
  });

  it('every non-legacy item has a category', () => {
    for (const item of tackInventory) {
      if (!item.isLegacyAlias) {
        expect(typeof item.category).toBe('string');
      }
    }
  });

  it('every item with a category has a non-empty string category', () => {
    for (const item of tackInventory) {
      if (item.category !== undefined) {
        expect(typeof item.category).toBe('string');
        expect(item.category.length).toBeGreaterThan(0);
      }
    }
  });

  it('includes at least one saddle', () => {
    expect(tackInventory.some(i => i.category === 'saddle' && !i.isLegacyAlias)).toBe(true);
  });

  it('includes at least one bridle', () => {
    expect(tackInventory.some(i => i.category === 'bridle')).toBe(true);
  });

  it('includes at least one decorative item', () => {
    expect(tackInventory.some(i => i.category === 'decorative')).toBe(true);
  });

  it('no item carries a numericBonus (Equoria-lsudd: numericBonus retired (owner decision A, 2026-10-23: the item in the slot decides the tack points).)', () => {
    for (const item of tackInventory) {
      expect(item).not.toHaveProperty('numericBonus');
    }
  });

  it('decorative items have presenceBonus', () => {
    for (const item of tackInventory.filter(i => i.category === 'decorative')) {
      expect(typeof item.presenceBonus).toBe('number');
    }
  });

  it('known saddle IDs are present: dressage-saddle, all-purpose-saddle', () => {
    const ids = new Set(tackInventory.map(i => i.id));
    expect(ids.has('dressage-saddle')).toBe(true);
    expect(ids.has('all-purpose-saddle')).toBe(true);
  });

  it('known bridle IDs are present: all-purpose-bridle', () => {
    const ids = new Set(tackInventory.map(i => i.id));
    expect(ids.has('all-purpose-bridle')).toBe(true);
  });

  it('known decorative IDs are present: show-ribbon', () => {
    const ids = new Set(tackInventory.map(i => i.id));
    expect(ids.has('show-ribbon')).toBe(true);
  });
});
