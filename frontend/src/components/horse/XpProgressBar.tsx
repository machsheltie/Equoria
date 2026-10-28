/**
 * XpProgressBar — the horse's Points toward its next stat (Equoria-a0fim).
 *
 * Owner ruling 2026-10-28: Horse Points do NOT equal a level. They are a
 * bankable currency: every 1,000 earns one stat point the player allocates to
 * the stat of her choice (bible Vol 13, LOCKED). So the bar reads
 * "X / 1000 Points" toward the next stat, says plainly how many stats are
 * ready when banked points have earned some, and links to Allocate Stats.
 * Owner ruling q223 (2026-10-28): Allocate Stats is its own page
 * (/horses/:id/allocate-stats, AllocateStatsPage); the old contract opened a
 * picker in place here.
 * Old contract (Story 3-4): a "Level N" header, a level-up tooltip and reward
 * toasts at 25/50/75/100% — all gone with the level framing.
 *
 * The threshold comes from the server (`pointsPerStatPoint`); the bar holds no
 * number of its own (Equoria-576c0 B13).
 */

import { Link } from 'react-router';
import { userMessageFor } from '@/lib/http/userMessage';
import { useHorseXP } from '@/hooks/api/useHorseXP';
import FenceJumpBar from '@/components/ui/FenceJumpBar';
import { InlineError, SectionLoading } from '@/components/ui/state';
import '@/styles/horseProgression.css';

interface XpProgressBarProps {
  horseId: number;
}

/** "1 stat is ready to allocate." / "3 stats are ready to allocate." */
export function statsReadyLine(ready: number): string {
  return ready === 1 ? '1 stat is ready to allocate.' : `${ready} stats are ready to allocate.`;
}

const XpProgressBar = ({ horseId }: XpProgressBarProps) => {
  const { data: xpData, isPending, error, isError, refetch } = useHorseXP(horseId);

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
          <Link to={`/horses/${horseId}/allocate-stats`} className="horse-points__link">
            Allocate Stats
          </Link>
        </>
      )}
    </section>
  );
};

export default XpProgressBar;
