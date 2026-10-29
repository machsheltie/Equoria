/**
 * The shared staff star-level table (owner ruling 2026-10-28, Equoria-nawn5): five levels,
 * stars 1-5, prices 100-500, drawn inside each staff type's old skill tier with the old
 * odds; older rows and offers placed from their old skill word and price. Owner ruling
 * q226 (2026-10-28): every hire, old or new, pays its star level's price.
 */

import { describe, it, expect } from '@jest/globals';
import {
  drawStaffLevel,
  hiredStaffFee,
  isStaffLevel,
  legacyStaffLevel,
  offerLevelAndFee,
  staffLevelFee,
  staffLevelLabel,
  staffLevelStars,
  staffLevels,
  staffSkillOdds,
} from '../constants/staffLevels.mjs';

describe('the five levels', () => {
  it('are stored as camelCase words with 1-5 stars, labels and prices 100-500', () => {
    expect(
      staffLevels.map(level => [level, staffLevelStars(level), staffLevelLabel(level), staffLevelFee(level)]),
    ).toEqual([
      ['rookie', 1, 'Rookie', 100],
      ['novice', 2, 'Novice', 200],
      ['intermediate', 3, 'Intermediate', 300],
      ['advanced', 4, 'Advanced', 400],
      ['expert', 5, 'Expert', 500],
    ]);
  });

  it('refuses to price an unknown level, and never labels it with the stored word', () => {
    expect(isStaffLevel('master')).toBe(false);
    expect(() => staffLevelFee('master')).toThrow('Unknown staff level');
    expect(staffLevelLabel('master')).toBe('Unrated');
    expect(staffLevelStars('master')).toBe(0);
  });
});

// Riders draw no old skill tier any more (owner ruling 2026-10-29, q282): every new
// rider is a Rookie (riderMarketplace). Old contract: riders drew rookie/developing/
// experienced here too.
describe('drawing a new staff member', () => {
  // A deterministic sequence: the first value picks the tier, the second the level in it.
  const seq = values => {
    let i = 0;
    return () => values[i++];
  };

  it.each([
    ['trainer', [0.0, 0.9], 'novice', 'novice'],
    ['trainer', [0.9, 0.0], 'expert', 'expert'],
    ['groom', [0.0, 0.0], 'novice', 'rookie'],
    ['groom', [0.5, 0.5], 'intermediate', 'intermediate'],
    ['groom', [0.8, 0.5], 'expert', 'advanced'],
    ['groom', [0.99, 0.5], 'master', 'expert'],
  ])('%s with rolls %j is %s / %s', (type, rolls, skillLevel, starLevel) => {
    expect(drawStaffLevel(type, seq(rolls))).toEqual({ skillLevel, starLevel });
  });

  // Owner ruling 2026-10-29 (q282) retired the riders' old skill word (old contract:
  // riders drew rookie / developing / experienced at 45/40/15).
  it('keeps the trainer and groom old skill odds; riders have none', () => {
    expect(() => staffSkillOdds('rider')).toThrow('Unknown staff type');
    expect(staffSkillOdds('trainer')).toEqual({ novice: 45, developing: 40, expert: 15 });
    expect(staffSkillOdds('groom')).toEqual({ novice: 40, intermediate: 35, expert: 20, master: 5 });
  });
});

describe('placing staff from before star levels', () => {
  it.each([
    // q282: a rider has no old skill word; one stored without a star level is a Rookie.
    ['rider', 'rookie', 225, 'rookie'],
    ['rider', 'experienced', 800, 'rookie'],
    ['trainer', 'novice', 149, 'rookie'],
    ['trainer', 'novice', 150, 'novice'],
    ['trainer', 'developing', 274, 'intermediate'],
    ['trainer', 'developing', 275, 'advanced'],
    ['trainer', 'expert', 350, 'expert'],
    ['groom', 'novice', 2, 'rookie'],
    ['groom', 'novice', 3, 'novice'],
    ['groom', 'intermediate', 5, 'intermediate'],
    ['groom', 'expert', 10, 'advanced'],
    ['groom', 'master', 18, 'expert'],
    ['groom', 'mysterious', 9, 'rookie'],
  ])('%s %s at %i is %s', (type, skillLevel, measure, expected) => {
    expect(legacyStaffLevel(type, skillLevel, measure)).toBe(expected);
  });

  // Owner ruling q226 changed this contract: an old offer used to cost what it
  // advertised; now every offer costs its level's price.
  it('every offer costs its level price; an old offer is placed from its old skill word', () => {
    expect(offerLevelAndFee('rider', { starLevel: 'advanced', weeklyRate: 999 }, 999)).toEqual({
      starLevel: 'advanced',
      fee: 400,
    });
    // q282: an old rider offer with only its retired skill word is a Rookie.
    expect(offerLevelAndFee('rider', { skillLevel: 'experienced', weeklyRate: 650 }, 650)).toEqual({
      starLevel: 'rookie',
      fee: 100,
    });
    expect(offerLevelAndFee('groom', { skillLevel: 'expert', experience: 9 }, 9)).toEqual({
      starLevel: 'advanced',
      fee: 400,
    });
  });
});

// Owner ruling q226 (2026-10-28, "change it now") changed this contract: staff hired
// before star levels no longer keep the price they were hired at.
describe('what a hired rider, trainer or groom costs (owner ruling q226)', () => {
  it('is always the star level price', () => {
    expect(staffLevels.map(level => hiredStaffFee({ starLevel: level }))).toEqual([100, 200, 300, 400, 500]);
  });

  it('refuses a row without a star level rather than charging nothing', () => {
    expect(() => hiredStaffFee({})).toThrow('Unknown staff level');
    expect(() => hiredStaffFee(null)).toThrow('Unknown staff level');
  });
});
