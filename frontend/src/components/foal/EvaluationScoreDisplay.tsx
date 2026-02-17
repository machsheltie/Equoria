/**
 * EvaluationScoreDisplay Component
 *
 * Displays overall milestone evaluation score with visual progress bar,
 * color coding, and category label (Excellent/Good/Neutral/Poor/Bad).
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React from 'react';
import { Award } from 'lucide-react';
import {
  getEvaluationCategory,
  getEvaluationColor,
  getScoreProgressPercentage,
  type EvaluationCategory,
} from '@/types/foal';

export interface EvaluationScoreDisplayProps {
  score: number; // -10 to +10
  size?: 'small' | 'medium' | 'large';
  showProgressBar?: boolean;
  showCategory?: boolean;
}

/**
 * Get category icon color
 */
function getCategoryIconColor(category: EvaluationCategory): string {
  switch (category) {
    case 'Excellent':
    case 'Good':
      return 'text-green-600';
    case 'Neutral':
      return 'text-yellow-600';
    case 'Poor':
    case 'Bad':
      return 'text-red-600';
  }
}

/**
 * Get progress bar gradient based on score
 */
function getProgressBarGradient(score: number): string {
  if (score >= 3) return 'from-green-500 to-green-600';
  if (score >= 0) return 'from-yellow-500 to-yellow-600';
  return 'from-red-500 to-red-600';
}

/**
 * Get size classes
 */
function getSizeClasses(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        score: 'text-3xl',
        label: 'text-xs',
        icon: 'h-5 w-5',
        progressHeight: 'h-2',
      };
    case 'medium':
      return {
        score: 'text-4xl',
        label: 'text-sm',
        icon: 'h-6 w-6',
        progressHeight: 'h-3',
      };
    case 'large':
      return {
        score: 'text-5xl',
        label: 'text-base',
        icon: 'h-8 w-8',
        progressHeight: 'h-4',
      };
  }
}

/**
 * EvaluationScoreDisplay Component
 */
const EvaluationScoreDisplay: React.FC<EvaluationScoreDisplayProps> = ({
  score,
  size = 'medium',
  showProgressBar = true,
  showCategory = true,
}) => {
  const category = getEvaluationCategory(score);
  const colorClasses = getEvaluationColor(score);
  const progressPercentage = getScoreProgressPercentage(score);
  const iconColor = getCategoryIconColor(category);
  const progressGradient = getProgressBarGradient(score);
  const sizeClasses = getSizeClasses(size);

  // Format score with + or - prefix
  const formattedScore = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className={`rounded-lg border p-6 ${colorClasses.split(' ').slice(1).join(' ')}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className={`${sizeClasses.icon} ${iconColor}`} />
          <span className={`font-semibold ${colorClasses.split(' ')[0]}`}>Overall Score</span>
        </div>
        {showCategory && (
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full ${colorClasses}`}
          >
            {category}
          </span>
        )}
      </div>

      {/* Score Display */}
      <div className="text-center mb-4">
        <div className={`${sizeClasses.score} font-bold ${colorClasses.split(' ')[0]}`}>
          {formattedScore}
        </div>
        <div className={`${sizeClasses.label} text-slate-600 mt-1`}>out of ±10</div>
      </div>

      {/* Progress Bar */}
      {showProgressBar && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>-10</span>
            <span>0</span>
            <span>+10</span>
          </div>
          <div
            className={`w-full bg-slate-200 rounded-full ${sizeClasses.progressHeight} overflow-hidden`}
          >
            <div
              className={`h-full bg-gradient-to-r ${progressGradient} transition-all duration-500 ease-out`}
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={score}
              aria-valuemin={-10}
              aria-valuemax={10}
              aria-label={`Evaluation score: ${formattedScore}`}
            />
          </div>

          {/* Score markers */}
          <div className="relative h-4">
            {/* Center marker (0) */}
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-slate-400 -translate-x-1/2" />
            {/* Good threshold marker (+3) */}
            <div
              className="absolute left-[65%] top-0 w-0.5 h-2 bg-green-400"
              title="Good threshold (+3)"
            />
            {/* Poor threshold marker (-3) */}
            <div
              className="absolute left-[35%] top-0 w-0.5 h-2 bg-red-400"
              title="Poor threshold (-3)"
            />
          </div>
        </div>
      )}

      {/* Score interpretation */}
      <div
        className={`mt-4 text-center ${sizeClasses.label} ${colorClasses.split(' ')[0]} font-medium`}
      >
        {category === 'Excellent' && '🌟 Outstanding development!'}
        {category === 'Good' && '✨ Positive development'}
        {category === 'Neutral' && '📊 Average development'}
        {category === 'Poor' && '⚠️ Needs improvement'}
        {category === 'Bad' && '❌ Significant improvement needed'}
      </div>
    </div>
  );
};

export default EvaluationScoreDisplay;
