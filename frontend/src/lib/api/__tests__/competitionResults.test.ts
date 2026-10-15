/**
 * Competition results read: the backend's scoped show-results DTO mapped to the
 * modal's CompetitionResults (Equoria-q4uem.10, owner ruling R4).
 *
 * The modal reads GET /api/v1/competition/show/:showId/results. Prize
 * distribution comes from what was actually paid (each placement's recorded
 * prizeWon), never recomputed from the 50/30/20 rule, and anything unrecorded
 * stays null rather than becoming a reassuring 0 (PRODUCT.md, Truth and State).
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  fetchCompetitionResults,
  toCompetitionResults,
  type ShowResultRow,
  type ShowResultsEnvelope,
} from '../competitionResults';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function row(overrides: Partial<ShowResultRow>): ShowResultRow {
  return {
    resultId: 1,
    horseId: 1,
    horseName: 'Comet',
    ownerName: 'stacey',
    isViewerHorse: false,
    placement: 1,
    score: 80,
    prizeWon: 500,
    runDate: '2026-10-10T07:00:00.000Z',
    horsePointsAwarded: 30,
    statGain: null,
    conformationAward: null,
    ...overrides,
  };
}

const header = {
  id: 42,
  name: 'Moonlit Dressage Classic',
  discipline: 'Dressage',
  showType: 'ridden',
  status: 'completed',
  scheduledRunDate: '2026-10-10T07:00:00.000Z',
  executedAt: '2026-10-10T07:03:00.000Z',
  prize: 1000,
};

function envelope(overrides: Partial<ShowResultsEnvelope>): ShowResultsEnvelope {
  const results = overrides.results ?? [];
  return { success: true, showId: 42, count: results.length, show: header, results, ...overrides };
}

describe('toCompetitionResults', () => {
  it('maps the show header and every result row', () => {
    const mapped = toCompetitionResults(
      envelope({
        results: [
          row({
            resultId: 7,
            horseId: 3,
            horseName: 'Comet',
            placement: 1,
            score: 81.5,
            prizeWon: 500,
          }),
          row({
            resultId: 8,
            horseId: 4,
            horseName: 'Zephyr',
            ownerName: 'me',
            isViewerHorse: true,
            placement: 2,
            score: 64.25,
            prizeWon: 300,
            horsePointsAwarded: 27,
            statGain: { stat: 'precision', gain: 1 },
          }),
          row({ resultId: 9, horseId: 5, horseName: 'Apple', placement: 3, prizeWon: 200 }),
        ],
      })
    );

    expect(mapped).toEqual({
      competitionId: 42,
      competitionName: 'Moonlit Dressage Classic',
      discipline: 'Dressage',
      showType: 'ridden',
      date: '2026-10-10T07:00:00.000Z',
      totalParticipants: 3,
      prizePool: 1000,
      prizeDistribution: { first: 500, second: 300, third: 200 },
      results: [
        {
          rank: 1,
          horseId: 3,
          horseName: 'Comet',
          ownerName: 'stacey',
          finalScore: 81.5,
          prizeWon: 500,
          isCurrentUser: false,
          horsePointsAwarded: 30,
          statGain: null,
          conformationAward: null,
        },
        {
          rank: 2,
          horseId: 4,
          horseName: 'Zephyr',
          ownerName: 'me',
          finalScore: 64.25,
          prizeWon: 300,
          isCurrentUser: true,
          horsePointsAwarded: 27,
          statGain: { stat: 'precision', gain: 1 },
          conformationAward: null,
        },
        {
          rank: 3,
          horseId: 5,
          horseName: 'Apple',
          ownerName: 'stacey',
          finalScore: 80,
          prizeWon: 200,
          isCurrentUser: false,
          horsePointsAwarded: 30,
          statGain: null,
          conformationAward: null,
        },
      ],
    });
  });

  it('leaves a placement nobody took as null, not 0, in the prize distribution', () => {
    const mapped = toCompetitionResults(
      envelope({
        results: [
          row({ placement: 1, prizeWon: 500 }),
          row({ horseId: 2, placement: 2, prizeWon: 300 }),
        ],
      })
    );

    expect(mapped.prizeDistribution).toEqual({ first: 500, second: 300, third: null });
  });

  it('has no prize pool or distribution for a conformation show', () => {
    const mapped = toCompetitionResults(
      envelope({
        show: { ...header, discipline: 'conformation', showType: 'conformation', prize: 0 },
        results: [row({ prizeWon: null, conformationAward: { ribbon: 'Blue', titlePoints: 10 } })],
      })
    );

    expect(mapped.prizePool).toBeNull();
    expect(mapped.prizeDistribution).toBeNull();
    expect(mapped.results[0]).toMatchObject({
      prizeWon: null,
      conformationAward: { ribbon: 'Blue', titlePoints: 10 },
    });
  });

  it('falls back to the execution time when there are no results, and to null without a show', () => {
    expect(toCompetitionResults(envelope({ results: [] })).date).toBe('2026-10-10T07:03:00.000Z');

    const missing = toCompetitionResults({
      success: true,
      showId: 9,
      count: 0,
      show: null,
      results: [],
    });
    expect(missing).toMatchObject({
      competitionId: 9,
      competitionName: null,
      discipline: null,
      showType: null,
      date: null,
      totalParticipants: 0,
      prizePool: null,
      prizeDistribution: null,
      results: [],
    });
  });
});

describe('fetchCompetitionResults', () => {
  it('reads the show results route and returns the mapped results', async () => {
    const calledPaths: string[] = [];
    server.use(
      http.get(`${base}/api/v1/competition/show/:showId/results`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json(envelope({ results: [row({})] }));
      })
    );

    const results = await fetchCompetitionResults(42);

    expect(calledPaths).toEqual(['/api/v1/competition/show/42/results']);
    expect(results.competitionName).toBe('Moonlit Dressage Classic');
    expect(results.results).toHaveLength(1);
  });
});
