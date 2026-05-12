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
import {
  hasAlreadyCompletedFoalTaskToday,
  calculateGroomInteractionEffects,
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
} from '../../utils/groomSystem.mjs';
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

// ── calculateGroomInteractionEffects — branch coverage (Equoria-jkht) ─────────
//
// Branch map:
//   GROOM_SPECIALTIES[groom.speciality] || GROOM_SPECIALTIES.general  → known/unknown
//   SKILL_LEVELS[groom.skillLevel]       || SKILL_LEVELS.intermediate  → known/unknown
//   PERSONALITY_TRAITS[groom.personality]|| PERSONALITY_TRAITS.gentle  → known/unknown
//   typeof groom.sessionRate === 'number'                              → true/false
//   errorOccurred                                                       → random; tested via output shape
//   quality: errorOccurred / bondingChange>=7 / >=4 / else            → random; tested via valid set
//   catch                                                              → null groom throws

describe('calculateGroomInteractionEffects()', () => {
  // Minimal valid foal (no DB calls — function is synchronous pure calc)
  const foal = { id: 1, bondScore: 50, temperament: null };

  // Helper: build a groom object with all known keys
  function makeGroom(overrides = {}) {
    return {
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      personality: 'gentle',
      experience: 0,
      sessionRate: 20,
      ...overrides,
    };
  }

  // ── return shape ────────────────────────────────────────────────────────────

  it('returns an object with expected fields for a valid groom', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result).toHaveProperty('bondingChange');
    expect(result).toHaveProperty('stressChange');
    expect(result).toHaveProperty('cost');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('errorOccurred');
    expect(result).toHaveProperty('successRate');
    expect(result).toHaveProperty('modifiers');
  });

  it('bondingChange is within [0, 10]', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result.bondingChange).toBeGreaterThanOrEqual(0);
    expect(result.bondingChange).toBeLessThanOrEqual(10);
  });

  it('stressChange is within [-10, 5]', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(result.stressChange).toBeGreaterThanOrEqual(-10);
    expect(result.stressChange).toBeLessThanOrEqual(5);
  });

  it('quality is one of the four expected values', () => {
    const result = calculateGroomInteractionEffects(makeGroom(), foal, 'grooming', 60);
    expect(['excellent', 'good', 'fair', 'poor']).toContain(result.quality);
  });

  // ── specialty fallback branch ───────────────────────────────────────────────

  it('falls back to GROOM_SPECIALTIES.general for unknown speciality', () => {
    const result = calculateGroomInteractionEffects(
      makeGroom({ speciality: 'unicornWhisperer' }),
      foal,
      'grooming',
      60,
    );
    // The general specialty has bondingModifier=1.0; modifiers.specialty reflects it
    expect(result.modifiers.specialty).toBe(GROOM_SPECIALTIES.general.bondingModifier);
  });

  it('uses GROOM_SPECIALTIES.foalCare for foalCare speciality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ speciality: 'foalCare' }), foal, 'grooming', 60);
    expect(result.modifiers.specialty).toBe(GROOM_SPECIALTIES.foalCare.bondingModifier);
  });

  // ── skillLevel fallback branch ──────────────────────────────────────────────

  it('falls back to SKILL_LEVELS.intermediate for unknown skillLevel', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ skillLevel: 'mythic' }), foal, 'grooming', 60);
    expect(result.modifiers.skillLevel).toBe(SKILL_LEVELS.intermediate.bondingModifier);
  });

  it('uses SKILL_LEVELS.expert for expert skillLevel', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ skillLevel: 'expert' }), foal, 'grooming', 60);
    expect(result.modifiers.skillLevel).toBe(SKILL_LEVELS.expert.bondingModifier);
  });

  // ── personality fallback branch ─────────────────────────────────────────────

  it('falls back to PERSONALITY_TRAITS.gentle for unknown personality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ personality: 'telepathic' }), foal, 'grooming', 60);
    expect(result.modifiers.personality).toBe(PERSONALITY_TRAITS.gentle.bondingModifier);
  });

  it('uses PERSONALITY_TRAITS.strict for strict personality', () => {
    const result = calculateGroomInteractionEffects(makeGroom({ personality: 'strict' }), foal, 'grooming', 60);
    expect(result.modifiers.personality).toBe(PERSONALITY_TRAITS.strict.bondingModifier);
  });

  // ── sessionRate type branch ─────────────────────────────────────────────────

  it('uses numeric sessionRate when provided', () => {
    const groom = makeGroom({ sessionRate: 30, skillLevel: 'intermediate', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    // cost = 30 * intermediate.costModifier * (1 + (60-60)/300) = 30 * 1 * 1 = 30
    expect(result.cost).toBeCloseTo(30, 1);
  });

  it('defaults sessionRate to 18.0 when not a number (string)', () => {
    const groom = makeGroom({ sessionRate: 'free', skillLevel: 'intermediate', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    // cost = 18 * intermediate.costModifier * 1 = 18
    expect(result.cost).toBeCloseTo(18, 1);
  });

  it('defaults sessionRate to 18.0 when undefined', () => {
    const groom = makeGroom({ skillLevel: 'intermediate', experience: 0 });
    delete groom.sessionRate;
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 60);
    expect(result.cost).toBeCloseTo(18, 1);
  });

  // ── experience bonus branch ─────────────────────────────────────────────────

  it('applies experience bonus to bondingChange (+1 per 5 years)', () => {
    const withExp = makeGroom({ experience: 5, skillLevel: 'master' });
    const noExp = makeGroom({ experience: 0, skillLevel: 'master' });
    const resultWith = calculateGroomInteractionEffects(withExp, foal, 'grooming', 60);
    const resultNo = calculateGroomInteractionEffects(noExp, foal, 'grooming', 60);
    // modifiers.experience should reflect the experienceBonus
    expect(resultWith.modifiers.experience).toBe(1); // Math.floor(5/5)=1
    expect(resultNo.modifiers.experience).toBe(0); // Math.floor(0/5)=0
  });

  // ── quality = 'fair' branch (line 598) — very short duration → bondingChange < 4 ─

  it("quality is 'fair' (or 'poor' on rare error) when duration is extremely short", () => {
    // duration=1 → baseBondingChange=0 → bondingChange=0 < 4
    // master errorChance=0.01 → 99% no error → quality='fair' (line 598)
    const groom = makeGroom({ skillLevel: 'master', experience: 0 });
    const result = calculateGroomInteractionEffects(groom, foal, 'grooming', 1);
    expect(['fair', 'poor']).toContain(result.quality);
  });

  // ── catch path ──────────────────────────────────────────────────────────────

  it('throws when groom is null (catch re-throws)', () => {
    expect(() => calculateGroomInteractionEffects(null, foal, 'grooming', 60)).toThrow();
  });
});
