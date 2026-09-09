/**
 * ColorPredictionChart (Equoria-4v6w, 31E-5 frontend UI)
 *
 * Displays the offspring coat-color probability distribution for a given
 * sire/dam pair. Pulls data via `useColorPrediction` (Equoria-c9jp) which wraps
 * the backend's per-locus Punnett-square service.
 *
 * Render contract:
 *   - Loading skeleton while data is in flight.
 *   - Legacy-horse case (`data === null` per AC6): renders an honest
 *     "color prediction unavailable" notice — NOT a fabricated chart.
 *   - Error fallback with the API error message.
 *   - Happy path: per-color horizontal probability bar sorted descending
 *     (backend already sorts), plus a "X combinations · Y lethal filtered"
 *     fine print so power users understand how the chart was derived.
 *
 * Backend doctrine (`backend/modules/horses/services/breedingColorPredictionService.mjs`):
 *   - Probabilities always sum to ≤ 1.0 (Math.min(1, ...) cap).
 *   - All-lethal edge case returns empty `possibleColors[]` — render an
 *     empty-state message rather than crashing.
 *
 * Palette migration (design exception `palette-classes` retired): this file
 * never encoded a literal coat colour. Its retired exception justification
 * ("temporary review of literal coat-color encoding") did not describe the
 * file — every raw class was generic chrome: red error/all-lethal states, an
 * amber "prediction unavailable" notice, and one amber accent used identically
 * for the header icon and every probability bar regardless of which coat colour
 * the row named. Those are now `--role-danger-*`, `--role-warning-*`, and the
 * house gold bar gradient. If literal coat swatches are ever wanted here, that
 * is a new design decision, not a restoration of something removed.
 *
 * The component intentionally has no recharts dependency for this iteration —
 * a flat row of percentage bars is sufficient and keeps the bundle smaller.
 * Switching to a recharts BarChart is a follow-up if richer interactivity is
 * needed.
 */

import type { JSX } from 'react';
import { AlertCircle, Palette } from 'lucide-react';
import { useColorPrediction } from '@/hooks/api/useColorPrediction';

export interface ColorPredictionChartProps {
  sireId: number | null | undefined;
  damId: number | null | undefined;
  /** Optional breed override; defaults to dam's breed server-side. */
  foalBreedId?: number;
}

export default function ColorPredictionChart({
  sireId,
  damId,
  foalBreedId,
}: ColorPredictionChartProps): JSX.Element | null {
  const { data, isLoading, error } = useColorPrediction(sireId, damId, foalBreedId);

  // Self-cross or missing parents: render nothing — parent UI should not even
  // mount this when the pair is incomplete, but defend defensively.
  if (typeof sireId !== 'number' || typeof damId !== 'number' || sireId === damId) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-[var(--btn-glass-border)] bg-[var(--alpha-bg-midnight-20)] p-4"
        data-testid="color-prediction-loading"
      >
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-[var(--role-accent-text)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Offspring Color Forecast
          </span>
        </div>
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 rounded bg-[var(--alpha-bg-midnight-40)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] p-4"
        data-testid="color-prediction-error"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-[var(--role-danger-text)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--text-primary)]">Color prediction unavailable</p>
            <p className="text-[var(--role-danger-text)] mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // AC6 legacy-horse case: backend returns null for parents without genotype data
  if (data == null) {
    return (
      <div
        className="rounded-lg border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] p-4"
        data-testid="color-prediction-legacy"
      >
        <div className="flex items-start gap-2">
          <Palette className="h-4 w-4 text-[var(--role-warning-text)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--text-primary)]">Offspring Color Forecast</p>
            <p className="text-[var(--role-warning-text)] mt-1">
              Color prediction is unavailable for this pair — one or both parents predate the
              coat-genetics system (no genotype recorded).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All-lethal edge case — backend filtered every combination as lethal
  if (data.possibleColors.length === 0) {
    return (
      <div
        className="rounded-lg border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] p-4"
        data-testid="color-prediction-all-lethal"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-[var(--role-danger-text)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--text-primary)]">No viable offspring colors</p>
            <p className="text-[var(--role-danger-text)] mt-1">
              All {data.totalCombinations} possible genotype combinations were filtered as lethal.
              Choose a different breeding pair.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-[var(--btn-glass-border)] bg-[var(--alpha-bg-midnight-20)] p-4"
      data-testid="color-prediction-chart"
    >
      <div className="flex items-center gap-2 mb-3">
        <Palette className="h-4 w-4 text-[var(--role-accent-text)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Offspring Color Forecast
        </h3>
      </div>
      <ul className="space-y-2" aria-label="Possible offspring colors with probability">
        {data.possibleColors.map((entry) => (
          <li
            key={entry.colorName}
            className="text-sm"
            data-testid={`color-prediction-row-${entry.colorName}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-primary)] font-medium">{entry.colorName}</span>
              <span className="text-[var(--alpha-cream-80)] tabular-nums">{entry.percentage}</span>
            </div>
            <div
              className="mt-1 h-2 rounded bg-[var(--alpha-bg-midnight-40)] overflow-hidden"
              role="presentation"
            >
              <div
                className="h-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]"
                style={{ width: `${Math.min(100, Math.round(entry.probability * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--alpha-text-primary-60)]">
        {data.totalCombinations} genotype combination
        {data.totalCombinations === 1 ? '' : 's'} considered · {data.lethalCombinationsFiltered}{' '}
        lethal filtered
      </p>
    </div>
  );
}
