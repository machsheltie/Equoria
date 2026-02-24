/**
 * MilestoneTooltip Component
 *
 * Custom Recharts tooltip for milestone timeline visualization.
 * Displays milestone name, age, progress, and confirmed traits.
 *
 * Story 6-2: Foal Milestone Timeline - Subcomponent
 */

import React from 'react';
import { CheckCircle, Clock, Target } from 'lucide-react';

/**
 * Props passed by Recharts to custom tooltip components
 */
export interface MilestoneTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      ageDay: number;
      progress: number;
      status: 'completed' | 'current' | 'pending';
      completed: boolean;
      current: boolean;
      traits: string[];
      score?: number;
    };
  }>;
  label?: string;
}

/**
 * Get status icon and color based on milestone status
 */
function getStatusInfo(status: 'completed' | 'current' | 'pending') {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle,
        color: 'text-emerald-400',
        bg: 'bg-[rgba(16,185,129,0.1)]',
        label: 'Completed',
      };
    case 'current':
      return {
        icon: Target,
        color: 'text-blue-400',
        bg: 'bg-[rgba(37,99,235,0.1)]',
        label: 'In Progress',
      };
    case 'pending':
      return {
        icon: Clock,
        color: 'text-[rgb(148,163,184)]',
        bg: 'bg-[rgba(15,35,70,0.3)]',
        label: 'Upcoming',
      };
  }
}

/**
 * MilestoneTooltip Component
 *
 * Custom tooltip for Recharts chart displaying milestone details on hover
 */
const MilestoneTooltip: React.FC<MilestoneTooltipProps> = ({ active, payload }) => {
  // Don't render if not active or no data
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  const { name, ageDay, progress, status, traits, score } = data;
  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-[rgba(15,35,70,0.95)] border border-[rgba(37,99,235,0.3)] rounded-lg p-4 shadow-lg max-w-xs">
      {/* Header with status */}
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
        <div className="flex-1">
          <p className="font-semibold text-[rgb(220,235,255)] text-sm">{name}</p>
          <p className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
        </div>
      </div>

      {/* Milestone details */}
      <div className="space-y-2 mt-3">
        {/* Age */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[rgb(148,163,184)]">Age Window:</span>
          <span className="font-medium text-[rgb(220,235,255)]">Day {ageDay}+</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[rgb(148,163,184)]">Progress:</span>
          <span className="font-medium text-[rgb(220,235,255)]">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[rgba(15,35,70,0.5)] rounded-full h-1.5 mt-1">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'completed'
                ? 'bg-green-500'
                : status === 'current'
                  ? 'bg-blue-500'
                  : 'bg-[rgb(148,163,184)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Score (if completed) */}
        {status === 'completed' && score !== undefined && (
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-[rgba(37,99,235,0.3)]">
            <span className="text-[rgb(148,163,184)]">Evaluation Score:</span>
            <span
              className={`font-semibold ${
                score >= 5 ? 'text-emerald-400' : score >= 0 ? 'text-blue-400' : 'text-amber-400'
              }`}
            >
              {score > 0 ? '+' : ''}
              {score}
            </span>
          </div>
        )}

        {/* Traits confirmed */}
        {traits.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[rgba(37,99,235,0.3)]">
            <p className="text-xs font-medium text-[rgb(220,235,255)] mb-1">Traits Confirmed:</p>
            <div className="flex flex-wrap gap-1">
              {traits.map((trait, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-0.5 text-xs font-medium bg-[rgba(16,185,129,0.15)] text-emerald-400 rounded"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MilestoneTooltip;
