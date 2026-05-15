/**
 * GaitsTab Component
 *
 * Displays a horse's 4 standard gait scores (walk, trot, canter, gallop)
 * plus, for gaited breeds, the named gaiting array.
 *
 * Equoria-aa6b — visual treatment mirrors ConformationTab so the existing
 * data-display pattern carries over. Uses real /api/v1/horses/:id/gaits via
 * the useHorseGaits React Query hook.
 */

import { AlertCircle } from 'lucide-react';
import { useHorseGaits } from '@/hooks/api/useGaits';

export interface GaitsTabProps {
  horseId: number;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-burnished-gold';
  if (score >= 50) return 'text-amber-300';
  return 'text-rose-300';
};

const SCORE_BAR_COLOR = (score: number) => {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-amber-500';
  if (score >= 50) return 'bg-amber-700';
  return 'bg-rose-500';
};

interface GaitRowProps {
  label: string;
  score: number;
  testId: string;
}

const GaitRow = ({ label, score, testId }: GaitRowProps) => (
  <div
    className="rounded-lg border border-[var(--glass-hover)] bg-[var(--glass-bg)] p-4"
    data-testid={testId}
  >
    <div className="flex items-baseline justify-between mb-2">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      <p
        className={`text-lg font-semibold ${SCORE_COLOR(score)}`}
        data-testid={`${testId}-score`}
      >
        {score}
        <span className="text-xs text-[var(--text-secondary)]"> / 100</span>
      </p>
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(0,0,0,0.3)]">
      <div
        className={`h-full ${SCORE_BAR_COLOR(score)}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  </div>
);

const GaitsTab = ({ horseId }: GaitsTabProps) => {
  const { data, isLoading, error, refetch } = useHorseGaits(horseId);

  if (isLoading) {
    return (
      <div
        className="w-full flex items-center justify-center py-12"
        data-testid="gaits-loading"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burnished-gold mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">Loading gait scores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-6"
        data-testid="gaits-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-300">Error loading gait scores</p>
            <p className="text-sm text-rose-400 mt-1">
              {error.message || 'Failed to fetch gait scores'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-31C.1 horses: API returns `data: null` (Equoria-0hqg policy)
  if (!data || !data.gaitScores) {
    return (
      <div
        className="w-full rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 text-center"
        data-testid="gaits-no-data"
      >
        <p className="text-sm text-[var(--text-secondary)]">
          No gait scores available for this horse.
        </p>
      </div>
    );
  }

  const { walk, trot, canter, gallop, gaiting } = data.gaitScores;

  return (
    <div className="space-y-6" data-testid="gaits-tab">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Standard Gaits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GaitRow label="Walk" score={walk} testId="gait-walk" />
          <GaitRow label="Trot" score={trot} testId="gait-trot" />
          <GaitRow label="Canter" score={canter} testId="gait-canter" />
          <GaitRow label="Gallop" score={gallop} testId="gait-gallop" />
        </div>
      </div>

      {gaiting && gaiting.length > 0 && (
        <div data-testid="gaits-gaited-section">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
            Breed-Specific Gaits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gaiting.map(entry => (
              <GaitRow
                key={entry.name}
                label={entry.name}
                score={entry.score}
                testId={`gaiting-${entry.name.toLowerCase().replace(/\s+/g, '-')}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GaitsTab;
