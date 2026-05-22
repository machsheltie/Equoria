/**
 * Rare-trait roster sentinel (Equoria-6s4p5)
 *
 * Pure functions, no DB required.
 *
 * PURPOSE
 * -------
 * Locks the single-source-of-truth state of the four "rare" environmental
 * traits that historically drifted across three independent maps + a doc:
 *   - legendaryBloodline / legendary_bloodline (LIVE)
 *   - weatherImmunity     / weather_immunity    (LIVE via the snake spelling)
 *   - night_vision                              (LIVE via the snake spelling)
 *   - fire_resistance, water_phobia             (DOC-ONLY ghosts — no code)
 *
 * EVIDENCE OF "LIVE" (verified 2026-05-22, Equoria-6s4p5):
 *   The nightly cron (backend/services/cronJobs.mjs#evaluateFoalTraits)
 *   calls evaluateTraitRevelation (traitEvaluation.mjs), which can push the
 *   snake_case keys `weather_immunity` / `night_vision` onto a foal's
 *   epigeneticModifiers.positive/hidden and PERSISTS them via prisma.horse
 *   .update. The live competition scorer (logic/simulateCompetition.mjs)
 *   calls calculateTraitCompetitionImpact (traitCompetitionImpact.mjs),
 *   which reads horse.epigeneticModifiers.{positive,negative} names DIRECTLY
 *   against TRAIT_COMPETITION_EFFECTS — keyed `weather_immunity` /
 *   `night_vision`. So both are mechanically effective end-to-end.
 *
 * KNOWN CASING SPLIT (intentionally asserted, NOT silently "fixed" here):
 *   epigeneticTraits.mjs TRAIT_DEFINITIONS keys the trait camelCase
 *   (`weatherImmunity`) and that module's calculateEpigeneticTraits is NOT
 *   wired into the live birth path (only traitController /definitions +
 *   examples/tests). The live path uses the snake spelling. Unifying the
 *   spelling is a canonical-roster decision owned by Equoria-9o3n7 (and
 *   touches genotype/progression code outside this issue's lane), so this
 *   sentinel ASSERTS the current split rather than mutating live behavior.
 *   When 9o3n7 lands the canonical spelling, update this test in lockstep.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllTraitCompetitionEffects } from '../../../utils/traitCompetitionImpact.mjs';
import { getAllTraitEffects } from '../../../utils/traitEffects.mjs';
import { TRAIT_DEFINITIONS as EVALUATION_DEFS } from '../../../utils/traitEvaluation.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';

const GHOST_NAMES = ['fire_resistance', 'fireResistance', 'water_phobia', 'waterPhobia'];

describe('rare-trait roster — doc-only ghosts have zero code presence (Equoria-6s4p5)', () => {
  const competitionMap = getAllTraitCompetitionEffects();
  const effectsMap = getAllTraitEffects();
  const evaluationRare = EVALUATION_DEFS.rare;

  it.each(GHOST_NAMES)('ghost trait "%s" is absent from every code map (it is doc-only)', name => {
    expect(competitionMap[name]).toBeUndefined();
    expect(effectsMap[name]).toBeUndefined();
    expect(evaluationRare[name]).toBeUndefined();
    expect(getTraitDefinition(name)).toBeNull();
  });
});

describe('rare-trait roster — live snake_case traits resolve in every map on the live path (Equoria-6s4p5)', () => {
  const competitionMap = getAllTraitCompetitionEffects();
  const evaluationRare = EVALUATION_DEFS.rare;

  // The live emit→score path: traitEvaluation (emitter, persisted by cron)
  // and traitCompetitionImpact (scorer) MUST agree on the identical key.
  const LIVE_RARE_KEYS = ['weather_immunity', 'night_vision'];

  it.each(LIVE_RARE_KEYS)('live rare trait "%s" is both emittable and scorable under the SAME key', key => {
    // emittable: present in the revelation roster the cron consumes
    expect(evaluationRare[key]).toBeDefined();
    // scorable: present in the competition-effects map the scorer reads
    expect(competitionMap[key]).toBeDefined();
    expect(competitionMap[key].general.scoreModifier).toBeGreaterThan(0);
  });

  it('legendary_bloodline resolves snake_case in emitter + effects, but is camelCase in the competition map (documented split)', () => {
    const effectsMap = getAllTraitEffects();
    // Emitter (cron-persisted) + getCombinedTraitEffects scorer path — snake.
    expect(evaluationRare.legendary_bloodline).toBeDefined();
    expect(effectsMap.legendary_bloodline).toBeDefined();
    // calculateTraitCompetitionImpact map keys it camelCase — so a
    // cron-emitted `legendary_bloodline` MISSES this map's bonus (the
    // getCombinedTraitEffects competitionScoreModifier still applies). This
    // mismatch is the casing-fragmentation class Equoria-9o3n7 must unify.
    expect(competitionMap.legendaryBloodline).toBeDefined();
    expect(competitionMap.legendary_bloodline).toBeUndefined();
  });
});

describe('rare-trait roster — documents the camelCase/snake split pending Equoria-9o3n7', () => {
  it('weatherImmunity is camelCase ONLY in the dormant epigeneticTraits definitions, snake elsewhere on the live path', () => {
    // Dormant definition module (NOT wired to birth) — camelCase.
    expect(getTraitDefinition('weatherImmunity')).not.toBeNull();
    // Live scorer + emitter — snake_case.
    expect(getAllTraitCompetitionEffects().weather_immunity).toBeDefined();
    expect(EVALUATION_DEFS.rare.weather_immunity).toBeDefined();
    // The camelCase spelling is NOT on the live scorer path (this is the
    // documented drift — a camelCase weatherImmunity on a horse earns no
    // competition bonus). Asserting it pins the known gap for 9o3n7.
    expect(getAllTraitCompetitionEffects().weatherImmunity).toBeUndefined();
  });
});
