/**
 * dailyCareAutomation — pure-function + light-DB branch-coverage tests (Equoria-rr7)
 *
 * Pure functions (no DB):
 *   isGroomAvailableToday — is_active guard, availability || {} fallback, day match, catch
 *   determineRoutinesToPerform — unknown-routine filter, already-completed filter, keep path
 *   scheduleDailyCareAutomation — return shape, custom schedule
 *   DAILY_CARE_ROUTINES — structure invariants
 *
 * Light DB (real DB, specificFoalId=-1 → no assignments → early return):
 *   runDailyCareAutomation — no-assignments path
 */

import { describe, it, expect } from '@jest/globals';
import {
  isGroomAvailableToday,
  determineRoutinesToPerform,
  scheduleDailyCareAutomation,
  DAILY_CARE_ROUTINES,
  runDailyCareAutomation,
} from '../../utils/dailyCareAutomation.mjs';

// ── DAILY_CARE_ROUTINES constant ──────────────────────────────────────────────

describe('DAILY_CARE_ROUTINES', () => {
  it('has 5 entries each with name, interactionType, and positive duration', () => {
    const entries = Object.entries(DAILY_CARE_ROUTINES);
    expect(entries.length).toBe(5);
    for (const [, routine] of entries) {
      expect(typeof routine.name).toBe('string');
      expect(typeof routine.interactionType).toBe('string');
      expect(typeof routine.duration).toBe('number');
      expect(routine.duration).toBeGreaterThan(0);
    }
  });

  it('includes morning_care and feeding as distinct entries', () => {
    expect(DAILY_CARE_ROUTINES.morning_care).toBeDefined();
    expect(DAILY_CARE_ROUTINES.feeding).toBeDefined();
    expect(DAILY_CARE_ROUTINES.morning_care.interactionType).toBe('daily_care');
    expect(DAILY_CARE_ROUTINES.feeding.interactionType).toBe('feeding');
  });
});

// ── isGroomAvailableToday ─────────────────────────────────────────────────────

describe('isGroomAvailableToday()', () => {
  // ── Guard: is_active false ────────────────────────────────────────────────

  it('returns false when groom.is_active is false', () => {
    expect(isGroomAvailableToday({ is_active: false })).toBe(false);
  });

  it('returns false when is_active is false even with availability set to true', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    expect(isGroomAvailableToday({ is_active: false, availability: { [todayName]: true } })).toBe(false);
  });

  // ── availability || {} fallback (falsy left branch) ───────────────────────

  it('returns true when is_active true and availability is absent (|| {} fallback)', () => {
    expect(isGroomAvailableToday({ is_active: true })).toBe(true);
  });

  it('returns true when is_active true and availability is null (|| {} fallback)', () => {
    expect(isGroomAvailableToday({ is_active: true, availability: null })).toBe(true);
  });

  // ── availability truthy, day check ────────────────────────────────────────

  it('returns true when is_active true and availability is empty object', () => {
    expect(isGroomAvailableToday({ is_active: true, availability: {} })).toBe(true);
  });

  it('returns true when today is explicitly true in availability', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    const groom = { is_active: true, availability: { [todayName]: true } };
    expect(isGroomAvailableToday(groom)).toBe(true);
  });

  it('returns false when today is explicitly false in availability', () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    const groom = { is_active: true, availability: { [todayName]: false } };
    expect(isGroomAvailableToday(groom)).toBe(false);
  });

  // ── catch path ────────────────────────────────────────────────────────────

  it('returns true (fail-safe) when accessing is_active throws', () => {
    const evil = {
      get is_active() {
        throw new Error('getter bomb');
      },
    };
    expect(isGroomAvailableToday(evil)).toBe(true);
  });
});

// ── determineRoutinesToPerform ────────────────────────────────────────────────

describe('determineRoutinesToPerform()', () => {
  it('returns empty array when requestedRoutines is empty', () => {
    expect(determineRoutinesToPerform([], [])).toEqual([]);
  });

  it('excludes unknown routine types (!routine branch → filter false)', () => {
    const result = determineRoutinesToPerform(['unicorn_spa', 'teleportation'], []);
    expect(result).toEqual([]);
  });

  it('includes known routine types not yet completed', () => {
    const result = determineRoutinesToPerform(['morning_care', 'feeding'], []);
    expect(result).toContain('morning_care');
    expect(result).toContain('feeding');
  });

  it('excludes routines whose interactionType appears in completedRoutines', () => {
    // morning_care.interactionType='daily_care', evening_care.interactionType='daily_care'
    const result = determineRoutinesToPerform(
      ['morning_care', 'evening_care', 'feeding'],
      ['daily_care'],
    );
    expect(result).not.toContain('morning_care');
    expect(result).not.toContain('evening_care');
    expect(result).toContain('feeding');
  });

  it('returns all valid known routines when completedRoutines is empty', () => {
    const all = Object.keys(DAILY_CARE_ROUTINES);
    const result = determineRoutinesToPerform(all, []);
    expect(result).toEqual(all);
  });

  it('returns empty when all routines already completed', () => {
    const all = Object.keys(DAILY_CARE_ROUTINES);
    const allInteractionTypes = [...new Set(all.map(k => DAILY_CARE_ROUTINES[k].interactionType))];
    const result = determineRoutinesToPerform(all, allInteractionTypes);
    expect(result).toEqual([]);
  });
});

// ── scheduleDailyCareAutomation ───────────────────────────────────────────────

describe('scheduleDailyCareAutomation()', () => {
  it('returns configuration with default schedule, enabled true, and handler function', () => {
    const result = scheduleDailyCareAutomation();
    expect(result.schedule).toBe('0 8,14,20 * * *');
    expect(result.enabled).toBe(true);
    expect(typeof result.handler).toBe('function');
    expect(typeof result.description).toBe('string');
  });

  it('uses the provided custom schedule', () => {
    const result = scheduleDailyCareAutomation('0 6 * * *');
    expect(result.schedule).toBe('0 6 * * *');
    expect(result.enabled).toBe(true);
  });
});

// ── runDailyCareAutomation — no-assignments early return ──────────────────────

describe('runDailyCareAutomation()', () => {
  it('returns success with 0 processed when specificFoalId has no active assignments', async () => {
    const result = await runDailyCareAutomation({ specificFoalId: -1 });
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(Array.isArray(result.interactions)).toBe(true);
    expect(result.interactions).toHaveLength(0);
    expect(result.message).toMatch(/no active/i);
  });

  it('accepts dryRun option without error when no assignments', async () => {
    const result = await runDailyCareAutomation({ specificFoalId: -1, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
  });
});
