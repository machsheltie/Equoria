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
    <div className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-[rgb(220,235,255)]">Training Results</h3>

      {/* Discipline */}
      <div className="mb-4">
        <p className="text-sm font-medium text-[rgb(148,163,184)]">Discipline</p>
        <p className="text-base font-semibold text-[rgb(220,235,255)]">{result.discipline}</p>
      </div>

      {/* Score Display */}
      <div className="mb-4">
        <p className="text-sm font-medium text-[rgb(148,163,184)]">Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[rgb(220,235,255)]">{result.updatedScore}</span>
          {scoreChange !== null && (
            <span
              className={`text-lg font-semibold ${
                scoreImproved
                  ? 'text-emerald-400'
                  : scoreDeclined
                    ? 'text-amber-400'
                    : 'text-[rgb(148,163,184)]'
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
              ? 'border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] text-emerald-400'
              : scoreDeclined
                ? 'border border-amber-500/30 bg-[rgba(212,168,67,0.1)] text-amber-400'
                : 'border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] text-[rgb(148,163,184)]'
          }`}
        >
          {scoreImproved && <span>✨ Score improved!</span>}
          {scoreDeclined && <span>⚠️ Score declined</span>}
          {!scoreImproved && !scoreDeclined && <span>Score unchanged</span>}
        </div>
      )}

      {/* Message */}
      {result.message && (
        <div className="mb-4 rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] px-3 py-2 text-sm text-[rgb(220,235,255)]">
          {result.message}
        </div>
      )}

      {/* Next Eligible Date */}
      <div className="mb-6">
        <p className="text-sm font-medium text-[rgb(148,163,184)]">Next Training:</p>
        <p className="text-sm text-[rgb(220,235,255)]">{formatDate(result.nextEligibleDate)}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white/90 hover:bg-white/10 transition-colors"
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
