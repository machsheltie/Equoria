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
    <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-slate-900">Training Results</h3>

      {/* Discipline */}
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-600">Discipline</p>
        <p className="text-base font-semibold text-slate-900">{result.discipline}</p>
      </div>

      {/* Score Display */}
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-600">Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{result.updatedScore}</span>
          {scoreChange !== null && (
            <span
              className={`text-lg font-semibold ${
                scoreImproved
                  ? 'text-emerald-600'
                  : scoreDeclined
                    ? 'text-amber-600'
                    : 'text-slate-500'
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
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : scoreDeclined
                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {scoreImproved && <span>✨ Score improved!</span>}
          {scoreDeclined && <span>⚠️ Score declined</span>}
          {!scoreImproved && !scoreDeclined && <span>Score unchanged</span>}
        </div>
      )}

      {/* Message */}
      {result.message && (
        <div className="mb-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {result.message}
        </div>
      )}

      {/* Next Eligible Date */}
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-600">Next Training:</p>
        <p className="text-sm text-slate-900">{formatDate(result.nextEligibleDate)}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onTrainAgain}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Train Again
        </button>
      </div>
    </div>
  );
};

export default TrainingResultsDisplay;
