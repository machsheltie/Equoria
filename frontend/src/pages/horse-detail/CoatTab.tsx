/**
 * CoatTab — dedicated Color & Genetics panel for HorseDetailPage (Epic 31E-4)
 *
 * Equoria-ea3n + Equoria-oovy. Sources data from the new /horses/:id/color and
 * /horses/:id/genetics endpoints via React Query hooks, rather than reading
 * phenotype JSON straight off the main horse payload. Surfaces:
 *
 *   1. Color name + shade (e.g. "Bay — Dark").
 *   2. Face marking, leg markings, advanced markings.
 *   3. Modifier chips (sooty, flaxen, pangare, rabicano) — only when present.
 *   4. Locus-by-locus genotype table with allele pairs (breeding planning).
 *
 * Legacy horses without color data render a graceful empty state with the
 * message returned by the backend, rather than throwing or hiding.
 */

import { Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/state';
import { useHorseCoatGenetics, useHorseCoatColor } from '@/hooks/useHorseCoatGenetics';

/**
 * Short, human-readable description per locus. Used as a tooltip-grade
 * interpretation in the genotype table (Equoria-oovy AC2). Keys mirror the
 * CORE_LOCI list in backend genotypeGenerationService.mjs so that any new
 * locus added in the backend will surface as the locus name itself until
 * a description is added here — no crash, just less context.
 */
const LOCUS_INTERPRETATIONS: Record<string, string> = {
  E_Extension: 'Extension — controls black vs red base coat (E dominant, e recessive).',
  A_Agouti: 'Agouti — restricts black pigment to mane/tail/legs (bay vs black).',
  Cr_Cream: 'Cream — dilutes red and black pigment (palomino, buckskin, cremello).',
  D_Dun: 'Dun — primitive marking + body dilution.',
  Z_Silver: 'Silver — dilutes black pigment only (e.g. silver bay, silver dapple).',
  Ch_Champagne: 'Champagne — soft body dilution with mottled skin & light eyes.',
  G_Gray: 'Gray — progressive depigmentation with age (dominant).',
  Rn_Roan: 'Roan — interspersed white hairs on the body (head/legs stay dark).',
  W_DominantWhite: 'Dominant White — large patches of unpigmented skin and hair.',
  TO_Tobiano: 'Tobiano — vertical white spotting that crosses the topline.',
  O_FrameOvero: 'Frame Overo — horizontal white spotting (lethal in homozygous).',
  SB1_Sabino1: 'Sabino-1 — irregular white edges, belly spots, leg markings.',
  SW_SplashWhite: 'Splash White — "dipped in paint" pattern with blue eyes.',
  LP_LeopardComplex: 'Leopard Complex — Appaloosa spotting base gene.',
  PATN1_Pattern1: 'Pattern-1 — modifies the extent of leopard-complex spotting.',
  EDXW: 'EDXW — Extreme White; large coverage variant.',
  MFSD12_Mushroom: 'Mushroom — sepia-toned recessive dilution of red.',
};

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
  const geneticsQuery = useHorseCoatGenetics(horseId);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1 — Color & markings (ea3n)                              */}
      {/* ----------------------------------------------------------------- */}
      <section data-testid="coat-color-section">
        <h2 className="text-xl font-display text-[var(--text-primary)] mb-3">
          Color &amp; Markings
        </h2>
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
              <div
                className="text-2xl font-display text-[var(--text-primary)]"
                data-testid="coat-color-name"
              >
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

      {/* ----------------------------------------------------------------- */}
      {/* Section 2 — Genotype table (oovy)                                */}
      {/* ----------------------------------------------------------------- */}
      <section data-testid="coat-genotype-section">
        <h2 className="text-xl font-display text-[var(--text-primary)] mb-3">
          Genotype (Breeding Planning)
        </h2>
        {geneticsQuery.isLoading && <LoadingBlock label="Loading genotype..." />}
        {geneticsQuery.isError && (
          <ErrorState
            message="Could not load genotype data."
            retry={{ label: 'Try Again', onClick: () => geneticsQuery.refetch() }}
          />
        )}
        {geneticsQuery.isSuccess && geneticsQuery.data === null && (
          <EmptyState message="No genotype data available for this horse." />
        )}
        {geneticsQuery.isSuccess && geneticsQuery.data !== null && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="coat-genotype-table">
              <thead>
                <tr className="bg-[var(--alpha-bg-midnight-50)] text-[var(--text-secondary)]">
                  <th className="px-3 py-2 text-left">Locus</th>
                  <th className="px-3 py-2 text-left">Allele pair</th>
                  <th className="px-3 py-2 text-left">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(geneticsQuery.data.colorGenotype).map(([locus, allelePair]) => (
                  <tr
                    key={locus}
                    className="border-t border-[var(--alpha-gold-primary-10)]"
                    data-testid={`coat-locus-${locus}`}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{locus}</td>
                    <td className="px-3 py-2 font-mono text-[var(--gold-primary)]">
                      {String(allelePair)}
                    </td>
                    <td
                      className="px-3 py-2 text-[var(--text-secondary)]"
                      title={LOCUS_INTERPRETATIONS[locus] ?? locus}
                    >
                      {LOCUS_INTERPRETATIONS[locus] ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
