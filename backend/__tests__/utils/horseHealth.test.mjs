import { describe, it, expect } from '@jest/globals';
import { getFeedHealth, startOfUtcDay, alreadyFedToday } from '../../utils/horseHealth.mjs';

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
