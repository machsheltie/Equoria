/**
 * Tests for Decorative & Parade Tack System (Equoria-rmlh).
 *
 * Covers:
 *   - tackInventory decorative items shape and values
 */

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
// previous jest.unstable_mockModule-of-logger was purely for noise
// suppression — no logger.* assertions in this file. The real logger
// runs at LOG_LEVEL=error per setup.mjs which keeps test output clean.

import { describe, it, expect } from '@jest/globals';
import { tackInventory } from '../../economy/index.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// tackInventory — decorative items shape
// ─────────────────────────────────────────────────────────────────────────────

describe('tackInventory — decorative items', () => {
  const decorative = tackInventory.filter(i => i.category === 'decorative');

  it('exports at least 5 decorative items', () => {
    expect(decorative.length).toBeGreaterThanOrEqual(5);
  });

  // Old contract: presenceBonus >= 1. Owner q32/q23 (2026-10-23,
  // Equoria-dqnz1): decorations claim nothing until parades score.
  it('every decorative item has isCosmetic: true, comingSoon: true and no presence bonus', () => {
    for (const item of decorative) {
      expect(item.isCosmetic).toBe(true);
      expect(item.comingSoon).toBe(true);
      expect(item).not.toHaveProperty('presenceBonus');
      expect(item).not.toHaveProperty('bonus');
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

  it('no decorative item has a numericBonus (no stat effect; Equoria-lsudd: numericBonus retired (owner decision A, 2026-10-23: the item in the slot decides the tack points).)', () => {
    for (const item of decorative) {
      expect(item).not.toHaveProperty('numericBonus');
    }
  });
});
