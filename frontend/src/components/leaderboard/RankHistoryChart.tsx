/**
 * RankHistoryChart Component
 *
 * Renders a multi-series Recharts LineChart of a user's historical rank over
 * time, one line per leaderboard category (level / xp / horse-earnings /
 * horse-performance). Rank axis is inverted so "up = better" (rank 1 at top).
 *
 * Presentational only — the container (ProfilePage) supplies the fetched
 * series plus loading/error state. Equoria-l332.
 *
 * Established pattern: Recharts Integration (PATTERN_LIBRARY.md Epic 5).
 */

import React, { memo, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { RankHistorySeries } from '@/lib/api/leaderboards';

export interface RankHistoryChartProps {
  series: RankHistorySeries[];
  isLoading?: boolean;
  /** Error message to show instead of the chart, if any. */
  errorMessage?: string;
}

/** Stable colour per category so the legend/lines don't reshuffle. */
const CATEGORY_COLORS: Record<string, string> = {
  level: '#f5c451', // gold
  xp: '#7dd3fc', // sky
  'horse-earnings': '#86efac', // green
  'horse-performance': '#c4b5fd', // violet
};

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Merge the per-category series into a single row-per-timestamp dataset that
 * Recharts can plot as multiple <Line> series keyed by category.
 */
function buildChartData(series: RankHistorySeries[]) {
  const byTime = new Map<string, Record<string, number | string>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byTime.get(p.capturedAt) ?? { capturedAt: p.capturedAt };
      row[s.category] = p.rank;
      byTime.set(p.capturedAt, row);
    }
  }
  return Array.from(byTime.values()).sort((a, b) =>
    String(a.capturedAt).localeCompare(String(b.capturedAt))
  );
}

const RankHistoryChartImpl: React.FC<RankHistoryChartProps> = ({
  series,
  isLoading = false,
  errorMessage,
}) => {
  const chartData = useMemo(() => buildChartData(series ?? []), [series]);

  if (isLoading) {
    return (
      <div
        data-testid="rank-history-loading"
        className="text-xs text-[var(--text-secondary)] py-6 text-center"
      >
        Loading rank history…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div data-testid="rank-history-error" className="text-xs text-red-400 py-6 text-center">
        {errorMessage}
      </div>
    );
  }

  if (!series || series.length === 0 || chartData.length === 0) {
    return (
      <div
        data-testid="rank-history-empty"
        className="text-xs text-[var(--text-secondary)] py-6 text-center"
      >
        No rank history yet — check back after a few days of play.
      </div>
    );
  }

  return (
    <div data-testid="rank-history-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
          <XAxis
            dataKey="capturedAt"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11 }}
            stroke="var(--text-secondary)"
          />
          {/* Reversed so rank 1 (best) sits at the top of the chart. */}
          <YAxis
            reversed
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            stroke="var(--text-secondary)"
            label={{ value: 'Rank', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value: number, name: string) => {
              const s = series.find((x) => x.category === name);
              return [`#${value}`, s?.categoryLabel ?? name];
            }}
          />
          <Legend
            formatter={(value: string) =>
              series.find((s) => s.category === value)?.categoryLabel ?? value
            }
          />
          {series.map((s) => (
            <Line
              key={s.category}
              type="monotone"
              dataKey={s.category}
              name={s.category}
              stroke={CATEGORY_COLORS[s.category] ?? '#94a3b8'}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RankHistoryChart = memo(RankHistoryChartImpl);
export default RankHistoryChart;
