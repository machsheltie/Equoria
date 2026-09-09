/**
 * LineageSection — sire/dam parent links plus a contribution bar
 * showing % traits inherited from each parent + any mutations.
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 *
 * Palette migration (design exception `palette-classes` retired): raw
 * blue/purple gradients are now `--status-info` (sire) and `--status-rare`
 * (dam), and each bar segment states its parent in words with an accessible
 * name on the bar, so the split no longer rests on hue alone. The exception's
 * other half — "migrate to a purpose-built family tree" — is a redesign and
 * is NOT done here; it remains open for the owner's direction.
 */

import React from 'react';
import type { EpigeneticTrait } from '../../../hooks/useHorseGenetics';
import type { Horse } from '../HorseDetailPageTypes';

interface LineageSectionProps {
  horse: Horse;
  allTraits: EpigeneticTrait[];
}

const LineageSection: React.FC<LineageSectionProps> = ({ horse, allTraits }) => {
  if (!horse.parentIds) return null;

  const sireTraits = allTraits.filter((t) => t.source === 'sire').length;
  const damTraits = allTraits.filter((t) => t.source === 'dam').length;
  const mutationTraits = allTraits.filter((t) => t.source === 'mutation').length;
  const inheritedTotal = sireTraits + damTraits;

  const sirePercentage = inheritedTotal > 0 ? Math.round((sireTraits / inheritedTotal) * 100) : 0;
  const damPercentage = inheritedTotal > 0 ? Math.round((damTraits / inheritedTotal) * 100) : 0;

  return (
    <div>
      <h3 className="type-section-heading mb-4">Lineage &amp; Genetic Contribution</h3>

      {/* Genetic Contribution Visualization */}
      {allTraits.length > 0 && (
        <div className="mb-6 p-4 glass-panel rounded-lg border border-[rgba(37,99,235,0.2)]">
          <h4 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3">
            Genetic Contribution
          </h4>

          {/* Contribution Bar — each segment names its parent in text, so the
              sire/dam split does not rest on colour alone. */}
          <div
            className="flex h-8 rounded-lg overflow-hidden border border-[rgba(37,99,235,0.3)] mb-3"
            role="img"
            aria-label={`Genetic contribution: sire ${sireTraits} trait${
              sireTraits === 1 ? '' : 's'
            } (${sirePercentage}%), dam ${damTraits} trait${
              damTraits === 1 ? '' : 's'
            } (${damPercentage}%)`}
          >
            {sireTraits > 0 && (
              <div
                className="bg-[var(--status-info)] flex items-center justify-center min-w-0 px-1 text-role-inverse text-xs font-semibold"
                style={{ width: `${sirePercentage}%` }}
                title={`Sire: ${sireTraits} traits (${sirePercentage}%)`}
              >
                <span className="truncate">Sire {sirePercentage}%</span>
              </div>
            )}
            {damTraits > 0 && (
              <div
                className="bg-[var(--status-rare)] flex items-center justify-center min-w-0 px-1 text-role-inverse text-xs font-semibold"
                style={{ width: `${damPercentage}%` }}
                title={`Dam: ${damTraits} traits (${damPercentage}%)`}
              >
                <span className="truncate">Dam {damPercentage}%</span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[var(--status-info)]" aria-hidden="true"></div>
              <span className="text-[rgb(220,235,255)]">
                Sire: <strong>{sireTraits}</strong> ({sirePercentage}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[var(--status-rare)]" aria-hidden="true"></div>
              <span className="text-[rgb(220,235,255)]">
                Dam: <strong>{damTraits}</strong> ({damPercentage}%)
              </span>
            </div>
            {mutationTraits > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded bg-gradient-to-r from-[var(--gold-primary)] to-[var(--text-secondary)]"
                  aria-hidden="true"
                ></div>
                <span className="text-[rgb(220,235,255)]">
                  Mutations: <strong>{mutationTraits}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Analysis */}
          {inheritedTotal > 0 && (
            <div className="mt-3 pt-3 border-t border-[rgba(37,99,235,0.2)]">
              <p className="text-xs text-[rgb(160,175,200)]">
                {sirePercentage > damPercentage + 10 ? (
                  <>
                    <strong>Sire-Dominant:</strong> This horse inherited significantly more traits
                    from the sire lineage.
                  </>
                ) : damPercentage > sirePercentage + 10 ? (
                  <>
                    <strong>Dam-Dominant:</strong> This horse inherited significantly more traits
                    from the dam lineage.
                  </>
                ) : (
                  <>
                    <strong>Balanced Inheritance:</strong> This horse has a well-balanced genetic
                    contribution from both parents.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parent Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {horse.parentIds.sireId && (
          <button
            onClick={() => (window.location.href = `/horses/${horse.parentIds!.sireId}`)}
            className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-[var(--alpha-gold-primary-50)] transition-colors text-left"
          >
            <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Sire</p>
            <p className="fantasy-body text-[rgb(220,235,255)]">View Sire Details &rarr;</p>
          </button>
        )}
        {horse.parentIds.damId && (
          <button
            onClick={() => (window.location.href = `/horses/${horse.parentIds!.damId}`)}
            className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-[var(--alpha-gold-primary-50)] transition-colors text-left"
          >
            <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Dam</p>
            <p className="fantasy-body text-[rgb(220,235,255)]">View Dam Details &rarr;</p>
          </button>
        )}
      </div>
    </div>
  );
};

export default LineageSection;
