/**
 * ShowRecordSection — the horse's record on its main page (Equoria-b4msy;
 * owner request 2026-10-28): its Points (cumulative Horse Points earned), its
 * Wins / Places / Shows, and its Winnings.
 *
 * Wins / Places / Shows reads as the show-ring record: 1st, 2nd and 3rd place
 * finishes. Winnings is the prize money of every recorded result, the same
 * results the Show Results tab lists. A quiet ledger in the Horse Details
 * style, never tiles. Unknown is an em dash, never a fake zero.
 */

import React from 'react';
import Currency from '@/components/ui/Currency';
import { InlineError } from '@/components/ui/state';
import { useHorseXP } from '@/hooks/api/useHorseXP';
import { useHorseCompetitionHistory } from '@/hooks/api/useHorseCompetitionHistory';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/horseCare.css';

const UNKNOWN = '—';

/** A count the server actually sent; anything else is unknown, never 0. */
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** One failed read: said in place, with a real retry. */
const ReadError: React.FC<{ error: unknown; onRetry: () => void; testId: string }> = ({
  error,
  onRetry,
  testId,
}) => (
  <div className="flex items-center gap-3" data-testid={testId}>
    <InlineError message={userMessageFor(error).message} />
    <button
      type="button"
      className="fantasy-caption underline text-[var(--text-secondary)]"
      onClick={onRetry}
    >
      Try Again
    </button>
  </div>
);

const ShowRecordSection: React.FC<{ horseId: number }> = ({ horseId }) => {
  const points = useHorseXP(horseId);
  const record = useHorseCompetitionHistory(horseId);
  const stats = record.data?.statistics;
  const currentPoints = points.data?.currentXP;
  const placings =
    stats && isCount(stats.wins) && isCount(stats.secondPlaces) && isCount(stats.thirdPlaces)
      ? `${stats.wins} / ${stats.secondPlaces} / ${stats.thirdPlaces}`
      : null;

  return (
    <section aria-labelledby="show-record-heading" data-testid="show-record">
      <h3 id="show-record-heading" className="type-section-heading mb-3">
        Show Record
      </h3>
      <dl className="horse-status__record">
        <div className="horse-status__row">
          <dt>Points</dt>
          <dd data-testid="record-points">
            {isCount(currentPoints) ? currentPoints.toLocaleString() : UNKNOWN}
          </dd>
        </div>
        <div className="horse-status__row">
          <dt>Wins / Places / Shows</dt>
          <dd data-testid="record-placings">{placings ?? UNKNOWN}</dd>
        </div>
        <div className="horse-status__row">
          <dt>Winnings</dt>
          <dd data-testid="record-winnings">
            {stats && isCount(stats.totalPrizeMoney) ? (
              <Currency amount={stats.totalPrizeMoney} />
            ) : (
              UNKNOWN
            )}
          </dd>
        </div>
      </dl>
      {(points.isPending || record.isPending) && (
        <p className="fantasy-caption text-[var(--text-muted)] mt-3" role="status">
          Loading the show record…
        </p>
      )}
      {points.isError && (
        <ReadError
          error={points.error}
          onRetry={() => points.refetch()}
          testId="record-points-error"
        />
      )}
      {record.isError && (
        <ReadError
          error={record.error}
          onRetry={() => record.refetch()}
          testId="record-results-error"
        />
      )}
    </section>
  );
};

export default ShowRecordSection;
