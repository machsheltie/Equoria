/**
 * ActivityCard Component
 *
 * Displays individual enrichment activity details including category,
 * duration, benefits, cooldown status, and availability.
 *
 * Story 6-3: Enrichment Activity UI
 */

import React from 'react';
import {
  Heart,
  Shield,
  Compass,
  Clock,
  TrendingUp,
  Sparkles,
  Timer,
  Lock,
  CheckCircle,
} from 'lucide-react';
import type {
  EnrichmentActivityDefinition,
  EnrichmentActivityStatus,
  Foal,
} from '@/types/foal';
import {
  getActivityStatusColor,
  getActivityStatusLabel,
  getCategoryColor,
  formatCooldownTime,
  canPerformActivity,
} from '@/types/foal';

export interface ActivityCardProps {
  activity: EnrichmentActivityDefinition;
  status: EnrichmentActivityStatus;
  foal: Foal;
  onClick?: () => void;
  isRecommended?: boolean;
}

/**
 * Get category icon component
 */
function getCategoryIconComponent(category: string) {
  switch (category) {
    case 'trust':
      return Heart;
    case 'desensitization':
      return Shield;
    case 'exposure':
      return Compass;
    case 'habituation':
      return Clock;
    default:
      return Sparkles;
  }
}

/**
 * Get status icon component
 */
function getStatusIconComponent(status: string) {
  switch (status) {
    case 'available':
      return CheckCircle;
    case 'on_cooldown':
      return Timer;
    case 'completed_today':
      return CheckCircle;
    case 'locked':
      return Lock;
    default:
      return Clock;
  }
}

/**
 * Format benefit value for display
 */
function formatBenefit(value: number, isStat: boolean = false): string {
  if (isStat) {
    return value > 0 ? `+${value}` : `${value}`;
  }
  return `+${value}%`;
}

/**
 * ActivityCard Component
 */
const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  status,
  foal,
  onClick,
  isRecommended = false,
}) => {
  const { name, description, category, durationMinutes, cooldownHours, benefits } = activity;

  const CategoryIcon = getCategoryIconComponent(category);
  const StatusIcon = getStatusIconComponent(status.status);
  const categoryColors = getCategoryColor(category);
  const statusColors = getActivityStatusColor(status.status);

  const { canPerform, reason } = canPerformActivity(activity, foal, status);

  // Card styling based on status and recommended state
  const cardClasses = `
    rounded-lg border p-4 transition-all duration-200
    ${canPerform ? 'bg-white hover:shadow-md border-slate-200' : 'bg-gray-50 border-gray-200 opacity-75'}
    ${isRecommended ? 'ring-2 ring-blue-400 border-blue-300' : ''}
    ${canPerform && onClick ? 'cursor-pointer' : 'cursor-default'}
  `;

  const handleClick = () => {
    if (canPerform && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      role={canPerform && onClick ? 'button' : undefined}
      aria-label={canPerform ? `Start ${name} activity` : `${name} - ${reason}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Category Icon */}
          <div className={`rounded-full p-2 ${categoryColors.split(' ')[1]} flex-shrink-0`}>
            <CategoryIcon className={`h-5 w-5 ${categoryColors.split(' ')[0]}`} />
          </div>

          {/* Activity Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h4 className="font-semibold text-slate-900 text-sm">{name}</h4>
              {isRecommended && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  <Sparkles className="h-3 w-3" />
                  Recommended
                </span>
              )}
            </div>

            {/* Category Badge */}
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${categoryColors}`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${statusColors}`}>
          <StatusIcon className="h-3 w-3" />
          <span>{getActivityStatusLabel(status.status)}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 mb-3 ml-11">{description}</p>

      {/* Time Info */}
      <div className="flex items-center gap-4 mb-3 ml-11 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Duration: {durationMinutes}m</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3" />
          <span>Cooldown: {cooldownHours}h</span>
        </div>
      </div>

      {/* Cooldown Timer */}
      {status.status === 'on_cooldown' && status.cooldownRemainingMinutes !== undefined && (
        <div className="mb-3 ml-11">
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
            <Timer className="h-3 w-3" />
            <span>Available in {formatCooldownTime(status.cooldownRemainingMinutes)}</span>
          </div>
        </div>
      )}

      {/* Cannot Perform Reason */}
      {!canPerform && reason && status.status !== 'on_cooldown' && (
        <div className="mb-3 ml-11">
          <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-100 rounded px-2 py-1.5">
            <Lock className="h-3 w-3" />
            <span>{reason}</span>
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="border-t border-slate-200 pt-3 ml-11">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700">Benefits:</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Temperament Modifiers */}
          {benefits.temperamentModifiers &&
            Object.entries(benefits.temperamentModifiers).map(([stat, value]) => (
              <div key={stat} className="flex items-center justify-between">
                <span className="text-slate-600 capitalize">{stat}:</span>
                <span className="font-medium text-slate-900">
                  {formatBenefit(value, true)}
                </span>
              </div>
            ))}

          {/* Other Benefits */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Trait Discovery:</span>
            <span className="font-medium text-slate-900">
              {formatBenefit(benefits.traitDiscoveryBoost)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Milestone:</span>
            <span className="font-medium text-slate-900">
              +{benefits.milestoneBonus} pts
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Bonding:</span>
            <span className="font-medium text-slate-900">
              +{benefits.bondingIncrease}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Stress:</span>
            <span className="font-medium text-emerald-600">
              -{benefits.stressReduction}
            </span>
          </div>
        </div>
      </div>

      {/* Action hint for available activities */}
      {canPerform && onClick && (
        <div className="mt-3 ml-11 text-xs text-blue-600 font-medium">
          Click to start activity →
        </div>
      )}
    </div>
  );
};

export default ActivityCard;
