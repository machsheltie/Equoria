/**
 * PerformanceBreakdownPanel (Equoria-gf8sj, Spec 11.3 ScoreBreakdownRadar)
 *
 * Wires the previously-dead `performanceView` state on CompetitionResultsPage
 * to a real score-breakdown view. ScoreBreakdownRadar already existed and was
 * used in breeding CompatibilityPreview, but was NOT rendered on the
 * Competition Results page even though the backend competition result
 * (competitionController scoringDetails) already returns the per-horse
 * `scoreBreakdown`.
 *
 * This panel:
 *   - fetches the REAL competition results via useCompetitionResults
 *     (same hook the modal-deep-link uses — real backend data, no fixtures)
 *   - locates the participant by horseId
 *   - feeds the backend's real scoreBreakdown components into
 *     ScoreBreakdownRadar
 *   - renders a visually-hidden, screen-reader-accessible list of the exact
 *     numeric components + final score (Spec: "values exposed to screen
 *     readers" — Recharts SVG is not SR-navigable on its own)
 *
 * States: loading, error, no-breakdown (legacy/foreign horse), populated.
 */

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import ScoreBreakdownRadar from './ScoreBreakdownRadar';
import { useCompetitionResults } from '@/hooks/api/useCompetitionResults';
import type { ScoreBreakdown } from '@/lib/api/competitionResults';

export interface PerformanceBreakdownPanelProps {
  competitionId: number;
  horseId: number;
  onClose: () => void;
}

/** Human labels for the backend scoreBreakdown component keys. */
const COMPONENT_LABELS: Record<keyof ScoreBreakdown, string> = {
  baseStatScore: 'Base Stat Score',
  traitBonus: 'Trait Bonus',
  trainingScore: 'Training Score',
  equipmentBonus: 'Equipment Bonus',
  riderBonus: 'Rider Bonus',
  healthModifier: 'Health Modifier',
  randomLuck: 'Random Luck',
};

function toRadarStats(b: ScoreBreakdown): Record<string, number> {
  return {
    'Base Stat': b.baseStatScore,
    Trait: b.traitBonus,
    Training: b.trainingScore,
    Equipment: b.equipmentBonus,
    Rider: b.riderBonus,
    Health: b.healthModifier,
    Luck: b.randomLuck,
  };
}

const PerformanceBreakdownPanel: React.FC<PerformanceBreakdownPanelProps> = ({
  competitionId,
  horseId,
  onClose,
}) => {
  const { data, isLoading, isError } = useCompetitionResults(competitionId);

  const participant = useMemo(
    () => data?.results.find((r) => r.horseId === horseId),
    [data, horseId]
  );

  return (
    <section
      data-testid="performance-breakdown-panel"
      aria-label="Performance breakdown"
      className="glass-panel-heavy rounded-2xl border border-[rgba(201,162,39,0.25)] p-5 mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[var(--gold-400)] font-[var(--font-heading)]">
          Performance Breakdown
          {participant ? ` — ${participant.horseName}` : ''}
        </h3>
        <button
          type="button"
          aria-label="Close performance breakdown"
          onClick={onClose}
          className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div
          data-testid="performance-breakdown-loading"
          className="text-sm text-[var(--text-muted)] py-8 text-center"
        >
          Loading performance data…
        </div>
      )}

      {!isLoading && isError && (
        <div
          data-testid="performance-breakdown-error"
          role="alert"
          className="text-sm text-rose-400 py-8 text-center"
        >
          Couldn&apos;t load this performance breakdown — please try again.
        </div>
      )}

      {!isLoading && !isError && participant && !participant.scoreBreakdown && (
        <div
          data-testid="performance-breakdown-empty"
          className="text-sm text-[var(--text-muted)] py-8 text-center"
        >
          No detailed score breakdown is available for this horse&apos;s entry.
        </div>
      )}

      {!isLoading && !isError && participant?.scoreBreakdown && (
        <>
          <ScoreBreakdownRadar
            stats={toRadarStats(participant.scoreBreakdown)}
            maxValue={100}
            title={`${participant.horseName} — final score ${participant.finalScore.toFixed(1)}`}
          />

          {/* Screen-reader-accessible exact values. The Recharts SVG is not
              SR-navigable, so the spec's "values exposed to screen readers"
              requirement is met by this visually-hidden description. */}
          <div data-testid="score-breakdown-sr" className="sr-only">
            <p>
              Score breakdown for {participant.horseName} in{' '}
              {data?.competitionName ?? 'this competition'}. Final Score:{' '}
              {participant.finalScore.toFixed(1)}.
            </p>
            <ul>
              {(Object.keys(COMPONENT_LABELS) as Array<keyof ScoreBreakdown>).map((key) => (
                <li key={key}>
                  {COMPONENT_LABELS[key]}: {participant.scoreBreakdown![key]}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
};

export default PerformanceBreakdownPanel;
