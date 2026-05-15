/**
 * RankHistoryChart Component Tests (Equoria-l332)
 *
 * Verifies the presentational rank-trend chart:
 * - Empty / loading / error states render their honest placeholders
 *   (and the chart itself is ABSENT in those states)
 * - With real series data the chart container IS rendered with one
 *   <Line> per category
 *
 * Recharts is mocked to lightweight DOM (JSDOM has no layout) so we can
 * assert which series get plotted without a real SVG renderer.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RankHistoryChart from '../RankHistoryChart';
import type { RankHistorySeries } from '@/lib/api/leaderboards';

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`rank-line-${dataKey}`} />,
  };
});

const sampleSeries: RankHistorySeries[] = [
  {
    category: 'level',
    categoryLabel: 'Level',
    points: [
      { rank: 12, capturedAt: '2026-05-01T00:00:00.000Z' },
      { rank: 9, capturedAt: '2026-05-08T00:00:00.000Z' },
      { rank: 7, capturedAt: '2026-05-15T00:00:00.000Z' },
    ],
  },
  {
    category: 'xp',
    categoryLabel: 'XP',
    points: [
      { rank: 30, capturedAt: '2026-05-01T00:00:00.000Z' },
      { rank: 22, capturedAt: '2026-05-15T00:00:00.000Z' },
    ],
  },
];

describe('RankHistoryChart', () => {
  it('renders the empty state (and NOT the chart) when series is empty', () => {
    render(<RankHistoryChart series={[]} />);
    expect(screen.getByTestId('rank-history-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('rank-history-chart')).not.toBeInTheDocument();
  });

  it('renders the loading state when isLoading', () => {
    render(<RankHistoryChart series={[]} isLoading />);
    expect(screen.getByTestId('rank-history-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('rank-history-chart')).not.toBeInTheDocument();
  });

  it('renders the error state when errorMessage is provided', () => {
    render(<RankHistoryChart series={[]} errorMessage="boom" />);
    expect(screen.getByTestId('rank-history-error')).toHaveTextContent('boom');
    expect(screen.queryByTestId('rank-history-chart')).not.toBeInTheDocument();
  });

  it('renders the chart with one line per category when data is present', () => {
    render(<RankHistoryChart series={sampleSeries} />);
    expect(screen.getByTestId('rank-history-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('rank-history-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('rank-line-level')).toBeInTheDocument();
    expect(screen.getByTestId('rank-line-xp')).toBeInTheDocument();
  });

  it('treats a series whose points are all empty as no data (empty state)', () => {
    const emptyPoints: RankHistorySeries[] = [
      { category: 'level', categoryLabel: 'Level', points: [] },
    ];
    render(<RankHistoryChart series={emptyPoints} />);
    expect(screen.getByTestId('rank-history-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('rank-history-chart')).not.toBeInTheDocument();
  });
});
