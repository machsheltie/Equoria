/**
 * TraitConfirmationCard Component
 *
 * Displays confirmed traits with effects, benefits, tier indicators,
 * and confirmation reasoning.
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React from 'react';
import { Sparkles, TrendingUp, Award, Info, CheckCircle, XCircle } from 'lucide-react';
import type { EpigeneticTrait } from '@/types/foal';
import { getTraitConfirmationReason } from '@/types/foal';

export interface TraitConfirmationCardProps {
  trait: EpigeneticTrait;
  score: number;
  showReason?: boolean;
  compact?: boolean;
}

/**
 * Get trait type color
 */
function getTraitTypeColor(isPositive: boolean): string {
  return isPositive
    ? 'text-emerald-400 bg-[rgba(16,185,129,0.1)] border-emerald-500/30'
    : 'text-red-400 bg-[rgba(239,68,68,0.1)] border-red-500/30';
}

/**
 * Get trait tier color
 */
function getTierColor(tier?: string): string {
  switch (tier?.toLowerCase()) {
    case 'exotic':
      return 'text-purple-400 bg-[rgba(147,51,234,0.1)] border-purple-500/30';
    case 'ultra-rare':
      return 'text-pink-400 bg-[rgba(236,72,153,0.1)] border-pink-500/30';
    case 'rare':
      return 'text-blue-400 bg-[rgba(37,99,235,0.1)] border-blue-500/30';
    case 'uncommon':
      return 'text-emerald-400 bg-[rgba(16,185,129,0.1)] border-emerald-500/30';
    default:
      return 'text-[rgb(148,163,184)] bg-[rgba(15,35,70,0.3)] border-[rgba(37,99,235,0.3)]';
  }
}

/**
 * Get trait tier display name
 */
function getTierDisplayName(tier?: string): string {
  if (!tier) return '';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * TraitConfirmationCard Component
 */
const TraitConfirmationCard: React.FC<TraitConfirmationCardProps> = ({
  trait,
  score,
  showReason = true,
  compact = false,
}) => {
  const isPositive = trait.isPositive ?? score >= 0;
  const typeColor = getTraitTypeColor(isPositive);
  const tierColor = getTierColor(trait.tier);
  const confirmationReason = getTraitConfirmationReason(score);

  const TraitIcon = isPositive ? CheckCircle : XCircle;

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${typeColor}`}>
        <div className="flex items-start gap-3">
          <TraitIcon className={`h-5 w-5 ${typeColor.split(' ')[0]} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-semibold text-sm ${typeColor.split(' ')[0]}`}>{trait.name}</h4>
              {trait.tier && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${tierColor}`}
                >
                  <Sparkles className="h-3 w-3" />
                  {getTierDisplayName(trait.tier)}
                </span>
              )}
            </div>
            <p className="text-xs text-[rgb(148,163,184)] mt-1">{trait.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${typeColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <TraitIcon className={`h-6 w-6 ${typeColor.split(' ')[0]} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <h4 className={`font-bold text-lg ${typeColor.split(' ')[0]}`}>{trait.name}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${typeColor}`}
              >
                {isPositive ? 'Positive Trait' : 'Negative Trait'}
              </span>
              {trait.tier && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${tierColor}`}
                >
                  <Sparkles className="h-3 w-3" />
                  {getTierDisplayName(trait.tier)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[rgb(220,235,255)] mb-4">{trait.description}</p>

      {/* Effects & Benefits */}
      {trait.effects && trait.effects.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${typeColor.split(' ')[0]}`} />
            <span className="text-xs font-semibold text-[rgb(220,235,255)] uppercase tracking-wide">
              Effects & Benefits
            </span>
          </div>

          <div className="space-y-2">
            {trait.effects.map((effect, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Award className={`h-4 w-4 ${typeColor.split(' ')[0]} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className="font-medium text-[rgb(220,235,255)]">
                    {effect.type}:{' '}
                    <span className={typeColor.split(' ')[0]}>
                      {effect.value > 0 ? '+' : ''}
                      {effect.value}
                      {effect.type.toLowerCase().includes('percent') ? '%' : ''}
                    </span>
                  </p>
                  <p className="text-xs text-[rgb(148,163,184)] mt-0.5">{effect.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Reason */}
      {showReason && (
        <div className={`rounded-lg border p-3 ${typeColor.split(' ').slice(1).join(' ')}`}>
          <div className="flex items-start gap-2">
            <Info className={`h-4 w-4 ${typeColor.split(' ')[0]} flex-shrink-0 mt-0.5`} />
            <div>
              <p className="text-xs font-semibold text-[rgb(220,235,255)] mb-1">Why This Trait?</p>
              <p className="text-xs text-[rgb(148,163,184)]">{confirmationReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Badge (if available) */}
      {trait.category && (
        <div className="mt-3 text-xs text-[rgb(148,163,184)]">
          <span className="font-medium">Category:</span> {trait.category}
        </div>
      )}
    </div>
  );
};

export default TraitConfirmationCard;
