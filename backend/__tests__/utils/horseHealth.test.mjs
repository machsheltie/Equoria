import { describe, it, expect } from '@jest/globals';
import {
  getFeedHealth,
  startOfUtcDay,
  alreadyFedToday,
  getVetHealth,
  getDisplayedHealth,
  worseOf,
} from '../../utils/horseHealth.mjs';

describe('getFeedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getFeedHealth({ age: 21, lastFedDate: NOW }, NOW)).toBe('retired');
    expect(getFeedHealth({ age: 25, lastFedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns critical when lastFedDate is null', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: null }, NOW)).toBe('critical');
    expect(getFeedHealth({ age: 5 }, NOW)).toBe('critical');
  });

  it('returns excellent for 0-2 day gap (UTC calendar)', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-29T00:00:00Z') }, NOW)).toBe('excellent');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-28T00:00:00Z') }, NOW)).toBe('excellent');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-27T00:00:00Z') }, NOW)).toBe('excellent');
  });

  it('returns good for 3-4 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-26T00:00:00Z') }, NOW)).toBe('good');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-25T00:00:00Z') }, NOW)).toBe('good');
  });

  it('returns fair for 5-6 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-24T00:00:00Z') }, NOW)).toBe('fair');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-23T00:00:00Z') }, NOW)).toBe('fair');
  });

  it('returns poor for 7-8 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-22T00:00:00Z') }, NOW)).toBe('poor');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-21T00:00:00Z') }, NOW)).toBe('poor');
  });

  it('returns critical for 9+ day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-20T00:00:00Z') }, NOW)).toBe('critical');
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-01T00:00:00Z') }, NOW)).toBe('critical');
  });
});

describe('startOfUtcDay', () => {
  it('truncates to UTC midnight', () => {
    expect(startOfUtcDay(new Date('2026-04-29T15:30:45.999Z')).toISOString()).toBe('2026-04-29T00:00:00.000Z');
  });
});

describe('alreadyFedToday', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns false when lastFedDate is null', () => {
    expect(alreadyFedToday(null, NOW)).toBe(false);
  });

  it('returns true when fed earlier today UTC', () => {
    expect(alreadyFedToday(new Date('2026-04-29T01:00:00Z'), NOW)).toBe(true);
    expect(alreadyFedToday(new Date('2026-04-29T23:59:59Z'), NOW)).toBe(true);
  });

  it('returns false when fed yesterday UTC', () => {
    expect(alreadyFedToday(new Date('2026-04-28T23:59:59Z'), NOW)).toBe(false);
  });
});

describe('getVetHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getVetHealth({ age: 21, lastVettedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns critical when lastVettedDate is null and no override', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: null }, NOW)).toBe('critical');
  });

  it('returns healthStatus override when non-null', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'critical' }, NOW)).toBe('critical');
    expect(
      getVetHealth({ age: 5, lastVettedDate: new Date('2026-01-01T00:00:00Z'), healthStatus: 'excellent' }, NOW),
    ).toBe('excellent');
  });

  it('returns excellent for ≤7 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-22T00:00:00Z') }, NOW)).toBe('excellent');
  });

  it('returns good for 8-14 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-21T00:00:00Z') }, NOW)).toBe('good');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-15T00:00:00Z') }, NOW)).toBe('good');
  });

  it('returns fair for 15-21 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-14T00:00:00Z') }, NOW)).toBe('fair');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-08T00:00:00Z') }, NOW)).toBe('fair');
  });

  it('returns poor for 22-28 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-07T00:00:00Z') }, NOW)).toBe('poor');
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-01T00:00:00Z') }, NOW)).toBe('poor');
  });

  it('returns critical for 29+ day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-03-31T00:00:00Z') }, NOW)).toBe('critical');
  });
});

describe('worseOf', () => {
  it('picks the worse band', () => {
    expect(worseOf('excellent', 'good')).toBe('good');
    expect(worseOf('good', 'excellent')).toBe('good');
    expect(worseOf('fair', 'critical')).toBe('critical');
    expect(worseOf('excellent', 'excellent')).toBe('excellent');
  });

  it('retired overrides everything', () => {
    expect(worseOf('retired', 'critical')).toBe('retired');
    expect(worseOf('critical', 'retired')).toBe('retired');
  });
});

describe('getDisplayedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns the worse of feed and vet', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-28T00:00:00Z'), // excellent feed
      lastVettedDate: new Date('2026-04-08T00:00:00Z'), // fair vet (21 days)
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('fair');
  });

  it('returns critical when feed is critical', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-15T00:00:00Z'), // critical feed (14 days)
      lastVettedDate: NOW, // excellent vet
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('critical');
  });

  it('returns retired for age >= 21 even if vet/feed are critical', () => {
    expect(getDisplayedHealth({ age: 22 }, NOW)).toBe('retired');
  });
});
