/**
 * RankHistoryChart — the Season Timeline of rank (Equoria-d6a47)
 *
 * Successor to the Recharts line chart, per the owner ruling on Equoria-ij7ev
 * (2026-09-11): an authored season timeline, not a line chart. One lane per
 * leaderboard category; each lane is a chronological rail of snapshots. Every
 * snapshot states the rank outright ("#7") beneath its date, and the movement
 * since the previous snapshot is written in words — rank 1 is best, so a
 * falling number is a climb and a rising one is a slip. The current standing
 * is lantern-lit on the rail and the season's best rank carries a star.
 *
 * Presentational only — ProfilePage supplies the fetched series plus
 * loading/error state (Equoria-l332). The file keeps its historical name so
 * the call site and its tests are undisturbed.
 */

import React, { memo, useMemo } from 'react';
import { formatDate } from '@/lib/formatDate';
import type { RankHistoryPoint, RankHistorySeries } from '@/lib/api/leaderboards';

export interface RankHistoryChartProps {
  series: RankHistorySeries[];
  isLoading?: boolean;
  /** Error message to show instead of the timeline, if any. */
  errorMessage?: string;
}

type Movement =
  | { direction: 'climb'; places: number }
  | { direction: 'slip'; places: number }
  | { direction: 'hold'; places: 0 };

interface SeasonEntry extends RankHistoryPoint {
  /** Movement since the previous snapshot; absent on the first. */
  movement?: Movement;
  isCurrent: boolean;
  isBest: boolean;
}

interface SeasonLane {
  category: string;
  label: string;
  entries: SeasonEntry[];
  current: number;
  best: number;
}

function formatDateLabel(iso: string): string {
  // Equoria-2dnd2: route through the shared util for consistency with every
  // other date display (all en-US). The raw `iso` is the fallback — the util's
  // guard means an unparseable iso falls back to itself rather than throwing.
  return formatDate(iso, { month: 'short', day: 'numeric' }, iso);
}

function movementBetween(previous: number, next: number): Movement {
  // Lower rank number is better: 12 → 9 is a climb of 3 places.
  const delta = previous - next;
  if (delta > 0) return { direction: 'climb', places: delta };
  if (delta < 0) return { direction: 'slip', places: -delta };
  return { direction: 'hold', places: 0 };
}

/** Sort each category's points by time and work out movement, current, best. */
export function buildSeasonLanes(series: RankHistorySeries[]): SeasonLane[] {
  const lanes: SeasonLane[] = [];
  for (const s of series) {
    if (!s.points || s.points.length === 0) continue;
    const ordered = [...s.points].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const best = Math.min(...ordered.map((p) => p.rank));
    let bestMarked = false;
    const entries: SeasonEntry[] = ordered.map((point, i) => {
      const isBest = !bestMarked && point.rank === best;
      if (isBest) bestMarked = true;
      return {
        ...point,
        movement: i > 0 ? movementBetween(ordered[i - 1].rank, point.rank) : undefined,
        isCurrent: i === ordered.length - 1,
        isBest,
      };
    });
    lanes.push({
      category: s.category,
      label: s.categoryLabel,
      entries,
      current: ordered[ordered.length - 1].rank,
      best,
    });
  }
  return lanes;
}

/** Four-point celestial star — marks the season's best standing. */
const SeasonBestStar: React.FC = () => (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    aria-hidden="true"
    className="inline-block shrink-0 align-baseline"
  >
    <path
      d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z"
      fill="var(--gold-light)"
    />
  </svg>
);

const MOVEMENT_TONE: Record<Movement['direction'], string> = {
  climb: 'text-[var(--role-success-text)]',
  slip: 'text-[var(--role-warning-text)]',
  hold: 'text-[var(--text-secondary)]',
};

const MovementMark: React.FC<{ movement: Movement }> = ({ movement }) => {
  const words =
    movement.direction === 'climb'
      ? `climbed ${movement.places}`
      : movement.direction === 'slip'
        ? `slipped ${movement.places}`
        : 'held';
  const spoken =
    movement.direction === 'hold'
      ? 'held its place'
      : `${words} ${movement.places === 1 ? 'place' : 'places'}`;

  return (
    <span
      data-testid="rank-movement"
      data-direction={movement.direction}
      className={`mt-1 inline-flex items-center gap-1 text-xs font-[var(--font-body)] tabular-nums ${MOVEMENT_TONE[movement.direction]}`}
    >
      <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" className="shrink-0">
        {movement.direction === 'climb' && <path d="M4 1 L7.5 7 L0.5 7 Z" fill="currentColor" />}
        {movement.direction === 'slip' && <path d="M4 7 L0.5 1 L7.5 1 Z" fill="currentColor" />}
        {movement.direction === 'hold' && (
          <rect x="0.5" y="3.25" width="7" height="1.5" fill="currentColor" />
        )}
      </svg>
      <span aria-hidden="true">{words}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
};

const SeasonSnapshot: React.FC<{ entry: SeasonEntry; index: number; category: string }> = ({
  entry,
  index,
  category,
}) => {
  const dateLabel = formatDateLabel(entry.capturedAt);
  return (
    <li
      data-testid={`rank-entry-${category}-${index}`}
      data-rank={entry.rank}
      data-captured-at={entry.capturedAt}
      data-current={entry.isCurrent ? 'true' : 'false'}
      data-best={entry.isBest ? 'true' : 'false'}
      className="relative flex min-w-[5.5rem] flex-col items-start pr-6 pt-5 before:absolute before:left-0 before:right-0 before:top-[5px] before:h-px before:bg-[var(--alpha-gold-primary-40)]"
    >
      {/* The node on the rail: the current standing is lantern-lit. */}
      <span
        aria-hidden="true"
        className={
          entry.isCurrent
            ? 'absolute left-0 top-0 h-[11px] w-[11px] rounded-full bg-[var(--gold-primary)] shadow-[var(--glow-gold)]'
            : 'absolute left-0 top-0 h-[11px] w-[11px] rounded-full border border-[var(--gold-dim)] bg-[var(--bg-night-sky)]'
        }
      />
      <time
        dateTime={entry.capturedAt}
        className="text-xs font-[var(--font-body)] text-[var(--text-secondary)]"
      >
        {dateLabel}
      </time>
      <span
        className={`mt-0.5 inline-flex items-center gap-1 font-[var(--font-body)] font-semibold leading-none tabular-nums ${
          entry.isCurrent
            ? 'text-lg text-[var(--gold-light)]'
            : 'text-base text-[var(--text-primary)]'
        }`}
      >
        <span className="sr-only">rank </span>
        <span>#{entry.rank}</span>
        {entry.isBest && (
          <>
            <SeasonBestStar />
            <span className="sr-only">, season best</span>
          </>
        )}
        {entry.isCurrent && <span className="sr-only">, current standing</span>}
      </span>
      {entry.movement && <MovementMark movement={entry.movement} />}
    </li>
  );
};

const RankHistoryChartImpl: React.FC<RankHistoryChartProps> = ({
  series,
  isLoading = false,
  errorMessage,
}) => {
  const lanes = useMemo(() => buildSeasonLanes(series ?? []), [series]);

  if (isLoading) {
    return (
      <div
        data-testid="rank-history-loading"
        className="py-6 text-center text-xs text-[var(--text-secondary)]"
      >
        Loading rank history…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        data-testid="rank-history-error"
        role="alert"
        className="py-6 text-center text-xs text-[var(--role-danger-text)]"
      >
        {errorMessage}
      </div>
    );
  }

  if (lanes.length === 0) {
    return (
      <div
        data-testid="rank-history-empty"
        className="py-6 text-center text-xs text-[var(--text-secondary)]"
      >
        No rank history yet — check back after a few days of play.
      </div>
    );
  }

  return (
    <div data-testid="rank-history-timeline" className="space-y-5">
      {lanes.map((lane) => (
        <section
          key={lane.category}
          data-testid={`rank-lane-${lane.category}`}
          aria-label={`${lane.label} rank over the season`}
        >
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="type-label">{lane.label}</h3>
            <p
              data-testid="rank-standing-summary"
              className="text-xs font-[var(--font-body)] tabular-nums text-[var(--text-secondary)]"
            >
              now <span className="font-semibold text-[var(--gold-light)]">#{lane.current}</span>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              best #{lane.best}
            </p>
          </header>
          <div className="overflow-x-auto pb-1">
            <ol className="flex min-w-max" aria-label={`${lane.label} snapshots, oldest first`}>
              {lane.entries.map((entry, index) => (
                <SeasonSnapshot
                  key={`${entry.capturedAt}-${index}`}
                  entry={entry}
                  index={index}
                  category={lane.category}
                />
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
};

export const RankHistoryChart = memo(RankHistoryChartImpl);
export default RankHistoryChart;
