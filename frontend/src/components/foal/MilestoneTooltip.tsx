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
        color: 'text-green-600',
        bg: 'bg-green-50',
        label: 'Completed',
      };
    case 'current':
      return {
        icon: Target,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        label: 'In Progress',
      };
    case 'pending':
      return {
        icon: Clock,
        color: 'text-gray-600',
        bg: 'bg-gray-50',
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
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg max-w-xs">
      {/* Header with status */}
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
        <div className="flex-1">
          <p className="font-semibold text-slate-900 text-sm">{name}</p>
          <p className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
        </div>
      </div>

      {/* Milestone details */}
      <div className="space-y-2 mt-3">
        {/* Age */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Age Window:</span>
          <span className="font-medium text-slate-900">Day {ageDay}+</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Progress:</span>
          <span className="font-medium text-slate-900">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'completed'
                ? 'bg-green-500'
                : status === 'current'
                  ? 'bg-blue-500'
                  : 'bg-gray-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Score (if completed) */}
        {status === 'completed' && score !== undefined && (
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-200">
            <span className="text-slate-600">Evaluation Score:</span>
            <span
              className={`font-semibold ${
                score >= 5 ? 'text-green-600' : score >= 0 ? 'text-blue-600' : 'text-amber-600'
              }`}
            >
              {score > 0 ? '+' : ''}
              {score}
            </span>
          </div>
        )}

        {/* Traits confirmed */}
        {traits.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs font-medium text-slate-700 mb-1">Traits Confirmed:</p>
            <div className="flex flex-wrap gap-1">
              {traits.map((trait, index) => (
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
    </div>
  );
};

export default MilestoneTooltip;
