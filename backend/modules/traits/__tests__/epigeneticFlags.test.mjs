/**
 * epigeneticFlags — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { EPIGENETIC_FLAGS, GROOM_PERSONALITIES } from '../../../utils/epigeneticFlags.mjs';

// ---------------------------------------------------------------------------
// EPIGENETIC_FLAGS constant
// ---------------------------------------------------------------------------
describe('EPIGENETIC_FLAGS', () => {
  it('is a non-empty object', () => {
    expect(typeof EPIGENETIC_FLAGS).toBe('object');
    expect(Object.keys(EPIGENETIC_FLAGS).length).toBeGreaterThan(0);
  });

  it('includes BRAVE, FEARFUL, CONFIDENT, INSECURE', () => {
    expect(EPIGENETIC_FLAGS.BRAVE).toBeDefined();
    expect(EPIGENETIC_FLAGS.FEARFUL).toBeDefined();
    expect(EPIGENETIC_FLAGS.CONFIDENT).toBeDefined();
    expect(EPIGENETIC_FLAGS.INSECURE).toBeDefined();
  });

  it('each flag has name, description, triggers, effects, conflictsWith', () => {
    for (const [, flag] of Object.entries(EPIGENETIC_FLAGS)) {
      expect(typeof flag.name).toBe('string');
      expect(typeof flag.description).toBe('string');
      expect(Array.isArray(flag.triggers)).toBe(true);
      expect(typeof flag.effects).toBe('object');
      expect(Array.isArray(flag.conflictsWith)).toBe(true);
    }
  });

  it('BRAVE conflicts with FEARFUL', () => {
    expect(EPIGENETIC_FLAGS.BRAVE.conflictsWith).toContain('FEARFUL');
  });

  it('CONFIDENT conflicts with INSECURE', () => {
    expect(EPIGENETIC_FLAGS.CONFIDENT.conflictsWith).toContain('INSECURE');
  });

  it('BRAVE has traitProbability effects', () => {
    expect(EPIGENETIC_FLAGS.BRAVE.effects.traitProbability).toBeDefined();
    expect(typeof EPIGENETIC_FLAGS.BRAVE.effects.traitProbability).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// GROOM_PERSONALITIES constant
// ---------------------------------------------------------------------------
describe('GROOM_PERSONALITIES', () => {
  it('is a non-empty object', () => {
    expect(typeof GROOM_PERSONALITIES).toBe('object');
    expect(Object.keys(GROOM_PERSONALITIES).length).toBeGreaterThan(0);
  });

  it('includes GENTLE, ENERGETIC, PATIENT, FIRM, BALANCED', () => {
    expect(GROOM_PERSONALITIES.GENTLE).toBeDefined();
    expect(GROOM_PERSONALITIES.ENERGETIC).toBeDefined();
    expect(GROOM_PERSONALITIES.PATIENT).toBeDefined();
    expect(GROOM_PERSONALITIES.FIRM).toBeDefined();
    expect(GROOM_PERSONALITIES.BALANCED).toBeDefined();
  });

  it('each personality has name, description, traitBonuses, traitPenalties, temperamentSynergy', () => {
    for (const [, personality] of Object.entries(GROOM_PERSONALITIES)) {
      expect(typeof personality.name).toBe('string');
      expect(typeof personality.description).toBe('string');
      expect(typeof personality.traitBonuses).toBe('object');
      expect(typeof personality.traitPenalties).toBe('object');
      expect(typeof personality.temperamentSynergy).toBe('object');
    }
  });

  it('GENTLE has positive bonus for AFFECTIONATE', () => {
    expect(GROOM_PERSONALITIES.GENTLE.traitBonuses.AFFECTIONATE).toBeGreaterThan(0);
  });

  it('GENTLE has penalty for FEARFUL', () => {
    expect(GROOM_PERSONALITIES.GENTLE.traitPenalties.FEARFUL).toBeLessThan(0);
  });

  it('BALANCED has bonuses for all major positive traits', () => {
    const balanced = GROOM_PERSONALITIES.BALANCED.traitBonuses;
    expect(balanced.CONFIDENT).toBeGreaterThan(0);
    expect(balanced.AFFECTIONATE).toBeGreaterThan(0);
    expect(balanced.RESILIENT).toBeGreaterThan(0);
  });
});
