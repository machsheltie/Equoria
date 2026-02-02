/**
 * HorseSelectionCard Component
 *
 * Individual horse card for competition entry selection:
 * - Displays horse details (name, age, sex, level)
 * - Shows eligibility status with color-coded badges
 * - Selection checkbox with toggle functionality
 * - Top 3 relevant stats for the competition discipline
 * - Expected performance preview
 * - Tooltip for ineligibility reasons
 *
 * Story 5-1: Competition Entry System - Task 5
 */

import React, { useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  Bandage,
} from 'lucide-react';

/**
 * Horse data structure for selection
 */
export interface Horse {
  id: number;
  name: string;
  age: number;
  sex: 'Mare' | 'Stallion' | 'Gelding';
  level: number;
  health: 'healthy' | 'injured';
  disciplines: { [key: string]: number };
}

/**
 * Eligibility status types
 */
export type EligibilityStatus =
  | 'eligible'
  | 'too-young'
  | 'too-old'
  | 'wrong-level'
  | 'already-entered'
  | 'injured';

/**
 * Relevant stat for display
 */
export interface RelevantStat {
  name: string;
  value: number;
}

/**
 * HorseSelectionCard component props
 */
export interface HorseSelectionCardProps {
  horse: Horse;
  isSelected: boolean;
  onToggle: (horseId: number) => void;
  eligibilityStatus: EligibilityStatus;
  ineligibilityReason?: string;
  relevantStats: RelevantStat[];
  expectedPerformance?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Configuration for eligibility status badges
 */
interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  showTooltip: boolean;
}

/**
 * Status configuration mapping
 */
const statusConfigs: Record<EligibilityStatus, StatusConfig> = {
  eligible: {
    label: 'Eligible',
    icon: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    showTooltip: false,
  },
  'too-young': {
    label: 'Too Young',
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    showTooltip: true,
  },
  'too-old': {
    label: 'Too Old',
    icon: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    showTooltip: true,
  },
  'wrong-level': {
    label: 'Wrong Level',
    icon: <AlertOctagon className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    showTooltip: true,
  },
  'already-entered': {
    label: 'Already Entered',
    icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    showTooltip: false,
  },
  injured: {
    label: 'Injured',
    icon: <Bandage className="h-3 w-3" aria-hidden="true" />,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    showTooltip: true,
  },
};

/**
 * EligibilityBadge sub-component
 *
 * Displays the eligibility status with optional tooltip
 */
const EligibilityBadge = memo(
  ({
    status,
    reason,
  }: {
    status: EligibilityStatus;
    reason?: string;
  }) => {
    const config = statusConfigs[status];

    const badgeContent = (
      <span
        data-testid="eligibility-badge"
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          config.bgColor,
          config.textColor
        )}
      >
        {config.icon}
        {config.label}
      </span>
    );

    if (config.showTooltip && reason) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
            <TooltipContent role="tooltip">
              <p>{reason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return badgeContent;
  }
);
EligibilityBadge.displayName = 'EligibilityBadge';

/**
 * StatItem sub-component
 *
 * Displays a single stat with name and value
 */
const StatItem = memo(({ name, value }: { name: string; value: number }) => {
  const isHighStat = value > 80;

  return (
    <div
      data-testid="stat-item"
      className={cn(
        'flex justify-between items-center text-sm',
        isHighStat ? 'text-green-600 font-medium' : 'text-slate-600'
      )}
    >
      <span>{name}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
});
StatItem.displayName = 'StatItem';

/**
 * HorseSelectionCard Component
 *
 * Displays horse information with selection checkbox and eligibility status.
 * Optimized with React.memo for performance in large lists.
 */
const HorseSelectionCard = memo(
  ({
    horse,
    isSelected,
    onToggle,
    eligibilityStatus,
    ineligibilityReason,
    relevantStats,
    expectedPerformance,
    disabled = false,
    className = '',
  }: HorseSelectionCardProps) => {
    // Handle checkbox toggle with useCallback for performance
    const handleToggle = useCallback(() => {
      if (!disabled) {
        onToggle(horse.id);
      }
    }, [disabled, onToggle, horse.id]);

    // Handle keyboard interaction
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
          event.preventDefault();
          onToggle(horse.id);
        }
      },
      [disabled, onToggle, horse.id]
    );

    const isEligible = eligibilityStatus === 'eligible';

    return (
      <div
        data-testid="horse-selection-card"
        tabIndex={0}
        role="article"
        aria-label={`Horse selection card for ${horse.name}`}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative bg-white rounded-lg shadow p-4 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-400',
          isSelected && 'ring-2 ring-blue-500 bg-blue-50',
          disabled && 'opacity-60 cursor-not-allowed',
          !disabled && 'cursor-pointer hover:shadow-md',
          className
        )}
      >
        {/* Header: Checkbox, Name, Eligibility Badge */}
        <div className="flex items-start gap-3 mb-3">
          {/* Selection Checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleToggle}
            disabled={disabled}
            aria-label={`Select ${horse.name} for competition`}
            className="mt-1"
          />

          {/* Horse Name and Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                {horse.name}
              </h3>
              <EligibilityBadge status={eligibilityStatus} reason={ineligibilityReason} />
            </div>

            {/* Horse Details: Age, Sex, Level */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span data-testid="horse-age">
                <span className="font-medium">{horse.age}</span> yrs
              </span>
              <span data-testid="horse-sex">{horse.sex}</span>
              <span data-testid="horse-level">
                Lvl <span className="font-medium">{horse.level}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div data-testid="horse-stats" className="mb-3 space-y-1">
          {relevantStats.length > 0 ? (
            relevantStats.slice(0, 3).map((stat) => (
              <StatItem key={stat.name} name={stat.name} value={stat.value} />
            ))
          ) : (
            <p className="text-sm text-slate-400 italic">No stats available</p>
          )}
        </div>

        {/* Expected Performance */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Expected Performance</span>
            <span
              data-testid="expected-performance"
              className={cn(
                'text-sm font-semibold',
                expectedPerformance !== undefined && expectedPerformance >= 80
                  ? 'text-green-600'
                  : expectedPerformance !== undefined && expectedPerformance >= 60
                    ? 'text-amber-600'
                    : 'text-slate-600'
              )}
            >
              {expectedPerformance !== undefined ? `${expectedPerformance}%` : 'N/A'}
            </span>
          </div>

          {/* Performance bar indicator */}
          {expectedPerformance !== undefined && (
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  expectedPerformance >= 80
                    ? 'bg-green-500'
                    : expectedPerformance >= 60
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                )}
                style={{ width: `${Math.min(100, expectedPerformance)}%` }}
              />
            </div>
          )}
        </div>

        {/* Ineligible overlay indicator */}
        {!isEligible && (
          <div
            className="absolute inset-0 bg-slate-50/30 rounded-lg pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);
HorseSelectionCard.displayName = 'HorseSelectionCard';

export default HorseSelectionCard;
