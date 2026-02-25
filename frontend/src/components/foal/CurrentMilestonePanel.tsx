/**
 * CurrentMilestonePanel Component
 *
 * Displays detailed information about the foal's current milestone including
 * focus area, days remaining, progress, and enrichment activity recommendations.
 *
 * Story 6-2: Foal Milestone Timeline - Subcomponent
 */

import React from 'react';
import { Target, Clock, TrendingUp, Sparkles } from 'lucide-react';
import type { Milestone } from '@/types/foal';
import { calculateMilestoneProgress } from '@/types/foal';

export interface CurrentMilestonePanelProps {
  milestone: Milestone;
  foalAge: number;
  daysRemaining: number;
  enrichmentActivitiesCompleted?: number;
  totalEnrichmentActivities?: number;
}

/**
 * Get progress bar fill color (CSS custom property) based on progress percentage.
 * Uses --status-* tokens so colors are theme-consistent.
 */
function getProgressFill(progress: number): string {
  if (progress >= 75) return 'var(--status-success)';
  if (progress >= 50) return 'var(--celestial-primary)';
  if (progress >= 25) return 'var(--status-warning)';
  return 'var(--status-warning)';
}

/**
 * Get enrichment completion status color (CSS custom property).
 */
function getEnrichmentStatusColor(completed: number, total: number): string {
  const percentage = (completed / total) * 100;
  if (percentage >= 80) return 'var(--status-success)';
  if (percentage >= 60) return 'var(--celestial-primary)';
  if (percentage >= 40) return 'var(--status-warning)';
  return 'var(--status-warning)';
}

/**
 * CurrentMilestonePanel Component
 */
const CurrentMilestonePanel: React.FC<CurrentMilestonePanelProps> = ({
  milestone,
  foalAge,
  daysRemaining,
  enrichmentActivitiesCompleted = 0,
  totalEnrichmentActivities = 5,
}) => {
  const { name, description, focus, ageWindow } = milestone;
  const progress = calculateMilestoneProgress(milestone, foalAge);
  const progressFill = getProgressFill(progress);
  const enrichmentPercentage = Math.round(
    (enrichmentActivitiesCompleted / totalEnrichmentActivities) * 100
  );

  return (
    <div className="rounded-lg border border-blue-500/30 bg-[rgba(37,99,235,0.1)] p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-full bg-[rgba(37,99,235,0.2)] p-2">
          <Target className="h-6 w-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[rgb(220,235,255)]">Current Milestone</h3>
          <p className="text-2xl font-bold text-blue-400 mt-1">{name}</p>
        </div>
      </div>

      {/* Age Window */}
      <div className="mb-4 pb-4 border-b border-blue-500/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[rgb(148,163,184)]">Age Window:</span>
          <span className="font-semibold text-[rgb(220,235,255)]">
            Days {ageWindow.min}-{ageWindow.max}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-[rgb(148,163,184)]">Foal Age:</span>
          <span className="font-semibold text-blue-400">{foalAge} days old</span>
        </div>
      </div>

      {/* Focus Area */}
      {focus && (
        <div className="mb-4 rounded-lg bg-[rgba(37,99,235,0.15)] p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                Developmental Focus
              </p>
              <p className="text-sm text-[rgb(220,235,255)] mt-1">{focus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {description && <p className="text-sm text-[rgb(148,163,184)] mb-4">{description}</p>}

      {/* Days Remaining */}
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-[rgb(148,163,184)]" />
        <div className="flex-1">
          <p className="text-sm text-[rgb(148,163,184)]">Days remaining in window:</p>
          <p className="text-lg font-bold text-[rgb(220,235,255)]">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-[rgb(148,163,184)]" />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm font-medium text-[rgb(220,235,255)]">Milestone Progress</span>
            <span className="text-sm font-bold text-[rgb(220,235,255)]">{progress}%</span>
          </div>
        </div>
        <div
          className="w-full rounded-full h-3 overflow-hidden"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: progressFill,
              transition: 'width var(--duration-reveal) var(--ease-out)',
            }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Milestone progress: ${progress}%`}
          />
        </div>
        <p className="text-xs text-[rgb(148,163,184)] mt-1">
          Day {foalAge - ageWindow.min + 1} of {ageWindow.max - ageWindow.min + 1} in this window
        </p>
      </div>

      {/* Enrichment Activities */}
      <div className="rounded-lg border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--status-success)' }}>
            Enrichment Activities
          </p>
          <span
            className="text-sm font-bold"
            style={{
              color: getEnrichmentStatusColor(
                enrichmentActivitiesCompleted,
                totalEnrichmentActivities
              ),
            }}
          >
            {enrichmentActivitiesCompleted} / {totalEnrichmentActivities}
          </span>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-surface)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${enrichmentPercentage}%`,
              background: 'var(--status-success)',
              transition: 'width var(--duration-reveal) var(--ease-out)',
            }}
            role="progressbar"
            aria-valuenow={enrichmentActivitiesCompleted}
            aria-valuemin={0}
            aria-valuemax={totalEnrichmentActivities}
            aria-label={`Enrichment activities: ${enrichmentActivitiesCompleted} of ${totalEnrichmentActivities}`}
          />
        </div>
        <p className="text-xs text-emerald-300 mt-2">
          {enrichmentPercentage >= 80
            ? '🌟 Excellent progress! Keep up the great care.'
            : enrichmentPercentage >= 60
              ? '✨ Good progress. A few more activities will help.'
              : enrichmentPercentage >= 40
                ? '💫 Making progress. More enrichment recommended.'
                : '⏳ More enrichment activities needed for optimal development.'}
        </p>
      </div>

      {/* Guidance */}
      <div className="mt-4 rounded-lg bg-[rgba(212,168,67,0.1)] border border-amber-500/30 p-3">
        <p className="text-xs font-semibold text-amber-300 mb-1">💡 Care Tip</p>
        <p className="text-xs text-amber-200">
          {daysRemaining <= 2
            ? 'Milestone evaluation is approaching! Complete any remaining enrichment activities.'
            : progress < 50
              ? 'Focus on daily enrichment activities to build positive traits.'
              : 'Continue consistent care and bonding activities for best results.'}
        </p>
      </div>
    </div>
  );
};

export default CurrentMilestonePanel;
