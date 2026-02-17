/**
 * MilestoneCard Component
 *
 * Displays individual milestone details in the milestone history list.
 * Shows completion status, evaluation score, and confirmed traits.
 *
 * Story 6-2: Foal Milestone Timeline - Subcomponent
 */

import React from 'react';
import { CheckCircle, Clock, Target, ChevronRight, Award } from 'lucide-react';
import type { Milestone } from '@/types/foal';
import { getDaysUntilMilestone } from '@/types/foal';

export interface MilestoneCardProps {
  milestone: Milestone;
  foalAge: number;
  onClick?: () => void;
  isCurrent: boolean;
}

/**
 * Get status icon component based on milestone status
 */
function getStatusIcon(status: string, isCurrent: boolean) {
  if (status === 'completed') {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  if (isCurrent) {
    return <Target className="h-5 w-5 text-blue-600" />;
  }
  return <Clock className="h-5 w-5 text-gray-400" />;
}

/**
 * Get status label for display
 */
function getStatusLabel(status: string, isCurrent: boolean): string {
  if (status === 'completed') return 'Completed';
  if (isCurrent) return 'In Progress';
  return 'Upcoming';
}

/**
 * Format evaluation score for display
 */
function formatScore(score: number): { text: string; color: string } {
  const prefix = score > 0 ? '+' : '';
  let color = 'text-gray-600';

  if (score >= 5) color = 'text-green-600';
  else if (score >= 0) color = 'text-blue-600';
  else if (score >= -5) color = 'text-amber-600';
  else color = 'text-red-600';

  return {
    text: `${prefix}${score}`,
    color,
  };
}

/**
 * MilestoneCard Component
 */
const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  foalAge,
  onClick,
  isCurrent,
}) => {
  const { name, description, ageWindow, status, score, traitsConfirmed } = milestone;
  const isCompleted = status === 'completed';
  const isPending = status === 'pending';
  const daysUntil = isPending ? getDaysUntilMilestone(milestone, foalAge) : 0;

  // Card styling based on status
  const cardClasses = `
    rounded-lg border p-4 transition-all duration-200
    ${isCurrent ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' : 'border-slate-200 bg-white'}
    ${isCompleted ? 'bg-green-50/50 border-green-200' : ''}
    ${isPending ? 'bg-gray-50/50 border-gray-200 opacity-80' : ''}
    ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
  `;

  return (
    <div className={cardClasses} onClick={onClick} role={onClick ? 'button' : undefined}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-0.5">{getStatusIcon(status, isCurrent)}</div>

          {/* Milestone Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 text-sm">{name}</h4>
            <p className="text-xs text-slate-600 mt-1">
              Age Window: Days {ageWindow.min}-{ageWindow.max}
            </p>
            <p className="text-xs font-medium text-slate-700 mt-1">
              {getStatusLabel(status, isCurrent)}
            </p>
          </div>

          {/* Arrow icon for clickable cards */}
          {onClick && <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />}
        </div>
      </div>

      {/* Description */}
      {description && <p className="text-sm text-slate-600 mt-2 ml-8">{description}</p>}

      {/* Focus area */}
      {milestone.focus && (
        <div className="mt-2 ml-8">
          <p className="text-xs text-slate-500">
            <span className="font-medium">Focus:</span> {milestone.focus}
          </p>
        </div>
      )}

      {/* Completed milestone details */}
      {isCompleted && (
        <div className="mt-3 ml-8 space-y-2">
          {/* Evaluation score */}
          {score !== undefined && (
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-slate-600">Score:</span>
              <span className={`text-sm font-bold ${formatScore(score).color}`}>
                {formatScore(score).text}
              </span>
            </div>
          )}

          {/* Traits confirmed */}
          {traitsConfirmed && traitsConfirmed.length > 0 && (
            <div>
              <p className="text-xs text-slate-600 mb-1">Traits Confirmed:</p>
              <div className="flex flex-wrap gap-1">
                {traitsConfirmed.map((trait, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending milestone info */}
      {isPending && daysUntil > 0 && (
        <div className="mt-2 ml-8">
          <p className="text-xs text-slate-600">
            Begins in: <span className="font-medium text-slate-900">{daysUntil} days</span>
          </p>
        </div>
      )}

      {/* Current milestone progress */}
      {isCurrent && (
        <div className="mt-3 ml-8">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600">Progress in window:</span>
            <span className="font-medium text-blue-600">
              Day {foalAge} of {ageWindow.max}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((foalAge - ageWindow.min) / (ageWindow.max - ageWindow.min)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneCard;
