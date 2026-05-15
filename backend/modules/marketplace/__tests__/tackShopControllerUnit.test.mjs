import { describe, it, expect } from '@jest/globals';
import { TACK_INVENTORY, resolveTackBonus } from '../../../modules/services/controllers/tackShopController.mjs';

// ─── TACK_INVENTORY ──────────────────────────────────────────────────────────

describe('TACK_INVENTORY', () => {
  it('is an array', () => {
    expect(Array.isArray(TACK_INVENTORY)).toBe(true);
  });

  it('has at least 10 items', () => {
    expect(TACK_INVENTORY.length).toBeGreaterThanOrEqual(10);
  });

  it('every item has an id string', () => {
    for (const item of TACK_INVENTORY) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
    }
  });

  it('every non-legacy item has a category', () => {
    for (const item of TACK_INVENTORY) {
      if (!item.isLegacyAlias) {
        expect(typeof item.category).toBe('string');
      }
    }
  });

  it('every item with a category has a non-empty string category', () => {
    for (const item of TACK_INVENTORY) {
      if (item.category !== undefined) {
        expect(typeof item.category).toBe('string');
        expect(item.category.length).toBeGreaterThan(0);
      }
    }
  });

  it('includes at least one saddle', () => {
    expect(TACK_INVENTORY.some(i => i.category === 'saddle' && !i.isLegacyAlias)).toBe(true);
  });

  it('includes at least one bridle', () => {
    expect(TACK_INVENTORY.some(i => i.category === 'bridle')).toBe(true);
  });

  it('includes at least one decorative item', () => {
    expect(TACK_INVENTORY.some(i => i.category === 'decorative')).toBe(true);
  });

  it('saddles have numeric numericBonus', () => {
    for (const item of TACK_INVENTORY.filter(i => i.category === 'saddle')) {
      expect(typeof item.numericBonus).toBe('number');
    }
  });

  it('bridles have numeric numericBonus', () => {
    for (const item of TACK_INVENTORY.filter(i => i.category === 'bridle')) {
      expect(typeof item.numericBonus).toBe('number');
    }
  });

  it('decorative items have presenceBonus', () => {
    for (const item of TACK_INVENTORY.filter(i => i.category === 'decorative')) {
      expect(typeof item.presenceBonus).toBe('number');
    }
  });

  it('known saddle IDs are present: dressage-saddle, all-purpose-saddle', () => {
    const ids = new Set(TACK_INVENTORY.map(i => i.id));
    expect(ids.has('dressage-saddle')).toBe(true);
    expect(ids.has('all-purpose-saddle')).toBe(true);
  });

  it('known bridle IDs are present: all-purpose-bridle', () => {
    const ids = new Set(TACK_INVENTORY.map(i => i.id));
    expect(ids.has('all-purpose-bridle')).toBe(true);
  });

  it('known decorative IDs are present: show-ribbon', () => {
    const ids = new Set(TACK_INVENTORY.map(i => i.id));
    expect(ids.has('show-ribbon')).toBe(true);
  });
});

// ─── resolveTackBonus ─────────────────────────────────────────────────────────

describe('resolveTackBonus — null/invalid tack', () => {
  it('returns zeroes for null', () => {
    expect(resolveTackBonus(null)).toEqual({ saddleBonus: 0, bridleBonus: 0, presenceBonus: 0 });
  });

  it('returns zeroes for undefined', () => {
    expect(resolveTackBonus(undefined)).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
  });

  it('returns zeroes for a string', () => {
    expect(resolveTackBonus('bad')).toEqual({ saddleBonus: 0, bridleBonus: 0, presenceBonus: 0 });
  });

  it('returns zeroes for empty object', () => {
    expect(resolveTackBonus({})).toEqual({ saddleBonus: 0, bridleBonus: 0, presenceBonus: 0 });
  });
});

describe('resolveTackBonus — direct numeric fields (legacy path)', () => {
  it('passes through saddleBonus and bridleBonus when numeric', () => {
    const result = resolveTackBonus({ saddleBonus: 5, bridleBonus: 3 });
    expect(result.saddleBonus).toBe(5);
    expect(result.bridleBonus).toBe(3);
    expect(result.presenceBonus).toBe(0);
  });

  it('uses 0 for missing fields when one numeric field exists', () => {
    const result = resolveTackBonus({ saddleBonus: 7 });
    expect(result.saddleBonus).toBe(7);
    expect(result.bridleBonus).toBe(0);
  });

  it('returns presenceBonus as 0 even in parade mode for legacy path', () => {
    const result = resolveTackBonus({ saddleBonus: 5, bridleBonus: 3 }, 'parade');
    expect(result.presenceBonus).toBe(0);
  });
});

describe('resolveTackBonus — catalog lookup path', () => {
  it('resolves a valid saddle ID to its numericBonus', () => {
    const result = resolveTackBonus({ saddle: 'dressage-saddle' });
    expect(result.saddleBonus).toBe(5);
    expect(result.bridleBonus).toBe(0);
  });

  it('resolves a valid bridle ID to its numericBonus (Equoria-slry: literal lock)', () => {
    // spec-all-purpose-tack.md: all-purpose-bridle.numericBonus = 5.
    // Asserting literal value catches a regression that lowered the bonus
    // (e.g. 5 → 1) which the prior .toBeGreaterThan(0) check let through.
    const result = resolveTackBonus({ bridle: 'all-purpose-bridle' });
    expect(result.bridleBonus).toBe(5);
    expect(result.saddleBonus).toBe(0);
  });

  it('resolves both saddle and bridle together (Equoria-slry: literal lock)', () => {
    // spec-all-purpose-tack.md: all-purpose-saddle.numericBonus = 5
    // and all-purpose-bridle.numericBonus = 5. Literal asserts replace
    // the prior .toBeGreaterThan(0) which would have passed a 1+1 regression.
    const result = resolveTackBonus({ saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' });
    expect(result.saddleBonus).toBe(5);
    expect(result.bridleBonus).toBe(5);
  });

  it('returns 0 for unknown saddle ID', () => {
    const result = resolveTackBonus({ saddle: 'nonexistent-saddle' });
    expect(result.saddleBonus).toBe(0);
  });

  it('returns 0 for unknown bridle ID', () => {
    const result = resolveTackBonus({ bridle: 'nonexistent-bridle' });
    expect(result.bridleBonus).toBe(0);
  });
});

describe('resolveTackBonus — parade decorations', () => {
  it('returns presenceBonus = 0 for ridden shows even with decorations', () => {
    const result = resolveTackBonus({ decorations: ['show-ribbon'] }, 'ridden');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns presenceBonus = 0 for conformation shows even with decorations', () => {
    const result = resolveTackBonus({ decorations: ['show-ribbon'] }, 'conformation');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns presenceBonus for parade show with valid decorations', () => {
    const result = resolveTackBonus({ decorations: ['show-ribbon'] }, 'parade');
    expect(result.presenceBonus).toBeGreaterThan(0);
  });

  it('sums presenceBonus from multiple decorations in parade', () => {
    const result = resolveTackBonus({ decorations: ['show-ribbon', 'braided-mane-wrap'] }, 'parade');
    expect(result.presenceBonus).toBeGreaterThan(0);
  });

  it('ignores unknown decoration IDs in parade', () => {
    const result = resolveTackBonus({ decorations: ['fake-decoration'] }, 'parade');
    expect(result.presenceBonus).toBe(0);
  });

  it('handles non-array decorations gracefully (no throw)', () => {
    expect(() => resolveTackBonus({ decorations: 'not-an-array' }, 'parade')).not.toThrow();
  });

  it('defaults to ridden show type when showType not provided', () => {
    const result = resolveTackBonus({ decorations: ['show-ribbon'] });
    expect(result.presenceBonus).toBe(0);
  });
});
