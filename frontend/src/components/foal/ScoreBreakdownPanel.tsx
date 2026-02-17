/**
 * ScoreBreakdownPanel Component
 *
 * Displays detailed scoring breakdown showing bond modifier,
 * task consistency, and care quality with visual representations
 * and explanations.
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React from 'react';
import { Heart, CheckSquare, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ScoreBreakdownPanelProps {
  bondModifier: number; // -2 to +2
  taskConsistency: number; // 0 to +3
  careQuality: number; // groom bonuses
  totalScore: number; // -10 to +10
}

/**
 * Get component value color
 */
function getComponentColor(value: number, isModifier: boolean = false): string {
  if (isModifier) {
    // For bond modifier: green if positive, red if negative, yellow if 0
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-yellow-600';
  } else {
    // For other components: green if high, yellow if medium, gray if low
    if (value >= 2) return 'text-green-600';
    if (value >= 1) return 'text-yellow-600';
    return 'text-slate-600';
  }
}

/**
 * Get progress bar color
 */
function getProgressBarColor(value: number, max: number): string {
  const percentage = (value / max) * 100;
  if (percentage >= 75) return 'bg-green-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

/**
 * Get icon for value trend
 */
function getTrendIcon(value: number) {
  if (value > 0) return TrendingUp;
  if (value < 0) return TrendingDown;
  return Minus;
}

/**
 * Get bond modifier explanation
 */
function getBondExplanation(value: number): string {
  if (value >= 2) return 'Excellent bond with groom - strong trust established';
  if (value >= 1) return 'Good bond with groom - positive relationship forming';
  if (value === 0) return 'Average bond with groom - room for improvement';
  if (value >= -1) return 'Weak bond with groom - needs more attention';
  return 'Poor bond with groom - significant trust issues';
}

/**
 * Get task consistency explanation
 */
function getTaskExplanation(value: number, days: number = 7): string {
  if (value >= 3) return `Perfect care consistency - all ${days} days`;
  if (value >= 2) return `Strong care consistency - most days covered`;
  if (value >= 1) return `Moderate care consistency - some gaps present`;
  return 'Weak care consistency - many missed days';
}

/**
 * Get care quality explanation
 */
function getCareExplanation(value: number): string {
  if (value >= 3) return 'Exceptional groom bonuses - premium care provided';
  if (value >= 2) return 'Strong groom bonuses - high-quality care';
  if (value >= 1) return 'Moderate groom bonuses - standard care';
  if (value > 0) return 'Minimal groom bonuses - basic care';
  return 'No special groom bonuses';
}

/**
 * ScoreBreakdownPanel Component
 */
const ScoreBreakdownPanel: React.FC<ScoreBreakdownPanelProps> = ({
  bondModifier,
  taskConsistency,
  careQuality,
  totalScore,
}) => {
  const BondTrendIcon = getTrendIcon(bondModifier);
  const TaskTrendIcon = getTrendIcon(taskConsistency);
  const CareTrendIcon = getTrendIcon(careQuality);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-bold text-slate-900">Score Breakdown</h3>
      </div>

      <div className="space-y-6">
        {/* Bond Modifier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Bond Modifier</span>
            </div>
            <div className="flex items-center gap-2">
              <BondTrendIcon className={`h-4 w-4 ${getComponentColor(bondModifier, true)}`} />
              <span className={`text-lg font-bold ${getComponentColor(bondModifier, true)}`}>
                {bondModifier > 0 ? '+' : ''}
                {bondModifier}
              </span>
            </div>
          </div>

          {/* Progress bar for bond modifier (-2 to +2) */}
          <div className="relative mb-2">
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  bondModifier >= 0 ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.abs(bondModifier) * 50}%`,
                  marginLeft: bondModifier < 0 ? '0%' : '0%',
                }}
              />
            </div>
            {/* Center line */}
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-slate-400 -translate-x-1/2" />
          </div>

          <p className="text-xs text-slate-600">{getBondExplanation(bondModifier)}</p>
        </div>

        {/* Task Consistency */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">Task Consistency</span>
            </div>
            <div className="flex items-center gap-2">
              <TaskTrendIcon className={`h-4 w-4 ${getComponentColor(taskConsistency)}`} />
              <span className={`text-lg font-bold ${getComponentColor(taskConsistency)}`}>
                +{taskConsistency}
              </span>
            </div>
          </div>

          {/* Progress bar (0 to 3) */}
          <div className="mb-2">
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full ${getProgressBarColor(taskConsistency, 3)} transition-all duration-500`}
                style={{ width: `${(taskConsistency / 3) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-600">{getTaskExplanation(taskConsistency)}</p>
        </div>

        {/* Care Quality */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-semibold text-slate-700">Care Quality</span>
            </div>
            <div className="flex items-center gap-2">
              <CareTrendIcon className={`h-4 w-4 ${getComponentColor(careQuality)}`} />
              <span className={`text-lg font-bold ${getComponentColor(careQuality)}`}>
                {careQuality > 0 ? '+' : ''}
                {careQuality}
              </span>
            </div>
          </div>

          {/* Progress bar (variable max, but typically 0-5) */}
          <div className="mb-2">
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full ${getProgressBarColor(careQuality, 5)} transition-all duration-500`}
                style={{ width: `${Math.min(100, (careQuality / 5) * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-600">{getCareExplanation(careQuality)}</p>
        </div>

        {/* Total Calculation */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Total Score</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">
                {bondModifier > 0 ? '+' : ''}
                {bondModifier} + {taskConsistency} + {careQuality > 0 ? '+' : ''}
                {careQuality}
              </div>
              <span
                className={`text-xl font-bold ${
                  totalScore >= 3
                    ? 'text-green-600'
                    : totalScore >= 0
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`}
              >
                = {totalScore > 0 ? '+' : ''}
                {totalScore}
              </span>
            </div>
          </div>
        </div>

        {/* Key factors summary */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Key Factors:</p>
          <div className="space-y-1 text-xs text-slate-600">
            {bondModifier > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Strong bond with groom helped score</span>
              </div>
            )}
            {bondModifier < 0 && (
              <div className="flex items-center gap-2">
                <span className="text-red-600">✗</span>
                <span>Weak bond with groom hurt score</span>
              </div>
            )}
            {taskConsistency >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Consistent care routine helped score</span>
              </div>
            )}
            {taskConsistency < 2 && (
              <div className="flex items-center gap-2">
                <span className="text-amber-600">!</span>
                <span>More consistent care would improve results</span>
              </div>
            )}
            {careQuality > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Groom bonuses provided extra benefits</span>
              </div>
            )}
            {careQuality === 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">○</span>
                <span>No special groom bonuses this milestone</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBreakdownPanel;
