import { describe, it, expect } from '@jest/globals';
import {
  getFeedHealth,
  startOfGameDay,
  alreadyFedToday,
  getVetHealth,
  getDisplayedHealth,
  worseOf,
  withHealth,
  healthWords,
  toHealthWord,
  hasBadHealth,
  badHealthMessage,
  hungerFeedingPlan,
  horseHealthGrade,
} from '../../../utils/horseHealth.mjs';

// Owner ruling 2026-10-23 (Equoria-u0jop): health is exactly Excellent, Very
// Good, Good, Fair, Bad; Poor, Bad and Critical all map to Bad. Old contract:
// lowercase bands excellent / good / fair / poor / critical.
// Owner ruling 2026-10-23 (Equoria-qwz60): health comes from days since the
// vet (0-7 Excellent, 8-14 Very Good, 15-21 Good, 22-28 Fair, 29+ Bad); hunger
// from days since feeding (0-2 Excellent, 3-4 Very Good, 5-6 Good, 7-8 Fair,
// 9+ Bad). Hunger Fair lowers health one level, hunger Bad two, floor Bad.
// Old contract: health was the WORSE of feed and vet health, feed bands were
// 0-2/3-4/5-6/7+ (Excellent/Good/Fair/Bad), vet bands 0-7/8-14/15-21/22+, and a
// stored healthStatus overrode the vet days.
describe('toHealthWord (the one health vocabulary)', () => {
  it('is exactly the five words, best first', () => {
    expect(healthWords).toEqual(['Excellent', 'Very Good', 'Good', 'Fair', 'Bad']);
  });

  it('maps Poor, Bad and Critical to Bad in any case', () => {
    for (const raw of ['Poor', 'poor', 'Bad', 'bad', 'Critical', 'critical', 'CRITICAL']) {
      expect(toHealthWord(raw)).toBe('Bad');
    }
  });

  it('keeps the five words and normalises their case and spacing', () => {
    expect(toHealthWord('excellent')).toBe('Excellent');
    expect(toHealthWord('Very Good')).toBe('Very Good');
    expect(toHealthWord('very-good')).toBe('Very Good');
    expect(toHealthWord('VERY GOOD')).toBe('Very Good');
    expect(toHealthWord('Good')).toBe('Good');
    expect(toHealthWord('fair')).toBe('Fair');
  });

  it('treats a free-form vet finding or a missing value as Bad (conservative, feed-system contract)', () => {
    expect(toHealthWord('Injured')).toBe('Bad');
    expect(toHealthWord('Lameness')).toBe('Bad');
    expect(toHealthWord(null)).toBe('Bad');
    expect(toHealthWord(undefined)).toBe('Bad');
  });
});

describe('hasBadHealth (the Fair-or-better gate for breeding, training and shows)', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');
  const vettedToday = { age: 5, lastVettedDate: NOW, healthStatus: null };

  const vetted = daysAgo => ({
    age: 5,
    healthStatus: null,
    lastVettedDate: new Date(NOW.getTime() - daysAgo * 86400000),
  });
  const fed = daysAgo => ({ lastFedDate: new Date(NOW.getTime() - daysAgo * 86400000) });

  it('passes a Fair horse (vetted 22 days ago, fed today)', () => {
    expect(hasBadHealth({ ...vetted(22), ...fed(0) }, NOW)).toBe(false);
  });

  it('refuses a horse vetted 29 days ago, however well fed', () => {
    expect(hasBadHealth({ ...vetted(29), ...fed(0) }, NOW)).toBe(true);
  });

  it('lowers a Fair vet horse to Bad when hunger is Fair (7 days unfed)', () => {
    expect(hasBadHealth({ ...vetted(22), ...fed(7) }, NOW)).toBe(true);
  });

  it('does not make a freshly vetted horse Bad from hunger alone (Bad hunger lowers Excellent two levels to Good)', () => {
    expect(hasBadHealth({ ...vetted(0), ...fed(30) }, NOW)).toBe(false);
  });

  it('refuses a horse whose stored vet finding is Critical or Poor', () => {
    expect(hasBadHealth({ ...vettedToday, lastFedDate: NOW, healthStatus: 'Critical' }, NOW)).toBe(true);
    expect(hasBadHealth({ ...vettedToday, lastFedDate: NOW, healthStatus: 'Poor' }, NOW)).toBe(true);
  });

  it('leaves a retired horse to the age rules (retirement is not a health word)', () => {
    expect(hasBadHealth({ age: 22 }, NOW)).toBe(false);
  });
});

describe('badHealthMessage', () => {
  it('names the horse, the action, the Bad word and the Fair-or-better bar', () => {
    expect(badHealthMessage('Moonflower', 'breed')).toBe(
      'Moonflower is in Bad health and cannot breed. A horse must be in Fair health or better to breed, train or enter a show. Feed and vet to restore health.',
    );
  });
});

describe('getFeedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getFeedHealth({ age: 21, lastFedDate: NOW }, NOW)).toBe('retired');
    expect(getFeedHealth({ age: 25, lastFedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns Bad when lastFedDate is null', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: null }, NOW)).toBe('Bad');
    expect(getFeedHealth({ age: 5 }, NOW)).toBe('Bad');
  });

  it('returns Excellent for 0-2 day gap (Eastern game days; feeds at noon EDT)', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-29T16:00:00Z') }, NOW)).toBe('Excellent');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-28T16:00:00Z') }, NOW)).toBe('Excellent');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-27T16:00:00Z') }, NOW)).toBe('Excellent');
  });

  it('returns Very Good for 3-4 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-26T16:00:00Z') }, NOW)).toBe('Very Good');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-25T16:00:00Z') }, NOW)).toBe('Very Good');
  });

  it('returns Good for 5-6 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-24T16:00:00Z') }, NOW)).toBe('Good');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-23T16:00:00Z') }, NOW)).toBe('Good');
  });

  it('returns Fair for a 7-8 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-22T16:00:00Z') }, NOW)).toBe('Fair');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-21T16:00:00Z') }, NOW)).toBe('Fair');
  });

  it('counts from hungerSince when it is set (a feeding below Excellent back-dates it)', () => {
    const lastFedDate = new Date('2026-04-29T16:00:00Z');
    expect(getFeedHealth({ age: 5, lastFedDate, hungerSince: new Date('2026-04-21T16:00:00Z') }, NOW)).toBe('Fair');
    expect(getFeedHealth({ age: 5, lastFedDate, hungerSince: null }, NOW)).toBe('Excellent');
  });

  it('returns Bad for 9+ day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-20T16:00:00Z') }, NOW)).toBe('Bad');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-01T16:00:00Z') }, NOW)).toBe('Bad');
  });
});

// Owner ruling 2026-10-09: feeding days are Eastern game days
// (America/New_York). Old contract: UTC calendar days.
describe('startOfGameDay', () => {
  it('truncates to 00:00 Eastern (EDT in April: 04:00 UTC)', () => {
    expect(startOfGameDay(new Date('2026-04-29T15:30:45.999Z')).toISOString()).toBe('2026-04-29T04:00:00.000Z');
  });

  it('uses EST (05:00 UTC) in winter', () => {
    expect(startOfGameDay(new Date('2026-12-15T15:30:00Z')).toISOString()).toBe('2026-12-15T05:00:00.000Z');
  });
});

describe('alreadyFedToday', () => {
  const NOW = new Date('2026-04-29T15:30:00Z'); // 11:30 EDT, Apr 29

  it('returns false when lastFedDate is null', () => {
    expect(alreadyFedToday(null, NOW)).toBe(false);
  });

  it('returns true when fed earlier today Eastern', () => {
    expect(alreadyFedToday(new Date('2026-04-29T04:00:00Z'), NOW)).toBe(true); // 00:00 EDT
    expect(alreadyFedToday(new Date('2026-04-30T03:59:59Z'), NOW)).toBe(true); // 23:59:59 EDT
  });

  it('returns false when fed yesterday Eastern, even if it was already today in UTC', () => {
    expect(alreadyFedToday(new Date('2026-04-29T03:59:59Z'), NOW)).toBe(false); // Apr 28, 23:59 EDT
    expect(alreadyFedToday(new Date('2026-04-29T01:00:00Z'), NOW)).toBe(false); // Apr 28, 21:00 EDT
  });
});

describe('getVetHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getVetHealth({ age: 21, lastVettedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns Bad when lastVettedDate is null and no override', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: null }, NOW)).toBe('Bad');
  });

  it('reads a Critical or Poor healthStatus as a Bad vet finding', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'critical' }, NOW)).toBe('Bad');
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'Poor' }, NOW)).toBe('Bad');
  });

  // Old contract: a stored 'excellent' overrode the vet days. The column
  // defaults to 'Excellent', so health never decayed; days since the vet rule.
  it('lets days since the vet decide when healthStatus is one of the good words', () => {
    const longAgo = new Date('2026-01-01T00:00:00Z');
    expect(getVetHealth({ age: 5, lastVettedDate: longAgo, healthStatus: 'Excellent' }, NOW)).toBe('Bad');
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'Fair' }, NOW)).toBe('Excellent');
  });

  // Old contract: a free-form finding came back unchanged ('Lameness').
  // Owner ruling 2026-10-23: every health value is one of the five words, so an
  // unknown finding is Bad (the feed-system contract already ranked it critical).
  it('maps a free-form vet finding to Bad', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'Lameness' }, NOW)).toBe('Bad');
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'Injured' }, NOW)).toBe('Bad');
  });

  it('returns Excellent for ≤7 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-22T00:00:00Z') }, NOW)).toBe('Excellent');
  });

  it('returns Very Good for 8-14 day gap (boundaries 7/8 and 14/15)', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-21T00:00:00Z') }, NOW)).toBe('Very Good');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-15T00:00:00Z') }, NOW)).toBe('Very Good');
  });

  it('returns Good for 15-21 day gap (boundaries 14/15 and 21/22)', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-14T00:00:00Z') }, NOW)).toBe('Good');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-08T00:00:00Z') }, NOW)).toBe('Good');
  });

  it('returns Fair for a 22-28 day gap (boundaries 21/22 and 28/29)', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-07T00:00:00Z') }, NOW)).toBe('Fair');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-01T00:00:00Z') }, NOW)).toBe('Fair');
  });

  it('returns Bad for 29+ day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-03-31T00:00:00Z') }, NOW)).toBe('Bad');
  });
});

describe('worseOf', () => {
  it('picks the worse band', () => {
    expect(worseOf('Excellent', 'Good')).toBe('Good');
    expect(worseOf('Good', 'Excellent')).toBe('Good');
    expect(worseOf('Very Good', 'Good')).toBe('Good');
    expect(worseOf('Excellent', 'Very Good')).toBe('Very Good');
    expect(worseOf('Fair', 'Bad')).toBe('Bad');
    expect(worseOf('Excellent', 'Excellent')).toBe('Excellent');
  });

  it('retired overrides everything', () => {
    expect(worseOf('retired', 'Bad')).toBe('retired');
    expect(worseOf('Bad', 'retired')).toBe('retired');
  });

  it('treats unknown free-form vet findings as Bad (sentinel for worseOf -1 bug)', () => {
    expect(worseOf('Excellent', 'Lameness')).toBe('Bad');
    expect(worseOf('Lameness', 'Excellent')).toBe('Bad');
    expect(worseOf('Lameness', 'Lameness')).toBe('Bad');
    expect(worseOf('Good', 'Tendon strain')).toBe('Bad');
  });
});

describe('getDisplayedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('is the vet health when hunger is Good or better', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-28T16:00:00Z'), // Excellent hunger
      lastVettedDate: new Date('2026-04-08T00:00:00Z'), // Good vet (21 days)
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('Good');
  });

  it('lowers health one level for Fair hunger and two for Bad hunger', () => {
    const vetExcellent = { age: 5, lastVettedDate: NOW };
    expect(getDisplayedHealth({ ...vetExcellent, lastFedDate: new Date('2026-04-22T16:00:00Z') }, NOW)).toBe(
      'Very Good',
    );
    expect(getDisplayedHealth({ ...vetExcellent, lastFedDate: new Date('2026-04-15T16:00:00Z') }, NOW)).toBe('Good');
    expect(getDisplayedHealth({ ...vetExcellent, lastFedDate: null }, NOW)).toBe('Good');
  });

  it('never goes below Bad', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-01T16:00:00Z'), // Bad hunger
      lastVettedDate: new Date('2026-04-01T00:00:00Z'), // Fair vet (28 days)
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('Bad');
    expect(horseHealthGrade(horse, NOW)).toBe('bad');
  });

  it('returns retired for age >= 21 even if vet/feed are Bad', () => {
    expect(getDisplayedHealth({ age: 22 }, NOW)).toBe('retired');
  });
});

describe('hungerFeedingPlan (hunger is a fill bar; owner ruling 2026-10-23)', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');
  const levelAfter = plan => getFeedHealth({ age: 5, lastFedDate: NOW, hungerSince: plan.hungerSince }, NOW);

  it('raises Bad hunger (9+ days, or never fed) one level to Fair', () => {
    for (const lastFedDate of [null, new Date('2026-04-10T16:00:00Z')]) {
      const plan = hungerFeedingPlan({ lastFedDate }, NOW);
      expect(plan.canFeed).toBe(true);
      expect(levelAfter(plan)).toBe('Fair');
    }
  });

  it('walks Bad up one level per feeding to Excellent, then allows one feeding per day', () => {
    let horse = { lastFedDate: new Date('2026-04-01T16:00:00Z'), hungerSince: null };
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      const plan = hungerFeedingPlan(horse, NOW);
      expect(plan.canFeed).toBe(true);
      horse = { lastFedDate: NOW, hungerSince: plan.hungerSince };
      seen.push(getFeedHealth({ age: 5, ...horse }, NOW));
    }
    expect(seen).toEqual(['Fair', 'Good', 'Very Good', 'Excellent']);
    expect(hungerFeedingPlan(horse, NOW).canFeed).toBe(false);
  });

  it('feeds an Excellent horse once per Eastern game day, then again the next day', () => {
    const horse = { lastFedDate: new Date('2026-04-29T14:00:00Z'), hungerSince: null };
    expect(hungerFeedingPlan(horse, NOW).canFeed).toBe(false);
    expect(hungerFeedingPlan(horse, new Date('2026-04-30T15:00:00Z')).canFeed).toBe(true);
  });

  it('an Excellent horse not yet fed today is reset to day 0', () => {
    const plan = hungerFeedingPlan({ lastFedDate: new Date('2026-04-27T16:00:00Z') }, NOW);
    expect(plan.canFeed).toBe(true);
    expect(plan.hungerSince.getTime()).toBe(NOW.getTime());
  });

  it('a below-Excellent horse already fed today can be fed again', () => {
    const horse = { lastFedDate: NOW, hungerSince: new Date('2026-04-21T16:00:00Z') }; // Fair
    expect(hungerFeedingPlan(horse, NOW).canFeed).toBe(true);
  });
});

describe('withHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns null as-is when horse is null (null guard, lines 191-194)', () => {
    expect(withHealth(null, NOW)).toBeNull();
  });

  it('returns non-object input as-is (string guard)', () => {
    expect(withHealth('not-an-object', NOW)).toBe('not-an-object');
  });

  it('adds feedHealth, vetHealth, displayedHealth to a valid horse', () => {
    const horse = { age: 5, lastFedDate: NOW, lastVettedDate: NOW };
    const result = withHealth(horse, NOW);
    expect(result).toHaveProperty('feedHealth');
    expect(result).toHaveProperty('vetHealth');
    expect(result).toHaveProperty('displayedHealth');
  });
});

// ── default-now branches (Equoria-jkht) ────────────────────────────────────────
// All exported functions use `now = new Date()` default. Calling each without
// `now` covers the default-parameter branch that no existing test exercised.

describe('default now= parameter branches', () => {
  it('alreadyFedToday uses new Date() default when now is omitted', () => {
    // null lastFedDate → early false (no date math needed, safe to omit now)
    expect(alreadyFedToday(null)).toBe(false);
  });

  it('getFeedHealth uses new Date() default when now is omitted', () => {
    // age >= 21 → retired early, no date math — safe to omit now
    expect(getFeedHealth({ age: 21 })).toBe('retired');
  });

  it('getVetHealth uses new Date() default when now is omitted', () => {
    // age >= 21 → retired early, no date math — safe to omit now
    expect(getVetHealth({ age: 25 })).toBe('retired');
  });

  it('getDisplayedHealth uses new Date() default when now is omitted', () => {
    // retired horse: both sub-calls return 'retired', worseOf returns 'retired'
    const result = getDisplayedHealth({ age: 22 });
    expect(result).toBe('retired');
  });

  it('withHealth uses new Date() default when now is omitted', () => {
    // retired horse: all three health fields = 'retired'
    const result = withHealth({ age: 22 });
    expect(result.feedHealth).toBe('retired');
    expect(result.vetHealth).toBe('retired');
    expect(result.displayedHealth).toBe('retired');
  });
});
