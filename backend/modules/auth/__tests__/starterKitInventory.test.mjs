/**
 * Equoria-oroi — Lock STARTER_KIT_INVENTORY itemId/name/bonus values.
 *
 * Background: spec-all-purpose-tack.md AC requires that new user registration
 * seeds saddle with itemId='all-purpose-saddle' / name='All Purpose Saddle'
 * and bridle with itemId='all-purpose-bridle' / name='All Purpose Bridle'.
 * No prior test asserted these — a typo or rename would land silently.
 *
 * This is a pure-module-import unit test (no DB), per CLAUDE.md guidance.
 * Real-DB registration integration tests cover the seeding path itself
 * (auth-system-integration.test.mjs); this file locks the constants the
 * seeding path reads.
 */

import { STARTER_KIT_INVENTORY } from '../controllers/authController.mjs';

describe('STARTER_KIT_INVENTORY value lock (Equoria-oroi)', () => {
  test('contains exactly two entries (saddle + bridle)', () => {
    expect(STARTER_KIT_INVENTORY).toHaveLength(2);
    const categories = STARTER_KIT_INVENTORY.map(item => item.category).sort();
    expect(categories).toEqual(['bridle', 'saddle']);
  });

  test('saddle entry: locked itemId/name/bonus/quantity', () => {
    const saddle = STARTER_KIT_INVENTORY.find(item => item.category === 'saddle');
    expect(saddle).toBeDefined();
    expect(saddle.itemId).toBe('all-purpose-saddle');
    expect(saddle.name).toBe('All Purpose Saddle');
    expect(saddle.bonus).toBe('+5 all disciplines');
    expect(saddle.quantity).toBe(1);
  });

  test('bridle entry: locked itemId/name/bonus/quantity', () => {
    const bridle = STARTER_KIT_INVENTORY.find(item => item.category === 'bridle');
    expect(bridle).toBeDefined();
    expect(bridle.itemId).toBe('all-purpose-bridle');
    expect(bridle.name).toBe('All Purpose Bridle');
    expect(bridle.bonus).toBe('+5 all disciplines');
    expect(bridle.quantity).toBe(1);
  });

  test('all entries have a non-empty id field (used as inventory primary key)', () => {
    for (const item of STARTER_KIT_INVENTORY) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
    }
  });
});
