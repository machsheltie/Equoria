/**
 * TraitInteractionsSection — grid of trait-pair interactions with
 * strength badges.
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 *
 * Palette migration (design exception `palette-classes` retired): raw
 * purple/emerald/slate classes are now semantic tokens, and each badge names
 * its strength band in words alongside an arrow glyph, so the band is legible
 * without telling the badge colours apart. Band thresholds are unchanged; the
 * Strong / Moderate / Mild vocabulary and glyphs come from the existing ladder
 * in `components/trainer/TrainerDiscoveryPanel.tsx`.
 */

import React from 'react';
import type { TraitInteraction } from '../../../hooks/useHorseGenetics';

interface TraitInteractionsSectionProps {
  interactions: TraitInteraction[] | undefined;
}

/** Strength band for a trait interaction. `label`/`icon` carry it without colour. */
function strengthBand(strength: number): { label: string; icon: string; badgeClass: string } {
  if (strength >= 75) {
    return {
      label: 'Strong',
      icon: '⬆⬆',
      badgeClass: 'bg-[var(--role-success-bg)] text-[var(--role-success-text)]',
    };
  }
  if (strength >= 50) {
    return {
      label: 'Moderate',
      icon: '⬆',
      badgeClass: 'bg-[var(--alpha-gold-primary-20)] text-[var(--gold-primary)]',
    };
  }
  return {
    label: 'Mild',
    icon: '→',
    badgeClass: 'bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)]',
  };
}

const TraitInteractionsSection: React.FC<TraitInteractionsSectionProps> = ({ interactions }) => {
  if (!interactions || interactions.length === 0) return null;

  return (
    <div>
      <h3 className="type-section-heading mb-4">Trait Interactions ({interactions.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {interactions.map((interaction, index) => {
          const band = strengthBand(interaction.strength);
          return (
            <div
              key={index}
              className="p-4 bg-[rgba(37,99,235,0.08)] rounded-lg border border-[var(--role-info-border)]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--status-rare)]">
                  {interaction.trait1} + {interaction.trait2}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${band.badgeClass}`}
                  aria-label={`Interaction strength ${interaction.strength} of 100 — ${band.label}`}
                  title={`Interaction strength ${interaction.strength} of 100 — ${band.label}`}
                >
                  <span aria-hidden="true">{band.icon} </span>
                  {band.label} · {interaction.strength}
                </span>
              </div>
              <p className="text-sm text-[rgb(220,235,255)]">{interaction.effect}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TraitInteractionsSection;
