/**
 * Trait reveal engine — the per-day rule (owner ruling 2026-10-26, q98; Equoria-2d55z).
 *
 * Pure tests of applyTraitDay and the settings gate. The numbers here are test
 * values only; the owner has not ruled the real ones.
 */

import { describe, it, expect } from '@jest/globals';
import { applyTraitDay, revealSettingsReady, runNightlyTraitReveal } from '../services/traitRevealEngine.mjs';
import { traitRevealSettingsPendingOwner } from '../config/traitRevealSettings.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const byRarity = (common, uncommon, rare, ultraRare, legendary) => ({
  common,
  uncommon,
  rare,
  ultraRare,
  legendary,
});

const testSettings = Object.freeze({
  revealDays: { positive: byRarity(2, 4, 6, 8, 10), negative: byRarity(2, 4, 6, 8, 10) },
  switchOffDays: { positive: byRarity(3, 4, 6, 8, 10), negative: byRarity(3, 4, 6, 8, 10) },
  dailyChance: byRarity(0.5, 0.5, 0.5, 0.5, 0.5),
  lastDayOfLife: 21,
  traitRarity: {
    brave: 'common',
    confident: 'common',
    legendaryBloodline: 'rare',
    fearful: 'common',
    fragile: 'common',
    resilient: 'common',
    insecure: null,
  },
});

const always = () => 0;
const never = () => 0.999;
const empty = () => ({ positive: [], negative: [], hidden: [] });

describe('revealSettingsReady — the engine refuses unruled numbers', () => {
  it('the shipped settings are all pending the owner, so the engine is not ready', () => {
    expect(revealSettingsReady(traitRevealSettingsPendingOwner)).toBe(false);
  });

  it('complete test settings are ready; one missing number makes them not ready', () => {
    expect(revealSettingsReady(testSettings)).toBe(true);
    const missing = {
      ...testSettings,
      dailyChance: { ...testSettings.dailyChance, legendary: null },
    };
    expect(revealSettingsReady(missing)).toBe(false);
    expect(revealSettingsReady({ ...testSettings, lastDayOfLife: null })).toBe(false);
    expect(revealSettingsReady({ ...testSettings, lastDayOfLife: Infinity })).toBe(true);
  });

  it('runNightlyTraitReveal with the shipped settings touches nothing and says why', async () => {
    const result = await runNightlyTraitReveal({ horseIds: [] });
    expect(result).toEqual({
      skipped: 'settingsPendingOwner',
      horsesEvaluated: 0,
      changes: 0,
      errors: 0,
    });
  });
});

describe('applyTraitDay — a groomed day', () => {
  it('reveals a hidden positive trait once its grooming-day count is reached and the roll succeeds', () => {
    const traits = { ...empty(), hidden: ['brave', 'fearful'] };
    const { traits: next, changes } = applyTraitDay(
      traits,
      { groomed: true, groomedDays: 2, neglectedDays: 0 },
      testSettings,
      always,
    );
    expect(next.positive).toEqual(['brave']);
    expect(next.hidden).toEqual(['fearful']);
    expect(changes).toEqual([{ trait: 'brave', change: 'revealed', polarity: 'positive' }]);
  });

  it('does not reveal before the count is reached, even with a winning roll', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    const { traits: next, changes } = applyTraitDay(
      traits,
      { groomed: true, groomedDays: 1, neglectedDays: 0 },
      testSettings,
      always,
    );
    expect(next.hidden).toEqual(['brave']);
    expect(changes).toEqual([]);
  });

  it('is a chance, not a guarantee: a losing roll leaves the trait hidden', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    const { changes } = applyTraitDay(traits, { groomed: true, groomedDays: 9, neglectedDays: 0 }, testSettings, never);
    expect(changes).toEqual([]);
  });

  it('a rarer positive trait needs more grooming days than a common one', () => {
    const traits = { ...empty(), hidden: ['brave', 'legendaryBloodline'] };
    const early = applyTraitDay(traits, { groomed: true, groomedDays: 3, neglectedDays: 0 }, testSettings, always);
    expect(early.traits.positive).toEqual(['brave']);
    expect(early.traits.hidden).toEqual(['legendaryBloodline']);
    const later = applyTraitDay(
      early.traits,
      { groomed: true, groomedDays: 6, neglectedDays: 0 },
      testSettings,
      always,
    );
    expect(later.traits.positive).toEqual(['brave', 'legendaryBloodline']);
  });

  it('switches an active negative trait off once enough grooming days have passed', () => {
    const traits = { ...empty(), negative: ['fragile'] };
    const before = applyTraitDay(traits, { groomed: true, groomedDays: 2, neglectedDays: 0 }, testSettings, always);
    expect(before.traits.negative).toEqual(['fragile']);
    const { traits: next, changes } = applyTraitDay(
      traits,
      { groomed: true, groomedDays: 3, neglectedDays: 0 },
      testSettings,
      always,
    );
    expect(next.negative).toEqual([]);
    expect(next.hidden).toEqual(['fragile']);
    expect(changes).toEqual([{ trait: 'fragile', change: 'switchedOff', polarity: 'negative' }]);
  });

  it('never reveals a negative trait or switches off a positive one', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: ['fearful'] };
    const { changes } = applyTraitDay(
      traits,
      { groomed: true, groomedDays: 20, neglectedDays: 20 },
      testSettings,
      always,
    );
    expect(changes).toEqual([]);
  });
});

describe('applyTraitDay — a neglected day', () => {
  it('reveals a hidden negative trait after enough neglect days and switches an active positive off', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: ['fearful', 'brave'] };
    const { traits: next, changes } = applyTraitDay(
      traits,
      { groomed: false, groomedDays: 10, neglectedDays: 3 },
      testSettings,
      always,
    );
    expect(next).toEqual({ positive: [], negative: ['fearful'], hidden: ['brave', 'resilient'] });
    expect(changes).toEqual([
      { trait: 'fearful', change: 'revealed', polarity: 'negative' },
      { trait: 'resilient', change: 'switchedOff', polarity: 'positive' },
    ]);
  });

  it('counts neglect days for neglect rules, not grooming days', () => {
    const traits = { ...empty(), hidden: ['fearful'] };
    const { changes } = applyTraitDay(
      traits,
      { groomed: false, groomedDays: 15, neglectedDays: 1 },
      testSettings,
      always,
    );
    expect(changes).toEqual([]);
  });
});

describe('applyTraitDay — traits outside the rule are never touched', () => {
  it('leaves a trait with no ruled rarity, or off the roster, exactly where it is', () => {
    const traits = { positive: ['intelligent'], negative: [], hidden: ['insecure', 'bold'] };
    const groomed = applyTraitDay(traits, { groomed: true, groomedDays: 20, neglectedDays: 0 }, testSettings, always);
    const neglected = applyTraitDay(
      traits,
      { groomed: false, groomedDays: 0, neglectedDays: 20 },
      testSettings,
      always,
    );
    expect(groomed.changes).toEqual([]);
    expect(neglected.changes).toEqual([]);
    expect(neglected.traits).toEqual(traits);
  });

  it('never invents a trait the horse does not carry', () => {
    const { traits: next } = applyTraitDay(
      empty(),
      { groomed: true, groomedDays: 20, neglectedDays: 0 },
      testSettings,
      always,
    );
    expect(next).toEqual(empty());
  });
});

describe('applyTraitDay — seeded rolls are reproducible and land near the chance', () => {
  it('the same seed gives the same outcome; over many horses about half reveal at 0.5', () => {
    const run = seed => {
      const rng = seededRng(seed);
      let revealed = 0;
      for (let i = 0; i < 2000; i++) {
        const { changes } = applyTraitDay(
          { ...empty(), hidden: ['brave'] },
          { groomed: true, groomedDays: 5, neglectedDays: 0 },
          testSettings,
          rng,
        );
        revealed += changes.length;
      }
      return revealed;
    };
    expect(run(7)).toBe(run(7));
    const share = run(7) / 2000;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
});
