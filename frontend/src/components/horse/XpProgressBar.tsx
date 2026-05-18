/**
 * XpProgressBar Component
 *
 * Displays horse XP progress with:
 * - Current level display
 * - Progress bar to next stat point
 * - XP breakdown tooltip
 * - Visual milestone markers
 *
 * Story 3-4: XP & Progression Display - Task 1
 */

import { useEffect, useRef, useState } from 'react';
import { useHorseXP } from '@/hooks/api/useHorseXP';
import FenceJumpBar from '@/components/ui/FenceJumpBar';
import { useRewardToast } from '@/components/feedback';

interface XpProgressBarProps {
  horseId: number;
}

/** FenceJumpBar fence markers — Spec 11.3.10 "threshold crossed (25/50/75/100%)". */
const FENCE_THRESHOLDS = [25, 50, 75, 100] as const;

/** Highest fence threshold at or below a given progress %, else 0. */
function highestThresholdReached(pct: number): number {
  let reached = 0;
  for (const t of FENCE_THRESHOLDS) {
    if (pct >= t) reached = t;
  }
  return reached;
}

const XpProgressBar = ({ horseId }: XpProgressBarProps) => {
  const { data: xpData, isLoading, error, isError, refetch } = useHorseXP(horseId);
  const [showTooltip, setShowTooltip] = useState(false);
  const { notify } = useRewardToast();

  // Derived progress (only valid once data has loaded).
  const hasData = Boolean(xpData);
  const level = xpData ? xpData.availableStatPoints + 1 : 0;
  const xpInCurrentLevel = xpData ? xpData.currentXP - xpData.availableStatPoints * 100 : 0;
  const progressPercentage = xpData ? Math.round((xpInCurrentLevel / 100) * 100) : 0;
  const xpToNext = xpData ? xpData.xpToNextStatPoint : Number.POSITIVE_INFINITY;

  // Meaningful-progress triggers (Spec 11.3.10), sourced from REAL useHorseXP
  // data. Fire only on an actual fence-threshold crossing or when within
  // 10 XP of the next level — routine +5 XP that does not cross a fence
  // produces NO toast (the provider also drops non-meaningful items).
  const prevThresholdRef = useRef<number | null>(null);
  const approachingNotifiedRef = useRef(false);
  useEffect(() => {
    if (!hasData) return;
    const reached = highestThresholdReached(progressPercentage);
    const prev = prevThresholdRef.current;

    // Initialise baseline on first real data without toasting (avoids a
    // spurious toast just for opening the page on an in-progress bar).
    if (prev === null) {
      prevThresholdRef.current = reached;
      approachingNotifiedRef.current = xpToNext <= 10;
      return;
    }

    if (reached > prev) {
      prevThresholdRef.current = reached;
      notify({
        type: reached === 100 ? 'level-up' : 'milestone',
        title:
          reached === 100 ? `Level ${level + 1} reached!` : `${reached}% to Level ${level + 1}`,
        message:
          reached === 100
            ? `${xpData?.currentXP ?? 0} XP — a new stat point is ready.`
            : `Keep going — ${xpToNext} XP to the next level.`,
        meaningful: true,
      });
    } else if (reached < prev) {
      // Bar reset after a level-up — re-arm for the new level.
      prevThresholdRef.current = reached;
      approachingNotifiedRef.current = false;
    }

    // Approaching level-up (within 10 XP) — fire once per level.
    if (xpToNext <= 10 && !approachingNotifiedRef.current) {
      approachingNotifiedRef.current = true;
      notify({
        type: 'level-up',
        title: `Almost Level ${level + 1}!`,
        message: `Just ${xpToNext} XP to go.`,
        meaningful: true,
      });
    } else if (xpToNext > 10) {
      approachingNotifiedRef.current = false;
    }
  }, [hasData, progressPercentage, xpToNext, level, notify, xpData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 shadow-sm">
        <div className="text-center text-sm text-slate-400">Loading XP data...</div>
      </div>
    );
  }

  // Error state
  if (isError || !xpData) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-4 shadow-sm">
        <div className="text-sm text-rose-400">{error?.message || 'Failed to fetch XP data'}</div>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded bg-rose-600 px-3 py-1 text-sm text-[var(--text-primary)] hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // level / xpInCurrentLevel / progressPercentage are computed once at the
  // top of the component (so the meaningful-progress effect can read them).
  // After the early returns xpData is guaranteed defined, so those hoisted
  // values are final here.

  return (
    <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 shadow-sm">
      {/* Header: Level Display */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Level</p>
          <h3 className="text-2xl font-bold text-emerald-400">Level {level}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">XP Progress</p>
          <p className="text-sm font-medium text-[rgb(220,235,255)]">
            {xpData.currentXP} / {xpData.nextStatPointAt} XP
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
      >
        <FenceJumpBar
          value={progressPercentage}
          label={`Level ${level} progress: ${xpData.currentXP} of ${xpData.nextStatPointAt} XP to next stat point`}
        />

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 top-full z-[var(--z-raised)] mt-2 w-64 -translate-x-1/2 rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-3 shadow-lg">
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              XP Breakdown
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Current XP:</span>
                <span className="font-medium text-[rgb(220,235,255)]">{xpData.currentXP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stat Points Earned:</span>
                <span className="font-medium text-[rgb(220,235,255)]">
                  {xpData.availableStatPoints}
                </span>
              </div>
              <div className="flex justify-between border-t border-[rgba(37,99,235,0.3)] pt-1">
                <span className="text-slate-400">Next Stat Point:</span>
                <span className="font-medium text-emerald-400">{xpData.xpToNextStatPoint} XP</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Level Info */}
      <div className="mt-2 text-center text-xs text-slate-400">
        {xpData.xpToNextStatPoint} XP to Level {level + 1}
      </div>
    </div>
  );
};

export default XpProgressBar;
