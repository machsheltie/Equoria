/**
 * XPProgressBar Component
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

interface XPProgressBarProps {
  horseId: number;
}

const XPProgressBar = ({ horseId }: XPProgressBarProps) => {
  const { data: xpData, isLoading, error, isError, refetch } = useHorseXP(horseId);
  const [showTooltip, setShowTooltip] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-center text-sm text-slate-600">Loading XP data...</div>
      </div>
    );
  }

  // Error state
  if (isError || !xpData) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="text-sm text-rose-800">{error?.message || 'Failed to fetch XP data'}</div>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded bg-rose-600 px-3 py-1 text-sm text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
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

  // Milestone levels
  const milestones = [5, 10, 15, 20, 25];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header: Level Display */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Level</p>
          <h3 className="text-2xl font-bold text-emerald-600">Level {level}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">XP Progress</p>
          <p className="text-sm font-medium text-slate-900">
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
        <div
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Level ${level} progress: ${xpData.currentXP} of ${xpData.nextStatPointAt} XP to next stat point`}
          className="relative h-6 w-full overflow-hidden rounded-full bg-slate-200"
        >
          {/* Progress fill */}
          <div
            data-testid="progress-fill"
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />

          {/* Milestone markers */}
          {milestones.map((milestone) => {
            const isReached = level >= milestone;
            return (
              <div
                key={milestone}
                data-testid={`milestone-${milestone}`}
                className={`absolute top-0 h-full w-0.5 ${
                  isReached ? 'milestone-reached bg-amber-400' : 'bg-slate-300'
                }`}
                style={{ left: `${(milestone / 30) * 100}%` }}
                title={`Level ${milestone}`}
              />
            );
          })}
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              XP Breakdown
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Current XP:</span>
                <span className="font-medium text-slate-900">{xpData.currentXP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Stat Points Earned:</span>
                <span className="font-medium text-slate-900">{xpData.availableStatPoints}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-600">Next Stat Point:</span>
                <span className="font-medium text-emerald-600">{xpData.xpToNextStatPoint} XP</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Level Info */}
      <div className="mt-2 text-center text-xs text-slate-600">
        {xpData.xpToNextStatPoint} XP to Level {level + 1}
      </div>
    </div>
  );
};

export default XPProgressBar;
