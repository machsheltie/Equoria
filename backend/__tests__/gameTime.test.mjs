/**
 * The game clock — backend/utils/gameTime.mjs.
 *
 * Owner ruling (Stacey, repeated 2026-10-09): everything in Equoria runs on her
 * Eastern time (America/New_York), following daylight saving like a wall clock.
 * These tests pin the clock against known instants, including both 2026
 * daylight-saving changes (Mar 8 spring forward, Nov 1 fall back).
 */

import { describe, it, expect } from '@jest/globals';
import {
  GAME_TIME_ZONE,
  calendarDateDayIndex,
  gameCalendarDate,
  gameDateKey,
  gameDateParts,
  gameDayIndex,
  startOfGameDay,
  startOfGameDayIndex,
  startOfGameWeek,
} from '../utils/gameTime.mjs';

describe('game clock time zone', () => {
  it('is US Eastern with daylight saving', () => {
    expect(GAME_TIME_ZONE).toBe('America/New_York');
  });
});

describe('gameDateKey / gameDateParts', () => {
  it('reads an instant on the Eastern calendar, not the UTC one', () => {
    // 02:30 UTC on Oct 10 is 22:30 EDT on Oct 9.
    expect(gameDateKey(new Date('2026-10-10T02:30:00Z'))).toBe('2026-10-09');
    expect(gameDateParts(new Date('2026-10-10T02:30:00Z'))).toMatchObject({
      year: 2026,
      month: 10,
      day: 9,
      weekday: 5, // Friday
      hour: 22,
      minute: 30,
    });
  });

  it('turns the day at 00:00 Eastern: 04:00 UTC in summer, 05:00 UTC in winter', () => {
    expect(gameDateKey(new Date('2026-07-01T03:59:59Z'))).toBe('2026-06-30');
    expect(gameDateKey(new Date('2026-07-01T04:00:00Z'))).toBe('2026-07-01');
    expect(gameDateKey(new Date('2026-12-01T04:59:59Z'))).toBe('2026-11-30');
    expect(gameDateKey(new Date('2026-12-01T05:00:00Z'))).toBe('2026-12-01');
  });
});

describe('startOfGameDay', () => {
  it('is 00:00 EDT (04:00 UTC) in summer and 00:00 EST (05:00 UTC) in winter', () => {
    expect(startOfGameDay(new Date('2026-10-09T15:00:00Z')).toISOString()).toBe('2026-10-09T04:00:00.000Z');
    expect(startOfGameDay(new Date('2026-12-15T12:00:00Z')).toISOString()).toBe('2026-12-15T05:00:00.000Z');
  });

  it('late evening Eastern belongs to the Eastern day that is still running', () => {
    expect(startOfGameDay(new Date('2026-10-10T03:30:00Z')).toISOString()).toBe('2026-10-09T04:00:00.000Z');
  });

  it('handles both daylight-saving change days (midnight is before the 02:00 switch)', () => {
    expect(startOfGameDay(new Date('2026-03-08T12:00:00Z')).toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfGameDay(new Date('2026-03-09T12:00:00Z')).toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(startOfGameDay(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(startOfGameDay(new Date('2026-11-02T12:00:00Z')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
});

describe('gameDayIndex', () => {
  it('counts a 23-hour and a 25-hour daylight-saving day as exactly one day', () => {
    const spring = gameDayIndex(new Date('2026-03-09T04:30:00Z')) - gameDayIndex(new Date('2026-03-08T05:30:00Z'));
    const autumn = gameDayIndex(new Date('2026-11-02T05:30:00Z')) - gameDayIndex(new Date('2026-11-01T04:30:00Z'));
    expect(spring).toBe(1);
    expect(autumn).toBe(1);
  });

  it('round-trips through startOfGameDayIndex', () => {
    const index = gameDayIndex(new Date('2026-11-01T20:00:00Z'));
    expect(gameDayIndex(startOfGameDayIndex(index))).toBe(index);
    expect(gameDayIndex(new Date(startOfGameDayIndex(index).getTime() - 1))).toBe(index - 1);
  });
});

describe('startOfGameWeek', () => {
  it('walks back to 00:00 Eastern on the requested weekday', () => {
    // Fri Oct 9 2026 → Sunday Oct 4 and Monday Oct 5.
    expect(startOfGameWeek(new Date('2026-10-09T15:00:00Z'), 0).toISOString()).toBe('2026-10-04T04:00:00.000Z');
    expect(startOfGameWeek(new Date('2026-10-09T15:00:00Z'), 1).toISOString()).toBe('2026-10-05T04:00:00.000Z');
  });

  it('Sunday 23:00 Eastern is still Sunday (already Monday in UTC)', () => {
    expect(startOfGameWeek(new Date('2026-10-12T03:00:00Z'), 1).toISOString()).toBe('2026-10-05T04:00:00.000Z');
    expect(startOfGameWeek(new Date('2026-10-12T03:00:00Z'), 0).toISOString()).toBe('2026-10-11T04:00:00.000Z');
  });
});

describe('date-only columns (Horse.dateOfBirth, lastBredDate, lastVettedDate)', () => {
  it('gameCalendarDate stores the Eastern date, not the UTC date of the moment', () => {
    // 22:00 EDT on Oct 9 is Oct 10 in UTC; the stored calendar date is Oct 9.
    expect(gameCalendarDate(new Date('2026-10-10T02:00:00Z')).toISOString()).toBe('2026-10-09T00:00:00.000Z');
  });

  it('gameCalendarDate offsets by whole game days', () => {
    expect(gameCalendarDate(new Date('2026-10-10T02:00:00Z'), -21).toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('calendarDateDayIndex reads a stored date as that calendar date, comparable with gameDayIndex', () => {
    const stored = new Date('2026-10-09T00:00:00.000Z'); // how Prisma returns @db.Date 2026-10-09
    expect(calendarDateDayIndex(stored)).toBe(gameDayIndex(new Date('2026-10-09T16:00:00Z')));
    // A date written at 22:00 EDT reads back as the same game day it was written on.
    const written = gameCalendarDate(new Date('2026-10-10T02:00:00Z'));
    expect(calendarDateDayIndex(written)).toBe(gameDayIndex(new Date('2026-10-10T02:00:00Z')));
  });
});
