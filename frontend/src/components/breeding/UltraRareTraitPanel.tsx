/**
 * UltraRareTraitPanel Component
 *
 * Displays ultra-rare and exotic trait potential for offspring
 * including requirements, achievability status, and groom influence.
 *
 * Story 6-5: Breeding Predictions
 */

import React from 'react';
import { Crown, Sparkles, CheckCircle, AlertCircle, User } from 'lucide-react';
import type { UltraRareTraitPotential } from '@/types/breeding';
import { formatProbability, getProbabilityColor } from '@/types/breeding';

export interface UltraRareTraitPanelProps {
  traits: UltraRareTraitPotential[];
}

/**
 * Get tier color and styling (Celestial Night dark theme)
 */
function getTierStyle(tier: 'ultra-rare' | 'exotic'): {
  borderColor: string;
  bgColor: string;
  textColor: string;
  icon: React.ElementType;
} {
  if (tier === 'exotic') {
    return {
      borderColor: 'border-purple-500/40',
      bgColor: 'bg-[rgba(147,51,234,0.1)]',
      textColor: 'text-purple-400',
      icon: Crown,
    };
  }
  return {
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-[rgba(212,168,67,0.1)]',
    textColor: 'text-amber-400',
    icon: Sparkles,
  };
}

/**
 * UltraRareTraitPanel Component
 */
const UltraRareTraitPanel: React.FC<UltraRareTraitPanelProps> = ({ traits }) => {
  if (traits.length === 0) {
    return (
      <div className="glass-panel rounded-lg border border-[rgba(37,99,235,0.2)] p-6 text-center">
        <Sparkles className="h-8 w-8 text-[rgb(148,163,184)] mx-auto mb-2" />
        <p className="text-sm text-[rgb(148,163,184)]">No ultra-rare trait potential detected</p>
        <p className="text-xs text-[rgb(148,163,184)] mt-1">
          Ultra-rare traits require specific parent combinations and care patterns
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {traits.map((trait) => {
        const style = getTierStyle(trait.tier);
        const TierIcon = style.icon;
        const StatusIcon = trait.isAchievable ? CheckCircle : AlertCircle;
        const probabilityColor = getProbabilityColor(trait.baseProbability);

        return (
          <div
            key={trait.traitId}
            className={`rounded-lg border-2 ${style.borderColor} ${style.bgColor} p-4 relative overflow-hidden`}
          >
            {/* Decorative shine effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            {/* Header */}
            <div className="flex items-start justify-between mb-3 relative">
              <div className="flex items-start gap-3 flex-1">
                <div className={`p-2 rounded-lg ${style.bgColor} border ${style.borderColor}`}>
                  <TierIcon className={`h-5 w-5 ${style.textColor}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold text-lg ${style.textColor}`}>{trait.traitName}</h4>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.textColor} bg-[rgba(15,35,70,0.4)] rounded`}
                  >
                    {trait.tier === 'exotic' ? '👑 Exotic' : '✨ Ultra-Rare'}
                  </span>
                </div>
              </div>

              {/* Probability */}
              <div className={`px-3 py-1.5 rounded-lg ${probabilityColor} flex-shrink-0`}>
                <div className="text-xs font-medium opacity-70">Potential</div>
                <div className="text-lg font-bold">{formatProbability(trait.baseProbability)}</div>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-[rgb(220,235,255)] mb-3 relative">{trait.description}</p>

            {/* Probability Bar */}
            <div className="mb-4 relative">
              <div className="w-full bg-[rgba(15,35,70,0.4)] rounded-full h-3 overflow-hidden border border-[rgba(37,99,235,0.2)]">
                <div
                  className={`h-full transition-all duration-500 ${
                    trait.baseProbability >= 60
                      ? 'bg-gradient-to-r from-green-400 to-green-500'
                      : trait.baseProbability >= 40
                        ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                        : trait.baseProbability >= 20
                          ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                          : 'bg-gradient-to-r from-amber-400 to-amber-500'
                  }`}
                  style={{ width: `${trait.baseProbability}%` }}
                />
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-4 relative">
              <h5 className={`text-xs font-bold uppercase tracking-wide ${style.textColor} mb-2`}>
                Requirements:
              </h5>
              <ul className="space-y-1.5">
                {trait.requirements.map((requirement, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-[rgb(220,235,255)]"
                  >
                    <span
                      className={`inline-block w-1 h-1 rounded-full ${style.textColor} mt-1.5 flex-shrink-0`}
                    />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Achievability Status */}
            <div
              className={`rounded-lg border p-3 relative ${
                trait.isAchievable
                  ? 'border-emerald-500/30 bg-[rgba(16,185,129,0.1)]'
                  : 'border-amber-500/30 bg-[rgba(212,168,67,0.1)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon
                  className={`h-5 w-5 flex-shrink-0 ${
                    trait.isAchievable ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      trait.isAchievable ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Status:
                  </p>
                  <p
                    className={`text-sm ${
                      trait.isAchievable ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {trait.isAchievable
                      ? '✅ Achievable with perfect care'
                      : '⚠️ Requires specific care pattern'}
                  </p>
                </div>
              </div>
            </div>

            {/* Groom Influence */}
            {trait.groomInfluence && (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-[rgba(37,99,235,0.1)] p-3 relative">
                <div className="flex items-start gap-2">
                  <User className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-400 mb-1">
                      Groom Bonus:
                    </p>
                    <p className="text-sm text-blue-400">
                      <span className="font-semibold">{trait.groomInfluence.groomType}</span> groom
                      increases chance by{' '}
                      <span className="font-bold">+{trait.groomInfluence.bonusPercentage}%</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UltraRareTraitPanel;
