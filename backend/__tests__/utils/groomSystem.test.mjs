/**
 * groomSystem — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets hasAlreadyCompletedFoalTaskToday — a pure predicate with multiple
 * guard conditions and a catch path. No DB calls. No mocks.
 *
 * Branch map (15 branches):
 *   Guard 1: !foal || !today || typeof today !== 'string' || today.trim() === ''
 *   Guard 2: !foal.dailyTaskRecord || typeof foal.dailyTaskRecord !== 'object'
 *   Guard 3: !todayLog || !Array.isArray(todayLog) || todayLog.length === 0
 *   some():  enrichment task found / grooming task found / nothing found
 *   catch:   getter throws
 */

import { describe, it, expect } from '@jest/globals';
import { hasAlreadyCompletedFoalTaskToday } from '../../utils/groomSystem.mjs';
import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../../config/groomConfig.mjs';

const TODAY = '2026-05-12';

describe('hasAlreadyCompletedFoalTaskToday()', () => {
  // ── Guard 1: invalid first-arg or date string ────────────────────────────

  it('returns false when foal is null', () => {
    expect(hasAlreadyCompletedFoalTaskToday(null, TODAY)).toBe(false);
  });

  it('returns false when today is null', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, null)).toBe(false);
  });

  it('returns false when today is not a string (number)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, 20260512)).toBe(false);
  });

  it('returns false when today is a blank/whitespace string', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, '   ')).toBe(false);
  });

  // ── Guard 2: missing or non-object dailyTaskRecord ───────────────────────

  it('returns false when foal has no dailyTaskRecord property', () => {
    expect(hasAlreadyCompletedFoalTaskToday({}, TODAY)).toBe(false);
  });

  it('returns false when dailyTaskRecord is null (!record is true)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: null }, TODAY)).toBe(false);
  });

  it('returns false when dailyTaskRecord is a string (typeof !== object)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: 'invalid' }, TODAY)).toBe(false);
  });

  // ── Guard 3: no tasks recorded for today ────────────────────────────────

  it('returns false when no entry for today in dailyTaskRecord (!todayLog)', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ dailyTaskRecord: {} }, TODAY)).toBe(false);
  });

  it('returns false when todayLog is not an array (!Array.isArray)', () => {
    const foal = { dailyTaskRecord: { [TODAY]: 'brushing' } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  it('returns false when todayLog is an empty array (length === 0)', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  // ── some() — no foal-specific task in log ───────────────────────────────

  it('returns false when tasks today are none of the foal-specific lists', () => {
    const foal = { dailyTaskRecord: { [TODAY]: ['brushing', 'stall_care', 'hand-walking'] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(false);
  });

  // ── some() — enrichment task present ────────────────────────────────────

  it('returns true when todayLog contains an ELIGIBLE_FOAL_ENRICHMENT_TASKS entry', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [ELIGIBLE_FOAL_ENRICHMENT_TASKS[0]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  it('returns true when todayLog mixes non-foal and enrichment tasks', () => {
    const foal = { dailyTaskRecord: { [TODAY]: ['brushing', ELIGIBLE_FOAL_ENRICHMENT_TASKS[1]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  // ── some() — grooming task present ──────────────────────────────────────

  it('returns true when todayLog contains a FOAL_GROOMING_TASKS entry', () => {
    const foal = { dailyTaskRecord: { [TODAY]: [FOAL_GROOMING_TASKS[0]] } };
    expect(hasAlreadyCompletedFoalTaskToday(foal, TODAY)).toBe(true);
  });

  // ── catch path ───────────────────────────────────────────────────────────

  it('returns false (fail-safe) when accessing dailyTaskRecord throws', () => {
    const evil = {
      get dailyTaskRecord() {
        throw new Error('getter bomb');
      },
    };
    expect(hasAlreadyCompletedFoalTaskToday(evil, TODAY)).toBe(false);
  });
});
