/**
 * foalAgeUtils — activity age-stage validation (Equoria-4kzik)
 *
 * Pure-function sentinel for the server-side age-stage rule. No DB, no app.
 * Proves getStageForActivity / validateActivityForFoalAge correctly classify
 * known activities and reject out-of-stage attempts — the integrity rule that
 * was previously only enforced in the frontend DevelopmentTracker.
 */

import { describe, expect, it } from '@jest/globals';
import { getStageForActivity, validateActivityForFoalAge } from '../../../utils/foalAgeUtils.mjs';

// Equoria-oey96.16: age-stage cadence is on the game-year clock (7 real days =
// 1 game year). `now` is INJECTED (never Date.now()) and dobs are expressed in
// real DAYS, not weeks. Stage windows: newborn 0–2d, weanling 3–6d,
// yearling 7–13d, two_year_old 14–20d, graduated >= 21d (age-3 training gate).
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = days => new Date(NOW.getTime() - days * DAY_MS);

describe('getStageForActivity (Equoria-4kzik)', () => {
  it('maps each known activity to its real stage', () => {
    expect(getStageForActivity('imprinting')).toBe('newborn');
    expect(getStageForActivity('desensitization')).toBe('weanling');
    expect(getStageForActivity('ground_work')).toBe('yearling');
    expect(getStageForActivity('longe_work')).toBe('two_year_old');
  });

  it('returns null for unrecognised / day-based activity ids', () => {
    expect(getStageForActivity('not_a_real_activity')).toBeNull();
    expect(getStageForActivity('')).toBeNull();
    expect(getStageForActivity(null)).toBeNull();
    expect(getStageForActivity(42)).toBeNull();
  });
});

describe('validateActivityForFoalAge (Equoria-4kzik)', () => {
  it('allows a stage-matched activity', () => {
    expect(validateActivityForFoalAge('imprinting', daysAgo(0), NOW)).toEqual(
      expect.objectContaining({ allowed: true, currentStage: 'newborn' }),
    );
    expect(validateActivityForFoalAge('ground_work', daysAgo(10), NOW)).toEqual(
      expect.objectContaining({ allowed: true, currentStage: 'yearling' }),
    );
  });

  it('rejects an out-of-stage activity with wrong_stage + both stages', () => {
    const r = validateActivityForFoalAge('longe_work', daysAgo(0), NOW); // 2yo activity on newborn
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('wrong_stage');
    expect(r.requiredStage).toBe('two_year_old');
    expect(r.currentStage).toBe('newborn');
  });

  it('rejects when the horse has graduated (age 3+ game-years / 21+ real days)', () => {
    const r = validateActivityForFoalAge('imprinting', daysAgo(30), NOW); // >= 21 real days
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('graduated');
  });

  it('signals unknown_activity (caller defers, does not hard-reject)', () => {
    const r = validateActivityForFoalAge('some_day_based_enrichment', daysAgo(0), NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unknown_activity');
  });
});
