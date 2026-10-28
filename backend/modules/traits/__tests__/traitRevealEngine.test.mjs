/**
 * Trait reveal engine — the per-day rule (owner rulings 2026-10-26, q98, and
 * 2026-10-27, q113-q118, q134, q135, q139; Equoria-2d55z).
 *
 * Pure tests of applyTraitDay and the shipped settings, which now carry every
 * owner number: gates 3/6/12/16/19, 25% a day, first 21 days, and each roster
 * trait's rarity and polarity.
 *
 * Old contracts and the rulings that changed them:
 *   - 2026-10-27 morning: a trait first rolled on the qualifying day AFTER its
 *     gate (the gate day only opened it). Owner ruling 2026-10-27 (q139): the
 *     day a gate opens also rolls.
 *   - 2026-10-27 morning: no roster trait had a rarity or polarity, so these
 *     tests used made-up test values and the shipped settings touched nothing
 *     (skipped: 'noTraitsRuled'). Owner rulings 2026-10-27 (q134 rarity, q135
 *     polarity) filled all twenty, so the tests use the shipped values.
 *   - 2026-10-27: a trait that switched off went back to `hidden`. The owner
 *     ruling of 2026-10-22 recorded on Equoria-q4uem.17 (Equoria-nrto5): a
 *     revealed trait made inactive becomes revealed + dormant, never hidden
 *     again. The engine's trait lists gained `dormant`, so whole-object
 *     expectations carry it.
 */

import { describe, it, expect } from '@jest/globals';
import { applyTraitDay, revealSettingsReady, ruledTraits } from '../services/traitRevealEngine.mjs';
import { traitRevealSettings as settings } from '../config/traitRevealSettings.mjs';
import { traitRosterIds } from '../../../utils/epigeneticTraits.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const always = () => 0;
const never = () => 0.999;
const empty = () => ({ positive: [], negative: [], hidden: [], dormant: [] });
const groomedDay = groomedDays => ({ groomed: true, groomedDays, neglectedDays: 0 });
const neglectedDay = neglectedDays => ({ groomed: false, groomedDays: 0, neglectedDays });

describe('traitRevealSettings — the owner numbers', () => {
  it('holds the ruled gates, chance and window, and is ready', () => {
    const gates = { common: 3, uncommon: 6, rare: 12, ultraRare: 16, legendary: 19 };
    expect(settings.revealDays).toEqual({ positive: gates, negative: gates });
    expect(settings.switchOffDays).toEqual({ positive: gates, negative: gates });
    expect(Object.values(settings.dailyChance)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);
    expect(settings.lastDayOfLife).toBe(21);
    expect(revealSettingsReady(settings)).toBe(true);
  });

  it('holds the owner rarity for each of the 20 roster traits (q134)', () => {
    expect(Object.keys(settings.traitRarity)).toEqual([...traitRosterIds]);
    const byRarity = rarity =>
      Object.entries(settings.traitRarity)
        .filter(([, r]) => r === rarity)
        .map(([t]) => t)
        .sort();
    expect(byRarity('common')).toEqual(
      [
        'brave',
        'confident',
        'affectionate',
        'curious',
        'playful',
        'fearful',
        'insecure',
        'skittish',
        'excitable',
      ].sort(),
    );
    expect(byRarity('uncommon')).toEqual(
      ['outgoing', 'peopleTrusting', 'eagerLearner', 'adaptable', 'biddable', 'aloof', 'fragile'].sort(),
    );
    expect(byRarity('rare')).toEqual(['focused', 'resilient']);
    expect(byRarity('ultraRare')).toEqual(['competitive']);
    expect(byRarity('legendary')).toEqual(['heart']);
  });

  it('holds the owner polarity (q135): six negative traits, every other positive', () => {
    expect(Object.keys(settings.traitPolarity)).toEqual([...traitRosterIds]);
    const negative = Object.entries(settings.traitPolarity)
      .filter(([, p]) => p === 'negative')
      .map(([t]) => t)
      .sort();
    expect(negative).toEqual(['aloof', 'excitable', 'fearful', 'fragile', 'insecure', 'skittish']);
    const positive = Object.values(settings.traitPolarity).filter(p => p === 'positive');
    expect(positive).toHaveLength(14);
    expect(ruledTraits(settings).size).toBe(20);
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
});

describe('applyTraitDay — the ladder on groomed days', () => {
  it('the gate day itself rolls (q139): a common trait can reveal on the third groomed day', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    expect(applyTraitDay(traits, groomedDay(2), settings, always).changes).toEqual([]);
    const { traits: next, changes } = applyTraitDay(traits, groomedDay(3), settings, always);
    expect(next.positive).toEqual(['brave']);
    expect(next.hidden).toEqual([]);
    expect(changes).toEqual([{ trait: 'brave', change: 'revealed', polarity: 'positive' }]);
  });

  it('each rarity rolls from its own gate day: 3, 6, 12, 16, 19 groomed days', () => {
    const rolled = count =>
      applyTraitDay(
        { ...empty(), hidden: ['adaptable', 'brave', 'competitive', 'heart', 'resilient'] },
        groomedDay(count),
        settings,
        always,
      ).changes.map(c => c.trait);
    expect(rolled(2)).toEqual([]);
    expect(rolled(3)).toEqual(['brave']);
    expect(rolled(5)).toEqual(['brave']);
    expect(rolled(6)).toEqual(['adaptable', 'brave']);
    expect(rolled(11)).toEqual(['adaptable', 'brave']);
    // The commoner traits keep rolling once a rarer gate opens.
    expect(rolled(12)).toEqual(['adaptable', 'brave', 'resilient']);
    expect(rolled(15)).toEqual(['adaptable', 'brave', 'resilient']);
    expect(rolled(16)).toEqual(['adaptable', 'brave', 'competitive', 'resilient']);
    expect(rolled(18)).toEqual(['adaptable', 'brave', 'competitive', 'resilient']);
    expect(rolled(19)).toEqual(['adaptable', 'brave', 'competitive', 'heart', 'resilient']);
  });

  it('is a chance, not a guarantee: a losing roll leaves the trait hidden', () => {
    const traits = { ...empty(), hidden: ['brave'] };
    expect(applyTraitDay(traits, groomedDay(15), settings, never).changes).toEqual([]);
  });

  it('switches an active negative trait off from its gate day, by its own rarity', () => {
    // fragile is uncommon (q134): its switch-off gate is 6 groomed days.
    const traits = { ...empty(), negative: ['fragile', 'skittish'] };
    expect(applyTraitDay(traits, groomedDay(2), settings, always).changes).toEqual([]);
    const third = applyTraitDay(traits, groomedDay(3), settings, always);
    expect(third.traits).toEqual({ positive: [], negative: ['fragile'], hidden: [], dormant: ['skittish'] });
    expect(third.changes).toEqual([{ trait: 'skittish', change: 'switchedOff', polarity: 'negative' }]);
    expect(applyTraitDay(traits, groomedDay(5), settings, always).traits.negative).toEqual(['fragile']);
    const sixth = applyTraitDay(traits, groomedDay(6), settings, always);
    expect(sixth.traits).toEqual({ positive: [], negative: [], hidden: [], dormant: ['fragile', 'skittish'] });
  });

  it('a groomed day never reveals a negative or switches off a positive', () => {
    const traits = { positive: ['brave'], negative: [], hidden: ['fearful', 'aloof', 'excitable'] };
    expect(applyTraitDay(traits, groomedDay(20), settings, always).changes).toEqual([]);
  });
});

describe('applyTraitDay — neglected days mirror grooming, driven by polarity', () => {
  it('reveals a hidden negative and switches an active positive off from the gate day', () => {
    const traits = { positive: ['confident'], negative: [], hidden: ['fearful', 'brave'] };
    expect(applyTraitDay(traits, neglectedDay(2), settings, always).changes).toEqual([]);
    const { traits: next, changes } = applyTraitDay(traits, neglectedDay(3), settings, always);
    expect(next).toEqual({ positive: [], negative: ['fearful'], hidden: ['brave'], dormant: ['confident'] });
    expect(changes).toEqual([
      { trait: 'fearful', change: 'revealed', polarity: 'negative' },
      { trait: 'confident', change: 'switchedOff', polarity: 'positive' },
    ]);
  });

  it('every one of the six negative traits reveals on neglect, never on grooming', () => {
    const negatives = ['aloof', 'excitable', 'fearful', 'fragile', 'insecure', 'skittish'];
    const traits = { ...empty(), hidden: negatives };
    const neglected = applyTraitDay(traits, neglectedDay(6), settings, always);
    expect(neglected.traits.negative.sort()).toEqual(negatives);
    expect(neglected.traits.hidden).toEqual([]);
    expect(applyTraitDay(traits, groomedDay(6), settings, always).changes).toEqual([]);
  });

  it('a rare positive switches off only after 12 neglected days', () => {
    const traits = { ...empty(), positive: ['resilient'] };
    expect(applyTraitDay(traits, neglectedDay(11), settings, always).changes).toEqual([]);
    expect(applyTraitDay(traits, neglectedDay(12), settings, always).traits).toEqual({
      positive: [],
      negative: [],
      hidden: [],
      dormant: ['resilient'],
    });
  });

  it('counts neglected days for neglect, not groomed days', () => {
    const traits = { ...empty(), hidden: ['fearful'] };
    const { changes } = applyTraitDay(traits, { groomed: false, groomedDays: 15, neglectedDays: 1 }, settings, always);
    expect(changes).toEqual([]);
  });
});

describe('applyTraitDay — a switched-off trait stays revealed and dormant (Equoria-nrto5)', () => {
  it('a dormant trait is never hidden again, whatever the day brings', () => {
    const traits = { ...empty(), dormant: ['skittish', 'brave'] };
    for (const day of [groomedDay(20), neglectedDay(20)]) {
      const { traits: next } = applyTraitDay(traits, day, settings, never);
      expect(next.hidden).toEqual([]);
      expect(next.dormant.sort()).toEqual(['brave', 'skittish']);
    }
    // A groomed day never touches a dormant negative; a neglected day never a dormant positive.
    expect(applyTraitDay({ ...empty(), dormant: ['skittish'] }, groomedDay(20), settings, always).traits).toEqual({
      ...empty(),
      dormant: ['skittish'],
    });
    expect(applyTraitDay({ ...empty(), dormant: ['brave'] }, neglectedDay(20), settings, always).traits).toEqual({
      ...empty(),
      dormant: ['brave'],
    });
  });

  it('a dormant trait turns back on by the same gate and chance that revealed it', () => {
    const traits = { ...empty(), dormant: ['brave'] };
    expect(applyTraitDay(traits, groomedDay(2), settings, always).changes).toEqual([]);
    const third = applyTraitDay(traits, groomedDay(3), settings, always);
    expect(third.traits).toEqual({ ...empty(), positive: ['brave'] });
    expect(third.changes).toEqual([{ trait: 'brave', change: 'reactivated', polarity: 'positive' }]);
  });

  it('switching off and back on keeps the one carried copy', () => {
    const off = applyTraitDay({ ...empty(), negative: ['fearful'] }, groomedDay(3), settings, always).traits;
    expect(off).toEqual({ ...empty(), dormant: ['fearful'] });
    const on = applyTraitDay(off, neglectedDay(3), settings, always).traits;
    expect(on).toEqual({ ...empty(), negative: ['fearful'] });
  });
});

describe('applyTraitDay — traits outside the roster are never touched', () => {
  it('leaves an off-roster name exactly where it is', () => {
    const traits = { positive: ['calm'], negative: ['nervous'], hidden: ['bold'] };
    const groomed = applyTraitDay(traits, groomedDay(20), settings, always);
    const neglected = applyTraitDay(traits, neglectedDay(20), settings, always);
    expect(groomed.changes).toEqual([]);
    expect(neglected.changes).toEqual([]);
    expect(neglected.traits).toEqual({ ...traits, dormant: [] });
  });

  it('never invents a trait the horse does not carry', () => {
    expect(applyTraitDay(empty(), groomedDay(20), settings, always).traits).toEqual(empty());
  });
});

describe('applyTraitDay — seeded rolls are reproducible and land near 25%', () => {
  it('the same seed gives the same outcome; about a quarter of gate days reveal', () => {
    const run = seed => {
      const rng = seededRng(seed);
      let revealed = 0;
      for (let i = 0; i < 4000; i++) {
        revealed += applyTraitDay({ ...empty(), hidden: ['brave'] }, groomedDay(3), settings, rng).changes.length;
      }
      return revealed;
    };
    expect(run(7)).toBe(run(7));
    const share = run(7) / 4000;
    expect(share).toBeGreaterThan(0.22);
    expect(share).toBeLessThan(0.28);
  });
});
