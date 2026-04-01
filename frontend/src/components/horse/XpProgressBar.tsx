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

import { useState } from 'react';
import { useHorseXP } from '@/hooks/api/useHorseXP';
import FenceJumpBar from '@/components/ui/FenceJumpBar';

interface XpProgressBarProps {
  horseId: number;
}

const XpProgressBar = ({ horseId }: XpProgressBarProps) => {
  const { data: xpData, isLoading, error, isError, refetch } = useHorseXP(horseId);
  const [showTooltip, setShowTooltip] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">Loading XP data...</div>
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

  // Calculate level and progress
  const level = xpData.availableStatPoints + 1;
  const xpInCurrentLevel = xpData.currentXP - xpData.availableStatPoints * 100;
  const progressPercentage = Math.round((xpInCurrentLevel / 100) * 100);

  return (
    <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 shadow-sm">
      {/* Header: Level Display */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[rgb(148,163,184)]">Level</p>
          <h3 className="text-2xl font-bold text-emerald-400">Level {level}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-[rgb(148,163,184)]">XP Progress</p>
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
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[rgb(148,163,184)]">
              XP Breakdown
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[rgb(148,163,184)]">Current XP:</span>
                <span className="font-medium text-[rgb(220,235,255)]">{xpData.currentXP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgb(148,163,184)]">Stat Points Earned:</span>
                <span className="font-medium text-[rgb(220,235,255)]">
                  {xpData.availableStatPoints}
                </span>
              </div>
              <div className="flex justify-between border-t border-[rgba(37,99,235,0.3)] pt-1">
                <span className="text-[rgb(148,163,184)]">Next Stat Point:</span>
                <span className="font-medium text-emerald-400">{xpData.xpToNextStatPoint} XP</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Level Info */}
      <div className="mt-2 text-center text-xs text-[rgb(148,163,184)]">
        {xpData.xpToNextStatPoint} XP to Level {level + 1}
      </div>
    </div>
  );
};

export default XpProgressBar;
