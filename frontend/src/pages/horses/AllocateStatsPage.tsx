/**
 * AllocateStatsPage — /horses/:id/allocate-stats (owner ruling q223,
 * 2026-10-28; Equoria-a0fim).
 *
 * Banked Horse Points earn one stat point per 1,000 (bible Vol 13, LOCKED);
 * the player spends each on the stat of her choice. The owner asked for this
 * to be its own page, linked from the horse page's Points, instead of a picker
 * opened in place on the Progression tab (the old contract).
 *
 * Every number comes from the server: Points toward the next stat, stats ready,
 * and the stat's new value after an allocation.
 */

import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { statsReadyLine } from '@/components/horse/XpProgressBar';
import { useAllocateStat, useHorseXP } from '@/hooks/api/useHorseXP';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/horseProgression.css';

/** The ten competition stats a point may go to, with their authored names. */
const allocatableStats: { value: string; label: string }[] = [
  { value: 'speed', label: 'Speed' },
  { value: 'stamina', label: 'Stamina' },
  { value: 'agility', label: 'Agility' },
  { value: 'balance', label: 'Balance' },
  { value: 'precision', label: 'Precision' },
  { value: 'intelligence', label: 'Intelligence' },
  { value: 'boldness', label: 'Boldness' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'obedience', label: 'Obedience' },
  { value: 'focus', label: 'Focus' },
];

const statLabel = (value: string): string =>
  allocatableStats.find((stat) => stat.value === value)?.label ?? 'The stat';

/**
 * The stat picker and its one button. It stays mounted after the last ready
 * stat is spent, so the line saying what changed is not lost with the picker.
 */
function AllocateStatPicker({ horseId, ready }: { horseId: number; ready: number }) {
  const selectId = useId();
  const [statName, setStatName] = useState(allocatableStats[0].value);
  const allocate = useAllocateStat(horseId);

  return (
    <div className="horse-allocate" data-testid="allocate-stats">
      {ready > 0 && (
        <>
          <label htmlFor={selectId} className="fantasy-caption horse-allocate__label">
            Stat
          </label>
          <div className="horse-allocate__row">
            <select
              id={selectId}
              className="horse-allocate__field"
              value={statName}
              disabled={allocate.isPending}
              onChange={(event) => setStatName(event.target.value)}
            >
              {allocatableStats.map((stat) => (
                <option key={stat.value} value={stat.value}>
                  {stat.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              pending={allocate.isPending}
              onClick={() => allocate.mutate(statName)}
            >
              Allocate
            </Button>
          </div>
        </>
      )}
      {allocate.isError && <InlineError message={userMessageFor(allocate.error).message} />}
      {allocate.isSuccess && (
        <p className="fantasy-body horse-allocate__done" role="status">
          {statLabel(allocate.data.statName)} is now {allocate.data.newStatValue}.
        </p>
      )}
    </div>
  );
}

const AllocateStatsPage = () => {
  const { id } = useParams<{ id: string }>();
  const horseId = Number(id);
  const points = useHorseXP(horseId);

  const horseName = points.data?.horseName;

  return (
    <PageContainer variant="wide">
      <section className="horse-points allocate-page" aria-labelledby="allocate-stats-heading">
        <Link to={`/horses/${horseId}`} className="fantasy-caption horse-points__link">
          Back to {horseName ?? 'the horse'}
        </Link>
        <h1 id="allocate-stats-heading" className="type-entity-title">
          Allocate Stats{horseName ? ` for ${horseName}` : ''}
        </h1>

        {points.isPending ? (
          <SectionLoading label="Loading Points" minHeight="64px" />
        ) : points.isError ? (
          <div className="horse-allocate__row" data-testid="allocate-points-error">
            <InlineError message={userMessageFor(points.error).message} />
            <button
              type="button"
              className="fantasy-caption horse-allocate__retry"
              onClick={() => points.refetch()}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <p className="fantasy-body horse-allocate__done" data-testid="stats-ready">
              {points.data.availableStatPoints > 0
                ? statsReadyLine(points.data.availableStatPoints)
                : 'No stats are ready to allocate.'}
            </p>
            <p className="horse-points__count fantasy-body" data-testid="horse-points-count">
              {points.data.pointsPerStatPoint - points.data.xpToNextStatPoint} /{' '}
              {points.data.pointsPerStatPoint} Points toward the next stat
            </p>
            <AllocateStatPicker horseId={horseId} ready={points.data.availableStatPoints} />
          </>
        )}
      </section>
    </PageContainer>
  );
};

export default AllocateStatsPage;
