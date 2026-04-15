/**
 * ScoreProgressionPanel Component
 *
 * An integration component that combines ScoreRadarChart and TrainingHistoryTable,
 * fetching data with React Query for displaying horse training progression.
 *
 * Features:
 * - Radar chart showing discipline score distribution
 * - Training history table with sorting and pagination
 * - Score caps and bonuses information section
 * - Loading and error states with retry functionality
 * - Responsive grid layout (desktop: 2 columns, mobile: 1 column)
 *
 * Story 4-2: Training History Display - Task 3
 */

import React from 'react';
import { useHorseTrainingHistory } from '@/hooks/api/useHorses';
import ScoreRadarChart from './ScoreRadarChart';
import TrainingHistoryTable from './TrainingHistoryTable';
import type { TrainingHistoryEntry } from './TrainingHistoryTable';

/**
 * Props for ScoreProgressionPanel component
 */
interface ScoreProgressionPanelProps {
  /** The ID of the horse to display progression for */
  horseId: number;
  /** Optional CSS class for the container */
  className?: string;
}

const DISCIPLINES = [
  'western-pleasure',
  'reining',
  'cutting',
  'barrel-racing',
  'roping',
  'team-penning',
  'rodeo',
  'hunter',
  'saddleseat',
  'dressage',
  'show-jumping',
  'eventing',
  'cross-country',
  'endurance',
  'vaulting',
  'polo',
  'combined-driving',
  'fine-harness',
  'gaited',
  'gymkhana',
  'racing',
  'steeplechase',
  'harness-racing',
];

function buildDisciplineScores(
  history: Array<{ discipline?: string; score?: number }>
): Record<string, number> {
  const scores = Object.fromEntries(DISCIPLINES.map((discipline) => [discipline, 0]));

  for (const entry of history) {
    if (!entry.discipline || typeof entry.score !== 'number') continue;
    scores[entry.discipline] = Math.max(scores[entry.discipline] ?? 0, entry.score);
  }

  return scores;
}

/**
 * Transform API training history entries to table format
 */
function transformHistoryToTableFormat(
  history: Array<{
    id?: number;
    discipline?: string;
    score?: number;
    trainedAt?: string;
    notes?: string;
  }>
): TrainingHistoryEntry[] {
  return history.map((entry, index) => ({
    id: entry.id ?? index + 1,
    date: entry.trainedAt ?? new Date().toISOString(),
    discipline: entry.discipline ?? 'unknown',
    previousScore: Math.max(0, (entry.score ?? 0) - 5),
    newScore: entry.score ?? 0,
    scoreGain: 5,
    traits: [],
  }));
}

/**
 * Loading skeleton for the chart area
 */
function ChartSkeleton() {
  return (
    <div data-testid="chart-skeleton" className="animate-pulse">
      <div className="h-6 w-48 rounded bg-[rgba(15,35,70,0.5)]" />
      <div className="mt-4 aspect-square w-full rounded-lg bg-[rgba(15,35,70,0.5)]" />
    </div>
  );
}

/**
 * Loading skeleton for the table area
 */
function TableSkeleton() {
  return (
    <div data-testid="table-skeleton" className="animate-pulse">
      <div className="h-6 w-40 rounded bg-[rgba(15,35,70,0.5)]" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-full rounded bg-[rgba(15,35,70,0.5)]" />
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
  className = '',
}) => {
  // Fetch training history using React Query hook
  const { data: trainingHistory, isLoading, error, refetch } = useHorseTrainingHistory(horseId);

  const disciplineScores = buildDisciplineScores(trainingHistory ?? []);

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
          className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6 text-center"
        >
          <div className="mb-2 text-red-400">
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
          <p className="text-red-400">{error.message}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
        <div className="glass-panel rounded-lg border border-[rgba(37,99,235,0.2)] p-4">
          <h3 className="mb-4 text-lg font-semibold text-[rgb(220,235,255)]">
            Discipline Distribution
          </h3>
          <ScoreRadarChart disciplineScores={disciplineScores} height={300} className="w-full" />
        </div>

        {/* Section 2: Training History Table */}
        <div className="glass-panel rounded-lg border border-[rgba(37,99,235,0.2)] p-4">
          <h3 className="mb-4 text-lg font-semibold text-[rgb(220,235,255)]">Training History</h3>
          <TrainingHistoryTable
            history={tableHistory}
            loading={false}
            pageSize={5}
            className="w-full"
          />
        </div>
      </div>

      {/* Section 3: Score Caps & Bonuses Info */}
      <div
        data-testid="score-caps-section"
        className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4"
      >
        <h3 className="mb-3 text-lg font-semibold text-[rgb(220,235,255)]">
          {'\uD83D\uDCCA'} Score Caps & Bonuses
        </h3>
        <ul className="space-y-2 text-sm text-[rgb(220,235,255)]">
          <li className="flex items-start">
            <span className="mr-2 text-[rgb(148,163,184)]">{'•'}</span>
            <span>Base score cap: 100 per discipline</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-[rgb(148,163,184)]">{'•'}</span>
            <span>Trait bonuses can add +10-20</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-[rgb(148,163,184)]">{'•'}</span>
            <span>Groom bonuses can add +5-15</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ScoreProgressionPanel;
