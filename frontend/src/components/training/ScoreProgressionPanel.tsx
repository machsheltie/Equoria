/**
 * ScoreProgressionPanel Component
 *
 * An integration component that combines ScoreRadarChart and TrainingHistoryTable,
 * fetching data with React Query for displaying horse training progression.
 *
 * Features:
 * - Radar chart showing the horse's real discipline scores (Horse.disciplineScores)
 * - Training history table with each session's recorded before/after score
 * - Loading and error states with retry functionality
 * - Responsive grid layout (desktop: 2 columns, mobile: 1 column)
 *
 * Story 4-2: Training History Display - Task 3
 */

import React from 'react';
import { useHorseTrainingHistory } from '@/hooks/api/useHorses';
import type { HorseTrainingHistoryEntry } from '@/lib/api/types';
import { DISCIPLINES } from '@/lib/utils/training-utils';
import { userMessageFor } from '@/lib/http/userMessage';
import ScoreRadarChart from './ScoreRadarChart';
import TrainingHistoryTable from './TrainingHistoryTable';
import type { TrainingHistoryEntry } from './TrainingHistoryTable';

/**
 * Props for ScoreProgressionPanel component
 */
interface ScoreProgressionPanelProps {
  /** The ID of the horse to display progression for */
  horseId: number;
  /** The horse's real Horse.disciplineScores, keyed by discipline name ('Show Jumping') */
  disciplineScores: Record<string, number>;
  /** Optional CSS class for the container */
  className?: string;
}

/**
 * Map the horse's real disciplineScores (keyed by discipline name, as the
 * backend stores them) onto the radar's discipline ids. Only real numbers are
 * passed; a discipline the horse has never trained is left to the chart.
 * Equoria-ky2ob: the radar used to be rebuilt from a `score` field the
 * training-history rows never carried, so it was always all zeros.
 */
function toRadarScores(disciplineScores: Record<string, number>): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const discipline of DISCIPLINES) {
    const value = disciplineScores?.[discipline.name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      scores[discipline.id] = value;
    }
  }
  return scores;
}

/**
 * Transform API training history entries to table format.
 * Equoria-ky2ob (owner ruling 2026-10-22): before/after are the scores
 * TrainingLog recorded for the session. Sessions logged before they were
 * recorded keep null, and a missing date stays null — never invented numbers
 * or a "now" date.
 */
function transformHistoryToTableFormat(
  history: HorseTrainingHistoryEntry[]
): TrainingHistoryEntry[] {
  return history.map((entry, index) => {
    const before = typeof entry.scoreBefore === 'number' ? entry.scoreBefore : null;
    const after = typeof entry.scoreAfter === 'number' ? entry.scoreAfter : null;
    return {
      id: entry.id ?? index + 1,
      date: entry.trainedAt ?? null,
      discipline: entry.discipline ?? 'unknown',
      previousScore: before,
      newScore: after,
      scoreGain: before !== null && after !== null ? after - before : null,
    };
  });
}

/**
 * Loading skeleton for the chart area
 */
function ChartSkeleton() {
  return (
    <div data-testid="chart-skeleton" className="animate-pulse">
      <div className="h-6 w-48 rounded bg-[var(--role-neutral-bg)]" />
      <div className="mt-4 aspect-square w-full rounded-lg bg-[var(--role-neutral-bg)]" />
    </div>
  );
}

/**
 * Loading skeleton for the table area
 */
function TableSkeleton() {
  return (
    <div data-testid="table-skeleton" className="animate-pulse">
      <div className="h-6 w-40 rounded bg-[var(--role-neutral-bg)]" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-full rounded bg-[var(--role-neutral-bg)]" />
        ))}
      </div>
    </div>
  );
}

/**
 * ScoreProgressionPanel Component
 *
 * Displays discipline score distribution and training history for a horse.
 * Combines radar chart visualization with tabular history data.
 *
 * @example
 * ```tsx
 * <ScoreProgressionPanel horseId={123} className="mt-4" />
 * ```
 */
const ScoreProgressionPanel: React.FC<ScoreProgressionPanelProps> = ({
  horseId,
  disciplineScores,
  className = '',
}) => {
  // Fetch training history using React Query hook
  const { data: trainingHistory, isLoading, error, refetch } = useHorseTrainingHistory(horseId);

  const radarScores = toRadarScores(disciplineScores);

  // Handle retry button click
  const handleRetry = () => {
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="score-progression-panel" className={`space-y-6 p-4 ${className}`}>
        <div
          data-testid="loading-container"
          role="status"
          aria-busy="true"
          aria-label="Loading training data"
          className="space-y-6"
        >
          <div data-testid="content-grid" className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <ChartSkeleton />
            </div>
            <div>
              <TableSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="score-progression-panel" className={`space-y-6 p-4 ${className}`}>
        <div
          data-testid="error-container"
          className="rounded-lg border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] p-6 text-center"
        >
          <div className="mb-2 text-[var(--role-danger-text)]">
            <svg
              className="mx-auto h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-[var(--role-danger-text)]">{userMessageFor(error).message}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 rounded-md bg-[var(--status-danger)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--status-danger)] focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Transform history data for table component
  const tableHistory = transformHistoryToTableFormat(trainingHistory ?? []);

  return (
    <div data-testid="score-progression-panel" className={`space-y-6 p-4 ${className}`}>
      {/* Main content grid - responsive 2 columns on desktop, 1 on mobile */}
      <div data-testid="content-grid" className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Section 1: Radar Chart */}
        <div className="glass-panel rounded-lg border border-[var(--glass-border)] p-4">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Discipline Distribution
          </h3>
          <ScoreRadarChart disciplineScores={radarScores} height={300} className="w-full" />
        </div>

        {/* Section 2: Training History Table */}
        <div className="glass-panel rounded-lg border border-[var(--glass-border)] p-4">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Training History
          </h3>
          <TrainingHistoryTable
            history={tableHistory}
            loading={false}
            pageSize={5}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ScoreProgressionPanel;
