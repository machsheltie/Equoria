/**
 * Trait reveal engine — the per-day rule (owner rulings 2026-10-26, q98, and
 * 2026-10-27, q113-q118; Equoria-2d55z).
 *
 * Pure tests of applyTraitDay and the shipped settings. The numbers are the
 * owner's (gates 3/6/12/16/19, 25% a day, first 21 days). The per-trait rarity
 * and polarity are test values: the owner has not ruled them yet.
 *
 * Old contract (2026-10-26, numbers pending): every number was null, polarity
 * was hard-coded for the old roster, and a trait rolled on the day its count
 * was reached. The owner ruled on 2026-10-27 that rolls start on the
 * qualifying days after the gate (q113) and replaced the roster (q117).
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyTraitDay,
  revealSettingsReady,
  ruledTraits,
  runNightlyTraitReveal,
} from '../services/traitRevealEngine.mjs';
import { traitRevealSettings } from '../config/traitRevealSettings.mjs';
import { traitRosterIds } from '../../../utils/epigeneticTraits.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const settings = Object.freeze({
  ...traitRevealSettings,
  traitPolarity: {
    ...traitRevealSettings.traitPolarity,
    brave: 'positive',
    confident: 'positive',
    adaptable: 'positive',
    heart: 'positive',
    resilient: 'positive',
    fearful: 'negative',
    fragile: 'negative',
    insecure: 'negative',
  },
  traitRarity: {
    ...traitRevealSettings.traitRarity,
    brave: 'common',
    confident: 'uncommon',
    adaptable: 'rare',
    heart: 'legendary',
    resilient: 'common',
    fearful: 'common',
    fragile: 'common',
    insecure: null,
  },
});

const always = () => 0;
const never = () => 0.999;
const empty = () => ({ positive: [], negative: [], hidden: [] });
const groomedDay = groomedDays => ({ groomed: true, groomedDays, neglectedDays: 0 });
const neglectedDay = neglectedDays => ({ groomed: false, groomedDays: 0, neglectedDays });

describe('traitRevealSettings — the owner numbers', () => {
  it('holds the ruled gates, chance and window, and is ready', () => {
    const gates = { common: 3, uncommon: 6, rare: 12, ultraRare: 16, legendary: 19 };
    expect(traitRevealSettings.revealDays).toEqual({ positive: gates, negative: gates });
    expect(traitRevealSettings.switchOffDays).toEqual({ positive: gates, negative: gates });
    expect(Object.values(traitRevealSettings.dailyChance)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);
    expect(traitRevealSettings.lastDayOfLife).toBe(21);
    expect(revealSettingsReady(traitRevealSettings)).toBe(true);
  });

  it('has a rarity and polarity slot for exactly the 20 roster traits, none ruled yet', () => {
    expect(Object.keys(traitRevealSettings.traitRarity)).toEqual([...traitRosterIds]);
    expect(Object.keys(traitRevealSettings.traitPolarity)).toEqual([...traitRosterIds]);
    expect(ruledTraits(traitRevealSettings).size).toBe(0);
  });

  it('one missing number makes settings not ready', () => {
    expect(
      revealSettingsReady({
        ...settings,
        dailyChance: { ...settings.dailyChance, legendary: null },
      }),
    ).toBe(false);
    expect(revealSettingsReady({ ...settings, lastDayOfLife: null })).toBe(false);
  });

  it('runNightlyTraitReveal with the shipped settings touches nothing and says why', async () => {
    const result = await runNightlyTraitReveal({ horseIds: [] });
    expect(result).toEqual({ skipped: 'noTraitsRuled', horsesEvaluated: 0, changes: 0, errors: 0 });
  });
});

describe('applyTraitDay — the ladder on groomed days', () => {
  it('the gate day opens the gate but does not roll; the next groomed day does', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    expect(applyTraitDay(traits, groomedDay(3), settings, always).changes).toEqual([]);
    const { traits: next, changes } = applyTraitDay(traits, groomedDay(4), settings, always);
    expect(next.positive).toEqual(['brave']);
    expect(next.hidden).toEqual([]);
    expect(changes).toEqual([{ trait: 'brave', change: 'revealed', polarity: 'positive' }]);
  });

  it('each rarity rolls only after its own gate: 3, 6, 12, 19 groomed days', () => {
    const rolled = count =>
      applyTraitDay(
        { ...empty(), hidden: ['adaptable', 'brave', 'confident', 'heart'] },
        groomedDay(count),
        settings,
        always,
      ).changes.map(c => c.trait);
    expect(rolled(3)).toEqual([]);
    expect(rolled(4)).toEqual(['brave']);
    expect(rolled(6)).toEqual(['brave']);
    expect(rolled(7)).toEqual(['brave', 'confident']);
    expect(rolled(12)).toEqual(['brave', 'confident']);
    // The commoner traits keep rolling once a rarer gate opens.
    expect(rolled(13)).toEqual(['adaptable', 'brave', 'confident']);
    expect(rolled(19)).toEqual(['adaptable', 'brave', 'confident']);
    expect(rolled(20)).toEqual(['adaptable', 'brave', 'confident', 'heart']);
  });

  it('is a chance, not a guarantee: a losing roll leaves the trait hidden', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    expect(applyTraitDay(traits, groomedDay(15), settings, never).changes).toEqual([]);
  });

  it('switches any active negative trait off on groomed days after its gate', () => {
    const traits = { ...empty(), negative: ['fragile'] };
    expect(applyTraitDay(traits, groomedDay(3), settings, always).traits.negative).toEqual(['fragile']);
    const { traits: next, changes } = applyTraitDay(traits, groomedDay(4), settings, always);
    expect(next.negative).toEqual([]);
    expect(next.hidden).toEqual(['fragile']);
    expect(changes).toEqual([{ trait: 'fragile', change: 'switchedOff', polarity: 'negative' }]);
  });

  it('a groomed day never reveals a negative or switches off a positive', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: ['fearful'] };
    expect(applyTraitDay(traits, groomedDay(20), settings, always).changes).toEqual([]);
  });
});

describe('applyTraitDay — neglected days mirror grooming', () => {
  it('reveals a hidden negative and switches an active positive off after the gate', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: ['fearful', 'brave'] };
    expect(applyTraitDay(traits, neglectedDay(3), settings, always).changes).toEqual([]);
    const { traits: next, changes } = applyTraitDay(traits, neglectedDay(4), settings, always);
    expect(next).toEqual({ positive: [], negative: ['fearful'], hidden: ['brave', 'resilient'] });
    expect(changes).toEqual([
      { trait: 'fearful', change: 'revealed', polarity: 'negative' },
      { trait: 'resilient', change: 'switchedOff', polarity: 'positive' },
    ]);
  });

  it('counts neglected days for neglect, not groomed days', () => {
    const traits = { ...empty(), hidden: ['fearful'] };
    const { changes } = applyTraitDay(traits, { groomed: false, groomedDays: 15, neglectedDays: 1 }, settings, always);
    expect(changes).toEqual([]);
  });
});

describe('applyTraitDay — traits outside the rule are never touched', () => {
  it('leaves a trait with no ruled rarity or polarity, or off the roster, exactly where it is', () => {
    const traits = { positive: ['curious', 'calm'], negative: [], hidden: ['insecure', 'bold'] };
    const groomed = applyTraitDay(traits, groomedDay(20), settings, always);
    const neglected = applyTraitDay(traits, neglectedDay(20), settings, always);
    expect(groomed.changes).toEqual([]);
    expect(neglected.changes).toEqual([]);
    expect(neglected.traits).toEqual(traits);
  });

  it('never invents a trait the horse does not carry', () => {
    expect(applyTraitDay(empty(), groomedDay(20), settings, always).traits).toEqual(empty());
  });
});

describe('applyTraitDay — seeded rolls are reproducible and land near 25%', () => {
  it('the same seed gives the same outcome; about a quarter of qualifying days reveal', () => {
    const run = seed => {
      const rng = seededRng(seed);
      let revealed = 0;
      for (let i = 0; i < 4000; i++) {
        revealed += applyTraitDay({ ...empty(), hidden: ['brave'] }, groomedDay(5), settings, rng).changes.length;
      }
      return revealed;
    };
    expect(run(7)).toBe(run(7));
    const share = run(7) / 4000;
    expect(share).toBeGreaterThan(0.22);
    expect(share).toBeLessThan(0.28);
  });
});
