import React from 'react';
import type { TrainingResult } from '@/lib/api-client';

interface TrainingResultsDisplayProps {
  result: TrainingResult;
  previousScore?: number;
  onClose: () => void;
  onTrainAgain: () => void;
}

const TrainingResultsDisplay: React.FC<TrainingResultsDisplayProps> = ({
  result,
  previousScore,
  onClose,
  onTrainAgain,
}) => {
  // Calculate score change
  const scoreChange = previousScore !== undefined ? result.updatedScore - previousScore : null;

  // Determine if score improved, declined, or stayed same
  const scoreImproved = scoreChange !== null && scoreChange > 0;
  const scoreDeclined = scoreChange !== null && scoreChange < 0;

  // Format score change with + or - prefix
  const formatScoreChange = (change: number | null): string | null => {
    if (change === null) return null;
    if (change > 0) return `+${change}`;
    if (change < 0) return `${change}`;
    return '0';
  };

  // Format next eligible date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Training Results</h3>

      {/* Discipline */}
      <div className="mb-4">
        <p className="text-sm font-medium text-role-secondary">Discipline</p>
        <p className="text-base font-semibold text-[var(--text-primary)]">{result.discipline}</p>
      </div>

      {/* Score Display */}
      <div className="mb-4">
        <p className="text-sm font-medium text-role-secondary">Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)]">
            {result.updatedScore}
          </span>
          {scoreChange !== null && (
            <span
              className={`text-lg font-semibold ${
                scoreImproved
                  ? 'text-[var(--role-success-text)]'
                  : scoreDeclined
                    ? 'text-[var(--role-warning-text)]'
                    : 'text-role-secondary'
              }`}
            >
              ({formatScoreChange(scoreChange)})
            </span>
          )}
        </div>
      </div>

      {/* Success/Warning Indicator */}
      {scoreChange !== null && (
        <div
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            scoreImproved
              ? 'border border-[var(--role-success-border)] bg-[var(--role-success-bg)] text-[var(--role-success-text)]'
              : scoreDeclined
                ? 'border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]'
                : 'border border-[var(--role-neutral-border)] bg-[var(--role-neutral-bg)] text-role-secondary'
          }`}
        >
          {scoreImproved && <span>✨ Score improved!</span>}
          {scoreDeclined && <span>⚠️ Score declined</span>}
          {!scoreImproved && !scoreDeclined && <span>Score unchanged</span>}
        </div>
      )}

      {/* Message */}
      {result.message && (
        <div className="mb-4 rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
          {result.message}
        </div>
      )}

      {/* Next Eligible Date */}
      <div className="mb-6">
        <p className="text-sm font-medium text-role-secondary">Next Training:</p>
        <p className="text-sm text-[var(--text-primary)]">{formatDate(result.nextEligibleDate)}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-role-secondary hover:text-[var(--text-primary)] hover:border-[var(--btn-secondary-border-hover)] hover:bg-[var(--btn-secondary-bg-hover)] transition-colors"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onTrainAgain}
          className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)]"
          style={{
            background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
            color: 'var(--bg-deep-space)',
          }}
        >
          Train Again
        </button>
      </div>
    </div>
  );
};

export default TrainingResultsDisplay;
