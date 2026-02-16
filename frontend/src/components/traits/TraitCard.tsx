/**
 * TraitCard Component
 *
 * Displays an individual trait with tier-specific styling, epigenetic flags,
 * discovery status, and competition impact preview. Provides click handler
 * for opening detailed view in modal.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React from 'react';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import type { EpigeneticTrait } from '@/types/traits';
import {
  getTierStyle,
  getTierDisplayName,
  getBestDisciplines,
  calculateTotalImpact,
} from '@/types/traits';

export interface TraitCardProps {
  trait: EpigeneticTrait;
  onClick?: (trait: EpigeneticTrait) => void;
  showCompetitionImpact?: boolean;
}

/**
 * TraitCard Component
 */
const TraitCard: React.FC<TraitCardProps> = ({
  trait,
  onClick,
  showCompetitionImpact = true,
}) => {
  const tierStyle = getTierStyle(trait.tier);
  const totalImpact = calculateTotalImpact(trait.competitionImpact);
  const bestDisciplines = getBestDisciplines(trait.competitionImpact);

  // Determine if trait is beneficial or detrimental
  const ImpactIcon = totalImpact > 0 ? TrendingUp : totalImpact < 0 ? TrendingDown : null;
  const impactColor =
    totalImpact > 0 ? 'text-green-600' : totalImpact < 0 ? 'text-red-600' : 'text-slate-400';

  return (
    <div
      onClick={() => onClick?.(trait)}
      className={`rounded-lg border-2 ${tierStyle.borderColor} ${tierStyle.bgColor} p-4 transition-all hover:shadow-lg cursor-pointer relative overflow-hidden group`}
    >
      {/* Decorative shine effect for ultra-rare and exotic */}
      {(trait.tier === 'ultra-rare' || trait.tier === 'exotic') && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3 relative">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-bold text-lg ${tierStyle.textColor}`}>{trait.name}</h4>
            <Info className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Tier Badge */}
          <span
            className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${tierStyle.badgeColor} rounded`}
          >
            {getTierDisplayName(trait.tier)}
          </span>
        </div>

        {/* Impact Indicator */}
        {showCompetitionImpact && ImpactIcon && (
          <div className={`flex items-center gap-1 ${impactColor}`}>
            <ImpactIcon className="h-5 w-5" />
            <span className="text-sm font-bold">
              {totalImpact > 0 ? `+${totalImpact}` : totalImpact}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-700 mb-3 relative line-clamp-2">{trait.description}</p>

      {/* Category */}
      <div className="mb-3 relative">
        <span className="text-xs font-medium text-slate-600 bg-white/50 px-2 py-1 rounded">
          {trait.category}
        </span>
      </div>

      {/* Epigenetic Flags */}
      {trait.epigeneticFlags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 relative">
          {trait.epigeneticFlags.slice(0, 2).map((flag, index) => {
            // Simple flag display without importing getEpigeneticFlagDisplay
            let flagLabel = '';
            let flagIcon = '';
            let flagColor = '';

            switch (flag) {
              case 'stress-induced':
                flagLabel = 'Stress';
                flagIcon = '⚡';
                flagColor = 'text-amber-600 bg-amber-50 border-amber-200';
                break;
              case 'care-influenced':
                flagLabel = 'Care';
                flagIcon = '❤️';
                flagColor = 'text-blue-600 bg-blue-50 border-blue-200';
                break;
              case 'milestone-triggered':
                flagLabel = 'Milestone';
                flagIcon = '🎯';
                flagColor = 'text-purple-600 bg-purple-50 border-purple-200';
                break;
              case 'genetic-only':
                flagLabel = 'Genetic';
                flagIcon = '🧬';
                flagColor = 'text-green-600 bg-green-50 border-green-200';
                break;
            }

            return (
              <span
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${flagColor} rounded border`}
              >
                <span>{flagIcon}</span>
                <span>{flagLabel}</span>
              </span>
            );
          })}
          {trait.epigeneticFlags.length > 2 && (
            <span className="text-xs text-slate-500 px-2 py-0.5">
              +{trait.epigeneticFlags.length - 2} more
            </span>
          )}
        </div>
      )}

      {/* Best Disciplines Preview */}
      {showCompetitionImpact && bestDisciplines.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/50 relative">
          <p className="text-xs font-semibold text-slate-600 mb-1">Best For:</p>
          <div className="flex flex-wrap gap-1">
            {bestDisciplines.map((disc, index) => (
              <span
                key={index}
                className="text-xs text-slate-700 bg-white/70 px-2 py-0.5 rounded"
              >
                {disc.discipline}
                <span className="text-green-600 font-semibold ml-1">
                  +{disc.modifier}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Status Indicator */}
      {trait.discoveryStatus !== 'discovered' && (
        <div className="absolute top-2 right-2">
          {trait.discoveryStatus === 'partially_discovered' ? (
            <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full border-2 border-white shadow-sm" title="Partially Discovered" />
          ) : (
            <span className="inline-block w-3 h-3 bg-slate-300 rounded-full border-2 border-white shadow-sm" title="Hidden" />
          )}
        </div>
      )}

      {/* Positive/Negative Indicator */}
      <div className="absolute bottom-2 right-2 relative">
        {trait.isPositive ? (
          <span className="text-green-600 text-xs font-bold">+</span>
        ) : (
          <span className="text-red-600 text-xs font-bold">−</span>
        )}
      </div>
    </div>
  );
};

export default TraitCard;
