/**
 * TraitPredictionCard Component
 *
 * Displays individual trait prediction for offspring including
 * inheritance probability, source parent, and visual progress bar.
 *
 * Story 6-5: Breeding Predictions
 */

import React from 'react';
import { TrendingUp, User, Users, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import type { TraitPrediction } from '@/types/breeding';
import { formatProbability, getProbabilityColor } from '@/types/breeding';

export interface TraitPredictionCardProps {
  prediction: TraitPrediction;
  compact?: boolean;
}

/**
 * Get source icon based on trait source
 */
function getSourceIcon(source: string) {
  switch (source) {
    case 'both':
      return Users;
    case 'sire':
    case 'dam':
      return User;
    case 'random':
      return Sparkles;
    default:
      return User;
  }
}

/**
 * Get source label
 */
function getSourceLabel(source: string): string {
  switch (source) {
    case 'both':
      return 'From both parents';
    case 'sire':
      return 'From sire';
    case 'dam':
      return 'From dam';
    case 'random':
      return 'Random chance';
    default:
      return source;
  }
}

/**
 * Get source color
 */
function getSourceColor(source: string): string {
  switch (source) {
    case 'both':
      return 'text-[var(--status-rare)] bg-[var(--badge-rare-bg)]';
    case 'sire':
      return 'text-[var(--role-info-text)] bg-[var(--role-info-bg)]';
    case 'dam':
      return 'text-[var(--status-rare)] bg-[var(--badge-rare-bg)]';
    case 'random':
      return 'text-role-secondary bg-[var(--role-neutral-bg)]';
    default:
      return 'text-role-secondary bg-[var(--role-neutral-bg)]';
  }
}

/**
 * TraitPredictionCard Component
 */
const TraitPredictionCard: React.FC<TraitPredictionCardProps> = ({
  prediction,
  compact = false,
}) => {
  const { traitName, probability, source, isPositive, description, category } = prediction;

  const SourceIcon = getSourceIcon(source);
  const TraitTypeIcon = isPositive ? CheckCircle : XCircle;
  const probabilityColor = getProbabilityColor(probability);
  const sourceColor = getSourceColor(source);

  if (compact) {
    return (
      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <TraitTypeIcon
              className={`h-4 w-4 flex-shrink-0 ${isPositive ? 'text-[var(--role-success-text)]' : 'text-[var(--role-danger-text)]'}`}
            />
            <span className="text-sm font-medium text-[var(--text-primary)]">{traitName}</span>
          </div>
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-bold ${probabilityColor}`}
          >
            <TrendingUp className="h-3 w-3" />
            <span>{formatProbability(probability)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <TraitTypeIcon
            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              isPositive ? 'text-[var(--role-success-text)]' : 'text-[var(--role-danger-text)]'
            }`}
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[var(--text-primary)]">{traitName}</h4>
            {category && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium text-role-secondary bg-[var(--role-neutral-bg)] rounded">
                {category}
              </span>
            )}
          </div>
        </div>

        {/* Probability Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${probabilityColor} flex-shrink-0`}
        >
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-bold">{formatProbability(probability)}</span>
        </div>
      </div>

      {/* Description */}
      {description && <p className="text-sm text-role-secondary mb-3">{description}</p>}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-[var(--role-neutral-bg)] rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              probability >= 80
                ? 'bg-[var(--status-success)]'
                : probability >= 60
                  ? 'bg-[var(--status-info)]'
                  : probability >= 40
                    ? 'bg-[var(--status-warning)]'
                    : 'bg-[var(--gold-dim)]'
            }`}
            style={{ width: `${probability}%` }}
            role="progressbar"
            aria-valuenow={probability}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${traitName} inheritance probability: ${formatProbability(probability)}`}
          />
        </div>
      </div>

      {/* Source */}
      <div className="flex items-center gap-2">
        <SourceIcon className={`h-4 w-4 ${sourceColor.split(' ')[0]}`} />
        <span className={`text-xs font-medium ${sourceColor.split(' ')[0]}`}>
          {getSourceLabel(source)}
        </span>
      </div>

      {/* Trait Type Badge */}
      <div className="mt-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
            isPositive
              ? 'text-[var(--role-success-text)] bg-[var(--role-success-bg)]'
              : 'text-[var(--role-danger-text)] bg-[var(--role-danger-bg)]'
          }`}
        >
          {isPositive ? 'Positive Trait' : 'Negative Trait'}
        </span>
      </div>
    </div>
  );
};

export default TraitPredictionCard;
