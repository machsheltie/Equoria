import React, { useState } from 'react';
import { Sparkles, Info, TrendingUp } from 'lucide-react';

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
  onViewParent?: (parentId: number) => void;
  showTooltip?: boolean;
}

/**
 * Get border and background colors based on trait type and rarity
 */
const getTraitColors = (type: 'genetic' | 'epigenetic', rarity: string) => {
  // Base colors by type
  const typeColors: Record<string, { border: string; bg: string; text: string; accent?: string; animation?: string }> = {
    genetic: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    epigenetic: {
      border: 'border-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
    },
  };

  // Override for rare/legendary
  if (rarity === 'rare') {
    return {
      border: 'border-burnished-gold',
      bg: 'bg-amber-50',
      text: 'text-burnished-gold',
      accent: 'text-burnished-gold',
    };
  }

  if (rarity === 'legendary') {
    return {
      border: 'border-gradient-to-r from-burnished-gold via-purple-500 to-burnished-gold',
      bg: 'bg-gradient-to-br from-amber-50 to-purple-50',
      text: 'text-transparent bg-clip-text bg-gradient-to-r from-burnished-gold to-purple-600',
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
      color: 'text-forest-green',
      bgColor: 'bg-forest-green',
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
    color: 'text-mystic-silver',
    bgColor: 'bg-mystic-silver',
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
  onViewParent,
  showTooltip = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const colors = getTraitColors(trait.type, trait.rarity);
  const strengthInfo = getStrengthInfo(trait.strength);
  const sourceInfo = getSourceInfo(trait.source);

  return (
    <div
      className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${colors.border} ${colors.bg} ${
        colors.animation || ''
      } ${isHovered ? 'shadow-lg scale-105' : 'shadow-sm'}`}
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
                  ? 'bg-gradient-to-r from-burnished-gold to-purple-500 text-white'
                  : trait.rarity === 'rare'
                  ? 'bg-burnished-gold text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {trait.rarity.charAt(0).toUpperCase() + trait.rarity.slice(1)}
            </span>

            {/* Active Status for Epigenetic */}
            {trait.type === 'epigenetic' && trait.isActive !== undefined && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  trait.isActive
                    ? 'bg-forest-green text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {trait.isActive ? 'Active' : 'Dormant'}
              </span>
            )}
          </div>
        </div>

        {/* Info Icon */}
        {showTooltip && (
          <Info className={`w-5 h-5 ${colors.text} cursor-help`} />
        )}
      </div>

      {/* Strength Meter */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Strength
          </span>
          <span className={`text-xs font-semibold ${strengthInfo.color}`}>
            {strengthInfo.label} ({trait.strength})
          </span>
        </div>
        <div className="h-2 bg-parchment rounded-full overflow-hidden border border-aged-bronze">
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
              {sourceInfo.icon} <span className="text-xs text-gray-600">{sourceInfo.label}</span>
            </span>
          </div>
        </div>
      )}

      {/* Discovery Date (Epigenetic Only) */}
      {trait.type === 'epigenetic' && trait.discoveryDate && (
        <div className="text-xs text-gray-500 mb-2">
          Discovered: {new Date(trait.discoveryDate).toLocaleDateString()}
        </div>
      )}

      {/* Tooltip on Hover */}
      {showTooltip && isHovered && (
        <div className="absolute z-10 top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-xl border-2 border-aged-bronze w-80 max-w-[90vw]">
          {/* Trait Description */}
          <p className="text-sm text-midnight-ink mb-3">{trait.description}</p>

          {/* Impact on Stats */}
          {trait.impact.stats && Object.keys(trait.impact.stats).length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-aged-bronze mb-2">Stat Impact:</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(trait.impact.stats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between text-xs">
                    <span className="capitalize">{stat}:</span>
                    <span className={value > 0 ? 'text-forest-green' : 'text-red-500'}>
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
                    <span className="capitalize">{discipline}:</span>
                    <span className={value > 0 ? 'text-forest-green' : 'text-red-500'}>
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
            <div className="mt-3 pt-3 border-t border-aged-bronze">
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
