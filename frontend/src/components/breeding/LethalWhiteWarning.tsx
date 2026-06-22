/**
 * LethalWhiteWarning (Equoria-wodz, 31E retro action item)
 *
 * Surfaces lethal white risk to players BEFORE they confirm a breeding pair.
 * Pulls the same prediction data as `ColorPredictionChart` (one query, cached
 * by useColorPrediction) and renders a prominent red banner when
 * `lethalCombinationsFiltered > 0`.
 *
 * Player-friendly copy (no jargon):
 *   - Avoid: "homozygous overo", "OLW", "frame overo"
 *   - Use:   "some foals from this pairing would not survive birth"
 *
 * Render contract:
 *   - Hidden while data is loading (the chart's loading state suffices).
 *   - Hidden when both parents have full genotype data AND no lethal
 *     combinations exist — silence-is-golden in the happy path.
 *   - Hidden in the legacy-horse case (data === null) — the chart already
 *     surfaces that the prediction is unavailable.
 *   - Banner-prominent when lethalCombinationsFiltered > 0.
 */

import type { JSX } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useColorPrediction } from '@/hooks/api/useColorPrediction';

export interface LethalWhiteWarningProps {
  sireId: number | null | undefined;
  damId: number | null | undefined;
}

export default function LethalWhiteWarning({
  sireId,
  damId,
}: LethalWhiteWarningProps): JSX.Element | null {
  const { data, isLoading, error } = useColorPrediction(sireId, damId);

  // Hide while loading / on error / when legacy horse / when pair invalid —
  // the chart component already handles those states honestly. We only
  // surface the WARNING when the backend has definitive risk data.
  if (isLoading || error || data == null) return null;
  if (typeof sireId !== 'number' || typeof damId !== 'number' || sireId === damId) return null;
  if (data.lethalCombinationsFiltered <= 0) return null;

  const total = data.totalCombinations;
  const lethal = data.lethalCombinationsFiltered;
  const lethalPercent = total > 0 ? Math.round((lethal / total) * 100) : 0;

  return (
    <div
      role="alert"
      data-testid="lethal-white-warning"
      className="rounded-lg border border-[var(--status-danger)] bg-[var(--role-danger-bg)] p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--role-danger-text)] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-midnight-ink">Lethal foal risk for this breeding pair</p>
          <p className="mt-1 text-[var(--role-danger-text)]">
            Both parents carry a coat-color gene that is dangerous when inherited together. Some
            foals from this pairing would not survive birth — an estimated{' '}
            <strong>{lethalPercent}%</strong> of possible offspring genotypes ({lethal} of {total})
            are non-viable and are excluded from the color forecast below.
          </p>
          <p className="mt-1 text-[var(--role-danger-text)]">
            Consider choosing a different sire or dam to avoid this risk.
          </p>
        </div>
      </div>
    </div>
  );
}
