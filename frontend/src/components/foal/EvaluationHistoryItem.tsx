/**
 * EvaluationHistoryItem Component
 *
 * Displays evaluation summary card with milestone name, date, score,
 * traits, and expandable detailed view.
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Award } from 'lucide-react';
import type { MilestoneEvaluation } from '@/types/foal';
import { getEvaluationCategory, getEvaluationColor, formatMilestoneName } from '@/types/foal';
import EvaluationScoreDisplay from './EvaluationScoreDisplay';
import ScoreBreakdownPanel from './ScoreBreakdownPanel';

export interface EvaluationHistoryItemProps {
  evaluation: MilestoneEvaluation;
  onViewDetails?: () => void;
  defaultExpanded?: boolean;
}

/**
 * Format date for display
 */
function formatEvaluationDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * EvaluationHistoryItem Component
 */
const EvaluationHistoryItem: React.FC<EvaluationHistoryItemProps> = ({
  evaluation,
  onViewDetails,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const {
    milestone,
    score,
    traitsConfirmed,
    evaluatedAt,
    bondModifier,
    taskConsistency,
    careQuality,
  } = evaluation;

  const milestoneName = evaluation.milestoneName || formatMilestoneName(milestone);
  const category = getEvaluationCategory(score);
  const colorClasses = getEvaluationColor(score);
  const formattedScore = score > 0 ? `+${score}` : `${score}`;

  const handleToggle = () => {
    if (onViewDetails && !isExpanded) {
      onViewDetails();
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm transition-all">
      {/* Summary View (always visible) */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={handleToggle}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${milestoneName} evaluation details`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Milestone Name & Date */}
            <div className="flex items-start gap-3 mb-2">
              <Award className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">{milestoneName}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                  <Calendar className="h-3 w-3" />
                  <span>{formatEvaluationDate(evaluatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Score & Category */}
            <div className="flex items-center gap-3 mt-3">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${colorClasses}`}
              >
                <span className="text-sm font-bold">{formattedScore}</span>
                <span className="text-xs">({category})</span>
              </div>

              {/* Traits */}
              {traitsConfirmed && traitsConfirmed.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Traits:</span>
                  <div className="flex flex-wrap gap-1">
                    {traitsConfirmed.slice(0, 2).map((trait, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded"
                      >
                        {trait}
                      </span>
                    ))}
                    {traitsConfirmed.length > 2 && (
                      <span className="text-xs text-slate-500">
                        +{traitsConfirmed.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            aria-label={isExpanded ? 'Collapse details' : 'View details'}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Detailed View (expandable) */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
          {/* Score Display */}
          <EvaluationScoreDisplay score={score} size="small" showProgressBar showCategory={false} />

          {/* Score Breakdown */}
          <ScoreBreakdownPanel
            bondModifier={bondModifier}
            taskConsistency={taskConsistency}
            careQuality={careQuality}
            totalScore={score}
          />

          {/* All Traits Confirmed */}
          {traitsConfirmed && traitsConfirmed.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h5 className="text-sm font-semibold text-slate-700 mb-3">Traits Confirmed:</h5>
              <div className="flex flex-wrap gap-2">
                {traitsConfirmed.map((trait, index) => (
                  <span
                    key={index}
                    className="inline-block px-3 py-1.5 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-600 mb-1">Bond</p>
              <p
                className={`text-lg font-bold ${
                  bondModifier > 0
                    ? 'text-green-600'
                    : bondModifier < 0
                      ? 'text-red-600'
                      : 'text-slate-600'
                }`}
              >
                {bondModifier > 0 ? '+' : ''}
                {bondModifier}
              </p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-600 mb-1">Consistency</p>
              <p className="text-lg font-bold text-emerald-600">+{taskConsistency}</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-600 mb-1">Quality</p>
              <p className="text-lg font-bold text-amber-600">
                {careQuality > 0 ? '+' : ''}
                {careQuality}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationHistoryItem;
