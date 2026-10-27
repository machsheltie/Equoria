/**
 * ShowResultsTab — the horse's show record (Equoria-q4uem.10.1).
 *
 * Owner rulings: C18-A (this tab replaces the Competitions tab), R7 (date,
 * show, competition type, placement, Horse Points, winnings, and the owner's
 * stat gain), R5 (no score breakdown). Every show the horse was entered in, in
 * the server's order: upcoming first, then newest first. Unknown values show
 * "—", never 0. Dates are Eastern calendar dates.
 *
 * Composition: the Records family's quiet ledger (DESIGN.md) — an ordered
 * list of entries laid out as aligned columns on wide screens and as stacked
 * entries on a phone (no sideways scrolling). Authored CSS in
 * ShowResultsTab.css; podium metals for 1st-3rd always paired with the ordinal
 * text.
 */

import { useState, type ReactNode } from 'react';
import Currency from '@/components/ui/Currency';
import { formatDate } from '@/lib/formatDate';
import { useHorseShowResults, type HorseShowResultRow } from '@/lib/api/competitionResults';
import './ShowResultsTab.css';

const UNKNOWN = '—';
const PODIUM: Record<number, 'gold' | 'silver' | 'bronze'> = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
};

type FieldKey = 'date' | 'show' | 'type' | 'placement' | 'points' | 'winnings' | 'gain';
const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'show', label: 'Show' },
  { key: 'type', label: 'Type' },
  { key: 'placement', label: 'Placement' },
  { key: 'points', label: 'Horse Points' },
  { key: 'winnings', label: 'Winnings' },
  { key: 'gain', label: 'Stat gained' },
];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) {
    return `${n}th`;
  }
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

function competitionTypeLabel(row: HorseShowResultRow): string {
  if (row.competitionType.showType === 'conformation') {
    return 'Conformation';
  }
  if (row.competitionType.showType === 'parade') {
    return 'Parade';
  }
  return row.competitionType.discipline ?? UNKNOWN;
}

function PlacementCell({ row }: { row: HorseShowResultRow }) {
  if (row.status === 'upcoming') {
    return <span className="show-ledger__pending">Upcoming</span>;
  }
  if (row.status === 'running') {
    return <span className="show-ledger__pending">Running</span>;
  }
  if (row.placement === null) {
    return <>{UNKNOWN}</>;
  }
  const metal = PODIUM[row.placement];
  return (
    <span className="show-ledger__placement" data-podium={metal}>
      {ordinal(row.placement)}
    </span>
  );
}

function WinningsCell({ row }: { row: HorseShowResultRow }) {
  if (row.conformationAward) {
    return <>{`${row.conformationAward.ribbon} ribbon`}</>;
  }
  if (row.winnings === null) {
    return <>{UNKNOWN}</>;
  }
  return <Currency amount={row.winnings} />;
}

function statGainLabel(row: HorseShowResultRow): string {
  if (!row.statGain) {
    return UNKNOWN;
  }
  const { stat, gain } = row.statGain;
  return `+${gain} ${stat.charAt(0).toUpperCase()}${stat.slice(1)}`;
}

interface ShowResultsTabProps {
  horseId: number;
}

export default function ShowResultsTab({ horseId }: ShowResultsTabProps) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch, isFetching } = useHorseShowResults(horseId, page);

  if (isPending) {
    return (
      <p className="show-ledger__message" role="status">
        Loading show results…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="show-ledger__message" role="alert">
        <p>This horse&rsquo;s show results could not be loaded.</p>
        <button
          type="button"
          className="show-ledger__button"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Try again
        </button>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return <p className="show-ledger__message">No shows entered yet</p>;
  }

  const { pagination } = data;
  return (
    <section className="show-ledger" aria-label="Show results">
      <div className="show-ledger__head" aria-hidden="true">
        {FIELDS.map((f) => (
          <span key={f.key} data-field={f.key}>
            {f.label}
          </span>
        ))}
      </div>
      <ol className="show-ledger__list">
        {data.rows.map((row) => {
          const values: Record<FieldKey, ReactNode> = {
            date: formatDate(row.date, undefined, UNKNOWN),
            show: row.showName ?? UNKNOWN,
            type: competitionTypeLabel(row),
            placement: <PlacementCell row={row} />,
            points: row.horsePointsAwarded ?? UNKNOWN,
            winnings: <WinningsCell row={row} />,
            gain: statGainLabel(row),
          };
          return (
            <li key={row.showId} className="show-ledger__entry" data-status={row.status}>
              {FIELDS.map((f) => (
                <p key={f.key} className="show-ledger__field" data-field={f.key}>
                  <span className="show-ledger__label">{f.label}</span>
                  <span className="show-ledger__value">{values[f.key]}</span>
                </p>
              ))}
            </li>
          );
        })}
      </ol>
      {pagination.totalPages > 1 && (
        <nav className="show-ledger__paging" aria-label="Show results pages">
          <button
            type="button"
            className="show-ledger__button"
            onClick={() => setPage((p) => p - 1)}
            disabled={!pagination.hasPrevPage || isFetching}
          >
            Previous
          </button>
          <span className="show-ledger__page">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="show-ledger__button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNextPage || isFetching}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
