/**
 * TraitDiscovery: one button-styled chip for every trait the horse carries
 * (owner rulings q174 and q213, 2026-10-28; Equoria-i366a, Equoria-nrto5).
 *
 * - A hidden trait is a dark blue "Hidden" chip, the same treatment as the
 *   quick-actions bar buttons. Players may know how many traits a horse
 *   carries; the server sends only the count, never a hidden name.
 * - A revealed trait turns gold, like Train This Horse and Enter Competition,
 *   and opens its detail. One revealed since the owner last looked glows once
 *   (Equoria-lylhb).
 * - A switched-off (dormant) trait is greyed out and still shows its name,
 *   with the word "Inactive" so the state never rests on color alone.
 *
 * Rarity is never shown; names are the authored labels the server sends.
 */

import React from 'react';
import type { HorseTrait } from '../../../hooks/useHorseTraits';
import '@/styles/traitDiscovery.css';

interface TraitDiscoveryProps {
  revealed: HorseTrait[];
  dormant: HorseTrait[];
  hiddenCount: number;
  /** Normalised keys of revealed traits that glow (first view). */
  glowTokens: ReadonlySet<string>;
  normalize: (value: string) => string;
  onSelect: (trait: HorseTrait) => void;
}

const TraitDiscovery: React.FC<TraitDiscoveryProps> = ({
  revealed,
  dormant,
  hiddenCount,
  glowTokens,
  normalize,
  onSelect,
}) => {
  const carried = revealed.length + dormant.length + hiddenCount;

  return (
    <section aria-labelledby="trait-discovery-heading" data-testid="hidden-traits-section">
      <h3 id="trait-discovery-heading" className="type-section-heading trait-discovery__heading">
        Trait Discovery
      </h3>
      {carried === 0 ? (
        <div className="trait-discovery__empty">
          <p className="fantasy-body">No traits discovered yet</p>
          <p className="fantasy-caption trait-discovery__quiet">
            Traits emerge from how a horse is raised and cared for. They will appear here as they
            are discovered.
          </p>
        </div>
      ) : (
        <ul className="trait-discovery" aria-label="Traits carried">
          {revealed.map((trait) => {
            const isNew = glowTokens.has(normalize(trait.key));
            return (
              <li key={trait.key}>
                <button
                  type="button"
                  className="trait-chip trait-chip--revealed"
                  data-testid="trait-card"
                  data-new-trait={isNew ? 'true' : undefined}
                  style={isNew ? { boxShadow: 'var(--glow-gold-strong)' } : undefined}
                  onClick={() => onSelect(trait)}
                >
                  {trait.name}
                  {isNew && <span className="sr-only"> (newly revealed)</span>}
                </button>
              </li>
            );
          })}
          {dormant.map((trait) => (
            <li key={trait.key}>
              <button
                type="button"
                className="trait-chip trait-chip--inactive"
                data-testid="trait-chip-inactive"
                onClick={() => onSelect(trait)}
              >
                {trait.name}
                <span className="trait-chip__state">Inactive</span>
              </button>
            </li>
          ))}
          {Array.from({ length: hiddenCount }, (_, index) => (
            <li key={`hidden-${index}`}>
              <span className="trait-chip trait-chip--hidden" data-testid="trait-chip-hidden">
                Hidden
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TraitDiscovery;
