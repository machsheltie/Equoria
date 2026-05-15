/**
 * Equoria-u0mz: Sentinel integration test — temperament modifier surfaces
 * through runEnhancedCompetition pipeline.
 *
 * Closes the gap identified in OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive
 * test required) and §3 (adjacent-locations check). The 30 unit tests in
 * temperamentCompetitionModifiers.test.mjs cover calculateCompetitionScore() in
 * isolation, but did not exercise the controller pipeline — which is why the
 * Equoria-qszs defect (production callers omitting show.showType) was not caught
 * by unit tests.
 *
 * This test plants horses with temperaments through the actual
 * runEnhancedCompetition() function (the pre-DB scoring path used by
 * enterAndRunShow) and asserts:
 *   1. show.showType='ridden' applies the riddenModifier from
 *      TEMPERAMENT_COMPETITION_MODIFIERS.
 *   2. show.showType='conformation' applies the conformationModifier — proving
 *      that the qszs fix actually flows show.showType through to the scorer.
 *   3. Pre-qszs-fix sentinel: this test would FAIL if runEnhancedCompetition
 *      reverted to calling calculateCompetitionScore(horse, show.discipline)
 *      without show.showType, because Calm-conformation (+5%) and Calm-ridden
 *      (+2%) produce distinct scores; default-to-ridden would make them
 *      identical.
 *
 * Math.random is stubbed to 0.5 to eliminate the ±9% luck term so assertions
 * are exact (per the same DI pattern used in temperamentCompetitionModifiers
 * unit tests, but here we cannot inject a luckFn — runEnhancedCompetition uses
 * the default).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { runEnhancedCompetition } from '../controllers/competitionController.mjs';

// Racing horse with speed=stamina=intelligence=30 → baseScore = 90.
// Identical to the helper in temperamentCompetitionModifiers.test.mjs so the
// expected math is directly comparable to those unit assertions.
let _idSeq = 0;
function makeRacingHorse(overrides = {}) {
  return {
    id: ++_idSeq,
    name: `Horse-${_idSeq}`,
    speed: 30,
    stamina: 30,
    intelligence: 30,
    temperament: null,
    epigeneticModifiers: { positive: [], negative: [] },
    ...overrides,
  };
}

describe('Equoria-u0mz — runEnhancedCompetition: temperament modifier surfaces via show.showType', () => {
  let randomSpy;

  beforeEach(() => {
    // 0.5 → luckModifier = 0.5*0.18 - 0.09 = 0 (no luck adjustment)
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  // ─── show.showType='ridden' ────────────────────────────────────────────────

  it('Calm horse, ridden show: applies riddenModifier (+2%) → Math.round(90 * 1.02) = 92', () => {
    const horse = makeRacingHorse({ temperament: 'Calm' });
    const show = { discipline: 'Racing', showType: 'ridden' };

    const [result] = runEnhancedCompetition([horse], show);

    expect(result.score).toBe(92);
  });

  it('Calm horse, conformation show: applies conformationModifier (+5%) → Math.round(90 * 1.05) = 95', () => {
    const horse = makeRacingHorse({ temperament: 'Calm' });
    const show = { discipline: 'Racing', showType: 'conformation' };

    const [result] = runEnhancedCompetition([horse], show);

    expect(result.score).toBe(95);
  });

  it('SENTINEL (Equoria-qszs): Calm ridden ≠ Calm conformation through the pipeline', () => {
    // This is the test that would FAIL pre-qszs-fix: if runEnhancedCompetition
    // dropped show.showType, both calls would default to ridden and both scores
    // would be 92. The fix makes them diverge to 92 vs 95.
    const horseRidden = makeRacingHorse({ temperament: 'Calm' });
    const horseConformation = makeRacingHorse({ temperament: 'Calm' });

    const [rRidden] = runEnhancedCompetition([horseRidden], { discipline: 'Racing', showType: 'ridden' });
    const [rConformation] = runEnhancedCompetition([horseConformation], {
      discipline: 'Racing',
      showType: 'conformation',
    });

    expect(rRidden.score).toBe(92);
    expect(rConformation.score).toBe(95);
    expect(rConformation.score).toBeGreaterThan(rRidden.score);
  });

  it('Nervous horse, conformation show: applies conformationModifier (-5%) → Math.round(90 * 0.95) = 86', () => {
    const horse = makeRacingHorse({ temperament: 'Nervous' });
    const show = { discipline: 'Racing', showType: 'conformation' };

    const [result] = runEnhancedCompetition([horse], show);

    expect(result.score).toBe(86);
  });

  it('Bold horse, ridden show: applies riddenModifier (+5%) → Math.round(90 * 1.05) = 95', () => {
    const horse = makeRacingHorse({ temperament: 'Bold' });
    const show = { discipline: 'Racing', showType: 'ridden' };

    const [result] = runEnhancedCompetition([horse], show);

    expect(result.score).toBe(95);
  });

  it('null temperament, any showType: no modifier applied → score = baseScore (90)', () => {
    const horse = makeRacingHorse({ temperament: null });

    const [riddenResult] = runEnhancedCompetition([horse], { discipline: 'Racing', showType: 'ridden' });
    const [conformationResult] = runEnhancedCompetition([makeRacingHorse({ temperament: null })], {
      discipline: 'Racing',
      showType: 'conformation',
    });

    expect(riddenResult.score).toBe(90);
    expect(conformationResult.score).toBe(90);
  });

  it('show.showType undefined: defaults to ridden behaviour (back-compat)', () => {
    // Guards against the case where a show row was created before showType was
    // populated. runEnhancedCompetition should not crash and should default
    // through calculateCompetitionScore's ridden fallback.
    const horse = makeRacingHorse({ temperament: 'Calm' });
    const show = { discipline: 'Racing' }; // no showType field

    const [result] = runEnhancedCompetition([horse], show);

    // Defaults to ridden modifier (+2%) → 92.
    expect(result.score).toBe(92);
  });

  it('multi-horse competition mixed-temperament conformation show: correct rankings', () => {
    const calm = makeRacingHorse({ temperament: 'Calm', name: 'Calm' }); // +5% → 95
    const nervous = makeRacingHorse({ temperament: 'Nervous', name: 'Nervous' }); // -5% → 86
    const neutral = makeRacingHorse({ temperament: null, name: 'Neutral' }); // 0% → 90

    const results = runEnhancedCompetition([calm, nervous, neutral], {
      discipline: 'Racing',
      showType: 'conformation',
    });

    // Sorted desc by score: Calm > Neutral > Nervous.
    expect(results[0].name).toBe('Calm');
    expect(results[0].score).toBe(95);
    expect(results[0].placement).toBe('1st');

    expect(results[1].name).toBe('Neutral');
    expect(results[1].score).toBe(90);
    expect(results[1].placement).toBe('2nd');

    expect(results[2].name).toBe('Nervous');
    expect(results[2].score).toBe(86);
    expect(results[2].placement).toBe('3rd');
  });
});
