/**
 * ActivityConfirmationModal Component
 *
 * Confirmation modal for performing enrichment activities.
 * Shows activity details, benefits, cooldown warnings, and foal info.
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
  AlertCircle,
  Sparkles,
  Timer,
} from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import type { EnrichmentActivityDefinition, Foal } from '@/types/foal';
import { getCategoryColor } from '@/types/foal';

export interface ActivityConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activity: EnrichmentActivityDefinition | null;
  foal: Foal | null;
  isSubmitting?: boolean;
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
 * Format benefit value for display
 */
function formatBenefit(value: number, isStat: boolean = false): string {
  if (isStat) {
    return value > 0 ? `+${value}` : `${value}`;
  }
  return `+${value}%`;
}

/**
 * ActivityConfirmationModal Component
 */
const ActivityConfirmationModal: React.FC<ActivityConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  activity,
  foal,
  isSubmitting = false,
}) => {
  if (!activity || !foal) {
    return null;
  }

  const { name, description, category, durationMinutes, cooldownHours, benefits } = activity;
  const CategoryIcon = getCategoryIconComponent(category);
  const categoryColors = getCategoryColor(category);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Enrichment Activity"
      size="lg"
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        {/* Activity Header */}
        <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
          <div className={`rounded-full p-3 ${categoryColors.split(' ')[1]}`}>
            <CategoryIcon className={`h-6 w-6 ${categoryColors.split(' ')[0]}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900">{name}</h3>
            <span
              className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded ${categoryColors}`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          </div>
        </div>

        {/* Foal Info */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-700 mb-1">Performing with:</p>
          <p className="text-base font-bold text-slate-900">
            {foal.name || 'Unnamed Foal'} ({foal.ageInDays} days old)
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
            <div>
              <span className="font-medium">Bonding:</span> {foal.bondingLevel || 0}/100
            </div>
            <div>
              <span className="font-medium">Stress:</span> {foal.stressLevel || 0}/100
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm text-slate-700">{description}</p>
        </div>

        {/* Time Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">Duration</span>
            </div>
            <p className="text-lg font-bold text-blue-600">{durationMinutes} minutes</p>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-900">Cooldown</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{cooldownHours} hours</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-900">Expected Benefits</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* Temperament Modifiers */}
            {benefits.temperamentModifiers &&
              Object.entries(benefits.temperamentModifiers).map(([stat, value]) => (
                <div key={stat} className="flex items-center justify-between">
                  <span className="text-emerald-800 capitalize">{stat}:</span>
                  <span className="font-semibold text-emerald-900">
                    {formatBenefit(value, true)}
                  </span>
                </div>
              ))}

            {/* Other Benefits */}
            <div className="flex items-center justify-between">
              <span className="text-emerald-800">Trait Discovery:</span>
              <span className="font-semibold text-emerald-900">
                {formatBenefit(benefits.traitDiscoveryBoost)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-emerald-800">Milestone Bonus:</span>
              <span className="font-semibold text-emerald-900">+{benefits.milestoneBonus} pts</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-emerald-800">Bonding Increase:</span>
              <span className="font-semibold text-emerald-900">+{benefits.bondingIncrease}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-emerald-800">Stress Reduction:</span>
              <span className="font-semibold text-emerald-900">-{benefits.stressReduction}</span>
            </div>
          </div>
        </div>

        {/* Cooldown Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900 mb-1">Important Note</p>
              <p className="text-xs text-amber-800">
                After completing this activity, it will be unavailable for {cooldownHours} hours.
                Plan your foal's enrichment schedule accordingly.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Starting Activity...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Start Activity</span>
              </>
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default ActivityConfirmationModal;
