/**
 * Competition browser filter rules (Equoria-oey96.12), with an injected `now`
 * so the day and 24-hour boundaries are deterministic.
 */

import { describe, it, expect } from 'vitest';
import { applyCompetitionFilters, competitionClosesAt } from '../competition-filters';

// 2026-10-22 23:30 Eastern (EDT, UTC-4) = 2026-10-23T03:30:00Z — half an hour
// before the Eastern game day turns over.
const NOW = new Date('2026-10-23T03:30:00.000Z');

const ALL = { discipline: 'all', dateRange: 'all', entryFee: 'all' } as const;

function show(discipline: string, entryFee: number, closeDate?: string | null) {
  return { discipline, entryFee, closeDate };
}

describe('discipline', () => {
  const shows = [show('Dressage', 0), show('Show Jumping', 0), show('Reining', 0)];

  it('matches by discipline id or display name, whatever the casing', () => {
    expect(applyCompetitionFilters(shows, { ...ALL, discipline: 'show-jumping' }, NOW)).toEqual([
      shows[1],
    ]);
    expect(applyCompetitionFilters(shows, { ...ALL, discipline: 'DRESSAGE' }, NOW)).toEqual([
      shows[0],
    ]);
  });
});

describe('entry fee (coins)', () => {
  const shows = [0, 1, 99, 100, 500, 501].map((fee) => show('Dressage', fee));
  const fees = (bucket: 'free' | 'under100' | 'range' | 'over500') =>
    applyCompetitionFilters(shows, { ...ALL, entryFee: bucket }, NOW).map((s) => s.entryFee);

  it('buckets never overlap', () => {
    expect(fees('free')).toEqual([0]);
    expect(fees('under100')).toEqual([1, 99]);
    expect(fees('range')).toEqual([100, 500]);
    expect(fees('over500')).toEqual([501]);
  });
});

describe('date range on the Eastern game clock', () => {
  const at = (iso: string) => show('Dressage', 0, iso);

  it('closing keeps shows that close within the next 24 hours and no others', () => {
    const inside = at('2026-10-24T03:29:00.000Z'); // 23h59m away
    const edge = at('2026-10-24T03:30:00.000Z'); // exactly 24h away
    const outside = at('2026-10-24T03:31:00.000Z');
    const closed = at('2026-10-23T03:29:00.000Z');
    const kept = applyCompetitionFilters(
      [inside, edge, outside, closed],
      { ...ALL, dateRange: 'closing' },
      NOW
    );
    expect(kept).toEqual([inside, edge]);
  });

  it('today means the Eastern game date, not the UTC date', () => {
    // 23:45 Eastern tonight is already the 23rd in UTC.
    const tonight = at('2026-10-23T03:45:00.000Z');
    const tomorrow = at('2026-10-23T04:30:00.000Z'); // 00:30 Eastern on the 23rd
    const kept = applyCompetitionFilters([tonight, tomorrow], { ...ALL, dateRange: 'today' }, NOW);
    expect(kept).toEqual([tonight]);
  });

  it('week and month are rolling windows of game days', () => {
    const sixDays = at('2026-10-28T15:00:00.000Z');
    const eightDays = at('2026-10-31T15:00:00.000Z');
    const fortyDays = at('2026-12-01T15:00:00.000Z');
    const list = [sixDays, eightDays, fortyDays];
    expect(applyCompetitionFilters(list, { ...ALL, dateRange: 'week' }, NOW)).toEqual([sixDays]);
    expect(applyCompetitionFilters(list, { ...ALL, dateRange: 'month' }, NOW)).toEqual([
      sixDays,
      eightDays,
    ]);
  });

  it('a show with no usable date matches no date window but still shows under All', () => {
    const undated = show('Dressage', 0, null);
    expect(applyCompetitionFilters([undated], { ...ALL, dateRange: 'week' }, NOW)).toEqual([]);
    expect(applyCompetitionFilters([undated], ALL, NOW)).toEqual([undated]);
  });
});

describe('competitionClosesAt', () => {
  it('prefers closeDate, then entry deadline, run date and date', () => {
    expect(
      competitionClosesAt({
        discipline: 'x',
        entryFee: 0,
        date: '2026-01-04T00:00:00.000Z',
        runDate: '2026-01-03T00:00:00.000Z',
        entryDeadline: '2026-01-02T00:00:00.000Z',
        closeDate: '2026-01-01T00:00:00.000Z',
      })?.toISOString()
    ).toBe('2026-01-01T00:00:00.000Z');
    expect(
      competitionClosesAt({
        discipline: 'x',
        entryFee: 0,
        runDate: '2026-01-03T00:00:00.000Z',
      })?.toISOString()
    ).toBe('2026-01-03T00:00:00.000Z');
  });
});
