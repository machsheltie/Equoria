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
      borderColor: 'border-[var(--badge-rare-bg)]',
      bgColor: 'bg-[var(--badge-rare-bg)]',
      textColor: 'text-[var(--status-rare)]',
      icon: Crown,
    };
  }
  return {
    borderColor: 'border-[var(--role-warning-border)]',
    bgColor: 'bg-[var(--role-warning-bg)]',
    textColor: 'text-[var(--role-warning-text)]',
    icon: Sparkles,
  };
}

/**
 * UltraRareTraitPanel Component
 */
const UltraRareTraitPanel: React.FC<UltraRareTraitPanelProps> = ({ traits }) => {
  if (traits.length === 0) {
    return (
      <div className="glass-panel rounded-lg border border-[var(--glass-border)] p-6 text-center">
        <Sparkles className="h-8 w-8 text-role-secondary mx-auto mb-2" />
        <p className="text-sm text-role-secondary">No ultra-rare trait potential detected</p>
        <p className="text-xs text-role-secondary mt-1">
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
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.textColor} bg-[var(--role-neutral-bg)] rounded`}
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
            <p className="text-sm text-[var(--text-primary)] mb-3 relative">{trait.description}</p>

            {/* Probability Bar */}
            <div className="mb-4 relative">
              <div className="w-full bg-[var(--role-neutral-bg)] rounded-full h-3 overflow-hidden border border-[var(--glass-border)]">
                <div
                  className={`h-full transition-all duration-500 ${
                    trait.baseProbability >= 60
                      ? 'bg-[var(--status-success)]'
                      : trait.baseProbability >= 40
                        ? 'bg-[var(--status-info)]'
                        : trait.baseProbability >= 20
                          ? 'bg-[var(--status-warning)]'
                          : 'bg-[var(--gold-dim)]'
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
                    className="flex items-start gap-2 text-sm text-[var(--text-primary)]"
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
                  ? 'border-[var(--role-success-border)] bg-[var(--role-success-bg)]'
                  : 'border-[var(--role-warning-border)] bg-[var(--role-warning-bg)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon
                  className={`h-5 w-5 flex-shrink-0 ${
                    trait.isAchievable
                      ? 'text-[var(--role-success-text)]'
                      : 'text-[var(--role-warning-text)]'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      trait.isAchievable
                        ? 'text-[var(--role-success-text)]'
                        : 'text-[var(--role-warning-text)]'
                    }`}
                  >
                    Status:
                  </p>
                  <p
                    className={`text-sm ${
                      trait.isAchievable
                        ? 'text-[var(--role-success-text)]'
                        : 'text-[var(--role-warning-text)]'
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
              <div className="mt-3 rounded-lg border border-[var(--role-info-border)] bg-[var(--role-info-bg)] p-3 relative">
                <div className="flex items-start gap-2">
                  <User className="h-5 w-5 text-[var(--role-info-text)] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--role-info-text)] mb-1">
                      Groom Bonus:
                    </p>
                    <p className="text-sm text-[var(--role-info-text)]">
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
