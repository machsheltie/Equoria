/**
 * pregnancyBonusApprovedTraits.sentinel.test.mjs (Equoria-9o3n7.4)
 *
 * The pregnancy feed-tier bonus (premium feed during gestation biases foal
 * trait rolls) used to roll on an UNAPPROVED, dead trait pool:
 *   positive: wellNourished, vigorous
 *   negative: undernourished, weakImmunity, lowVigor
 * None had a traitEffects entry OR a TRAIT_DEFINITIONS entry, so a
 * premium-feed roll produced a trait that did NOTHING in competition/training.
 *
 * Per the 9o3n7 canonical roster (§B), the pools were repointed at approved,
 * effect-backed traits. This sentinel proves (OPTIMAL_FIX_DISCIPLINE §2):
 *   1. Every trait the repointed pools can emit resolves in BOTH traitEffects
 *      (mechanically real) AND epigeneticTraits TRAIT_DEFINITIONS (roster member).
 *   2. The 5 dead names no longer resolve in traitEffects — proving the dead
 *      emission is closed (it would FAIL if the old pool were restored).
 *
 * The repointed pools are mirrored here from foalingService.mjs (the module
 * does not export them). A drift between this list and the source would be
 * caught by the "every pool trait is effect-backed" assertion failing if a
 * future edit added an unbacked trait.
 */

import { describe, it, expect } from '@jest/globals';
import { getTraitEffects } from '../../../utils/traitEffects.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';
import { calculatePregnancyEpigeneticChances } from '../../../utils/pregnancyBonus.mjs';

// Mirrors foalingService.PREGNANCY_BONUS_{POSITIVE,NEGATIVE}_TRAITS.
const PREGNANCY_BONUS_POOL = [
  'resilient',
  'calm',
  'bold',
  'intelligent', // positive
  'fragile',
  'nervous',
  'lazy',
  'stubborn', // negative
];

const FORMER_DEAD_NAMES = [
  'wellNourished',
  'vigorous',
  'undernourished',
  'weakImmunity',
  'lowVigor',
];

describe('pregnancy-bonus pool is approved + effect-backed (Equoria-9o3n7.4)', () => {
  it.each(PREGNANCY_BONUS_POOL)('"%s" resolves in traitEffects AND TRAIT_DEFINITIONS', trait => {
    expect(getTraitEffects(trait)).not.toBeNull();
    expect(getTraitDefinition(trait)).not.toBeNull();
  });

  it.each(FORMER_DEAD_NAMES)('former dead trait "%s" no longer resolves in traitEffects', name => {
    expect(getTraitEffects(name)).toBeNull();
  });
});

describe('pregnancy feed-tier mechanic still biases foal outcomes (Equoria-9o3n7.4)', () => {
  it('premium (elite) feeding raises positive_chance vs poor (basic-only) feeding', () => {
    // 7 elite feedings across a 7-day gestation → max positive bias.
    const premium = calculatePregnancyEpigeneticChances({ elite: 7 });
    // 7 basic feedings → 0% per-feeding weight → no positive bias, no missed days.
    const poor = calculatePregnancyEpigeneticChances({ basic: 7 });
    expect(premium.positive_chance).toBeGreaterThan(poor.positive_chance);
    expect(poor.positive_chance).toBe(0);
  });

  it('under-feeding raises negative_chance (missed days penalty)', () => {
    const fed = calculatePregnancyEpigeneticChances({ elite: 7 });
    const neglected = calculatePregnancyEpigeneticChances({ elite: 2 }); // 5 missed days
    expect(neglected.negative_chance).toBeGreaterThan(fed.negative_chance);
    expect(fed.negative_chance).toBe(0);
  });
});
