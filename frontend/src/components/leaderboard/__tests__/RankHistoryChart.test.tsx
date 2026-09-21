/**
 * RankHistoryChart — Season Timeline tests (Equoria-d6a47, succeeds Equoria-l332)
 *
 * The Recharts line chart was replaced by an authored season timeline (owner
 * ruling Equoria-ij7ev, 2026-09-11). These tests assert the substance of the
 * timeline with real, non-empty series:
 * - one lane per leaderboard category, snapshots in chronological order
 *   regardless of the order the API delivered them
 * - inverted rank semantics: a falling rank number is written as a climb,
 *   a rising one as a slip, an unchanged one as held
 * - the current standing and the season best are marked
 * - the honest loading / error / empty states (and the timeline is ABSENT
 *   in those states)
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RankHistoryChart from '../RankHistoryChart';
import type { RankHistorySeries } from '@/lib/api/leaderboards';

const sampleSeries: RankHistorySeries[] = [
  {
    category: 'level',
    categoryLabel: 'Level',
    points: [
      { rank: 12, capturedAt: '2026-05-01T12:00:00.000Z' },
      { rank: 9, capturedAt: '2026-05-08T12:00:00.000Z' },
      { rank: 7, capturedAt: '2026-05-15T12:00:00.000Z' },
    ],
  },
  {
    category: 'xp',
    categoryLabel: 'XP',
    points: [
      { rank: 30, capturedAt: '2026-05-01T12:00:00.000Z' },
      { rank: 22, capturedAt: '2026-05-15T12:00:00.000Z' },
    ],
  },
  {
    category: 'horse-earnings',
    categoryLabel: 'Horse Earnings',
    points: [
      { rank: 5, capturedAt: '2026-05-01T12:00:00.000Z' },
      { rank: 8, capturedAt: '2026-05-08T12:00:00.000Z' },
      { rank: 8, capturedAt: '2026-05-15T12:00:00.000Z' },
    ],
  },
];

describe('RankHistoryChart (season timeline)', () => {
  describe('honest states', () => {
    it('renders the empty state (and NOT the timeline) when series is empty', () => {
      render(<RankHistoryChart series={[]} />);
      expect(screen.getByTestId('rank-history-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('rank-history-timeline')).not.toBeInTheDocument();
    });

    it('renders the loading state when isLoading', () => {
      render(<RankHistoryChart series={[]} isLoading />);
      expect(screen.getByTestId('rank-history-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('rank-history-timeline')).not.toBeInTheDocument();
    });

    it('renders the error state when errorMessage is provided', () => {
      render(<RankHistoryChart series={[]} errorMessage="boom" />);
      expect(screen.getByTestId('rank-history-error')).toHaveTextContent('boom');
      expect(screen.queryByTestId('rank-history-timeline')).not.toBeInTheDocument();
    });

    it('treats a series whose points are all empty as no data (empty state)', () => {
      const emptyPoints: RankHistorySeries[] = [
        { category: 'level', categoryLabel: 'Level', points: [] },
      ];
      render(<RankHistoryChart series={emptyPoints} />);
      expect(screen.getByTestId('rank-history-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('rank-history-timeline')).not.toBeInTheDocument();
    });
  });

  describe('with real series data', () => {
    it('renders one lane per category, each with one snapshot per point', () => {
      render(<RankHistoryChart series={sampleSeries} />);
      expect(screen.getByTestId('rank-history-timeline')).toBeInTheDocument();
      expect(screen.queryByTestId('rank-history-empty')).not.toBeInTheDocument();

      const lanes = screen.getAllByTestId(/^rank-lane-/);
      expect(lanes.length).toBe(3);

      const level = screen.getByTestId('rank-lane-level');
      const xp = screen.getByTestId('rank-lane-xp');
      expect(within(level).getAllByRole('listitem')).toHaveLength(3);
      expect(within(xp).getAllByRole('listitem')).toHaveLength(2);
      expect(within(level).getByText('Level')).toBeInTheDocument();
      expect(within(xp).getByText('XP')).toBeInTheDocument();
    });

    it('places snapshots in chronological order even when the API delivers them shuffled', () => {
      const shuffled: RankHistorySeries[] = [
        {
          category: 'level',
          categoryLabel: 'Level',
          points: [
            { rank: 7, capturedAt: '2026-05-15T12:00:00.000Z' },
            { rank: 12, capturedAt: '2026-05-01T12:00:00.000Z' },
            { rank: 9, capturedAt: '2026-05-08T12:00:00.000Z' },
          ],
        },
      ];
      render(<RankHistoryChart series={shuffled} />);
      const items = within(screen.getByTestId('rank-lane-level')).getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
      expect(items.map((li) => li.getAttribute('data-rank'))).toEqual(['12', '9', '7']);
      expect(items.map((li) => li.getAttribute('data-captured-at'))).toEqual([
        '2026-05-01T12:00:00.000Z',
        '2026-05-08T12:00:00.000Z',
        '2026-05-15T12:00:00.000Z',
      ]);
      // Each snapshot states its rank outright and stamps its date.
      expect(within(items[0]).getByText('#12')).toBeInTheDocument();
      expect(within(items[0]).getByText('May 1')).toBeInTheDocument();
      expect(within(items[2]).getByText('May 15')).toBeInTheDocument();
    });

    it('writes a falling rank number as a climb (rank 1 is best)', () => {
      render(<RankHistoryChart series={sampleSeries} />);
      const level = screen.getByTestId('rank-lane-level');
      const moves = within(level).getAllByTestId('rank-movement');
      expect(moves).toHaveLength(2);
      expect(moves.map((m) => m.getAttribute('data-direction'))).toEqual(['climb', 'climb']);
      expect(moves[0]).toHaveTextContent('climbed 3');
      expect(moves[1]).toHaveTextContent('climbed 2');
    });

    it('writes a rising rank number as a slip and an unchanged one as held', () => {
      render(<RankHistoryChart series={sampleSeries} />);
      const earnings = screen.getByTestId('rank-lane-horse-earnings');
      const moves = within(earnings).getAllByTestId('rank-movement');
      expect(moves).toHaveLength(2);
      expect(moves.map((m) => m.getAttribute('data-direction'))).toEqual(['slip', 'hold']);
      expect(moves[0]).toHaveTextContent('slipped 3');
      expect(moves[1]).toHaveTextContent('held');
    });

    it('marks the latest snapshot as the current standing and the best rank as the season best', () => {
      render(<RankHistoryChart series={sampleSeries} />);

      const level = within(screen.getByTestId('rank-lane-level')).getAllByRole('listitem');
      expect(level.map((li) => li.getAttribute('data-current'))).toEqual([
        'false',
        'false',
        'true',
      ]);
      expect(level.map((li) => li.getAttribute('data-best'))).toEqual(['false', 'false', 'true']);

      // Earnings: 5 → 8 → 8. The best rank (5) is the FIRST snapshot, not the
      // current one — best is the lowest number, never "the latest".
      const earnings = within(screen.getByTestId('rank-lane-horse-earnings')).getAllByRole(
        'listitem'
      );
      expect(earnings.map((li) => li.getAttribute('data-best'))).toEqual([
        'true',
        'false',
        'false',
      ]);
      expect(earnings.map((li) => li.getAttribute('data-current'))).toEqual([
        'false',
        'false',
        'true',
      ]);
    });

    it('summarises each lane as the current standing and the season best', () => {
      render(<RankHistoryChart series={sampleSeries} />);
      const summary = within(screen.getByTestId('rank-lane-horse-earnings')).getByTestId(
        'rank-standing-summary'
      );
      expect(summary).toHaveTextContent('now #8');
      expect(summary).toHaveTextContent('best #5');
    });

    it('drops a category with no points but keeps the others', () => {
      const mixed: RankHistorySeries[] = [
        { category: 'level', categoryLabel: 'Level', points: [] },
        sampleSeries[1],
      ];
      render(<RankHistoryChart series={mixed} />);
      expect(screen.getByTestId('rank-history-timeline')).toBeInTheDocument();
      expect(screen.queryByTestId('rank-lane-level')).not.toBeInTheDocument();
      expect(screen.getByTestId('rank-lane-xp')).toBeInTheDocument();
    });
  });
});
