/**
 * ShowRecordLine — the horse's show record, right under its name at the top of
 * the horse page, before the stats (owner rulings q225 / q224 / q215,
 * 2026-10-28; Equoria-b4msy):
 *
 *   Win/Place/Show: 4/3/1   Winnings: 12,500   Points: 2,350
 *
 * Win/Place/Show counts 1st, 2nd and 3rd place finishes; Winnings is the prize
 * money of every recorded result; Points is the horse's cumulative Horse
 * Points. Visitors see it too (q215): the visitor view passes the record its
 * own read returns to the same line. Old contract, replaced by q225: a
 * separate "Show Record" section below Care Team.
 *
 * Unknown is an em dash, never a fake zero.
 */

import React from 'react';
import Currency from '@/components/ui/Currency';
import { InlineError } from '@/components/ui/state';
import { useHorseXP } from '@/hooks/api/useHorseXP';
import { useHorseCompetitionHistory } from '@/hooks/api/useHorseCompetitionHistory';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/horseCare.css';

const unknownValue = '—';

/** A count the server actually sent; anything else is unknown, never 0. */
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export interface ShowRecordValues {
  wins?: number | null;
  secondPlaces?: number | null;
  thirdPlaces?: number | null;
  winnings?: number | null;
  points?: number | null;
}

/** The line itself: three facts, each unknown until the server sent it. */
export const ShowRecordLine: React.FC<{ record: ShowRecordValues }> = ({ record }) => {
  const placings =
    isCount(record.wins) && isCount(record.secondPlaces) && isCount(record.thirdPlaces)
      ? `${record.wins}/${record.secondPlaces}/${record.thirdPlaces}`
      : null;
  return (
    <dl className="horse-record-line" data-testid="show-record" aria-label="Show record">
      <div>
        <dt>Win/Place/Show:</dt>
        <dd data-testid="record-placings">{placings ?? unknownValue}</dd>
      </div>
      <div>
        <dt>Winnings:</dt>
        <dd data-testid="record-winnings">
          {isCount(record.winnings) ? <Currency amount={record.winnings} /> : unknownValue}
        </dd>
      </div>
      <div>
        <dt>Points:</dt>
        <dd data-testid="record-points">
          {isCount(record.points) ? record.points.toLocaleString() : unknownValue}
        </dd>
      </div>
    </dl>
  );
};

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

/** The owner's own horse: the record read from her horse's Points and results. */
const OwnShowRecord: React.FC<{ horseId: number }> = ({ horseId }) => {
  const points = useHorseXP(horseId);
  const results = useHorseCompetitionHistory(horseId);
  const stats = results.data?.statistics;

  return (
    <div>
      <ShowRecordLine
        record={{
          wins: stats?.wins,
          secondPlaces: stats?.secondPlaces,
          thirdPlaces: stats?.thirdPlaces,
          winnings: stats?.totalPrizeMoney,
          points: points.data?.currentXP,
        }}
      />
      {(points.isPending || results.isPending) && (
        <p className="fantasy-caption text-[var(--text-muted)]" role="status">
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
      {results.isError && (
        <ReadError
          error={results.error}
          onRetry={() => results.refetch()}
          testId="record-results-error"
        />
      )}
    </div>
  );
};

export default OwnShowRecord;
