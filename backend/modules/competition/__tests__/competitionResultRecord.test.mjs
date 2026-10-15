/**
 * competitionResultRecord.test.mjs (Equoria-q4uem.10, design §6)
 *
 * Pure tests of the result-record shape guards and the horse show-row
 * projection. `statGains` holds two different shapes (a ridden stat gain and a
 * conformation ribbon) and legacy rows may hold anything, so the guards must
 * reject every shape that is not exactly theirs. The integration tests reach
 * some of these cases only through ownership filtering; these pin the guards
 * themselves.
 */

import { describe, it, expect } from '@jest/globals';
import { readStatGain, readConformationAward, toHorseShowRow } from '../services/competitionResultRecord.mjs';

describe('readStatGain', () => {
  it('reads a ridden stat gain', () => {
    expect(readStatGain({ stat: 'focus', gain: 1 })).toEqual({ stat: 'focus', gain: 1 });
  });

  it('returns null for a conformation ribbon shape', () => {
    expect(readStatGain({ ribbon: 'Blue', titlePoints: 10 })).toBeNull();
  });

  it('returns null when the stat is not a string', () => {
    expect(readStatGain({ stat: 7 })).toBeNull();
    expect(readStatGain({ stat: 7, gain: 1 })).toBeNull();
  });

  it('returns null for a non-integer gain', () => {
    expect(readStatGain({ stat: 'focus', gain: 1.5 })).toBeNull();
    expect(readStatGain({ stat: 'focus', gain: '1' })).toBeNull();
  });

  it('returns null for null, arrays and primitives', () => {
    expect(readStatGain(null)).toBeNull();
    expect(readStatGain([{ stat: 'focus', gain: 1 }])).toBeNull();
    expect(readStatGain('focus')).toBeNull();
  });
});

describe('readConformationAward', () => {
  it('reads a ribbon award and rejects a stat-gain shape', () => {
    expect(readConformationAward({ ribbon: 'Red', titlePoints: 7 })).toEqual({ ribbon: 'Red', titlePoints: 7 });
    expect(readConformationAward({ stat: 'focus', gain: 1 })).toBeNull();
    expect(readConformationAward({ ribbon: 'Red', titlePoints: 7.5 })).toBeNull();
  });
});

describe('toHorseShowRow', () => {
  const upcomingShow = {
    id: 12,
    name: 'Harvest Moon Dressage',
    discipline: 'Dressage',
    showType: 'ridden',
    status: 'open',
    runDate: new Date('2026-10-20T07:00:00.000Z'),
  };

  it('shows an upcoming show with its scheduled date and every outcome unknown', () => {
    expect(toHorseShowRow(upcomingShow, null)).toEqual({
      showId: 12,
      showName: 'Harvest Moon Dressage',
      competitionType: { showType: 'ridden', discipline: 'Dressage' },
      status: 'upcoming',
      date: '2026-10-20T07:00:00.000Z',
      placement: null,
      horsePointsAwarded: null,
      winnings: null,
      statGain: null,
      conformationAward: null,
    });
  });

  it('marks a show being settled as running', () => {
    expect(toHorseShowRow({ ...upcomingShow, status: 'executing' }, null).status).toBe('running');
  });
});
