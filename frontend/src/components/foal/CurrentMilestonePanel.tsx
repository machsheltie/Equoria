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
 * Get progress bar color based on progress percentage
 */
function getProgressColor(progress: number): string {
  if (progress >= 75) return 'bg-green-500';
  if (progress >= 50) return 'bg-blue-500';
  if (progress >= 25) return 'bg-yellow-500';
  return 'bg-amber-500';
}

/**
 * Get enrichment completion status color
 */
function getEnrichmentStatusColor(completed: number, total: number): string {
  const percentage = (completed / total) * 100;
  if (percentage >= 80) return 'text-green-600';
  if (percentage >= 60) return 'text-blue-600';
  if (percentage >= 40) return 'text-yellow-600';
  return 'text-amber-600';
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
  const progressColor = getProgressColor(progress);
  const enrichmentPercentage = Math.round(
    (enrichmentActivitiesCompleted / totalEnrichmentActivities) * 100
  );

  return (
    <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-full bg-blue-100 p-2">
          <Target className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">Current Milestone</h3>
          <p className="text-2xl font-bold text-blue-600 mt-1">{name}</p>
        </div>
      </div>

      {/* Age Window */}
      <div className="mb-4 pb-4 border-b border-blue-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Age Window:</span>
          <span className="font-semibold text-slate-900">
            Days {ageWindow.min}-{ageWindow.max}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-600">Foal Age:</span>
          <span className="font-semibold text-blue-600">{foalAge} days old</span>
        </div>
      </div>

      {/* Focus Area */}
      {focus && (
        <div className="mb-4 rounded-lg bg-blue-100/50 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                Developmental Focus
              </p>
              <p className="text-sm text-blue-800 mt-1">{focus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-700 mb-4">{description}</p>
      )}

      {/* Days Remaining */}
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-slate-500" />
        <div className="flex-1">
          <p className="text-sm text-slate-600">Days remaining in window:</p>
          <p className="text-lg font-bold text-slate-900">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-slate-500" />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Milestone Progress</span>
            <span className="text-sm font-bold text-slate-900">{progress}%</span>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Milestone progress: ${progress}%`}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Day {foalAge - ageWindow.min + 1} of {ageWindow.max - ageWindow.min + 1} in this window
        </p>
      </div>

      {/* Enrichment Activities */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-emerald-900">Enrichment Activities</p>
          <span
            className={`text-sm font-bold ${getEnrichmentStatusColor(
              enrichmentActivitiesCompleted,
              totalEnrichmentActivities
            )}`}
          >
            {enrichmentActivitiesCompleted} / {totalEnrichmentActivities}
          </span>
        </div>
        <div className="w-full bg-emerald-200 rounded-full h-2">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all"
            style={{ width: `${enrichmentPercentage}%` }}
          />
        </div>
        <p className="text-xs text-emerald-700 mt-2">
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
      <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs font-semibold text-amber-900 mb-1">💡 Care Tip</p>
        <p className="text-xs text-amber-800">
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
