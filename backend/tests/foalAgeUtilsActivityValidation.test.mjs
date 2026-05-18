/**
 * foalAgeUtils — activity age-stage validation (Equoria-4kzik)
 *
 * Pure-function sentinel for the server-side age-stage rule. No DB, no app.
 * Proves getStageForActivity / validateActivityForFoalAge correctly classify
 * known activities and reject out-of-stage attempts — the integrity rule that
 * was previously only enforced in the frontend DevelopmentTracker.
 */

import { describe, expect, it } from '@jest/globals';
import { getStageForActivity, validateActivityForFoalAge } from '../utils/foalAgeUtils.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ago = weeks => new Date(Date.now() - weeks * WEEK_MS);

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
    expect(validateActivityForFoalAge('imprinting', new Date())).toEqual(
      expect.objectContaining({ allowed: true, currentStage: 'newborn' }),
    );
    expect(validateActivityForFoalAge('ground_work', ago(30))).toEqual(
      expect.objectContaining({ allowed: true, currentStage: 'yearling' }),
    );
  });

  it('rejects an out-of-stage activity with wrong_stage + both stages', () => {
    const r = validateActivityForFoalAge('longe_work', new Date()); // 2yo activity on newborn
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('wrong_stage');
    expect(r.requiredStage).toBe('two_year_old');
    expect(r.currentStage).toBe('newborn');
  });

  it('rejects when the horse has graduated (3+ years old)', () => {
    const r = validateActivityForFoalAge('imprinting', ago(110)); // > 104 weeks
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('graduated');
  });

  it('signals unknown_activity (caller defers, does not hard-reject)', () => {
    const r = validateActivityForFoalAge('some_day_based_enrichment', new Date());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unknown_activity');
  });
});
