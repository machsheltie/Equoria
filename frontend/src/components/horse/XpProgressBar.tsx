/**
 * XpProgressBar — the horse's Points toward its next stat (Equoria-a0fim).
 *
 * Owner ruling 2026-10-28: Horse Points do NOT equal a level. They are a
 * bankable currency: every 1,000 earns one stat point the player allocates to
 * the stat of her choice (bible Vol 13, LOCKED). So the bar reads
 * "X / 1000 Points" toward the next stat, says plainly how many stats are
 * ready when banked points have earned some, and offers Allocate Stats.
 * Old contract (Story 3-4): a "Level N" header, a level-up tooltip and reward
 * toasts at 25/50/75/100% — all gone with the level framing.
 *
 * The threshold comes from the server (`pointsPerStatPoint`); the bar holds no
 * number of its own (Equoria-576c0 B13).
 */

import { useId, useState } from 'react';
import { userMessageFor } from '@/lib/http/userMessage';
import { useAllocateStat, useHorseXP } from '@/hooks/api/useHorseXP';
import FenceJumpBar from '@/components/ui/FenceJumpBar';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import '@/styles/horseProgression.css';

interface XpProgressBarProps {
  horseId: number;
}

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

/** "1 stat is ready to allocate." / "3 stats are ready to allocate." */
export function statsReadyLine(ready: number): string {
  return ready === 1 ? '1 stat is ready to allocate.' : `${ready} stats are ready to allocate.`;
}

/** The stat picker and its one button; shown once Allocate Stats is opened. */
function AllocateStats({ horseId, ready }: { horseId: number; ready: number }) {
  const selectId = useId();
  const [statName, setStatName] = useState(allocatableStats[0].value);
  const allocate = useAllocateStat(horseId);

  return (
    <div className="horse-allocate" data-testid="allocate-stats">
      {ready > 0 && (
        <>
          <label htmlFor={selectId} className="fantasy-caption text-[var(--text-secondary)]">
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
        <p className="fantasy-body text-[var(--text-primary)]" role="status">
          {statLabel(allocate.data.statName)} is now {allocate.data.newStatValue}.
        </p>
      )}
    </div>
  );
}

const XpProgressBar = ({ horseId }: XpProgressBarProps) => {
  const { data: xpData, isPending, error, isError, refetch } = useHorseXP(horseId);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const allocateRegionId = useId();

  if (isPending) {
    return <SectionLoading label="Loading Points" minHeight="64px" />;
  }

  if (isError || !xpData) {
    return (
      <div className="flex items-center gap-3" data-testid="horse-points-error">
        <InlineError message={userMessageFor(error).message} />
        <button
          type="button"
          className="fantasy-caption underline text-[var(--text-secondary)]"
          onClick={() => refetch()}
        >
          Try Again
        </button>
      </div>
    );
  }

  const perStat = xpData.pointsPerStatPoint;
  const towardNext = perStat - xpData.xpToNextStatPoint;
  const percent = perStat > 0 ? Math.round((towardNext / perStat) * 100) : 0;
  const ready = xpData.availableStatPoints;

  return (
    <section className="horse-points" aria-labelledby="horse-points-heading">
      <h3 id="horse-points-heading" className="type-section-heading mb-3">
        Points
      </h3>
      <FenceJumpBar
        value={percent}
        label={`${towardNext} of ${perStat} Points toward the next stat`}
      />
      <p className="horse-points__count fantasy-body" data-testid="horse-points-count">
        {towardNext} / {perStat} Points
      </p>
      {ready > 0 && (
        <>
          <p className="fantasy-body text-[var(--text-primary)]" data-testid="stats-ready">
            {statsReadyLine(ready)}
          </p>
          <Button
            type="button"
            variant="link"
            aria-expanded={allocateOpen}
            aria-controls={allocateRegionId}
            onClick={() => setAllocateOpen((open) => !open)}
          >
            Allocate Stats
          </Button>
        </>
      )}
      <div id={allocateRegionId}>
        {allocateOpen && <AllocateStats horseId={horseId} ready={ready} />}
      </div>
    </section>
  );
};

export default XpProgressBar;
