/**
 * Rare-trait roster sentinel (Equoria-6s4p5, updated by Equoria-3hl8c + 9o3n7.5 §E)
 *
 * Pure functions, no DB required.
 *
 * PURPOSE
 * -------
 * Locks the CANONICAL single-source-of-truth state of the "rare" traits after
 * the 9o3n7 casing+roster consolidation:
 *
 *   - legendaryBloodline — the ONLY surviving rare trait. ONE camelCase
 *     spelling now resolves identically across all four maps (traitEffects,
 *     traitCompetitionImpact, epigeneticTraits TRAIT_DEFINITIONS, and
 *     traitEvaluation RARE reveals). The previous `legendary_bloodline`
 *     snake_case fragmentation is gone (Equoria-3hl8c).
 *   - weatherImmunity / nightVision / fireResistance / waterPhobia — these
 *     DO NOT exist in the game (user decision 2026-05-26, spec §E). Every
 *     reference (both casings) was removed from ALL four maps + docs
 *     (Equoria-9o3n7.5). No new fantasy/environmental traits replace them.
 *
 * This sentinel is positive-failing: it FAILS if any dropped name returns to
 * any map, or if legendaryBloodline ever splits casing again.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllTraitCompetitionEffects } from '../../../utils/traitCompetitionImpact.mjs';
import { getAllTraitEffects } from '../../../utils/traitEffects.mjs';
import { TRAIT_DEFINITIONS as EVALUATION_DEFS } from '../../../utils/traitEvaluation.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';

// All four dropped names, both casings — must be absent everywhere.
const DROPPED_NAMES = [
  'weather_immunity',
  'weatherImmunity',
  'night_vision',
  'nightVision',
  'fire_resistance',
  'fireResistance',
  'water_phobia',
  'waterPhobia',
];

describe('rare-trait roster — dropped traits have ZERO code presence (Equoria-9o3n7.5 §E)', () => {
  const competitionMap = getAllTraitCompetitionEffects();
  const effectsMap = getAllTraitEffects();
  const evaluationRare = EVALUATION_DEFS.rare;

  it.each(DROPPED_NAMES)('dropped trait "%s" is absent from every code map', name => {
    expect(competitionMap[name]).toBeUndefined();
    expect(effectsMap[name]).toBeUndefined();
    expect(evaluationRare[name]).toBeUndefined();
    expect(getTraitDefinition(name)).toBeNull();
  });
});

describe('rare-trait roster — legendaryBloodline is the single canonical rare trait (Equoria-3hl8c)', () => {
  const competitionMap = getAllTraitCompetitionEffects();
  const effectsMap = getAllTraitEffects();
  const evaluationRare = EVALUATION_DEFS.rare;

  it('legendaryBloodline resolves under ONE camelCase key in all four maps', () => {
    expect(effectsMap.legendaryBloodline).toBeDefined();
    expect(competitionMap.legendaryBloodline).toBeDefined();
    expect(evaluationRare.legendaryBloodline).toBeDefined();
    expect(getTraitDefinition('legendaryBloodline')).not.toBeNull();
    // The competition effect is a real positive bonus.
    expect(competitionMap.legendaryBloodline.general.scoreModifier).toBeGreaterThan(0);
  });

  it('the snake_case legendary_bloodline spelling is GONE from every map', () => {
    expect(effectsMap.legendary_bloodline).toBeUndefined();
    expect(competitionMap.legendary_bloodline).toBeUndefined();
    expect(evaluationRare.legendary_bloodline).toBeUndefined();
    expect(getTraitDefinition('legendary_bloodline')).toBeNull();
  });
});

describe('rare-trait roster — every rare trait is legendary-rarity (Equoria-4uop7 dead-branch guard)', () => {
  const evaluationRare = EVALUATION_DEFS.rare;

  // User decision 2026-05-26: there is NO rare tier below legendary. The
  // "non-legendary rare -> positive (visible) reveal" branch in
  // traitEvaluation.evaluateTraitRevelation was removed accordingly; the rare
  // reveal loop now unconditionally pushes to newTraits.hidden. That is correct
  // ONLY while every rare-tier trait is rarity:'legendary' (legendary traits are
  // always hidden until discovered). This sentinel makes that invariant
  // load-bearing — adding a non-legendary rare trait fails here, forcing a
  // deliberate decision to restore the visible-reveal branch rather than
  // silently routing a "rare" trait through the hidden-only path.
  it('TRAIT_DEFINITIONS.rare is non-empty and every entry is rarity:"legendary"', () => {
    const entries = Object.entries(evaluationRare);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, def] of entries) {
      expect(def.rarity).toBe('legendary');
    }
  });
});
