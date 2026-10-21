/**
 * Tests for Decorative & Parade Tack System (Equoria-rmlh).
 *
 * Covers:
 *   - TACK_INVENTORY decorative items shape and values
 *   - resolveTackBonus() with parade showType
 */

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
// previous jest.unstable_mockModule-of-logger was purely for noise
// suppression — no logger.* assertions in this file. The real logger
// runs at LOG_LEVEL=error per setup.mjs which keeps test output clean.

import { describe, it, expect } from '@jest/globals';
import { TACK_INVENTORY, resolveTackBonus } from '../../economy/index.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// TACK_INVENTORY — decorative items shape
// ─────────────────────────────────────────────────────────────────────────────

describe('TACK_INVENTORY — decorative items', () => {
  const decorative = TACK_INVENTORY.filter(i => i.category === 'decorative');

  it('exports at least 5 decorative items', () => {
    expect(decorative.length).toBeGreaterThanOrEqual(5);
  });

  it('every decorative item has isCosmetic: true and presenceBonus >= 1', () => {
    for (const item of decorative) {
      expect(item.isCosmetic).toBe(true);
      expect(typeof item.presenceBonus).toBe('number');
      expect(item.presenceBonus).toBeGreaterThanOrEqual(1);
    }
  });

  it('required items present: show-ribbon, braided-mane-wrap, parade-blanket, glitter-spray, floral-browband', () => {
    const ids = decorative.map(i => i.id);
    for (const required of ['show-ribbon', 'braided-mane-wrap', 'parade-blanket', 'glitter-spray', 'floral-browband']) {
      expect(ids).toContain(required);
    }
  });

  it('at least one item has a seasonalTag', () => {
    expect(decorative.some(i => typeof i.seasonalTag === 'string')).toBe(true);
  });

  it('snowflake-parade-tack has seasonalTag: winter', () => {
    const item = decorative.find(i => i.id === 'snowflake-parade-tack');
    expect(item).toBeDefined();
    expect(item.seasonalTag).toBe('winter');
  });

  it('glitter-spray has limitedUse: 3', () => {
    const item = decorative.find(i => i.id === 'glitter-spray');
    expect(item.limitedUse).toBe(3);
  });

  it('all decorative items have numericBonus: 0 (no stat effect)', () => {
    for (const item of decorative) {
      expect(item.numericBonus).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveTackBonus — parade showType
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveTackBonus() — parade presenceBonus', () => {
  it('returns presenceBonus 0 for null tack', () => {
    expect(resolveTackBonus(null, 'parade')).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
  });

  it('returns presenceBonus 0 for empty tack (no decorations)', () => {
    expect(resolveTackBonus({}, 'parade')).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
  });

  it('sums presenceBonus for a single decoration', () => {
    // show-ribbon has presenceBonus: 3
    const tack = { decorations: ['show-ribbon'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3);
  });

  it('sums presenceBonus for multiple decorations', () => {
    // show-ribbon (3) + floral-browband (3) = 6
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(6);
  });

  it('ignores unknown item IDs gracefully', () => {
    const tack = { decorations: ['show-ribbon', 'not-a-real-item'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3); // only show-ribbon counted
  });

  it('returns presenceBonus 0 for ridden showType even with decorations', () => {
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'ridden');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns presenceBonus 0 for conformation showType with decorations', () => {
    const tack = { decorations: ['parade-blanket'] };
    const result = resolveTackBonus(tack, 'conformation');
    expect(result.presenceBonus).toBe(0);
  });

  it('parade + saddle: returns both saddleBonus and presenceBonus', () => {
    const tack = { saddle: 'basic-saddle', decorations: ['show-ribbon'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3);
    // saddleBonus depends on whether basic-saddle is in the catalog — just verify type
    expect(typeof result.saddleBonus).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parade show scoring — tack bonus
// ─────────────────────────────────────────────────────────────────────────────

describe('parade show scoring — tack bonus behavior', () => {
  it('resolveTackBonus returns summed presenceBonus for parade decorations', () => {
    const { presenceBonus } = resolveTackBonus({ decorations: ['show-ribbon', 'floral-browband'] }, 'parade');
    expect(presenceBonus).toBe(6); // show-ribbon(3) + floral-browband(3)
  });

  it('resolveTackBonus returns zero presenceBonus for ridden show', () => {
    const { presenceBonus } = resolveTackBonus({ decorations: ['parade-blanket'] }, 'ridden');
    expect(presenceBonus).toBe(0);
  });

  it('resolveTackBonus returns zero presenceBonus when no decorations on parade show', () => {
    const { presenceBonus } = resolveTackBonus({}, 'parade');
    expect(presenceBonus).toBe(0);
  });

  it('decorated horse has higher presenceBonus than undecorated horse in parade', () => {
    const withDeco = resolveTackBonus({ decorations: ['parade-blanket', 'braided-mane-wrap'] }, 'parade');
    const noDeco = resolveTackBonus({}, 'parade');
    expect(withDeco.presenceBonus).toBeGreaterThan(noDeco.presenceBonus);
  });

  it('resolveTackBonus defaults showType to ridden — presenceBonus is 0', () => {
    const { presenceBonus } = resolveTackBonus({ decorations: ['parade-blanket'] });
    expect(presenceBonus).toBe(0);
  });
});
