/**
 * TraitInteractionsSection — grid of trait-pair interactions with
 * colored strength badges.
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 */

import React from 'react';
import type { TraitInteraction } from '../../../hooks/useHorseGenetics';

interface TraitInteractionsSectionProps {
  interactions: TraitInteraction[] | undefined;
}

const TraitInteractionsSection: React.FC<TraitInteractionsSectionProps> = ({ interactions }) => {
  if (!interactions || interactions.length === 0) return null;

  return (
    <div>
      <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
        Trait Interactions ({interactions.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {interactions.map((interaction, index) => (
          <div
            key={index}
            className="p-4 bg-[rgba(37,99,235,0.08)] rounded-lg border border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-purple-400">
                {interaction.trait1} + {interaction.trait2}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  interaction.strength >= 75
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : interaction.strength >= 50
                      ? 'bg-burnished-gold/20 text-burnished-gold'
                      : 'bg-[rgba(37,99,235,0.15)] text-slate-400'
                }`}
              >
                Strength: {interaction.strength}
              </span>
            </div>
            <p className="text-sm text-[rgb(220,235,255)]">{interaction.effect}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TraitInteractionsSection;
