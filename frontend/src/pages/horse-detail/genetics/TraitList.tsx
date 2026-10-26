/**
 * TraitList: the horse's revealed traits, as a quiet list. Each row names the
 * trait, says in words whether it helps or hinders, and gives its description.
 * No strength, rarity or score is shown (owner ruling 2026-10-26, q72).
 * A trait revealed since the owner last looked glows once (Equoria-lylhb).
 * Rows open the trait detail dialog (Equoria-vpgmc).
 */

import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { HorseTrait } from '../../../hooks/useHorseTraits';

interface TraitListProps {
  traits: HorseTrait[];
  /** Normalised keys of traits that should glow (first view). */
  glowTokens: ReadonlySet<string>;
  normalize: (value: string) => string;
  onSelect: (trait: HorseTrait) => void;
}

const TraitList: React.FC<TraitListProps> = ({ traits, glowTokens, normalize, onSelect }) => (
  <ul className="divide-y divide-[var(--frosted-border)]">
    {traits.map((trait) => {
      const isNew = glowTokens.has(normalize(trait.key));
      const helps = trait.valence === 'positive';
      return (
        <li key={trait.key}>
          <div
            data-testid="trait-card"
            data-new-trait={isNew ? 'true' : undefined}
            style={isNew ? { boxShadow: 'var(--glow-gold-strong)' } : undefined}
            role="button"
            tabIndex={0}
            aria-label={`${trait.name} trait - ${helps ? 'positive' : 'negative'}, activate for details`}
            onClick={() => onSelect(trait)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(trait);
              }
            }}
            className="cursor-pointer rounded-md px-2 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)]"
          >
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                {trait.name}
                {isNew && <span className="sr-only"> (newly revealed)</span>}
              </h4>
              <span
                data-testid="trait-valence-badge"
                className={`inline-flex items-center gap-1 text-sm ${
                  helps ? 'text-[var(--role-success-text)]' : 'text-[var(--role-danger-text)]'
                }`}
              >
                {helps ? (
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                )}
                {helps ? 'Helps' : 'Hinders'}
              </span>
            </div>
            {trait.description && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{trait.description}</p>
            )}
          </div>
        </li>
      );
    })}
  </ul>
);

export default TraitList;
