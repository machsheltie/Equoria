/**
 * epigeneticFlags — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  EPIGENETIC_FLAGS,
  GROOM_PERSONALITIES,
  CARE_PATTERN_TRIGGERS,
  evaluateEpigeneticFlags,
} from '../../utils/epigeneticFlags.mjs';

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

// ---------------------------------------------------------------------------
// CARE_PATTERN_TRIGGERS constant
// ---------------------------------------------------------------------------
describe('CARE_PATTERN_TRIGGERS', () => {
  it('is a non-empty object', () => {
    expect(typeof CARE_PATTERN_TRIGGERS).toBe('object');
    expect(Object.keys(CARE_PATTERN_TRIGGERS).length).toBeGreaterThan(0);
  });

  it('includes positive and negative patterns', () => {
    expect(CARE_PATTERN_TRIGGERS.CONSISTENT_DAILY_CARE).toBeDefined();
    expect(CARE_PATTERN_TRIGGERS.NEGLECT_PATTERN).toBeDefined();
  });

  it('each trigger has pattern and flags array', () => {
    for (const [, trigger] of Object.entries(CARE_PATTERN_TRIGGERS)) {
      expect(typeof trigger.pattern).toBe('string');
      expect(Array.isArray(trigger.flags)).toBe(true);
      expect(trigger.flags.length).toBeGreaterThan(0);
    }
  });

  it('NEGLECT_PATTERN triggers FEARFUL and INSECURE', () => {
    expect(CARE_PATTERN_TRIGGERS.NEGLECT_PATTERN.flags).toContain('FEARFUL');
    expect(CARE_PATTERN_TRIGGERS.NEGLECT_PATTERN.flags).toContain('INSECURE');
  });

  it('CONSISTENT_DAILY_CARE triggers AFFECTIONATE and CONFIDENT', () => {
    expect(CARE_PATTERN_TRIGGERS.CONSISTENT_DAILY_CARE.flags).toContain('AFFECTIONATE');
    expect(CARE_PATTERN_TRIGGERS.CONSISTENT_DAILY_CARE.flags).toContain('CONFIDENT');
  });
});

// ---------------------------------------------------------------------------
// evaluateEpigeneticFlags
// ---------------------------------------------------------------------------
describe('evaluateEpigeneticFlags', () => {
  const youngHorse = () => ({
    dateOfBirth: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days old
  });

  const oldHorse = () => ({
    dateOfBirth: new Date(Date.now() - 1200 * 24 * 60 * 60 * 1000), // 1200 days → over 3 years
  });

  it('returns an array', () => {
    expect(Array.isArray(evaluateEpigeneticFlags({}, {}, youngHorse()))).toBe(true);
  });

  it('returns empty array for horse over 3 years old (1095 days)', () => {
    const result = evaluateEpigeneticFlags({}, {}, oldHorse());
    expect(result).toEqual([]);
  });

  it('returns empty array for horse exactly at 1095 days', () => {
    const horse = { dateOfBirth: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000) };
    const result = evaluateEpigeneticFlags({}, {}, horse);
    expect(result).toEqual([]);
  });

  it('returns array (possibly empty) for young horse under 3 years', () => {
    const result = evaluateEpigeneticFlags({}, {}, youngHorse());
    expect(Array.isArray(result)).toBe(true);
  });

  it('does not include conflicting flags in result', () => {
    const result = evaluateEpigeneticFlags({}, {}, youngHorse());
    // Result should not contain both BRAVE and FEARFUL (they conflict)
    const hasBrave = result.includes('BRAVE');
    const hasFearful = result.includes('FEARFUL');
    expect(hasBrave && hasFearful).toBe(false);
  });

  it('does not include unknown flag names', () => {
    const result = evaluateEpigeneticFlags({}, {}, youngHorse());
    for (const flag of result) {
      expect(EPIGENETIC_FLAGS[flag]).toBeDefined();
    }
  });
});
