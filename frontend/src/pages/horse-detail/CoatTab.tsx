/**
 * CoatTab — dedicated Color & Markings panel for HorseDetailPage (Epic 31E-4)
 *
 * Equoria-ea3n. Sources data from /horses/:id/color via a React Query hook,
 * rather than reading phenotype JSON straight off the main horse payload. The
 * genotype table moved to the Genetics tab (owner ruling 2026-10-26, q72): it
 * stays hidden until the Vet's Genetic Testing is paid for. Surfaces:
 *
 *   1. Color name + shade (e.g. "Bay — Dark").
 *   2. Face marking, leg markings, advanced markings.
 *   3. Modifier chips (sooty, flaxen, pangare, rabicano) — only when present.
 *
 * Legacy horses without color data render a graceful empty state with the
 * message returned by the backend, rather than throwing or hiding.
 */

import { Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/state';
import { useHorseCoatColor } from '@/hooks/useHorseCoatGenetics';

/**
 * Human-friendly label for each leg position.
 */
const LEG_POSITIONS: Array<{ key: string; label: string }> = [
  { key: 'frontLeft', label: 'Front-left' },
  { key: 'frontRight', label: 'Front-right' },
  { key: 'hindLeft', label: 'Hind-left' },
  { key: 'hindRight', label: 'Hind-right' },
];

/**
 * Modifier keys with player-facing labels. Renders as chips when truthy.
 */
const MODIFIER_KEYS: Array<{ key: string; label: string }> = [
  { key: 'isSooty', label: 'Sooty' },
  { key: 'isFlaxen', label: 'Flaxen' },
  { key: 'isPangare', label: 'Pangare' },
  { key: 'isRabicano', label: 'Rabicano' },
];

function LoadingBlock({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center gap-2 text-[var(--text-secondary)] py-4"
    >
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/* Honest absence renders muted, not ceremonial: gold marks what was earned,
   and "no data recorded" is not an earning (Equoria-izmsb goldsmith pass —
   this block previously sat in gold-80 text over the retired parchment
   bg-warm-cream, both off-register on the night ground). */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--frosted-border)] p-6 text-center text-[var(--text-secondary)]">
      {message}
    </div>
  );
}

interface CoatTabProps {
  horseId: number | string;
}

export default function CoatTab({ horseId }: CoatTabProps) {
  const colorQuery = useHorseCoatColor(horseId);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1 — Color & markings (ea3n)                              */}
      {/* ----------------------------------------------------------------- */}
      <section data-testid="coat-color-section">
        <h2 className="type-section-heading mb-3">Color &amp; Markings</h2>
        {colorQuery.isLoading && <LoadingBlock label="Loading color data..." />}
        {colorQuery.isError && (
          <ErrorState
            message="Could not load color data."
            retry={{ label: 'Try Again', onClick: () => colorQuery.refetch() }}
          />
        )}
        {colorQuery.isSuccess && colorQuery.data === null && (
          <EmptyState message="No color data available for this horse." />
        )}
        {colorQuery.isSuccess && colorQuery.data !== null && (
          <div className="space-y-4">
            <div>
              <div className="text-sm uppercase tracking-wide text-[var(--alpha-gold-primary-80)]">
                Coat color
              </div>
              <div className="text-2xl text-[var(--text-primary)]" data-testid="coat-color-name">
                {colorQuery.data.colorName ?? 'not recorded'}
                {colorQuery.data.shade ? ` — ${colorQuery.data.shade}` : ''}
              </div>
            </div>

            <div>
              <div className="text-sm uppercase tracking-wide text-[var(--alpha-gold-primary-80)]">
                Face marking
              </div>
              <div className="text-base text-[var(--text-primary)]" data-testid="coat-face-marking">
                {colorQuery.data.faceMarking || 'None'}
              </div>
            </div>

            <div>
              <div className="text-sm uppercase tracking-wide text-[var(--alpha-gold-primary-80)]">
                Leg markings
              </div>
              <ul className="grid grid-cols-2 gap-2 mt-1" data-testid="coat-leg-markings">
                {LEG_POSITIONS.map(({ key, label }) => {
                  const legs = colorQuery.data?.legMarkings as
                    | Record<string, string>
                    | null
                    | undefined;
                  const value = legs && !Array.isArray(legs) ? legs[key] : null;
                  return (
                    <li key={key} className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{label}:</span> {value || 'None'}
                    </li>
                  );
                })}
              </ul>
            </div>

            {(() => {
              const adv = colorQuery.data.advancedMarkings as
                | Record<string, unknown>
                | null
                | undefined;
              if (!adv || typeof adv !== 'object' || Array.isArray(adv)) return null;
              const chips = Object.entries(adv).filter(([, v]) => v === true);
              if (chips.length === 0) return null;
              return (
                <div>
                  <div className="text-sm uppercase tracking-wide text-[var(--alpha-gold-primary-80)]">
                    Advanced markings
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1" data-testid="coat-advanced-markings">
                    {chips.map(([key]) => (
                      <span
                        key={key}
                        className="px-2 py-1 rounded bg-[var(--alpha-gold-primary-20)] text-[var(--gold-primary)] text-xs"
                      >
                        {key
                          .replace(/Present$/i, '')
                          .replace(/([A-Z])/g, ' $1')
                          .trim()}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const mods = colorQuery.data.modifiers as Record<string, unknown> | null | undefined;
              if (!mods || typeof mods !== 'object' || Array.isArray(mods)) return null;
              const active = MODIFIER_KEYS.filter(({ key }) => mods[key] === true);
              if (active.length === 0) return null;
              return (
                <div>
                  <div className="text-sm uppercase tracking-wide text-[var(--alpha-gold-primary-80)]">
                    Modifiers
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1" data-testid="coat-modifiers">
                    {active.map(({ key, label }) => (
                      <span
                        key={key}
                        className="px-2 py-1 rounded bg-[var(--alpha-gold-primary-20)] text-[var(--gold-primary)] text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
