/**
 * TraitCard — canonical genetics/epigenetic trait display (Story 3-3)
 *
 * The single live trait card used by the Genetics tab to render genetic and
 * epigenetic traits with rarity, source (sire/dam/mutation), stat-impact
 * detail, an authoritative beneficial/detrimental valence badge (Equoria-6rf97),
 * and a click/keyboard-activatable detail affordance (Equoria-vpgmc /
 * Equoria-4o9u4). The hover tooltip is retained as a progressive enhancement
 * for mouse users but is no longer the only path to detail.
 *
 * Equoria-q3u77: this is the ONE canonical TraitCard. A previously-orphaned
 * tier-based variant (which required tier / competitionImpact / discoveryStatus
 * data the backend never provides) was removed as dead code, so there is no
 * longer any ambiguity about which card to import.
 */

import React, { useState } from 'react';
import { Sparkles, Info, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Props for the TraitCard component
 */
export interface TraitCardProps {
  trait: {
    name: string;
    type: 'genetic' | 'epigenetic';
    description: string;
    source?: 'sire' | 'dam' | 'mutation';
    discoveryDate?: string;
    isActive?: boolean;
    rarity: 'common' | 'rare' | 'legendary';
    strength: number; // 0-100
    impact: {
      stats?: Record<string, number>;
      disciplines?: Record<string, number>;
    };
  };
  onViewParent?: (_parentId: number) => void;
  showTooltip?: boolean;
  /**
   * Authoritative beneficial/detrimental classification from the backend
   * (Equoria-6rf97). When provided, a valence badge (icon + text, not
   * color-only) is rendered. Omitted when the live data source has no
   * classification for this trait.
   */
  valence?: 'positive' | 'negative';
  /**
   * Invoked on click / Enter / Space (Equoria-vpgmc, Equoria-4o9u4). When
   * provided the card becomes a focusable role=button that opens the trait
   * detail modal. When omitted the card is a static, non-interactive panel.
   */
  onSelect?: () => void;
}

/**
 * Get border and background colors based on trait type and rarity
 */
const getTraitColors = (type: 'genetic' | 'epigenetic', rarity: string) => {
  // Base colors by type (dark theme equivalents)
  const typeColors: Record<
    string,
    { border: string; bg: string; text: string; accent?: string; animation?: string }
  > = {
    genetic: {
      border: 'border-blue-500/40',
      bg: 'bg-[rgba(37,99,235,0.1)]',
      text: 'text-blue-400',
    },
    epigenetic: {
      border: 'border-purple-500/40',
      bg: 'bg-[rgba(147,51,234,0.1)]',
      text: 'text-purple-400',
    },
  };

  // Override for rare/legendary
  if (rarity === 'rare') {
    return {
      border: 'border-burnished-gold/50',
      bg: 'bg-[rgba(212,168,67,0.1)]',
      text: 'text-burnished-gold',
      accent: 'text-burnished-gold',
    };
  }

  if (rarity === 'legendary') {
    return {
      border: 'border-burnished-gold/60',
      bg: 'bg-gradient-to-br from-[rgba(212,168,67,0.12)] to-[rgba(147,51,234,0.12)]',
      text: 'text-transparent bg-clip-text bg-gradient-to-r from-burnished-gold to-purple-400',
      accent: 'text-burnished-gold',
      animation: 'animate-pulse',
    };
  }

  return typeColors[type];
};

/**
 * Get strength indicator color and label
 */
const getStrengthInfo = (strength: number) => {
  if (strength >= 76) {
    return {
      color: 'text-burnished-gold',
      bgColor: 'bg-burnished-gold',
      label: 'Exceptional',
    };
  }
  if (strength >= 51) {
    return {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500',
      label: 'High',
    };
  }
  if (strength >= 26) {
    return {
      color: 'text-aged-bronze',
      bgColor: 'bg-aged-bronze',
      label: 'Medium',
    };
  }
  return {
    color: 'text-slate-400',
    bgColor: 'bg-slate-400',
    label: 'Low',
  };
};

/**
 * Get source badge text and icon
 */
const getSourceInfo = (source?: 'sire' | 'dam' | 'mutation') => {
  if (!source) return null;

  const sourceMap = {
    sire: { label: 'From Sire', icon: '♂️' },
    dam: { label: 'From Dam', icon: '♀️' },
    mutation: { label: 'Mutation', icon: '✨' },
  };

  return sourceMap[source];
};

/**
 * TraitCard Component
 *
 * Displays a horse trait with detailed information including:
 * - Trait name and type (genetic/epigenetic)
 * - Rarity indicator
 * - Strength meter
 * - Inheritance source
 * - Discovery date (for epigenetic traits)
 * - Detailed tooltip with impact information
 */
export const TraitCard: React.FC<TraitCardProps> = ({
  trait,
  onViewParent: _onViewParent,
  showTooltip = true,
  valence,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const colors = getTraitColors(trait.type, trait.rarity);
  const strengthInfo = getStrengthInfo(trait.strength);
  const sourceInfo = getSourceInfo(trait.source);
  const isInteractive = typeof onSelect === 'function';

  // Equoria-4o9u4: accessible label conveys name + valence per README spec
  // (e.g. "Resilient trait - positive"). Falls back to type when no valence.
  const valenceWord =
    valence === 'positive' ? 'positive' : valence === 'negative' ? 'negative' : trait.type;
  const accessibleLabel = `${trait.name} trait - ${valenceWord}${
    isInteractive ? ', activate for details' : ''
  }`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onSelect!();
    }
  };

  return (
    <div
      data-testid="trait-card"
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? accessibleLabel : undefined}
      onClick={isInteractive ? () => onSelect!() : undefined}
      onKeyDown={handleKeyDown}
      className={`relative p-4 rounded-lg border transition-all duration-200 ${colors.border} ${colors.bg} ${
        colors.animation || ''
      } ${isHovered ? 'shadow-lg scale-105 magical-glow' : 'shadow-sm'} ${
        isInteractive
          ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-burnished-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(10,22,40)]'
          : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {/* Trait Name */}
          <h4 className={`font-bold text-lg ${colors.text} mb-1`}>
            {trait.name}
            {trait.rarity === 'legendary' && (
              <Sparkles className="inline-block ml-2 w-4 h-4 text-burnished-gold animate-pulse" />
            )}
          </h4>

          {/* Trait Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              {trait.type === 'genetic' ? 'Genetic' : 'Epigenetic'}
            </span>

            {/* Rarity Badge */}
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                trait.rarity === 'legendary'
                  ? 'bg-gradient-to-r from-burnished-gold to-purple-500 text-[var(--text-primary)]'
                  : trait.rarity === 'rare'
                    ? 'bg-burnished-gold text-[var(--text-primary)]'
                    : 'bg-[rgba(37,99,235,0.2)] text-slate-400'
              }`}
            >
              {trait.rarity.charAt(0).toUpperCase() + trait.rarity.slice(1)}
            </span>

            {/* Valence Badge (Equoria-6rf97) — backend-authoritative
                beneficial/detrimental classification. Icon + text, not
                color-only, for a11y. */}
            {valence && (
              <span
                data-testid="trait-valence-badge"
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                  valence === 'positive'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {valence === 'positive' ? (
                  <TrendingUp className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3 h-3" aria-hidden="true" />
                )}
                {valence === 'positive' ? 'Beneficial' : 'Detrimental'}
              </span>
            )}

            {/* Active Status for Epigenetic */}
            {trait.type === 'epigenetic' && trait.isActive !== undefined && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  trait.isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[rgba(37,99,235,0.1)] text-slate-400 border border-[rgba(37,99,235,0.2)]'
                }`}
              >
                {trait.isActive ? 'Active' : 'Dormant'}
              </span>
            )}
          </div>
        </div>

        {/* Info Icon */}
        {showTooltip && <Info className={`w-5 h-5 ${colors.text} cursor-help`} />}
      </div>

      {/* Strength Meter */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Strength
          </span>
          <span className={`text-xs font-semibold ${strengthInfo.color}`}>
            {strengthInfo.label} ({trait.strength})
          </span>
        </div>
        <div className="h-2 bg-[rgba(15,35,70,0.5)] rounded-full overflow-hidden border border-[rgba(37,99,235,0.2)]">
          <div
            className={`h-full ${strengthInfo.bgColor} transition-all duration-300`}
            style={{ width: `${trait.strength}%` }}
          />
        </div>
      </div>

      {/* Source Badge (Inheritance) */}
      {sourceInfo && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {sourceInfo.icon} <span className="text-xs text-slate-400">{sourceInfo.label}</span>
            </span>
          </div>
        </div>
      )}

      {/* Discovery Date (Epigenetic Only) */}
      {trait.type === 'epigenetic' && trait.discoveryDate && (
        <div className="text-xs text-slate-400 mb-2">
          Discovered: {new Date(trait.discoveryDate).toLocaleDateString()}
        </div>
      )}

      {/* Tooltip on Hover */}
      {showTooltip && isHovered && (
        <div className="absolute z-[var(--z-raised)] top-full left-0 mt-2 p-4 glass-panel rounded-lg shadow-xl border border-[rgba(37,99,235,0.3)] w-80 max-w-[90vw]">
          {/* Trait Description */}
          <p className="text-sm text-[rgb(220,235,255)] mb-3">{trait.description}</p>

          {/* Impact on Stats */}
          {trait.impact.stats && Object.keys(trait.impact.stats).length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-aged-bronze mb-2">Stat Impact:</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(trait.impact.stats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between text-xs">
                    <span className="capitalize text-slate-400">{stat}:</span>
                    <span className={value > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {value > 0 ? '+' : ''}
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact on Disciplines */}
          {trait.impact.disciplines && Object.keys(trait.impact.disciplines).length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-aged-bronze mb-2">Discipline Impact:</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(trait.impact.disciplines).map(([discipline, value]) => (
                  <div key={discipline} className="flex justify-between text-xs">
                    <span className="capitalize text-slate-400">{discipline}:</span>
                    <span className={value > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {value > 0 ? '+' : ''}
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rarity Info */}
          {trait.rarity === 'legendary' && (
            <div className="mt-3 pt-3 border-t border-aged-bronze/30">
              <p className="text-xs text-burnished-gold font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Legendary Trait - Extremely Rare
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TraitCard;
